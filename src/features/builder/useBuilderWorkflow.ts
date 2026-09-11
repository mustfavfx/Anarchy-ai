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
import { useNotificationStore } from '../../stores/notificationStore';
import { useBuilderQueueStore } from '../../stores/builderQueueStore';
import { watermarkService } from '../../services/watermark/WatermarkService';
import { getUnifiedCost, deductCredits, refundCredits, getUserCredit, DEV_MODE } from '../../services/credit/creditService';
import { addHistoryEntry, cacheLocalImage, getLocalImage, deleteLocalImage, revokeObjectUrl, dataURLtoBlob, resolveUrlToBlob } from '../../services/history/HistoryService';
import type { NodeTreeData } from '../../types/history';
import { invoke } from '@tauri-apps/api/core';
import { STORAGE_KEYS } from '../../utils/storageKeys';
import { track } from '../../services/tracking/trackingService';
import { useAuth } from '../auth/AuthContext';
import { getCurrentUserId } from '../../services/supabase/supabaseClient';

// Re-export modular components, types, and constants for 100% backward compatibility
export * from './workflow/workflowConstants';
export * from './workflow/useWorkflowHistory';
export * from './workflow/workflowLayoutEngine';
export * from './workflow/useWorkflowExecution';
export * from './workflow/useWorkflowPainter';
export * from './workflow/useWorkflowNodeOps';

import {
  getAutosaveKey,
  uploadImageIfLocal,
  persistImageLocally,
  resolveImageIfCached,
  validateWorkflowData,
  createDataPacket,
  createEdge,
  HORIZONTAL_SPACING,
  VERTICAL_SPACING,
  TYPE_LABELS,
  MODEL_DISPLAY_NAMES,
  type GenerationConfig,
} from './workflow/workflowConstants';
import { useWorkflowHistory } from './workflow/useWorkflowHistory';
import {
  calculateTreePositions,
  generateBenchmarkGraph,
  calculateGroupChildPositions,
} from './workflow/workflowLayoutEngine';
import { useWorkflowExecution } from './workflow/useWorkflowExecution';
import { useWorkflowPainter } from './workflow/useWorkflowPainter';
import { useWorkflowNodeOps } from './workflow/useWorkflowNodeOps';

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

  // ── Undo/Redo history (delegated to useWorkflowHistory) ───────────────────
  const {
    canUndo,
    canRedo,
    pushHistory,
    undo,
    redo,
    syncUndoRedoState,
  } = useWorkflowHistory({
    nodes,
    edges,
    setNodes,
    setEdges,
  });

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
  // ── Node Operations (delegated to useWorkflowNodeOps) ────────────────────
  const {
    createSourceNode,
    spawnGhostNode,
    createStandaloneGhostNode,
    spawnDummyNode,
    convertDummyToResultNode,
  } = useWorkflowNodeOps({
    nodesRef,
    edgesRef,
    setNodes,
    setEdges,
    getNode,
    getChildren,
    calculateChildPosition,
  });

  // ── Workflow Execution (delegated to useWorkflowExecution) ───────────────
  const {
    executeNodeSingle,
    cancelExecution,
    executeNode,
    addChildNode,
    executeProcessing,
  } = useWorkflowExecution({
    nodesRef,
    edgesRef,
    setNodes,
    setEdges,
    getNode,
    getParent,
    getChildren,
    propagateNodeUpdate,
    pushHistory,
    abortControllers,
    tabId,
    userId: user?.id || 'anonymous',
    spawnGhostNode,
  });

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
      selectedModel === 'prunaai/p-image-upscale' ||
      selectedModel === 'philz1337x/clarity-pro-upscaler';

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
  // ========================================================================
  // AUTO LAYOUT (delegated to workflowLayoutEngine)
  // ========================================================================

  // ========================================================================
  // AUTO LAYOUT (delegated to workflowLayoutEngine)
  // ========================================================================

  const rearrangeNodes = useCallback((): void => {
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;
    if (currentNodes.length === 0) return;

    pushHistory(currentNodes, currentEdges);

    const targetPositions = calculateTreePositions(currentNodes, currentEdges);

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

    const { newNodes, newEdges } = generateBenchmarkGraph(nodeCount, edgeCount);

    setNodes(newNodes);
    setEdges(newEdges);
    pushHistory(newNodes, newEdges);
  }, [setNodes, setEdges, pushHistory]);

  const arrangeNodesInsideGroup = useCallback((groupNodeId: string) => {
    const groupNode = getNode(groupNodeId);
    if (!groupNode) return;
    const groupData = groupNode.data as BuilderNodeData;
    const childrenIds = groupData.groupChildren || [];
    if (childrenIds.length === 0) return;

    const positions = calculateGroupChildPositions(groupNode, childrenIds);

    setNodes(nds => nds.map(n => {
      const pos = positions[n.id];
      if (!pos) return n;
      return {
        ...n,
        position: pos
      };
    }));
  }, [getNode, setNodes]);

  // ── Painter & Inpaint Event Listeners (delegated to useWorkflowPainter) ──
  const {
    onPainterRenderedImageAsNodeHandler,
  } = useWorkflowPainter({
    nodesRef,
    selectedNodeId,
    setSelectedNodeId,
    setNodes,
    setEdges,
    getNode,
    calculateChildPosition,
  });

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
