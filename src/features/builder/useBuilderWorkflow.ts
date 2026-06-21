import { useCallback, useState, useMemo, useRef, useEffect } from 'react';
import { logger } from '../../utils/logger';
import { 
  useNodesState, 
  useEdgesState, 
  type Node, 
  type Edge, 
  type Connection,
  type XYPosition
} from '@xyflow/react';
import { 
  type ProcessingType, 
  type BuilderNodeData, 
  type DataPacket, 
  type NodeLineage,
  type NodeType,
  type NodeState,
  type WorkflowStats,
  type BuilderNode,
  sanitizeEdges
} from './types';
import { replicateService, type ReplicateImageModel, type ReplicateUpscaleModel } from '../../services/replicate';
import { UpscalerFactory } from '../../services/upscalers/UpscalerFactory';
import { useAIConfigStore } from '../../stores/aiConfigStore';
import { useBuilderQueueStore } from '../../stores/builderQueueStore';
import { watermarkService } from '../../services/watermark/WatermarkService';
import { addHistoryEntry, cacheLocalImage, getLocalImage, deleteLocalImage, revokeObjectUrl } from '../../services/history/HistoryService';
import type { NodeTreeData } from '../../types/history';
import { invoke } from '@tauri-apps/api/core';
import { STORAGE_KEYS } from '../../utils/storageKeys';
import { track } from '../../services/tracking/trackingService';
import { useAuth } from '../auth/AuthContext';

// Silent auto-save key — accepts optional tabId suffix for multi-tab isolation
const getAutosaveKey = (tabId?: string) =>
  tabId ? `${STORAGE_KEYS.BUILDER_AUTOSAVE}_${tabId}` : STORAGE_KEYS.BUILDER_AUTOSAVE;

// ── Upload helper: converts local/data-URI images ─────────────────────────────
// Nano Banana models accept base64 data URIs directly (best quality, no expiry)
// Other models (FLUX, GPT, etc.) need public URLs via upload service
async function uploadImageIfLocal(url: string, _model?: string): Promise<string> {
  if (!url) return url;
  // Public HTTPS URL (not localhost) - safe to use directly
  if (url.startsWith('https://')) return url;
  // Already a data URI — upload to Replicate Files API to get a serving URL
  // This is more reliable than sending huge base64 inline in JSON body
  if (url.startsWith('data:')) {
    try {
      const { replicateService } = await import('../../services/replicate');
      return await replicateService.uploadToReplicate(url);
    } catch {
      return url; // fallback: send data URI inline (works for small images)
    }
  }
  // localhost / blob URLs are not reachable by Replicate — convert to base64 first, then upload
  if (url.startsWith('http://') || url.startsWith('blob:')) {
    try {
      const b64: string = await invoke('url_to_base64', { url });
      if (b64?.startsWith('data:')) {
        try {
          const { replicateService } = await import('../../services/replicate');
          return await replicateService.uploadToReplicate(b64);
        } catch {
          return b64; // fallback: send data URI inline
        }
      }
    } catch { /* fall through */ }
    return url;
  }
  return url;
}

async function persistImageLocally(url: string): Promise<string> {
  if (!url || url.startsWith('data:') || url.startsWith('blob:')) return url;

  // Try Tauri Rust command first (bypasses CORS)
  try {
    const base64Data: string = await invoke('url_to_base64', { url });
    if (base64Data?.startsWith('data:')) return base64Data;
  } catch {
    // Tauri unavailable — fall through to browser fetch
  }

  // Browser fallback: fetch image and convert to base64
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    // Cannot convert — return original URL as last resort
  }

  return url;
}

async function resolveImageIfCached(url: string | undefined): Promise<string | undefined> {
  if (url && url.startsWith('idb://')) {
    const cached = await getLocalImage(url);
    if (cached) return cached;
  }
  return url;
}

// AI generation config passed to executeNode
export interface GenerationConfig {
  model: ReplicateImageModel | ReplicateUpscaleModel;
  resolution?: string;
  aspectRatio?: string;
  steps?: number;
  cfg?: number;
  seed?: number | null;
  strength?: number;
  referenceStrength?: number;
  disableSafetyChecker?: boolean;
  upscaleFactor?: number;
  negativePrompt?: string;
  // Watermark settings
  enableWatermark?: boolean;
  watermarkText?: string;
  watermarkPosition?: import('../../stores/aiConfigStore').WatermarkPosition;
  watermarkOpacity?: number;
  watermarkFontSize?: number;
  // Topaz Labs settings
  enhanceModel?: string;
  topazUpscaleFactor?: string;
  topazSubjectDetection?: string;
  faceEnhancement?: boolean;
  faceEnhancementCreativity?: number;
  faceEnhancementStrength?: number;
  // Clarity Upscaler settings
  clarityScale?: number;
  clarityDynamic?: number;
  clarityCreativity?: number;
  clarityResemblance?: number;
  clarityTilingWidth?: number;
  clarityTilingHeight?: number;
  claritySdModel?: string;
  clarityScheduler?: string;
  claritySteps?: number;
  claritySeed?: number | null;
  clarityDownscaling?: boolean;
  clarityDownscalingRes?: number;
  claritySharpen?: number;
  clarityHandfix?: string;
  clarityOutputFormat?: string;
  // Pruna AI settings
  prunaMode?: 'target' | 'factor';
  prunaTarget?: number;
  prunaFactor?: number;
  prunaEnhanceDetails?: boolean;
  prunaEnhanceRealism?: boolean;
  prunaQuality?: number;
  prunaOutputFormat?: string;
}

// Re-export types for backward compatibility
export type { ProcessingType, BuilderNodeData, DataPacket, NodeLineage, NodeType, NodeState, WorkflowStats };

// ============================================================================
// CONSTANTS
// ============================================================================

const HORIZONTAL_SPACING = 380;
const VERTICAL_SPACING = 480;

// Type labels for UI
const TYPE_LABELS: Record<ProcessingType, string> = {
  source: 'Source',
  render: 'AI Render',
  detail: 'Detail Edit',
  upscale: 'Upscale',
  people: 'Add People',
  daynight: 'Day to Night',
  lighting: 'Lighting',
  material: 'Materials',
  local: 'Local Edit',
  variation: 'Variation'
};

// ============================================================================
// DATA PACKET UTILITIES
// ============================================================================

const createDataPacket = (
  image: string | undefined,
  prompt: string | undefined,
  operationType: ProcessingType,
  dimensions?: { width: number; height: number }
): DataPacket => ({
  image,
  prompt,
  metadata: {
    timestamp: Date.now(),
    operationType,
    format: 'png',
    width: dimensions?.width,
    height: dimensions?.height
  },
  dimensions
});

// ============================================================================
// EDGE FACTORY - Data carrying edges
// ============================================================================

interface EdgeOptions {
  animated?: boolean;
  isDataFlow?: boolean;
  packet?: DataPacket;
  targetHandleIndex?: number; // For multi-input nodes (ghost-target-0, ghost-target-1, etc.)
}

const createEdge = (
  sourceId: string, 
  targetId: string, 
  options: EdgeOptions = {}
): Edge => {
  const { animated = false, packet, targetHandleIndex = 0 } = options;
  
  return {
    id: `e-${sourceId}-${targetId}-${targetHandleIndex}`,
    source: sourceId,
    target: targetId,
    sourceHandle: 'source', // Explicit source handle for proper positioning
    targetHandle: `ghost-target-${targetHandleIndex}`, // Dynamic handle for multi-input
    type: 'default', // Bezier curves for smooth flowing lines
    animated,
    label: null, // No label on edge - must be null not undefined
    style: { 
      strokeWidth: 2,
      stroke: '#e11d48', // Brand red
      opacity: 0.8,
      strokeDasharray: '5 5', // Dashed line
      strokeLinecap: 'round'
    },
    data: {
      packet,
      isActive: !!packet,
      lastUpdate: Date.now()
    }
  };
};

// ============================================================================
// MAIN HOOK - AI Processing Graph Engine
// ============================================================================

// Validate workflow schema to prevent crashes from corrupted localStorage data
function validateWorkflowData(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  if (!Array.isArray(data.nodes)) return false;
  for (const node of data.nodes) {
    if (!node || typeof node !== 'object') return false;
    if (typeof node.id !== 'string' || !node.id) return false;
    if (typeof node.type !== 'string') return false;
    if (!node.position || typeof node.position !== 'object') return false;
    if (typeof node.position.x !== 'number' || typeof node.position.y !== 'number') return false;
    if (!node.data || typeof node.data !== 'object') return false;
  }
  if (data.edges && !Array.isArray(data.edges)) return false;
  return true;
}

// Snapshot type for undo/redo
interface HistorySnapshot { nodes: BuilderNode[]; edges: Edge[]; }

const MAX_HISTORY = 50;

export const useBuilderWorkflow = (tabId?: string, hasInitialState = false) => {
  const { user } = useAuth();
  const [nodes, setNodesInternal, onNodesChange] = useNodesState<BuilderNode>([]);
  const [edges, setEdgesInternal, onEdgesChange] = useEdgesState<Edge>([]);
  
  // Refs to track current state for callbacks without circular deps
  const nodesRef = useRef<BuilderNode[]>(nodes);
  const edgesRef = useRef<Edge[]>(edges);

  const setNodes = useCallback((update: BuilderNode[] | ((curr: BuilderNode[]) => BuilderNode[])) => {
    setNodesInternal(curr => {
      const next = typeof update === 'function' ? update(curr) : update;
      nodesRef.current = next;
      return next;
    });
  }, [setNodesInternal]);

  const setEdges = useCallback((update: Edge[] | ((curr: Edge[]) => Edge[])) => {
    setEdgesInternal(curr => {
      const next = typeof update === 'function' ? update(curr) : update;
      edgesRef.current = next;
      return next;
    });
  }, [setEdgesInternal]);

  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const abortControllers = useRef<Map<string, AbortController>>(new Map());
  const [isRestored, setIsRestored] = useState(false);

  useEffect(() => {
    const controllers = abortControllers.current;
    return () => {
      // Abort all active generators when this workflow hook unmounts
      controllers.forEach(ctrl => ctrl.abort());
    };
  }, []);

  // ── Undo/Redo history ──────────────────────────────────────────────────────
  const past   = useRef<HistorySnapshot[]>([]);
  const future = useRef<HistorySnapshot[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const syncUndoRedoState = useCallback(() => {
    setCanUndo(past.current.length > 0);
    setCanRedo(future.current.length > 0);
  }, []);

  // Call before any structural change (add/delete node, execute)
  const pushHistory = useCallback((currentNodes: BuilderNode[], currentEdges: Edge[]) => {
    past.current = [...past.current.slice(-MAX_HISTORY + 1), { nodes: currentNodes, edges: currentEdges }];
    future.current = []; // clear redo stack on new action
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const undo = useCallback(() => {
    if (past.current.length === 0) return;
    const snapshot = past.current[past.current.length - 1];
    past.current = past.current.slice(0, -1);
    future.current = [{ nodes, edges }, ...future.current.slice(0, MAX_HISTORY - 1)];
    setNodes(snapshot.nodes);
    setEdges(snapshot.edges);
    syncUndoRedoState();
  }, [nodes, edges, setNodes, setEdges, syncUndoRedoState]);

  const redo = useCallback(() => {
    if (future.current.length === 0) return;
    const snapshot = future.current[0];
    future.current = future.current.slice(1);
    past.current = [...past.current.slice(-MAX_HISTORY + 1), { nodes, edges }];
    setNodes(snapshot.nodes);
    setEdges(snapshot.edges);
    syncUndoRedoState();
  }, [nodes, edges, setNodes, setEdges, syncUndoRedoState]);

  // ========================================================================
  // SILENT AUTO-SAVE: Restore from localStorage on mount (no console logs)
  // ========================================================================
  useEffect(() => {
    if (isRestored) return;
    
    try {
      const key = getAutosaveKey(tabId);
      
      // Clear autosave if the page was explicitly reloaded/refreshed (e.g., F5)
      let isReload = false;
      try {
        const navs = performance.getEntriesByType('navigation');
        if (navs.length > 0) {
          isReload = (navs[0] as PerformanceNavigationTiming).type === 'reload';
        } else {
          isReload = performance.navigation.type === performance.navigation.TYPE_RELOAD;
        }
      } catch {}
      
      if (isReload) {
        localStorage.removeItem(key);
      }
      
      const saved = localStorage.getItem(key);
      if (saved) {
        const data = JSON.parse(saved);
        if (validateWorkflowData(data) && data.nodes.length > 0) {
          // Clean up stuck connecting/processing/queued states on load since the session was interrupted
          const cleanedNodes = data.nodes.map((n: any) => {
            if (n.data?.type === 'ghost' && (n.data.state === 'connecting' || n.data.state === 'processing' || n.data.state === 'queued')) {
              return {
                ...n,
                data: { 
                  ...n.data, 
                  state: 'failed', 
                  errorMessage: 'Session interrupted. Please retry generation.' 
                }
              };
            }
            return n;
          });
          setNodes(cleanedNodes);
          setEdges(sanitizeEdges(cleanedNodes, data.edges || []));
          // Delay isRestored so BuilderPage sees the restored nodes before checking
          const timerId = setTimeout(() => setIsRestored(true), 20);
          return () => clearTimeout(timerId);
        }
      }
    } catch {
      // Silent fail - no console output
    }
    
    // If no saved nodes, initialize with a default source node
    const sourceNodeId = `source-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const defaultSourceNode: BuilderNode = {
      id: sourceNodeId,
      type: 'baseNode',
      position: { x: 200, y: 200 },
      width: 260,
      data: {
        label: 'Source',
        type: 'source',
        processingType: 'source',
        state: 'idle',
        image: undefined,
        createdAt: Date.now(),
        lineage: {
          parentId: null,
          rootSourceId: sourceNodeId,
          generation: 0,
          branchIndex: 0,
          processingType: 'source',
          ancestry: []
        },
        inputData: undefined,
        outputData: undefined,
        config: {}
      } as BuilderNodeData
    };
    if (hasInitialState) {
      setIsRestored(true);
      return;
    }
    setNodes([defaultSourceNode]);
    setIsRestored(true);
  }, [isRestored, tabId, setNodes, setEdges, hasInitialState]);

  // ========================================================================
  // SILENT AUTO-SAVE: Save to localStorage whenever nodes/edges change
  // ========================================================================
  useEffect(() => {
    if (!isRestored) return;
    
    const timeoutId = setTimeout(() => {
      try {
        const key = getAutosaveKey(tabId);
        const saved = localStorage.getItem(key);
        const previous = saved ? JSON.parse(saved) : {};
        const data = { ...previous, nodes, edges };
        localStorage.setItem(key, JSON.stringify(data));
      } catch {
        // Silent fail - no console output
      }
    }, 2000); // Debounce 2 seconds
    
    return () => clearTimeout(timeoutId);
  }, [nodes, edges, isRestored, tabId]);

  // ========================================================================
  // AUTO CLEANUP & SANITIZATION OF EDGES
  // ========================================================================
  // Performance optimization: Only sanitize edges on structural changes (node count, node types, edge count)
  // to avoid heavy computations and edge flickering during node dragging.
  const nodeStructureKey = useMemo(() => {
    return `${nodes.length}-${nodes.map(n => `${n.id}:${n.data?.type}`).join(',')}`;
  }, [nodes]);

  const edgeStructureKey = useMemo(() => {
    return `${edges.length}-${edges.map(e => `${e.id}:${e.targetHandle}`).join(',')}`;
  }, [edges]);

  useEffect(() => {
    if (!isRestored) return;
    const sanitized = sanitizeEdges(nodesRef.current, edgesRef.current);
    
    // Check if there are actual changes to avoid infinite loop
    const hasChanges = sanitized.length !== edgesRef.current.length || sanitized.some((e, i) => {
      const orig = edgesRef.current[i];
      return !orig || e.id !== orig.id || e.targetHandle !== orig.targetHandle;
    });

    if (hasChanges) {
      setEdges(sanitized);
    }
  }, [nodeStructureKey, edgeStructureKey, isRestored, setEdges]);


  // ========================================================================
  // UTILITY FUNCTIONS
  // ========================================================================

  const getNode = useCallback((nodeId: string): BuilderNode | undefined => {
    return nodesRef.current.find(n => n.id === nodeId);
  }, []);

  const getNodeData = useCallback((nodeId: string): BuilderNodeData | undefined => {
    const node = getNode(nodeId);
    return node?.data;
  }, [getNode]);

  const getChildren = useCallback((nodeId: string): BuilderNode[] => {
    return nodesRef.current.filter(n => {
      const edge = edgesRef.current.find(e => e.target === n.id && e.source === nodeId);
      return !!edge;
    });
  }, []);

  const getParent = useCallback((nodeId: string): BuilderNode | undefined => {
    const edge = edgesRef.current.find(e => e.target === nodeId);
    return edge ? nodesRef.current.find(n => n.id === edge.source) : undefined;
  }, []);

  // Get ALL parents for multi-input aggregation (e.g., ghost nodes)
  const getAllParents = useCallback((nodeId: string): BuilderNode[] => {
    const parentEdges = edgesRef.current.filter(e => e.target === nodeId);
    return parentEdges
      .map(e => nodesRef.current.find(n => n.id === e.source))
      .filter((n): n is BuilderNode => !!n);
  }, []);

  // ========================================================================
  // POSITION CALCULATION - Auto layout
  // ========================================================================

  const calculateChildPosition = useCallback((parentId: string): XYPosition => {
    const parent = getNode(parentId);
    if (!parent) return { x: 80, y: 280 };

    const siblings = getChildren(parentId);
    const siblingCount = siblings.length;
    
    const direction = siblingCount % 2 === 0 ? 1 : -1;
    const offsetMultiplier = Math.ceil(siblingCount / 2);
    const yOffset = direction * offsetMultiplier * VERTICAL_SPACING;
    
    return {
      x: parent.position.x + HORIZONTAL_SPACING,
      y: parent.position.y + yOffset
    };
  }, [getNode, getChildren]);

  // ========================================================================
  // DATA FLOW PROPAGATION - Reactive updates
  // ========================================================================

  const propagateNodeUpdate = useCallback((nodeId: string): void => {
    const node = getNode(nodeId);
    if (!node) return;

    const nodeData = node.data as BuilderNodeData;
    const children = getChildren(nodeId);

    // Create output packet from this node
    const outputPacket = createDataPacket(
      nodeData.image,
      nodeData.prompt,
      nodeData.processingType
    );

    // Update this node's output data
    setNodes(nds => nds.map(n => 
      n.id === nodeId 
        ? { ...n, data: { ...n.data, outputData: outputPacket } }
        : n
    ));

    // Propagate to all children — single batch update for nodes and edges
    const childIds = new Set(children.map(c => c.id));
    const edgeTimestamp = Date.now();

    setNodes(nds => nds.map(n => {
      if (!childIds.has(n.id)) return n;
      const childData = n.data as BuilderNodeData;
      return {
        ...n,
        data: {
          ...childData,
          inputData: outputPacket,
          image: childData.type === 'ghost' ? outputPacket.image : childData.image,
        }
      };
    }));

    setEdges(eds => eds.map(e => {
      if (!childIds.has(e.target) || e.source !== nodeId) return e;
      return { ...e, data: { ...e.data, packet: outputPacket, isActive: true, lastUpdate: edgeTimestamp } };
    }));
  }, [getNode, getChildren, setNodes, setEdges]);

  const findDownstreamNodes = useCallback((nodeId: string): string[] => {
    const downstream: string[] = [];
    const visited = new Set<string>();
    
    const traverse = (currentId: string) => {
      if (visited.has(currentId)) return;
      visited.add(currentId);
      
      const children = getChildren(currentId);
      children.forEach(child => {
        downstream.push(child.id);
        traverse(child.id);
      });
    };
    
    traverse(nodeId);
    return downstream;
  }, [getChildren]);

  // ========================================================================
  // NODE LIFECYCLE - Source → Ghost → Result
  // ========================================================================

  const createSourceNode = useCallback((imageUrl?: string, label?: string, position?: { x: number; y: number }): string => {
    const id = `source-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    
    let finalImageRef = imageUrl;
    if (imageUrl && imageUrl.startsWith('data:')) {
      const imageKey = `idb://${crypto.randomUUID()}`;
      cacheLocalImage(imageKey, imageUrl).catch(err => {
        logger.error('[useBuilderWorkflow] Failed to cache source image:', err);
      });
      finalImageRef = imageKey;
    }

    const lineage: NodeLineage = {
      parentId: null,
      rootSourceId: id,
      generation: 0,
      branchIndex: 0,
      processingType: 'source',
      ancestry: []
    };

    const packet = finalImageRef ? createDataPacket(finalImageRef, undefined, 'source') : undefined;

    const newNode: BuilderNode = {
      id,
      type: 'baseNode',
      position: position ?? { x: 200, y: 200 },
      width: 260,
      data: {
        label: label || 'Source',
        type: 'source',
        processingType: 'source',
        state: finalImageRef ? 'ready' : 'idle',
        image: finalImageRef,
        originalImage: finalImageRef,
        createdAt: Date.now(),
        lineage,
        inputData: undefined,
        outputData: packet,
        config: {}
      } as BuilderNodeData
    };

    pushHistory(nodesRef.current, edgesRef.current); // snapshot before adding
    setNodes(nds => [...nds, newNode]);

    if (imageUrl) {
      try {
        const sessionParentId = sessionStorage.getItem('presetParentId') || undefined;
        const sessionRootId = sessionStorage.getItem('presetRootId') || undefined;

        // Clean up immediately so they are only used for this first node
        sessionStorage.removeItem('presetParentId');
        sessionStorage.removeItem('presetRootId');

        // Build node tree containing this source node
        const nodeTree: NodeTreeData = {
          nodes: [{
            id: newNode.id,
            type: 'source',
            position: newNode.position,
            image: finalImageRef,
            state: 'ready',
            processingType: 'source',
          }],
          sourceNodeId: newNode.id,
          activeNodeId: newNode.id,
          createdAt: Date.now(),
        };
        addHistoryEntry({
          type: 'edit',
          label: 'Source imported',
          outputImage: imageUrl,
          nodeTree,
          rootSourceId: newNode.id,
          rootSourceImage: imageUrl,
          parentId: sessionParentId,
          rootId: sessionRootId,
          nodeType: 'source',
        }).then(saved => {
          setNodes(nds => nds.map(n => 
            n.id === newNode.id 
              ? { ...n, data: { ...n.data, historyEntryId: saved.id } }
              : n
          ));
        }).catch(err => {
          logger.error('[useBuilderWorkflow] Failed to add source history entry:', err);
        });
      } catch {}
    }

    return id;
  }, [setNodes]); // eslint-disable-line react-hooks/exhaustive-deps

  const spawnGhostNode = useCallback((
    parentId: string,
    processingType: ProcessingType
  ): string | null => {
    const parent = getNode(parentId);
    if (!parent) throw new Error(`Parent node ${parentId} not found`);
    
    // Only source and result nodes can spawn ghosts
    const parentData = parent.data as BuilderNodeData;
    if (parentData.type === 'ghost') {
      throw new Error('Ghost nodes cannot spawn children');
    }

    // Only toggle-delete an IDLE ghost (one that hasn't taken work yet).
    // Ghosts that are processing/ready/error must persist so the user can
    // spawn additional ghosts from the same parent for branching workflows.
    const existingIdleGhost = getChildren(parentId).find(n => {
      const d = n.data as BuilderNodeData;
      return d.type === 'ghost' && d.state === 'idle';
    });
    
    if (existingIdleGhost) {
      setNodes(nds => nds.filter(n => n.id !== existingIdleGhost.id));
      setEdges(eds => eds.filter(e => e.target !== existingIdleGhost.id));
      return null;
    }

    const id = `ghost-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const position = calculateChildPosition(parentId);

    const parentLineage = parentData.lineage;
    const lineage: NodeLineage = {
      parentId,
      rootSourceId: parentLineage.rootSourceId,
      generation: parentLineage.generation + 1,
      branchIndex: 0,
      processingType,
      ancestry: [...parentLineage.ancestry, parentId]
    };

    const baseLabel = TYPE_LABELS[processingType];

    // Get parent output for input data (but ghost doesn't inherit image visually)
    const parentOutput = parentData.outputData;
    
    const newNode: BuilderNode = {
      id,
      type: 'ghostNode',
      position,
      width: 260,
      data: {
        label: baseLabel,
        type: 'ghost',
        processingType,
        state: 'idle',
        image: undefined, // Ghost is empty, no image inherited
        createdAt: Date.now(),
        lineage,
        inputData: parentOutput,
        outputData: undefined,
        prompt: undefined,
        config: {},
        pendingPlacement: true
      }
    };

    setNodes(nds => [...nds, newNode]);
    
    // Create data-carrying edge
    // Calculate handle index based on existing edges to support multi-input
    setEdges(eds => {
      const existingEdgesToTarget = eds.filter(e => e.target === id).length;
      return [...eds, createEdge(parentId, id, { 
        animated: false, 
        isDataFlow: true,
        packet: parentOutput,
        targetHandleIndex: existingEdgesToTarget // 0, 1, 2, etc. for multiple inputs
      })];
    });

    return id;
  }, [getNode, getChildren, calculateChildPosition, setNodes, setEdges]);

  const executeNodeSingle = useCallback(async (
    nodeId: string,
    prompt: string,
    config?: GenerationConfig
  ): Promise<{ image: string }> => {
    const node = getNode(nodeId);
    if (!node) throw new Error(`Node ${nodeId} not found`);

    const nodeData = node.data as BuilderNodeData;
    
    // Validate: only ghost nodes can be executed
    if (nodeData.type !== 'ghost') {
      throw new Error(`Cannot execute ${nodeData.type} node`);
    }

    // Check if already processing (active controller indicates running process)
    if (abortControllers.current.has(nodeId)) {
      throw new Error('Node is already processing');
    }

    const _execStartTime = Date.now();
    const model = config?.model || 'google/nano-banana-2';
    
    // Get source image(s) ONLY from directly connected parent nodes
    // Sorted by their target handle index (so ghost-target-0 is first)
    const incomingEdges = edgesRef.current
      .filter(e => e.target === nodeId && e.targetHandle)
      .sort((a, b) => {
        const matchA = a.targetHandle!.match(/ghost-target-(\d+)/);
        const matchB = b.targetHandle!.match(/ghost-target-(\d+)/);
        const idxA = matchA ? parseInt(matchA[1], 10) : 0;
        const idxB = matchB ? parseInt(matchB[1], 10) : 0;
        return idxA - idxB;
      });

    const allParentImages: string[] = [];
    incomingEdges.forEach(edge => {
      const parentNode = nodesRef.current.find(n => n.id === edge.source);
      if (parentNode) {
        const parentData = parentNode.data as BuilderNodeData;
        const img = parentData.outputData?.image || parentData.image;
        if (img && !allParentImages.includes(img)) {
          allParentImages.push(img);
        }
      }
    });

    // Fallback if no images found via edges but inputData has one
    if (allParentImages.length === 0 && nodeData.inputData?.image) {
      allParentImages.push(nodeData.inputData.image);
    }
    
    // Resolve any IndexedDB image references to actual base64/URL data
    const resolvedParentResults = await Promise.allSettled(
      allParentImages.map(img => resolveImageIfCached(img))
    );
    const resolvedParentImages = resolvedParentResults.map(r => r.status === 'fulfilled' ? r.value : undefined);
    const validResolvedParentImages = resolvedParentImages.filter((img): img is string => !!img);

    // Upload images based on model requirements
    const uploadedResults = await Promise.allSettled(
      validResolvedParentImages.map(img => uploadImageIfLocal(img, model as string))
    );
    const uploadedImages = uploadedResults.map(r => r.status === 'fulfilled' ? r.value : undefined).filter((img): img is string => !!img);

    // Primary source image is the first connected one
    const sourceImage = uploadedImages[0];
    
    // Check if using an upscale model (Replicate upscale models)
    const isUpscaleModel = (model as string) === 'topazlabs/image-upscale'
      || (model as string) === 'philz1337x/clarity-upscaler'
      || (model as string) === 'prunaai/p-image-upscale';
    if (isUpscaleModel && !sourceImage) {
      throw new Error('Upscaling engines require a source image. Please upload or connect an image first.');
    }

    // Central Queue Store: track connecting state
    useBuilderQueueStore.getState().addJob(nodeId, {
      state: 'connecting',
      errorMessage: undefined,
    });

    // Update prompt draft and config once (does not trigger layout/edge recals)
    setNodes(nds => nds.map(n => 
      n.id === nodeId 
        ? { 
            ...n, 
            data: { 
              ...n.data, 
              promptDraft: prompt,
              config: { ...config },
              pendingPlacement: false
            } 
          }
        : n
    ));

    const controller = new AbortController();
    abortControllers.current.set(nodeId, controller);

    try {
      const onStatusChange = (status: 'queued' | 'processing', predictionId?: string) => {
        useBuilderQueueStore.getState().updateJob(nodeId, {
          state: status,
          predictionId
        });
      };

      const sourceDims = nodeData.inputData?.dimensions;
      let result: { imageUrl: string; metadata: { width: number; height: number; model: string; prompt: string } };

      // For upscale models, use upscaleImage API
      if (isUpscaleModel) {
        const upscaler = UpscalerFactory.create(model);
        
        // Build an AIConfig-compatible object from the generation config
        const aiConfig: any = {
          model: model as import('../../services/replicate').ReplicateUpscaleModel,
          upscaleFactor: config?.upscaleFactor ?? 4,
          negativePrompt: config?.negativePrompt ?? '',
          steps: config?.steps ?? 20,
          cfg: config?.cfg ?? 7,
          seed: config?.seed ?? null,
          strength: config?.strength ?? 0.75,
          referenceStrength: config?.referenceStrength ?? 0.5,
          results: 1,
          disableSafetyChecker: config?.disableSafetyChecker ?? false,
          resolution: config?.resolution ?? 'Auto',
          aspectRatio: config?.aspectRatio ?? 'Auto',
          selectedTool: 'image-upscaler',
          enableWatermark: config?.enableWatermark ?? false,
          watermarkType: 'text',
          watermarkText: config?.watermarkText ?? '',
          watermarkImage: '',
          watermarkImageSize: config?.watermarkFontSize ?? 24,
          watermarkPosition: config?.watermarkPosition ?? 'bottom-right',
          watermarkOpacity: config?.watermarkOpacity ?? 0.5,
          watermarkFontSize: config?.watermarkFontSize ?? 24,
          ...config
        };

        upscaler.validateInputs(aiConfig);
        const upscaleResult = await upscaler.execute(aiConfig, sourceImage, controller.signal, onStatusChange);
        
        result = {
          imageUrl: upscaleResult.imageUrl,
          metadata: {
            width: upscaleResult.width ?? (sourceDims?.width ? sourceDims.width * (config?.upscaleFactor ?? 4) : 1024),
            height: upscaleResult.height ?? (sourceDims?.height ? sourceDims.height * (config?.upscaleFactor ?? 4) : 1024),
            model: upscaleResult.model,
            prompt: prompt || 'Upscale',
          }
        };

      } else {
        // For regular image models, use generate or generateImg2Img
        const baseParams = {
          prompt,
          model: model as import('../../services/replicate').ReplicateImageModel,
          negativePrompt: config?.negativePrompt,
          resolution: config?.resolution || 'Auto',
          aspectRatio: config?.aspectRatio || 'Auto',
          steps: config?.steps,
          cfg: config?.cfg,
          seed: config?.seed ?? undefined,
          strength: config?.strength,
          referenceStrength: config?.referenceStrength,
          disableSafetyChecker: config?.disableSafetyChecker,
          sourceWidth: sourceDims?.width,
          sourceHeight: sourceDims?.height,
          nodeId,
          userId: user?.id || 'anonymous',
        };

        // Choose generation mode based on model capabilities and available images
        const modelCaps = replicateService.getModelCapabilities(
          model as import('../../services/replicate').ReplicateImageModel
        );
        const useImg2Img = sourceImage && modelCaps.supportsImg2Img;
        result = useImg2Img
          ? await replicateService.generateImg2Img(baseParams, uploadedImages, controller.signal, onStatusChange)
          : await replicateService.generate(baseParams, controller.signal, onStatusChange);
      }

      const resultImage = await persistImageLocally(result.imageUrl);
      
      // Apply watermark if enabled
      let finalImage = resultImage;
      const aiConfig = useAIConfigStore.getState().config;
      const wmText = (aiConfig.watermarkText || '').trim();
      const wmEnabled = aiConfig.enableWatermark &&
        (aiConfig.watermarkType === 'image' ? !!aiConfig.watermarkImage : wmText.length > 0);
      if (wmEnabled) {
        try {
          // Canvas requires a data URI — convert http:// URLs via Tauri first
          let imageForWm = finalImage;
          if (imageForWm.startsWith('http')) {
            imageForWm = await invoke<string>('url_to_base64', { url: imageForWm });
          }
          finalImage = await watermarkService.applyWatermark(imageForWm, {
            type: aiConfig.watermarkType || 'text',
            text: wmText || 'Anarchy AI',
            watermarkImage: aiConfig.watermarkImage,
            watermarkImageSize: aiConfig.watermarkImageSize ?? 80,
            position: aiConfig.watermarkPosition ?? 'bottom-right',
            opacity: aiConfig.watermarkOpacity ?? 0.5,
            fontSize: aiConfig.watermarkFontSize ?? 24,
          });
        } catch (wmErr) {
          logger.warn('[Watermark] Failed to apply:', wmErr);
        }
      }
      
      const imageKey = `idb://${crypto.randomUUID()}`;
      await cacheLocalImage(imageKey, finalImage);

      const outputPacket = createDataPacket(
        imageKey,
        prompt,
        nodeData.processingType,
        { width: result.metadata.width, height: result.metadata.height }
      );

      try {
        const parent = getParent(nodeId);
        const rawParentImage = parent ? (parent.data as BuilderNodeData).image : undefined;
        // Resolve raw parent image first if it's cached
        const resolvedRawParentImage = await resolveImageIfCached(rawParentImage);
        // Persist parent image locally so history doesn't rely on expiring URLs
        const parentImage = resolvedRawParentImage ? await persistImageLocally(resolvedRawParentImage) : undefined;
        const modelId = model as string;
        
        const rootSourceNode = nodesRef.current.find(n => (n.data as BuilderNodeData).type === 'source');
        const rawRootImage = rootSourceNode ? (rootSourceNode.data as BuilderNodeData).image : undefined;
        const rootSourceImage = rawRootImage ? await resolveImageIfCached(rawRootImage) : undefined;
        const rootSourceId = rootSourceNode?.id;

        const parentHistoryEntryId = parent ? (parent.data as BuilderNodeData).historyEntryId : undefined;
        const rootHistoryEntryId = rootSourceNode ? (rootSourceNode.data as BuilderNodeData).historyEntryId : undefined;

        // Fallback to session values if the node is at the root level of the graph
        const sessionParentId = sessionStorage.getItem('presetParentId') || undefined;
        const sessionRootId = sessionStorage.getItem('presetRootId') || undefined;

        const finalParentId = parentHistoryEntryId || (!parent ? sessionParentId : undefined);
        const finalRootId = rootHistoryEntryId || (!parent ? sessionRootId : undefined);

        const nodeType = 
          nodeData.processingType === 'source' ? 'source' :
          nodeData.processingType === 'upscale' ? 'upscale' :
          nodeData.processingType === 'variation' ? 'variation' :
          nodeData.processingType === 'render' ? 'variation' :
          'edit';

        // Build node tree from current state
        const nodeTree: NodeTreeData = {
          nodes: nodesRef.current.map(n => {
            const data = n.data as BuilderNodeData;
            return {
              id: n.id,
              type: data.type,
              position: n.position,
              image: data.image,
              prompt: data.prompt,
              processingType: data.processingType,
              state: data.state,
              parentId: data.lineage?.parentId || undefined,
              historyEntryId: data.historyEntryId,
            };
          }),
          sourceNodeId: rootSourceId || nodeId,
          activeNodeId: nodeId,
          createdAt: Date.now(),
        };
        
        const savedEntry = await addHistoryEntry({
          type: (nodeData.processingType as any) === 'upscale' ? 'upscale' : 'render',
          label: prompt && prompt.length > 50 ? prompt.slice(0, 50) + '...' : (prompt || 'Generation'),
          prompt,
          model: modelId,
          inputImage: parentImage,
          outputImage: finalImage,
          duration: Date.now() - _execStartTime,
          nodeTree,
          rootSourceId,
          rootSourceImage,
          parentId: finalParentId,
          rootId: finalRootId,
          nodeType,
        });

        // Link the canvas node to the newly created history entry
        setNodes(nds => nds.map(n => 
          n.id === nodeId 
            ? { ...n, data: { ...n.data, historyEntryId: savedEntry.id } }
            : n
        ));

        const isUpscale = (nodeData.processingType as any) === 'upscale';
        track({
          event: isUpscale ? 'image_upscaled' : 'image_generated',
          properties: {
            model: modelId,
            duration_ms: Date.now() - _execStartTime,
            has_prompt: Boolean(prompt),
          },
        }).catch(() => {});
      } catch (historyErr) {
        logger.error('[History] Failed to save history entry:', historyErr);
      }

      // Auto-save generated image to Documents/Anarchy AI
      try {
        const timestamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-').slice(0, 19);
        const safeName = (prompt || 'generation').replace(/[^a-zA-Z0-9\u0600-\u06FF\s]/g, '').trim().slice(0, 40).replaceAll(' ', '_').replaceAll('  ', '_') || 'generation';
        const fileName = `${timestamp}_${safeName}.png`;
        await invoke('save_image_to_documents', { dataUri: finalImage, fileName });
      } catch { /* Non-critical — silently ignore */ }

      // Map model IDs to human-readable display names for the result title
      const MODEL_DISPLAY_NAMES: Record<string, string> = {
        'google/nano-banana-2':             'Nano Banana 2',
        'google/nano-banana-pro':           'Nano Banana Pro',
        'bytedance/seedream-4.5':           'Seedream 4.5',
        'black-forest-labs/flux-2-pro':     'FLUX 2 Pro',
        'openai/gpt-image-2':               'GPT Image 2',
        'bytedance/seedance-2.0':           'Seedance 2',
        'black-forest-labs/flux-kontext-pro':'FLUX Kontext Pro',
        'xai/grok-imagine-image':           'Grok Imagine',
        'stability-ai/stable-diffusion-3.5-large': 'Stable Diffusion 3.5',
        'philz1337x/clarity-upscaler':      'Clarity Upscaler',
      };
      const modelLabel = MODEL_DISPLAY_NAMES[model] || model.split('/').pop() || model;

      setNodes(nds => nds.map(n => {
        if (n.id !== nodeId) return n;
        
        return {
          ...n,
          type: 'baseNode', // Switch React Flow renderer so image is displayed
          data: {
            ...n.data,
            type: 'result', // TRANSFORM: Ghost becomes Result
            state: 'ready',
            label: modelLabel,
            modelUsed: model,
            prompt,
            image: imageKey,
            originalImage: imageKey,
            outputData: outputPacket,
            dimensions: { width: result.metadata.width, height: result.metadata.height },
            processedAt: Date.now()
          }
        };
      }));

      pushHistory(nodesRef.current, edgesRef.current); // snapshot before result lands

      // Update edges targeting this node: ghost handle 'ghost-target-0' -> BaseNode handle 'target'
      setEdges(eds => eds.map(e => 
        e.target === nodeId 
          ? { ...e, targetHandle: 'target' } 
          : e
      ));

      // Propagate update to children
      propagateNodeUpdate(nodeId);

      return { image: imageKey };

    } catch (error) {
      logger.error('Generation failed:', error);
      useBuilderQueueStore.getState().updateJob(nodeId, {
        state: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Generation failed'
      });
      setNodes(nds => nds.map(n => 
        n.id === nodeId 
          ? { 
              ...n, 
              data: { 
                ...n.data, 
                state: 'error',
                errorMessage: error instanceof Error ? error.message : 'Generation failed'
              } 
            }
          : n
      ));
      throw error;
    } finally {
      abortControllers.current.delete(nodeId);
    }
  }, [getNode, getParent, nodes, setNodes, propagateNodeUpdate]); // eslint-disable-line react-hooks/exhaustive-deps

  const cancelExecution = useCallback((nodeId: string) => {
    const controller = abortControllers.current.get(nodeId);
    if (controller) {
      controller.abort();
      abortControllers.current.delete(nodeId);
    }
    
    // Set state to cancelled in central queue store
    useBuilderQueueStore.getState().updateJob(nodeId, {
      state: 'cancelled',
      errorMessage: 'Execution cancelled by user'
    });

    setNodes(nds => nds.map(n => 
      n.id === nodeId 
        ? { 
            ...n, 
            data: { 
              ...n.data, 
              state: 'cancelled',
              errorMessage: 'Execution cancelled by user'
            } 
          }
        : n
    ));

    // Clear execution queue if this node was part of the running queue
    const queueStore = useBuilderQueueStore.getState();
    if (queueStore.activeQueue.includes(nodeId)) {
      queueStore.setQueue([]);
    }
  }, [setNodes]);

  const executeNode = useCallback(async (
    nodeId: string,
    prompt: string,
    config?: GenerationConfig
  ): Promise<{ image: string }> => {
    const queueStore = useBuilderQueueStore.getState();
    const order = queueStore.resolveAndQueue(nodeId, nodesRef.current, edgesRef.current);
    if (order.length === 0) return { image: '' };

    if (order.length === 1 && order[0] === nodeId && !queueStore.isExecuting) {
      // Execute directly if no pending dependencies and queue is not running
      return executeNodeSingle(nodeId, prompt, config);
    }

    // Define single node executor
    const executeSingle = async (id: string) => {
      const node = nodesRef.current.find(n => n.id === id);
      const nodePrompt = id === nodeId ? prompt : ((node?.data?.prompt || node?.data?.promptDraft || 'AI generation') as string);
      const nodeConfig = id === nodeId ? config : (node?.data?.config as GenerationConfig || undefined);
      return executeNodeSingle(id, nodePrompt, nodeConfig);
    };

    // If queue is already running, wait for this specific node's state to complete or fail
    if (queueStore.isExecuting) {
      return new Promise<{ image: string }>((resolve, reject) => {
        const check = setInterval(() => {
          const node = nodesRef.current.find(n => n.id === nodeId);
          const job = useBuilderQueueStore.getState().jobs[nodeId];
          const state = (job?.state || node?.data?.state) as NodeState;
          
          if (state === 'completed' || state === 'ready') {
            clearInterval(check);
            resolve({ image: node?.data?.image || '' });
          } else if (state === 'failed' || state === 'error' || state === 'cancelled') {
            clearInterval(check);
            reject(new Error(job?.errorMessage || node?.data?.errorMessage || 'Dependency execution failed'));
          }
        }, 500);
      });
    }

    try {
      await queueStore.runQueue(executeSingle);
      const node = nodesRef.current.find(n => n.id === nodeId);
      return { image: node?.data?.image || '' };
    } catch (err) {
      throw err;
    }
  }, [executeNodeSingle]);

  // ========================================================================
  // LEGACY COMPATIBILITY - Bridge to old API
  // ========================================================================

  const addChildNode = useCallback((
    parentId: string,
    processingType: ProcessingType
  ): string | null => {
    // New API: Always spawn a ghost node
    return spawnGhostNode(parentId, processingType);
  }, [spawnGhostNode]);

  const executeProcessing = useCallback((
    nodeId: string,
    prompt: string,
    options?: { strength?: number; seed?: number }
  ): void => {
    // Async wrapper for sync API compatibility (legacy)
    executeNode(nodeId, prompt, {
      model: 'black-forest-labs/flux-1.1-pro' as import('../../services/replicate').ReplicateImageModel,
      strength: options?.strength,
      seed: options?.seed,
    }).catch((e) => logger.error(e));
  }, [executeNode]);

  const updateNodeData = useCallback((nodeId: string, newData: Partial<BuilderNodeData>) => {
    setNodes(nds => nds.map(n => 
      n.id === nodeId 
        ? { ...n, data: { ...n.data, ...newData } }
        : n
    ));
  }, [setNodes]);

  const updateNodeImageAndPropagate = useCallback((nodeId: string, imageUrl: string) => {
    const outputPacket = createDataPacket(imageUrl, undefined, 'source');

    // 1. Update target node
    setNodes(nds => nds.map(n => {
      if (n.id !== nodeId) return n;
      return {
        ...n,
        data: {
          ...n.data,
          image: imageUrl,
          state: 'ready',
          outputData: outputPacket
        }
      };
    }));

    // 2. Propagate to children
    const children = getChildren(nodeId);
    const childIds = new Set(children.map(c => c.id));
    const edgeTimestamp = Date.now();

    setNodes(nds => nds.map(n => {
      if (!childIds.has(n.id)) return n;
      const childData = n.data as BuilderNodeData;
      return {
        ...n,
        data: {
          ...childData,
          inputData: outputPacket,
          image: childData.type === 'ghost' ? outputPacket.image : childData.image,
        }
      };
    }));

    setEdges(eds => eds.map(e => {
      if (!childIds.has(e.target) || e.source !== nodeId) return e;
      return { ...e, data: { ...e.data, packet: outputPacket, isActive: true, lastUpdate: edgeTimestamp } };
    }));
  }, [getChildren, setNodes, setEdges]);

  // ========================================================================
  // CONNECTION RULES - Validate before connecting
  // ========================================================================

  const validateConnection = useCallback((connection: Connection): boolean => {
    if (!connection.source || !connection.target) return false;
    
    // Prevent circular connections
    const downstream = findDownstreamNodes(connection.target);
    if (downstream.includes(connection.source)) {
      logger.error('Circular connection detected');
      return false;
    }

    const sourceNode = getNode(connection.source);
    const targetNode = getNode(connection.target);
    
    if (!sourceNode || !targetNode) return false;

    const sourceData = sourceNode.data as BuilderNodeData;
    const targetData = targetNode.data as BuilderNodeData;

    // Only LEFT → RIGHT flow
    // Source can connect to anything
    // Result can connect to ghosts
    // Ghost cannot be a source
    if (sourceData.type === 'ghost') {
      logger.error('Ghost nodes cannot be connection sources');
      return false;
    }

    // Target must be a ghost (for new connections)
    if (targetData.type !== 'ghost') {
      logger.error('Can only connect to ghost nodes');
      return false;
    }

    return true;
  }, [getNode, findDownstreamNodes]);

  const onConnect = useCallback((params: Connection) => {
    if (!validateConnection(params)) return;
    
    // Calculate the correct target handle for GhostNode
    const targetNode = getNode(params.target);
    let targetHandle = params.targetHandle;
    let edgeId = `e-${params.source}-${params.target}`;
    
    if (targetNode?.data?.type === 'ghost') {
      // Find the first unused target handle index (only count active nodes)
      const activeNodeIds = new Set(nodesRef.current.map(n => n.id));
      const existingEdges = edgesRef.current.filter(e => e.target === params.target && activeNodeIds.has(e.source));
      const usedIndices = existingEdges
        .map(e => {
          const match = e.targetHandle?.match(/ghost-target-(\d+)/);
          return match ? parseInt(match[1], 10) : -1;
        })
        .filter(idx => idx >= 0);
      
      let firstUnusedIndex = 0;
      while (usedIndices.includes(firstUnusedIndex)) {
        firstUnusedIndex++;
      }
      
      targetHandle = `ghost-target-${firstUnusedIndex}`;
      edgeId = `e-${params.source}-${params.target}-${firstUnusedIndex}`;
    }
    
    // Create edge with bezier type for smooth curved lines without corners
    // Brand red color (#e11d48) with dashed curved lines
    const newEdge: Edge = {
      id: edgeId,
      source: params.source,
      target: params.target,
      sourceHandle: 'source', // Explicit source handle for proper positioning
      targetHandle: targetHandle || 'ghost-target-0',
      type: 'default', // Use default for bezier curves
      animated: false,
      label: null, // No label on edge - must be null not undefined
      style: {
        strokeWidth: 2,
        stroke: '#e11d48', // Brand red for identity
        opacity: 0.8,
        strokeDasharray: '5 5', // Dashed line
        strokeLinecap: 'round'
      },
      data: {
        isActive: true,
        lastUpdate: Date.now()
      }
    };
    
    setEdges(eds => [...eds, newEdge]);
  }, [validateConnection, setEdges, getNode, edgesRef]);

  // ========================================================================
  // NODE DELETION - Cascading delete
  // ========================================================================

  const deleteNode = useCallback((nodeId: string, _isRecursive = false): void => {
    if (!_isRecursive) pushHistory(nodesRef.current, edgesRef.current); // snapshot once at top level
    
    // Abort active generation if any
    const activeCtrl = abortControllers.current.get(nodeId);
    if (activeCtrl) {
      activeCtrl.abort();
      abortControllers.current.delete(nodeId);
    }

    // Clean up cached images from IndexedDB and revoke Object URLs to prevent RAM leaks
    const node = getNode(nodeId);
    if (node) {
      const data = node.data as BuilderNodeData;
      if (data.image) {
        if (data.image.startsWith('idb://')) {
          deleteLocalImage(data.image).catch(() => {});
        } else if (data.image.startsWith('blob:')) {
          revokeObjectUrl(data.image);
        }
      }
      if (data.outputData?.image) {
        if (data.outputData.image.startsWith('idb://')) {
          deleteLocalImage(data.outputData.image).catch(() => {});
        } else if (data.outputData.image.startsWith('blob:')) {
          revokeObjectUrl(data.outputData.image);
        }
      }
    }

    const children = getChildren(nodeId);
    children.forEach(child => deleteNode(child.id, true));
    
    setNodes(nds => nds.filter(n => n.id !== nodeId));
    setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId));
    
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
    }
  }, [getChildren, getNode, setNodes, setEdges, selectedNodeId, setSelectedNodeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ========================================================================
  // AUTO LAYOUT
  // ========================================================================

  const rearrangeNodes = useCallback((): void => {
    if (nodes.length === 0) return;

    const rootNodes = nodes.filter(n => {
      const lineage = (n.data as BuilderNodeData).lineage;
      return !lineage?.parentId;
    });

    if (rootNodes.length === 0) return;

    const layoutedNodes: BuilderNode[] = [];
    const MARGIN_Y = 100;

    const getSubtreeHeight = (nodeId: string): number => {
      const children = getChildren(nodeId);
      if (children.length === 0) return VERTICAL_SPACING;
      
      return children.reduce((total, child) => 
        total + getSubtreeHeight(child.id), 0
      );
    };

    const layoutSubtree = (nodeId: string, x: number, startY: number): number => {
      const node = getNode(nodeId);
      if (!node) return startY;

      const children = getChildren(nodeId);
      const subtreeHeight = getSubtreeHeight(nodeId);
      const centerY = startY + subtreeHeight / 2 - VERTICAL_SPACING / 2;

      layoutedNodes.push({
        ...node,
        position: { x, y: centerY }
      });

      let currentChildY = startY;
      children.forEach(child => {
        const childHeight = getSubtreeHeight(child.id);
        layoutSubtree(child.id, x + HORIZONTAL_SPACING, currentChildY);
        currentChildY += childHeight;
      });

      return startY + subtreeHeight;
    };

    let currentY = MARGIN_Y;
    rootNodes.forEach(root => {
      layoutSubtree(root.id, 80, currentY);
      currentY += getSubtreeHeight(root.id) + MARGIN_Y;
    });

    setNodes(layoutedNodes);
  }, [nodes, getChildren, getNode, setNodes]);

  // ========================================================================
  // ACTIVE TARGET - For prompt bar
  // ========================================================================

  const activeTarget = useMemo((): Node | null => {
    // Priority: selected ghost node
    if (selectedNodeId) {
      const selected = getNode(selectedNodeId);
      if (selected) {
        const data = selected.data as BuilderNodeData;
        if (data.type === 'ghost' && data.state === 'idle') {
          return selected;
        }
      }
    }
    
    // Fallback: any idle ghost
    return nodes.find(n => {
      const data = n.data as BuilderNodeData;
      return data.type === 'ghost' && data.state === 'idle';
    }) || null;
  }, [nodes, selectedNodeId, getNode]);

  // ========================================================================
  // STATISTICS
  // ========================================================================

  const workflowStats = useMemo((): WorkflowStats => {
    const stats = {
      sourceNodes: 0,
      ghostNodes: 0,
      resultNodes: 0,
      activeProcessing: 0,
      maxDepth: 0,
      totalBranches: 0
    };

    nodes.forEach(n => {
      const data = n.data as BuilderNodeData;
      const lineage = data.lineage;

      switch (data.type) {
        case 'source': stats.sourceNodes++; break;
        case 'ghost': stats.ghostNodes++; break;
        case 'result': stats.resultNodes++; break;
      }

      if (data.state === 'processing') stats.activeProcessing++;
      if (lineage.generation > stats.maxDepth) stats.maxDepth = lineage.generation;
      if (!lineage.parentId) stats.totalBranches++;
    });

    return {
      totalNodes: nodes.length,
      ...stats
    };
  }, [nodes]);

  // ========================================================================
  // WORKFLOW RESTORATION - Restore full node tree from Library/History
  // ========================================================================

  /**
   * Restore a complete workflow from saved node tree data
   * Used when sending images with workflow from Library/History
   */
  const restoreWorkflow = useCallback((workflowData: {
    nodes: any[];
    edges?: any[];
    name?: string;
  }) => {
    if (!workflowData.nodes || workflowData.nodes.length === 0) {
      logger.warn('[restoreWorkflow] No nodes provided');
      return false;
    }

    try {
      // Clear existing nodes and edges
      setNodes([]);
      setEdges([]);

      // Restore nodes with full data
      const restoredNodes = workflowData.nodes.map((n: any) => ({
        id: n.id,
        type: n.type || 'baseNode',
        position: n.position || { x: 80, y: 300 },
        width: n.width || 260,
        height: n.height,
        data: {
          ...n.data,
          // Ensure proper state
          state: n.data?.state || 'idle',
          // Preserve lineage info
          lineage: n.data?.lineage || { generation: 0, branch: 0, ancestry: [] },
        },
      }));

      // Restore edges if provided
      const restoredEdges = sanitizeEdges(
        restoredNodes,
        (workflowData.edges || []).map((e: any) => ({
          id: e.id || `edge-${e.source}-${e.target}`,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle || 'source',
          targetHandle: e.targetHandle,
          type: e.type || 'default',
          animated: e.animated ?? false,
          style: e.style || { stroke: '#e11d48', strokeWidth: 2, strokeDasharray: '5 5' },
          data: e.data,
        }))
      );

      // Batch update to avoid multiple renders
      setNodes(restoredNodes);
      setEdges(restoredEdges);

      // Push to history for undo/redo
      pushHistory(restoredNodes, restoredEdges);

      logger.log('[restoreWorkflow] Restored', restoredNodes.length, 'nodes and', restoredEdges.length, 'edges');
      return true;
    } catch (err) {
      logger.error('[restoreWorkflow] Failed:', err);
      return false;
    }
  }, [setNodes, setEdges, pushHistory]);

  const spawnBenchmarkLayout = useCallback((nodeCount: number, edgeCount: number) => {
    logger.log('[Benchmark] Spawning layout with', nodeCount, 'nodes and', edgeCount, 'edges');
    
    // Clear queue and jobs
    const queueStore = useBuilderQueueStore.getState();
    queueStore.clearQueue();

    const newNodes: BuilderNode[] = [];
    const newEdges: Edge[] = [];

    // 1. Generate Nodes
    // Place them in a grid structure
    const cols = Math.max(2, Math.ceil(Math.sqrt(nodeCount)));

    for (let i = 0; i < nodeCount; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);

      const x = 100 + col * HORIZONTAL_SPACING;
      // Stagger rows slightly for organic look
      const y = 100 + row * 220 + (col % 2 === 0 ? 0 : 50);

      const nodeId = `node_${i}`;
      const type = i === 0 ? 'source' : 'ghost';

      const data: BuilderNodeData = {
        label: i === 0 ? 'Benchmark Source' : `Node #${i}`,
        type: type as any,
        processingType: i === 0 ? 'source' : 'render',
        state: i === 0 ? 'ready' : 'idle',
        image: i === 0 ? 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400' : undefined,
        prompt: i === 0 ? undefined : `Modern architectural render, node ${i}, hyperrealistic`,
        createdAt: Date.now(),
        lineage: {
          parentId: null,
          rootSourceId: 'node_0',
          generation: col,
          branchIndex: row,
          processingType: i === 0 ? 'source' : 'render',
          ancestry: []
        }
      };

      newNodes.push({
        id: nodeId,
        type: i === 0 ? 'baseNode' : 'ghostNode',
        position: { x, y },
        data
      });
    }

    // 2. Generate Edges
    const maxEdges = (nodeCount * (nodeCount - 1)) / 2;
    const targetEdgesCount = Math.min(edgeCount, maxEdges);
    let edgesAdded = 0;

    for (let i = 1; i < nodeCount; i++) {
      const col = i % cols;
      let parentIdx = 0;
      if (col > 0) {
        const prevColNodes = [];
        for (let j = 0; j < i; j++) {
          if (j % cols === col - 1) {
            prevColNodes.push(j);
          }
        }
        if (prevColNodes.length > 0) {
          parentIdx = prevColNodes[Math.floor(Math.random() * prevColNodes.length)];
        } else {
          parentIdx = Math.floor(Math.random() * i);
        }
      } else {
        parentIdx = Math.floor(Math.random() * i);
      }

      const sourceId = `node_${parentIdx}`;
      const targetId = `node_${i}`;

      const edge = createEdge(sourceId, targetId, {
        animated: false,
        targetHandleIndex: 0
      });
      if (sourceId !== 'node_0') {
        edge.sourceHandle = 'ghost-source';
      }
      newEdges.push(edge);
      edgesAdded++;
    }

    let attempts = 0;
    const edgeSet = new Set(newEdges.map(e => `${e.source}->${e.target}`));

    while (edgesAdded < targetEdgesCount && attempts < 2000) {
      attempts++;
      const sourceIdx = Math.floor(Math.random() * (nodeCount - 1));
      const targetIdx = sourceIdx + 1 + Math.floor(Math.random() * (nodeCount - sourceIdx - 1));

      if (sourceIdx === targetIdx) continue;

      const sourceId = `node_${sourceIdx}`;
      const targetId = `node_${targetIdx}`;
      const edgeKey = `${sourceId}->${targetId}`;

      if (!edgeSet.has(edgeKey)) {
        const targetIncomingCount = newEdges.filter(e => e.target === targetId).length;
        const edge = createEdge(sourceId, targetId, {
          animated: false,
          targetHandleIndex: targetIncomingCount
        });
        if (sourceId !== 'node_0') {
          edge.sourceHandle = 'ghost-source';
        }
        newEdges.push(edge);
        edgeSet.add(edgeKey);
        edgesAdded++;
      }
    }

    setNodes(newNodes);
    setEdges(newEdges);
    pushHistory(newNodes, newEdges);
  }, [setNodes, setEdges, pushHistory]);

  // ========================================================================
  // RETURN
  // ========================================================================

  return {
    // Core state
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    
    // Selection
    selectedNodeId,
    setSelectedNodeId,
    
    // Node lifecycle (New API)
    createSourceNode,
    spawnGhostNode,
    executeNode,
    cancelExecution,
    
    // Legacy API compatibility
    addChildNode,
    executeProcessing,
    updateNodeData,
    updateNodeImageAndPropagate,
    deleteNode,
    
    // Data flow
    propagateNodeUpdate,
    findDownstreamNodes,
    
    // Queries
    getNode,
    getNodeData,
    getChildren,
    getParent,
    getAllParents,
    
    // Layout
    rearrangeNodes,
    
    // UI helpers
    activeTarget,
    workflowStats,
    
    // Direct setters (for advanced use)
    setNodes,
    setEdges,

    // Restore state — true once localStorage restore attempt is complete
    isRestored,

    // Undo/Redo
    undo,
    redo,
    canUndo,
    canRedo,

    // Workflow restoration
    restoreWorkflow,
    spawnBenchmarkLayout
  };
};
