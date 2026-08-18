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
import { anarchyService } from '../../services/anarchy/AnarchyService';
import { UpscalerFactory } from '../../services/upscalers/UpscalerFactory';
import { useAIConfigStore } from '../../stores/aiConfigStore';
import { useBuilderQueueStore } from '../../stores/builderQueueStore';
import { watermarkService, getActiveWatermarkItems } from '../../services/watermark/WatermarkService';
import { addHistoryEntry, cacheLocalImage, getLocalImage, deleteLocalImage, revokeObjectUrl, dataURLtoBlob } from '../../services/history/HistoryService';
import type { NodeTreeData } from '../../types/history';
import { invoke } from '@tauri-apps/api/core';
import { STORAGE_KEYS } from '../../utils/storageKeys';
import { track } from '../../services/tracking/trackingService';
import { useAuth } from '../auth/AuthContext';

import { getCurrentUserId } from '../../services/supabase/supabaseClient';

// Silent auto-save key — accepts optional tabId suffix for multi-tab isolation
const getAutosaveKey = (tabId?: string) => {
  const uid = getCurrentUserId();
  const base = uid && uid !== 'default_user' ? `${STORAGE_KEYS.BUILDER_AUTOSAVE}_${uid}` : STORAGE_KEYS.BUILDER_AUTOSAVE;
  return tabId ? `${base}_${tabId}` : base;
};

// ── Upload helper: converts local/data-URI images ─────────────────────────────
// Nano Banana models accept base64 data URIs directly (best quality, no expiry)
// Other models (FLUX, GPT, etc.) need public URLs via upload service
async function uploadImageIfLocal(url: string, _model?: string): Promise<string> {
  if (!url) return url;
  // Public HTTPS URL (not localhost) - safe to use directly
  if (url.startsWith('https://')) return url;
  
  // Resolve IndexedDB-backed images first
  if (url.startsWith('idb://')) {
    try {
      const { getLocalImage } = await import('../../services/history/HistoryService');
      const cached = await getLocalImage(url);
      if (cached) {
        try {
          const { replicateService } = await import('../../services/replicate');
          return await replicateService.uploadToReplicate(cached);
        } catch (err) {
          logger.error('[uploadImageIfLocal] Replicate upload failed (idb resolution), falling back to inline:', err);
          return cached;
        }
      }
    } catch (err) {
      logger.error('[uploadImageIfLocal] Failed to resolve idb image:', err);
    }
    return url;
  }

  // Already a data URI — upload to Replicate Files API to get a serving URL
  // This is more reliable than sending huge base64 inline in JSON body
  if (url.startsWith('data:')) {
    try {
      const { replicateService } = await import('../../services/replicate');
      return await replicateService.uploadToReplicate(url);
    } catch (err) {
      logger.error('[uploadImageIfLocal] Replicate upload failed (data URI), falling back to inline:', err);
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
        } catch (err) {
          logger.error('[uploadImageIfLocal] Replicate upload failed (blob/local), falling back to inline:', err);
          return b64; // fallback: send data URI inline
        }
      }
    } catch (err) {
      logger.error('[uploadImageIfLocal] Failed to convert local URL to base64:', err);
    }
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
  // Seedream sequential settings
  sequentialImageGeneration?: string;
  maxImages?: number;
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

const HORIZONTAL_SPACING = 300;
const VERTICAL_SPACING = 210;

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
  video: 'Video',
  variation: 'Variation'
};

const MODEL_DISPLAY_NAMES: Record<string, string> = {
  'google/nano-banana-2':             'Nano Banana 2',
  'google/nano-banana-2-lite':        'Nano Banana 2 Lite',
  'google/nano-banana-pro':           'Nano Banana Pro',
  'bytedance/seedream-4.5':           'Seedream 4.5',
  'bytedance/seedream-5-pro':         'Seedream 5 Pro',
  'black-forest-labs/flux-2-pro':     'FLUX 2 Pro',
  'openai/gpt-image-2':               'GPT Image 2',
  'bytedance/seedance-2.0':           'Seedance 2',
  'black-forest-labs/flux-kontext-pro':'FLUX Kontext Pro',
  'xai/grok-imagine-image':           'Grok Imagine',
  'stability-ai/stable-diffusion-3.5-large': 'Stable Diffusion 3.5',
  'reve/edit-fast':                   'Anarchy Edit Fast',
  'reve/create':                      'Anarchy Create (v2)',
  'reve/extract-layout':              'Anarchy Analysis (v2)',
  'reve/render-layout':               'Anarchy Render Layout (v2)',
  'reve/create-layout':               'Anarchy Create Layout (v2)',
  'reve/reconcile-layouts':           'Anarchy Reconcile Layouts (v2)',
  'philz1337x/clarity-upscaler':      'Clarity Upscaler',
  'kwaivgi/kling-v3-omni-video':      'Kling v3 Omni Video',
  'xai/grok-imagine-video-1.5':       'Grok Imagine Video 1.5',
  'prunaai/p-video':                  'Pruna AI P-Video',
  'google/veo-3.1-fast':              'Google Veo 3.1 Fast',
  'pixverse/pixverse-v6':              'PixVerse v6',
  'openai/sora-2-pro':                'Sora 2 Pro',
};

// ============================================================================
// DATA PACKET UTILITIES
// ============================================================================

const createDataPacket = (
  image: string | undefined,
  prompt: string | undefined,
  operationType: ProcessingType,
  dimensions?: { width: number; height: number },
  model?: string,
  isVideo?: boolean
): DataPacket => ({
  image,
  prompt,
  metadata: {
    timestamp: Date.now(),
    operationType,
    format: 'png',
    width: dimensions?.width,
    height: dimensions?.height,
    model,
    isVideo
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

  const getNodes = useCallback((): BuilderNode[] => {
    return nodesRef.current;
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

  const propagateNodeUpdate = useCallback((nodeId: string, explicitPacket?: DataPacket): void => {
    const children = getChildren(nodeId);
    const childIds = new Set(children.map(c => c.id));
    const edgeTimestamp = Date.now();

    setNodes(nds => {
      const targetNode = nds.find(n => n?.id === nodeId);
      if (!targetNode) return nds;

      const targetData = (targetNode.data || {}) as BuilderNodeData;
      const img = explicitPacket?.image || targetData.image || targetData.outputData?.image;
      const pmt = explicitPacket?.prompt || targetData.prompt || targetData.outputData?.prompt;
      const procType = (explicitPacket as any)?.processingType || targetData.processingType || 'source';

      const outputPacket = explicitPacket || createDataPacket(img, pmt, procType);

      return nds.map(n => {
        if (!n) return n;
        if (n.id === nodeId) {
          return {
            ...n,
            data: {
              ...(n.data || {}),
              outputData: outputPacket,
            }
          };
        }
        if (childIds.has(n.id)) {
          const childData = (n.data || {}) as BuilderNodeData;
          return {
            ...n,
            data: {
              ...childData,
              inputData: outputPacket,
              image: childData.type === 'ghost' ? (outputPacket?.image || '') : (childData?.image || ''),
            }
          };
        }
        return n;
      });
    });

    if (childIds.size > 0) {
      setEdges(eds => eds.map(e => {
        if (!childIds.has(e.target) || e.source !== nodeId) return e;
        return { ...e, data: { ...e.data, isActive: true, lastUpdate: edgeTimestamp } };
      }));
    }
  }, [getChildren, setNodes, setEdges]);

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

  const createSourceNode = useCallback((imageUrl?: string, label?: string, position?: { x: number; y: number }, prompt?: string): string => {
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
        prompt: prompt || '',
        createdAt: Date.now(),
        lineage,
        inputData: undefined,
        outputData: packet,
        config: { prompt: prompt || '' }
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
    const queueStore = useBuilderQueueStore.getState();
    const existingIdleGhost = getChildren(parentId).find(n => {
      const d = n.data as BuilderNodeData;
      const job = queueStore.jobs[n.id];
      const isQueuedOrExecuting = queueStore.activeQueue.includes(n.id) || 
                                  (job && job.state !== 'idle') || 
                                  d.state !== 'idle';
      return d.type === 'ghost' && !isQueuedOrExecuting;
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

  const createStandaloneGhostNode = useCallback((position?: { x: number; y: number }): string => {
    const id = `ghost-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const lastNode = nodesRef.current[nodesRef.current.length - 1];
    const defaultPos = position ?? (lastNode ? { x: lastNode.position.x + 360, y: lastNode.position.y } : { x: 250, y: 150 });

    const lineage: NodeLineage = {
      parentId: null,
      rootSourceId: id,
      generation: 0,
      branchIndex: 0,
      processingType: 'render',
      ancestry: []
    };

    const newNode: BuilderNode = {
      id,
      type: 'ghostNode',
      position: defaultPos,
      width: 260,
      data: {
        label: 'Generator',
        type: 'ghost',
        processingType: 'render',
        state: 'idle',
        createdAt: Date.now(),
        lineage,
        config: {},
        pendingPlacement: false
      } as BuilderNodeData
    };

    nodesRef.current = [...nodesRef.current, newNode];
    setNodes(nds => [...nds, newNode]);
    return id;
  }, [setNodes]);

  const executeNodeSingle = useCallback(async (
    nodeId: string,
    prompt: string,
    config?: GenerationConfig
  ): Promise<{ image: string }> => {
    const node = getNode(nodeId) || nodesRef.current.find(n => n.id === nodeId);
    if (!node) throw new Error(`Node ${nodeId} not found`);

    const nodeData = node.data as BuilderNodeData;
    
    // Validate: only ghost, source, or result nodes can be executed
    if (nodeData.type !== 'ghost' && nodeData.type !== 'source' && nodeData.type !== 'result') {
      throw new Error(`Cannot execute ${nodeData.type} node`);
    }

    // Check if already processing (active controller indicates running process)
    if (abortControllers.current.has(nodeId)) {
      throw new Error('Node is already processing');
    }

    const _execStartTime = Date.now();
    const model = config?.model || 'google/nano-banana-2';
    
    // Get source image(s) from connected parent nodes
    // Include edges both with and without explicit targetHandle
    const incomingEdges = edgesRef.current
      .filter(e => e.target === nodeId)
      .sort((a, b) => {
        const matchA = a.targetHandle ? a.targetHandle.match(/ghost-target-(\d+)/) : null;
        const matchB = b.targetHandle ? b.targetHandle.match(/ghost-target-(\d+)/) : null;
        const idxA = matchA ? parseInt(matchA[1], 10) : 0;
        const idxB = matchB ? parseInt(matchB[1], 10) : 0;
        return idxA - idxB;
      });

    const allParentImages: string[] = [];
    incomingEdges.forEach(edge => {
      const parentNode = nodesRef.current.find(n => n.id === edge.source);
      if (parentNode) {
        const parentData = parentNode.data as BuilderNodeData;
        const img = parentData.outputData?.image || parentData.image || parentData.previewUrl || parentData.inputData?.image;
        if (img && !allParentImages.includes(img)) {
          allParentImages.push(img);
        }
      }
    });

    // Fallback 1: check lineage parentId if no image found via edges
    if (allParentImages.length === 0 && (nodeData as BuilderNodeData)?.lineage?.parentId) {
      const lineageParent = nodesRef.current.find(n => n.id === (nodeData as BuilderNodeData).lineage?.parentId);
      if (lineageParent) {
        const pData = lineageParent.data as BuilderNodeData;
        const img = pData.outputData?.image || pData.image || pData.previewUrl || pData.inputData?.image;
        if (img) allParentImages.push(img);
      }
    }

    // Fallback 2: check node's own inputData
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
            type: 'ghostNode',
            data: { 
              ...n.data, 
              state: 'connecting',
              promptDraft: prompt,
              config: { ...config },
              pendingPlacement: false,
              onCancel: () => {
                const ctrl = abortControllers.current.get(nodeId);
                if (ctrl) ctrl.abort();
              }
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
        setNodes(nds => nds.map(n => 
          n.id === nodeId 
            ? { 
                ...n, 
                type: 'ghostNode',
                data: { 
                  ...n.data, 
                  state: status,
                  predictionId
                } 
              }
            : n
        ));
      };

      // Resolve source dimensions from the first connected parent node (ghost-target-0)
      let sourceDims: { width: number; height: number } | undefined = undefined;
      const primaryEdge = incomingEdges[0];
      if (primaryEdge) {
        const primaryParentNode = nodesRef.current.find(n => n.id === primaryEdge.source);
        if (primaryParentNode) {
          const parentData = primaryParentNode.data as BuilderNodeData;
          const d = (parentData.outputData?.dimensions ?? parentData.dimensions) as { width: number; height: number } | undefined;
          sourceDims = d;
        }
      }
      if (!sourceDims) {
        sourceDims = nodeData.inputData?.dimensions;
      }
      
      let result: { imageUrl: string; imageUrls?: string[]; metadata: { width: number; height: number; model: string; prompt: string } };

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
          ...config,
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
          sequentialImageGeneration: config?.sequentialImageGeneration,
          maxImages: config?.maxImages,
        };

        if (
          model === 'reve/edit-fast' ||
          model === 'reve/create' ||
          model === 'reve/extract-layout' ||
          model === 'reve/render-layout' ||
          model === 'reve/create-layout' ||
          model === 'reve/reconcile-layouts'
        ) {
          result = await anarchyService.generate(
            {
              ...baseParams,
              model,
              anarchyRemoveBackground: (config as any)?.anarchyRemoveBackground,
              anarchyUpscaleFactor: (config as any)?.anarchyUpscaleFactor,
              anarchyEffect: (config as any)?.anarchyEffect,
            },
            uploadedImages,
            controller.signal,
            onStatusChange
          );
        } else {
          // Choose generation mode based on model capabilities and available images
          const modelCaps = replicateService.getModelCapabilities(
            model as import('../../services/replicate').ReplicateImageModel
          );
          const useImg2Img = sourceImage && modelCaps.supportsImg2Img;
          result = useImg2Img
            ? await replicateService.generateImg2Img(baseParams, uploadedImages, controller.signal, onStatusChange)
            : await replicateService.generate(baseParams, controller.signal, onStatusChange);
        }
      }

      let finalImage: any = result.imageUrl;
      const isVideo = model && [
        'bytedance/seedance-2.0',
        'kwaivgi/kling-v3-omni-video',
        'xai/grok-imagine-video-1.5',
        'prunaai/p-video',
        'google/veo-3.1-fast',
        'pixverse/pixverse-v6',
        'openai/sora-2-pro',
        'wavespeedai/wan-2.1-i2v-480p',
        'wavespeedai/wan-2.1-i2v-720p',
      ].some(m => (model as string).startsWith(m) || m.startsWith(model as string));

      const aiConfig = useAIConfigStore.getState().config;
      const wmText = (aiConfig.watermarkText || '').trim();
      const wmEnabled = aiConfig.enableWatermark &&
        (aiConfig.watermarkType === 'image' ? !!aiConfig.watermarkImage : wmText.length > 0);

      if (isVideo) {
        try {
          // Bypasses CORS by downloading via Tauri Rust backend proxy
          logger.log('[BuilderWorkflow] Fetching video blob via Rust proxy...', { url: result.imageUrl });
          const base64Data = await invoke<string>('url_to_base64', { url: result.imageUrl });
          logger.log('[BuilderWorkflow] url_to_base64 returned, starts with:', base64Data?.substring(0, 40));
          if (base64Data && base64Data.startsWith('data:')) {
            finalImage = dataURLtoBlob(base64Data);
            logger.log('[BuilderWorkflow] Video blob created, size:', (finalImage as Blob).size, 'type:', (finalImage as Blob).type);
          } else {
            logger.warn('[BuilderWorkflow] Rust proxy returned invalid base64, using URL fallback', { prefix: base64Data?.substring(0, 50) });
          }
        } catch (err) {
          logger.error('[BuilderWorkflow] Failed to fetch video blob via Rust proxy, using URL fallback:', err);
        }
      } else {
        const resultImage = await persistImageLocally(result.imageUrl);
        finalImage = resultImage;

        // Apply watermark if enabled
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
      }

      const imageKey = `idb://${crypto.randomUUID()}`;
      await cacheLocalImage(imageKey, finalImage);

      const outputPacket = createDataPacket(
        imageKey,
        prompt,
        nodeData.processingType,
        { width: result.metadata.width, height: result.metadata.height },
        model,
        isVideo
      );

      let modelLabel = '';
      let parentId: string | undefined = undefined;

      try {
        const parent = getParent(nodeId);
        const rawParentImage = parent ? (parent.data as BuilderNodeData)?.image : undefined;
        // Resolve raw parent image first if it's cached
        const resolvedRawParentImage = await resolveImageIfCached(rawParentImage);
        // Persist parent image locally so history doesn't rely on expiring URLs
        const parentImage = resolvedRawParentImage ? await persistImageLocally(resolvedRawParentImage) : undefined;
        const modelId = model as string;
        
        const rootSourceNode = nodesRef.current.find(n => (n.data as BuilderNodeData)?.type === 'source');
        const rawRootImage = rootSourceNode ? (rootSourceNode.data as BuilderNodeData)?.image : undefined;
        const rootSourceImage = rawRootImage ? await resolveImageIfCached(rawRootImage) : undefined;
        const rootSourceId = rootSourceNode?.id;

        const parentHistoryEntryId = parent ? (parent.data as BuilderNodeData)?.historyEntryId : undefined;
        const rootHistoryEntryId = rootSourceNode ? (rootSourceNode.data as BuilderNodeData)?.historyEntryId : undefined;

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

        const nodeTree: NodeTreeData = {
          nodes: nodesRef.current.map(n => {
            const data = (n.data || {}) as BuilderNodeData;
            return {
              id: n.id,
              type: data?.type || 'source',
              position: n.position,
              image: data?.image,
              prompt: data?.prompt,
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

        modelLabel = MODEL_DISPLAY_NAMES[model] || model.split('/').pop() || model;
        parentId = parent?.id;
        
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

        // Link the canvas node to the newly created history entry and spawn extra sibling nodes if any
        const extraNodes: BuilderNode[] = [];
        const extraEdges: Edge[] = [];

        if (result.imageUrls && result.imageUrls.length > 1) {
          const extraUrls = result.imageUrls.slice(1);
          const siblings = parentId ? getChildren(parentId) : [];
          let extraCount = siblings.length + 1; // plus 1 for the current nodeId which is already a child

          for (let i = 0; i < extraUrls.length; i++) {
            const url = extraUrls[i];
            const localUrl = await persistImageLocally(url);
            
            let finalExtraImage = localUrl;
            if (wmEnabled) {
              try {
                let imageForWm = finalExtraImage;
                if (imageForWm.startsWith('http')) {
                  imageForWm = await invoke<string>('url_to_base64', { url: imageForWm });
                }
                finalExtraImage = await watermarkService.applyWatermark(imageForWm, {
                  type: aiConfig.watermarkType || 'text',
                  text: wmText || 'Anarchy AI',
                  watermarkImage: aiConfig.watermarkImage,
                  watermarkImageSize: aiConfig.watermarkImageSize ?? 80,
                  position: aiConfig.watermarkPosition ?? 'bottom-right',
                  opacity: aiConfig.watermarkOpacity ?? 0.5,
                  fontSize: aiConfig.watermarkFontSize ?? 24,
                });
              } catch (wmErr) {
                logger.warn('[Watermark] Failed to apply to extra image:', wmErr);
              }
            }

            const key = `idb://${crypto.randomUUID()}`;
            await cacheLocalImage(key, finalExtraImage);

            const childPacket = createDataPacket(
              key,
              prompt,
              nodeData.processingType,
              { width: result.metadata.width, height: result.metadata.height },
              model,
              isVideo
            );

            // Save extra history entry
            let extraHistoryId: string | undefined = undefined;
            try {
              const savedEntryExtra = await addHistoryEntry({
                type: (nodeData.processingType as any) === 'upscale' ? 'upscale' : 'render',
                label: prompt && prompt.length > 50 ? prompt.slice(0, 50) + '...' : (prompt || 'Generation'),
                prompt,
                model: modelId,
                inputImage: parentImage,
                outputImage: finalExtraImage,
                duration: Date.now() - _execStartTime,
                nodeTree, // We can reuse the same initial node tree
                rootSourceId,
                rootSourceImage,
                parentId: finalParentId,
                rootId: finalRootId,
                nodeType,
              });
              extraHistoryId = savedEntryExtra.id;
            } catch (historyErr) {
              logger.error('[History] Failed to save extra history entry:', historyErr);
            }

            // Calculate position
            let newPosition: XYPosition;
            if (parentId && parent) {
              const direction = extraCount % 2 === 0 ? 1 : -1;
              const offsetMultiplier = Math.ceil(extraCount / 2);
              const yOffset = direction * offsetMultiplier * VERTICAL_SPACING;
              newPosition = {
                x: parent.position.x + HORIZONTAL_SPACING,
                y: parent.position.y + yOffset
              };
              extraCount++;
            } else {
              newPosition = {
                x: node.position.x,
                y: node.position.y + (i + 1) * VERTICAL_SPACING
              };
            }

            const parentData = parent?.data as BuilderNodeData | undefined;
            const parentLineage = parentData?.lineage;
            const newId = `node-${crypto.randomUUID()}`;
            const extraNode: BuilderNode = {
              id: newId,
              type: 'baseNode',
              position: newPosition,
              width: 260,
              data: {
                label: modelLabel,
                type: 'result',
                processingType: nodeData.processingType,
                state: 'ready',
                image: key,
                originalImage: key,
                prompt,
                modelUsed: model,
                createdAt: Date.now(),
                processedAt: Date.now(),
                lineage: {
                  parentId: parentId || null,
                  rootSourceId: rootSourceId || '',
                  generation: parentLineage ? parentLineage.generation + 1 : 1,
                  branchIndex: i + 1,
                  processingType: nodeData.processingType,
                  ancestry: parentLineage && parent ? [...parentLineage.ancestry, parent.id] : [],
                },
                inputData: nodeData.inputData,
                outputData: childPacket,
                dimensions: { width: result.metadata.width, height: result.metadata.height },
                historyEntryId: extraHistoryId
              }
            };

            extraNodes.push(extraNode);

            // Create edges from all parents of original node to newId
            incomingEdges.forEach((edge, handleIndex) => {
              const ed = createEdge(edge.source, newId, {
                animated: false,
                isDataFlow: true,
                packet: edge.data?.packet as DataPacket | undefined,
                targetHandleIndex: handleIndex
              });
              ed.targetHandle = 'target';
              extraEdges.push(ed);
            });
          }
        }

        setNodes(nds => {
          const updated = nds.map(n => 
            n.id === nodeId 
              ? { ...n, data: { ...n.data, historyEntryId: savedEntry.id } }
              : n
          );
          return [...updated, ...extraNodes];
        });

        if (extraEdges.length > 0) {
          setEdges(eds => [...eds, ...extraEdges]);
        }

        // Propagate updates for extra nodes safely
        if (extraNodes.length > 0) {
          setTimeout(() => {
            extraNodes.forEach(extraNode => {
              if (extraNode?.id) {
                try {
                  propagateNodeUpdate(extraNode.id);
                } catch (e) {
                  logger.warn('[BuilderWorkflow] propagateNodeUpdate error for extraNode:', e);
                }
              }
            });
          }, 200);
        }

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



      setNodes(nds => nds.map(n => {
        if (n.id !== nodeId) return n;
        
        return {
          ...n,
          type: 'baseNode', // Switch React Flow renderer so image is displayed
          data: {
            ...n.data,
            type: 'result',
            processingType: isVideo ? 'video' : nodeData.processingType,
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

      // Update selected node state in Zustand if it is the currently selected node
      const currentSelected = useAIConfigStore.getState().selectedNode;
      if (currentSelected?.id === nodeId) {
        useAIConfigStore.getState().setSelectedNode({
          id: nodeId,
          type: 'result',
          image: imageKey,
          originalImage: imageKey,
          prompt,
          state: 'ready',
          isVideo: isVideo
        });
      }

      pushHistory(nodesRef.current, edgesRef.current); // snapshot before result lands

      // Update edges targeting this node: ghost handle 'ghost-target-0' -> BaseNode handle 'target'
      setEdges(eds => eds.map(e => 
        e.target === nodeId 
          ? { ...e, targetHandle: 'target' } 
          : e
      ));

      // Propagate update to children
      propagateNodeUpdate(nodeId, outputPacket);

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
      // Update selected node state in Zustand if it is the currently selected node
      const currentSelected = useAIConfigStore.getState().selectedNode;
      if (currentSelected?.id === nodeId) {
        useAIConfigStore.getState().setSelectedNode({
          ...currentSelected,
          state: 'error',
          errorMessage: error instanceof Error ? error.message : 'Generation failed'
        });
      }
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

    // Update selected node state in Zustand if it is the currently selected node
    const currentSelected = useAIConfigStore.getState().selectedNode;
    if (currentSelected?.id === nodeId) {
      useAIConfigStore.getState().setSelectedNode({
        ...currentSelected,
        state: 'cancelled',
        errorMessage: 'Execution cancelled by user'
      });
    }

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

    // If target has no upstream unexecuted dependencies, run directly with zero delay
    if (order.length <= 1) {
      return executeNodeSingle(nodeId, prompt, config);
    }

    const executeSingle = async (id: string) => {
      const node = nodesRef.current.find(n => n.id === id);
      const nodePrompt = id === nodeId ? prompt : ((node?.data?.prompt || node?.data?.promptDraft || 'AI generation') as string);
      const nodeConfig = id === nodeId ? config : (node?.data?.config as GenerationConfig || undefined);
      return executeNodeSingle(id, nodePrompt, nodeConfig);
    };

    try {
      queueStore.setIsExecuting(true);
      await queueStore.runQueue(executeSingle);
      const node = nodesRef.current.find(n => n.id === nodeId);
      return { image: node?.data?.image || '' };
    } finally {
      queueStore.setIsExecuting(false);
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

  const updateNodeImageAndPropagate = useCallback((nodeId: string, imageUrl?: string, layoutData?: any) => {
    const outputPacket = imageUrl ? createDataPacket(imageUrl, undefined, 'source') : undefined;

    // 1. Update target node
    setNodes(nds => nds.map(n => {
      if (n.id !== nodeId) return n;
      const currentData: any = n.data || {};
      const updatedData: any = { ...currentData };

      if (imageUrl) {
        updatedData.image = imageUrl;
        updatedData.state = 'ready';
        updatedData.outputData = outputPacket;
      }

      if (layoutData) {
        updatedData.layout = layoutData;
        updatedData.extractedLayout = layoutData;
      }

      return {
        ...n,
        data: updatedData
      };
    }));

    // 2. Propagate to children
    const children = getChildren(nodeId);
    const childIds = new Set(children.map(c => c.id));
    const edgeTimestamp = Date.now();

    setNodes(nds => nds.map(n => {
      if (!n || !n.data || !childIds.has(n.id)) return n;
      const childData = (n.data || {}) as BuilderNodeData;
      return {
        ...n,
        data: {
          ...childData,
          inputData: outputPacket || childData.inputData,
          image: childData.type === 'ghost' ? (outputPacket?.image || childData.image) : childData.image,
        }
      };
    }));

    setEdges(eds => eds.map(e => {
      if (!childIds.has(e.target) || e.source !== nodeId) return e;
      return { ...e, data: { ...e.data, packet: outputPacket || e.data?.packet, isActive: true, lastUpdate: edgeTimestamp } };
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

    // Check connection count for single input models (Grok video & upscalers)
    const selectedModel = useAIConfigStore.getState().config.model;
    const isSingleInputModel =
      selectedModel === 'xai/grok-imagine-video-1.5' ||
      selectedModel === 'prunaai/p-video' ||
      selectedModel === 'google/veo-3.1-fast' ||
      selectedModel === 'pixverse/pixverse-v6' ||
      selectedModel === 'openai/sora-2-pro' ||
      selectedModel === 'topazlabs/image-upscale' ||
      selectedModel === 'philz1337x/clarity-upscaler' ||
      selectedModel === 'prunaai/p-image-upscale';

    if (isSingleInputModel) {
      const activeNodeIds = new Set(nodesRef.current.map(n => n.id));
      const existingCount = edgesRef.current.filter(e => e.target === connection.target && activeNodeIds.has(e.source)).length;
      if (existingCount >= 1) {
        logger.error(`This engine (${selectedModel}) only supports 1 input connection.`);
        return false;
      }
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
      const data = (node.data || {}) as BuilderNodeData;
      if (data?.image) {
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
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;
    if (currentNodes.length === 0) return;

    pushHistory(currentNodes, currentEdges);

    // 1. Build Parent-Child map & Child-Parent map
    const childrenMap: Record<string, string[]> = {};
    const hasParent = new Set<string>();

    currentNodes.forEach((n) => {
      childrenMap[n.id] = [];
    });

    currentEdges.forEach((e) => {
      if (e.source && e.target) {
        if (!childrenMap[e.source]) childrenMap[e.source] = [];
        if (!childrenMap[e.source].includes(e.target)) {
          childrenMap[e.source].push(e.target);
        }
        hasParent.add(e.target);
      }
    });

    // Also check lineage.parentId for unlinked nodes
    currentNodes.forEach((n) => {
      const parentId = (n.data as BuilderNodeData)?.lineage?.parentId;
      if (parentId && parentId !== n.id && childrenMap[parentId]) {
        if (!childrenMap[parentId].includes(n.id)) {
          childrenMap[parentId].push(n.id);
        }
        hasParent.add(n.id);
      }
    });

    // 2. Identify Root Nodes (nodes with no parent)
    let rootNodes = currentNodes.filter((n) => !hasParent.has(n.id));
    if (rootNodes.length === 0) {
      rootNodes = [currentNodes[0]];
    }

    // 3. Calculate Subtree Heights for Tree Hierarchy
    const LEAF_HEIGHT = 230; // height + gap per leaf
    const HORIZONTAL_STEP = 360; // spacing between tree generations
    const targetPositions: Record<string, { x: number; y: number }> = {};
    const placedNodes = new Set<string>();

    const calcSubtreeHeight = (nodeId: string, visited = new Set<string>()): number => {
      if (visited.has(nodeId)) return LEAF_HEIGHT;
      visited.add(nodeId);

      const kids = (childrenMap[nodeId] || []).filter((k) => !visited.has(k));
      if (kids.length === 0) return LEAF_HEIGHT;

      const kidsHeight = kids.reduce((sum, kidId) => sum + calcSubtreeHeight(kidId, new Set(visited)), 0);
      return Math.max(LEAF_HEIGHT, kidsHeight);
    };

    const layoutSubtree = (nodeId: string, x: number, startY: number, visited = new Set<string>()): number => {
      if (placedNodes.has(nodeId) || visited.has(nodeId)) return startY;
      visited.add(nodeId);
      placedNodes.add(nodeId);

      const kids = (childrenMap[nodeId] || []).filter((k) => !placedNodes.has(k));
      const subHeight = calcSubtreeHeight(nodeId);

      // Center parent node vertically relative to its subtree
      const parentY = startY + subHeight / 2 - LEAF_HEIGHT / 2;
      targetPositions[nodeId] = {
        x: Math.round(x),
        y: Math.round(parentY),
      };

      if (kids.length === 0) {
        return startY + LEAF_HEIGHT;
      }

      let currentChildY = startY;
      kids.forEach((kidId) => {
        const kidHeight = calcSubtreeHeight(kidId);
        layoutSubtree(kidId, x + HORIZONTAL_STEP, currentChildY, new Set(visited));
        currentChildY += kidHeight;
      });

      return startY + subHeight;
    };

    // 4. Layout roots and unplaced orphan nodes
    let currentY = 100;
    rootNodes.forEach((root) => {
      const height = calcSubtreeHeight(root.id);
      layoutSubtree(root.id, 80, currentY);
      currentY += height + 80; // gap between separate root trees
    });

    // Handle any orphan nodes not connected to root trees
    currentNodes.forEach((n) => {
      if (!placedNodes.has(n.id)) {
        targetPositions[n.id] = {
          x: 80,
          y: Math.round(currentY),
        };
        currentY += LEAF_HEIGHT;
      }
    });

    // 5. Apply tree positions to ReactFlow state immediately
    setNodes((nds) =>
      nds.map((n) => {
        const target = targetPositions[n.id];
        if (!target) return n;
        return {
          ...n,
          position: { x: target.x, y: target.y },
        };
      })
    );
  }, [setNodes, pushHistory]);

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
  // DUMMY NODE & GROUP NODE WORKFLOW FUNCTIONS
  // ========================================================================

  const spawnDummyNode = useCallback((
    parentId?: string,
    processingType: ProcessingType = 'local',
    prompt: string = 'توليد ماسك...'
  ): string => {
    const parent = parentId ? getNode(parentId) : undefined;
    const parentData = parent?.data as BuilderNodeData | undefined;

    const id = `dummy-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const position = parentId ? calculateChildPosition(parentId) : { x: 350, y: 250 };

    const lineage: NodeLineage = parentData ? {
      parentId: parentId ?? null,
      rootSourceId: parentData.lineage.rootSourceId,
      generation: parentData.lineage.generation + 1,
      branchIndex: 0,
      processingType,
      ancestry: [...parentData.lineage.ancestry, parentId].filter((x): x is string => Boolean(x))
    } : {
      parentId: null,
      rootSourceId: id,
      generation: 0,
      branchIndex: 0,
      processingType,
      ancestry: [id]
    };

    const newNode: BuilderNode = {
      id,
      type: 'dummyNode',
      position,
      width: 280,
      data: {
        label: 'نود التوليد المؤقتة',
        type: 'dummy',
        processingType,
        state: 'processing',
        createdAt: Date.now(),
        lineage,
        prompt,
        isDummy: true,
        progressPercentage: 15,
        statusMessage: 'جارِ المعالجة بالذكاء الاصطناعي...',
        inputData: parentData?.outputData
      }
    };

    setNodes(nds => [...nds, newNode]);
    if (parentId) {
      setEdges(eds => [...eds, createEdge(parentId, id, { isDataFlow: true })]);
    }

    return id;
  }, [getNode, calculateChildPosition, setNodes, setEdges]);

  const convertDummyToResultNode = useCallback(async (
    dummyNodeId: string,
    resultImage: string,
    prompt: string,
    dimensions?: { width: number; height: number }
  ) => {
    const cachedUrl = resultImage;
    try {
      await cacheLocalImage(`result_${Date.now()}.png`, resultImage);
    } catch {
      // Keep original image string on fallback
    }

    setNodes(nds => nds.map(n => {
      if (n.id !== dummyNodeId) return n;
      const data = n.data as BuilderNodeData;
      const outputData: DataPacket = {
        image: cachedUrl,
        prompt,
        metadata: {
          timestamp: Date.now(),
          operationType: data.processingType,
        },
        dimensions
      };
      return {
        ...n,
        type: 'baseNode',
        data: {
          ...data,
          type: 'result',
          state: 'completed',
          image: cachedUrl,
          processedAt: Date.now(),
          outputData,
          isDummy: false,
          progressPercentage: 100,
          statusMessage: 'مكتمل'
        }
      };
    }));
  }, [setNodes]);

  const arrangeNodesInsideGroup = useCallback((groupNodeId: string) => {
    const groupNode = getNode(groupNodeId);
    if (!groupNode) return;
    const groupData = groupNode.data as BuilderNodeData;
    const childrenIds = groupData.groupChildren || [];
    if (childrenIds.length === 0) return;

    const cols = Math.ceil(Math.sqrt(childrenIds.length));
    const spacingX = 300;
    const spacingY = 250;
    const startX = groupNode.position.x + 30;
    const startY = groupNode.position.y + 60;

    setNodes(nds => nds.map(n => {
      const idx = childrenIds.indexOf(n.id);
      if (idx === -1) return n;
      const row = Math.floor(idx / cols);
      const col = idx % cols;
      return {
        ...n,
        position: {
          x: startX + col * spacingX,
          y: startY + row * spacingY
        }
      };
    }));
  }, [getNode, setNodes]);

  const onPainterRenderedImageAsNodeHandler = useCallback(async (payload: {
    compositeImage: string;
    maskDataUrl?: string;
    prompt: string;
    refImages?: string[];
    sourceNodeId?: string;
  }) => {
    const parentId = payload.sourceNodeId || selectedNodeId || nodesRef.current[0]?.id;
    if (!parentId) {
      logger.warn('[BuilderWorkflow] No parent node ID for mask generation');
      return;
    }

    const parentNode = nodesRef.current.find(n => n.id === parentId);
    const parentData = parentNode?.data as BuilderNodeData | undefined;
    const cleanParentImage = parentData?.outputData?.image || parentData?.image;

    const dummyId = spawnGhostNode(parentId, 'local');
    if (!dummyId) return;

    try {
      const currentConfig = useAIConfigStore.getState().config;
      const model = currentConfig.model || 'google/nano-banana-2';

      const updateState = (status: string, pct: number, msg: string) => {
        setNodes(nds => nds.map(n => n.id === dummyId ? {
          ...n,
          type: 'ghostNode',
          data: {
            ...n.data,
            state: status as any,
            progressPercentage: pct,
            statusMessage: msg,
            promptDraft: payload.prompt,
            config: { ...currentConfig }
          }
        } : n));
      };

      updateState('connecting', 20, 'Preparing engine and image inputs...');

      // 1. Resolve and upload source images
      let sourceImgUrl = cleanParentImage || payload.compositeImage;
      if (sourceImgUrl && sourceImgUrl.startsWith('idb://')) {
        sourceImgUrl = (await resolveImageIfCached(sourceImgUrl)) || sourceImgUrl;
      }
      const uploadedSourceImg = await uploadImageIfLocal(sourceImgUrl, model as string);

      let uploadedCompositeImg: string | undefined = undefined;
      if (payload.compositeImage && payload.compositeImage !== cleanParentImage) {
        let cImg = payload.compositeImage;
        if (cImg.startsWith('idb://')) {
          cImg = (await resolveImageIfCached(cImg)) || cImg;
        }
        uploadedCompositeImg = await uploadImageIfLocal(cImg, model as string);
      }

      let uploadedMaskImg: string | undefined = undefined;
      if (payload.maskDataUrl) {
        let mImg = payload.maskDataUrl;
        if (mImg.startsWith('idb://')) {
          mImg = (await resolveImageIfCached(mImg)) || mImg;
        }
        uploadedMaskImg = await uploadImageIfLocal(mImg, model as string);
      }

      // Upload reference images from Mask Note cards if present
      let uploadedRefImgs: string[] = [];
      if (payload.refImages && payload.refImages.length > 0) {
        uploadedRefImgs = (await Promise.all(
          payload.refImages.map(async (img) => {
            let rImg = img;
            if (rImg.startsWith('idb://')) {
              rImg = (await resolveImageIfCached(rImg)) || rImg;
            }
            return await uploadImageIfLocal(rImg, model as string);
          })
        )).filter(Boolean);
      }

      updateState('processing', 50, 'Sending request to AI engine...');

      const userId = getCurrentUserId() || 'anonymous';
      let generatedImageUrl = '';

      // 2. Dispatch to AI Engine based on model family
      const cleanUserPrompt = payload.prompt ? payload.prompt.replace(/^\d+[-–\s]*/, '').trim() : '';
      const promptToUse = cleanUserPrompt || payload.prompt || 'AI Mask Generation';

      if ((model as string).startsWith('google/nano-banana')) {
        // Nano Banana models use natural spatial reasoning for masked/indicated edits.
        // Primary input MUST BE the composite image containing the red highlight so the model sees WHERE to edit!
        const spatialPrompt = (payload.maskDataUrl || uploadedCompositeImg)
          ? `In the red highlighted region of the image, replace or generate: "${promptToUse}". Keep all unhighlighted areas, surrounding room, wall textures, floor, lighting, and furniture 100% identical and unchanged.`
          : promptToUse;

        const baseParams = {
          ...currentConfig,
          prompt: spatialPrompt,
          model: model as any,
          resolution: currentConfig.resolution || '1K',
          aspectRatio: currentConfig.aspectRatio || 'Auto',
          nodeId: dummyId,
          userId,
        };

        const primaryInput = uploadedCompositeImg || uploadedSourceImg;
        const secondaryInput = uploadedSourceImg && uploadedSourceImg !== primaryInput ? uploadedSourceImg : undefined;
        const imageInputs = [
          primaryInput,
          ...(secondaryInput ? [secondaryInput] : []),
          ...uploadedRefImgs
        ];

        const genResult = await replicateService.generateImg2Img(
          baseParams,
          imageInputs,
          undefined,
          (status) => updateState(status, 75, 'Processing AI generation...')
        );

        generatedImageUrl = genResult.imageUrl;
      } else if (uploadedMaskImg && (
        model === 'reve/edit-fast' ||
        (model as string).includes('inpaint') ||
        (model as string).includes('flux')
      )) {
        // Direct mask payload for inpaint-capable engines
        const prediction = await replicateService.runPrediction(
          model as string,
          {
            image: uploadedSourceImg,
            mask: uploadedMaskImg,
            prompt: promptToUse,
            resolution: currentConfig.resolution || '1K',
            aspect_ratio: currentConfig.aspectRatio || '1:1',
          },
          dummyId,
          userId
        );

        const rawOutput = prediction.output;
        if (typeof rawOutput === 'string') {
          generatedImageUrl = rawOutput;
        } else if (Array.isArray(rawOutput) && typeof rawOutput[0] === 'string') {
          generatedImageUrl = rawOutput[0];
        } else if (rawOutput && typeof rawOutput === 'object') {
          const obj = rawOutput as any;
          generatedImageUrl = obj.url || obj.image || (Array.isArray(obj.images) ? obj.images[0] : '');
        }
      } else {
        // General fallback using img2img
        const baseParams = {
          ...currentConfig,
          prompt: promptToUse,
          model: model as any,
          resolution: currentConfig.resolution || 'Auto',
          aspectRatio: currentConfig.aspectRatio || 'Auto',
          nodeId: dummyId,
          userId,
        };

        const primaryInput = uploadedCompositeImg || uploadedSourceImg;
        const secondaryInput = uploadedSourceImg && uploadedSourceImg !== primaryInput ? uploadedSourceImg : undefined;
        const imageInputs = [
          primaryInput,
          ...(secondaryInput ? [secondaryInput] : []),
          ...uploadedRefImgs
        ];

        const genResult = await replicateService.generateImg2Img(
          baseParams,
          imageInputs,
          undefined,
          (status) => updateState(status, 75, 'Processing AI generation...')
        );

        generatedImageUrl = genResult.imageUrl;
      }

      if (!generatedImageUrl) {
        throw new Error('No image URL received from AI engine');
      }

      updateState('completed', 100, 'Generation completed successfully!');

      // Persist generated image locally as a Blob so it never expires
      let localBlobOrData: Blob | string = generatedImageUrl;
      try {
        const resolvedBlob = await resolveUrlToBlob(generatedImageUrl);
        if (resolvedBlob) {
          localBlobOrData = resolvedBlob;
        }
      } catch (blobErr) {
        logger.warn('[BuilderWorkflow] Could not pre-resolve generated image blob:', blobErr);
      }

      const imageKey = `idb://${crypto.randomUUID()}`;
      await cacheLocalImage(imageKey, localBlobOrData);

      const outputPacket = createDataPacket(
        imageKey,
        payload.prompt,
        'local',
        { width: 1024, height: 1024 },
        model,
        false
      );

      const displayLabel = payload.prompt
        ? (payload.prompt.length > 30 ? payload.prompt.slice(0, 30) + '...' : payload.prompt)
        : 'Mask Inpaint Edit';

      setNodes(nds => nds.map(n => 
        n.id === dummyId 
          ? { 
              ...n, 
              type: 'baseNode', 
              data: { 
                ...n.data, 
                label: displayLabel,
                type: 'result',
                state: 'ready',
                image: imageKey,
                originalImage: imageKey,
                prompt: payload.prompt,
                outputData: outputPacket,
                updatedAt: Date.now()
              } 
            } 
          : n
      ));

      useBuilderQueueStore.getState().updateJob(dummyId, { state: 'ready' });

      // Notify MaskCanvas of the completed in-place edit
      window.dispatchEvent(new CustomEvent('anarchy:mask-generated-in-place', {
        detail: {
          imageUrl: imageKey,
          sourceNodeId: parentId,
        }
      }));
    } catch (err: any) {
      logger.error('[BuilderWorkflow] Mask generation error:', err);
      setNodes(nds => nds.map(n => n.id === dummyId ? {
        ...n,
        data: { ...n.data, state: 'error', errorMessage: err?.message || 'فشل التوليد بالذكاء الاصطناعي' }
      } : n));
    }
  }, [selectedNodeId, spawnGhostNode, setNodes]);

  // Listen for mask generation trigger from MaskCanvas / EnlargedPreview
  useEffect(() => {
    const handleMaskGenerateEvent = (e: Event) => {
      const customEv = e as CustomEvent;
      if (customEv.detail) {
        onPainterRenderedImageAsNodeHandler(customEv.detail);
      }
    };
    window.addEventListener('anarchy:mask-generate', handleMaskGenerateEvent);
    return () => window.removeEventListener('anarchy:mask-generate', handleMaskGenerateEvent);
  }, [onPainterRenderedImageAsNodeHandler]);

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
    createStandaloneGhostNode,
    spawnDummyNode,
    convertDummyToResultNode,
    arrangeNodesInsideGroup,
    onPainterRenderedImageAsNodeHandler,
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
    getNodes,
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
