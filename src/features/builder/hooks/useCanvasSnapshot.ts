import { useCallback, useRef } from 'react';
import type { ReactFlowInstance } from 'reactflow';
import type { NodeTreeData } from '@/types/history';

interface CanvasSnapshotOptions {
  reactFlowInstance: ReactFlowInstance | null;
  activeNodeId?: string;
  prompt?: string;
  model?: string;
}

/**
 * useCanvasSnapshot — Captures a full deep snapshot of the React Flow canvas state.
 *
 * Captures:
 * - All nodes (id, type, position, width, height, image, prompt, state, hidden, selected)
 * - All edges (id, source, target, sourceHandle, targetHandle, type)
 * - Viewport transform (x, y, zoom)
 * - Active selection state
 * - Timestamp
 *
 * Used by useBuilderWorkflow to save complete graph snapshots on generation.
 */
export function useCanvasSnapshot() {
  const instanceRef = useRef<ReactFlowInstance | null>(null);

  const setInstance = useCallback((instance: ReactFlowInstance | null) => {
    instanceRef.current = instance;
  }, []);

  const captureSnapshot = useCallback((options: CanvasSnapshotOptions): NodeTreeData => {
    const { reactFlowInstance, activeNodeId, prompt, model } = options;
    const rf = reactFlowInstance || instanceRef.current;

    const rawNodes = rf ? rf.getNodes() : [];
    const rawEdges = rf ? rf.getEdges() : [];
    const viewport = rf ? rf.getViewport() : { x: 0, y: 0, zoom: 1 };

    const snapshotNodes = rawNodes.map(n => ({
      id: n.id,
      type: (n.data?.type || n.type || 'source') as any,
      position: { x: n.position.x, y: n.position.y },
      width: n.width || (n as any).measured?.width || 260,
      height: n.height || (n as any).measured?.height || 300,
      image: n.data?.image || '',
      prompt: n.data?.prompt || n.data?.config?.prompt || prompt || '',
      processingType: n.data?.processingType || n.data?.type || 'generate',
      state: n.data?.state || 'ready',
      parentId: n.data?.lineage?.parentId || n.data?.parentId || undefined,
      historyEntryId: n.data?.historyEntryId,
      hidden: n.hidden ?? false,
      selected: n.selected ?? false,
      model: n.data?.model || model || '',
    }));

    const snapshotEdges = rawEdges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle || undefined,
      targetHandle: e.targetHandle || undefined,
      type: e.type || 'default',
    }));

    // Find source node (root of the tree)
    const sourceNode = rawNodes.find(n => n.data?.type === 'source') || rawNodes[0];
    const sourceNodeId = sourceNode?.id || 'root';

    return {
      nodes: snapshotNodes as any,
      sourceNodeId,
      activeNodeId: activeNodeId || sourceNodeId,
      createdAt: Date.now(),
      // Store edges + viewport in a structured way
      edges: snapshotEdges as any,
      viewport,
    } as NodeTreeData & { edges: any[]; viewport: any };
  }, []);

  return { setInstance, captureSnapshot, instanceRef };
}
