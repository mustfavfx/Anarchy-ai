import { useCallback } from 'react';
import type { Edge, XYPosition } from '@xyflow/react';
import { logger } from '../../../utils/logger';
import { addHistoryEntry, cacheLocalImage } from '../../../services/history/HistoryService';
import { useBuilderQueueStore } from '../../../stores/builderQueueStore';
import type { 
  BuilderNode, 
  BuilderNodeData, 
  ProcessingType, 
  DataPacket, 
  NodeLineage
} from '../types';
import type { NodeTreeData } from '../../../types/history';
import {
  createDataPacket,
  createEdge,
  TYPE_LABELS,
} from './workflowConstants';

export interface UseWorkflowNodeOpsParams {
  nodesRef: React.MutableRefObject<BuilderNode[]>;
  edgesRef: React.MutableRefObject<Edge[]>;
  setNodes: (update: BuilderNode[] | ((curr: BuilderNode[]) => BuilderNode[])) => void;
  setEdges: (update: Edge[] | ((curr: Edge[]) => Edge[])) => void;
  getNode: (nodeId: string) => BuilderNode | undefined;
  getChildren: (nodeId: string) => BuilderNode[];
  calculateChildPosition: (parentId: string) => XYPosition;
  pushHistory?: (nodes: BuilderNode[], edges: Edge[]) => void;
}

export const useWorkflowNodeOps = ({
  nodesRef,
  edgesRef,
  setNodes,
  setEdges,
  getNode,
  getChildren,
  calculateChildPosition,
  pushHistory,
}: UseWorkflowNodeOpsParams) => {
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

    pushHistory?.(nodesRef.current, edgesRef.current); // snapshot before adding
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
  }, [setNodes, pushHistory, nodesRef, edgesRef]);

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
        pendingPlacement: false,
        isStandaloneGenerator: true
      } as BuilderNodeData
    };

    nodesRef.current = [...nodesRef.current, newNode];
    setNodes(nds => [...nds, newNode]);
    return id;
  }, [setNodes, nodesRef]);

  const spawnDummyNode = useCallback((
    parentId?: string,
    processingType: ProcessingType = 'local',
    prompt: string = 'Generating mask...'
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
        label: 'Temporary Generation Node',
        type: 'dummy',
        processingType,
        state: 'processing',
        createdAt: Date.now(),
        lineage,
        prompt,
        isDummy: true,
        progressPercentage: 15,
        statusMessage: 'AI Processing...',
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
          statusMessage: 'Completed'
        }
      };
    }));
  }, [setNodes]);

  return {
    createSourceNode,
    spawnGhostNode,
    createStandaloneGhostNode,
    spawnDummyNode,
    convertDummyToResultNode,
  };
};
