import type { HistoryEntry, NodeTreeData } from '../../../types/history';

export interface ViewportTransform {
  x: number;
  y: number;
  zoom: number;
}

export interface DeepCanvasSnapshotPayload {
  id: string;
  type: any;
  label: string;
  nodes: any[];
  edges: any[];
  viewport: ViewportTransform;
  selectedNodeId?: string;
  prompt?: string;
  model?: string;
  outputImage?: string;
  executionMetadata?: Record<string, any>;
}

export class DeepCanvasSnapshot {
  static capture(payload: DeepCanvasSnapshotPayload): HistoryEntry {
    const { id, type, label, nodes, edges, viewport, selectedNodeId, prompt, model, outputImage, executionMetadata } = payload;

    const rootNode = nodes.find(n => n.data?.type === 'source') || nodes[0];
    const sourceNodeId = rootNode ? rootNode.id : (nodes[0]?.id || 'root');

    const snapshotNodes = nodes.map(n => ({
      id: n.id,
      type: n.data?.type || n.type || 'source',
      position: n.position ? { x: n.position.x, y: n.position.y } : { x: 0, y: 0 },
      width: n.width || n.measured?.width || 260,
      height: n.height || n.measured?.height || 300,
      image: n.data?.image || '',
      prompt: n.data?.prompt || n.data?.config?.prompt || '',
      processingType: n.data?.processingType || n.data?.type || 'generate',
      state: n.data?.state || 'ready',
      parentId: n.data?.parentId,
      historyEntryId: n.data?.historyEntryId,
      hidden: n.hidden ?? false,
      selected: n.selected ?? false,
    }));

    const snapshotEdges = edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      type: e.type || 'default',
    }));

    const nodeTree: NodeTreeData = {
      nodes: snapshotNodes as any,
      sourceNodeId,
      activeNodeId: selectedNodeId || sourceNodeId,
      createdAt: Date.now(),
    };

    return {
      id,
      timestamp: Date.now(),
      type,
      label,
      prompt,
      model,
      outputImage,
      nodeTree,
      params: {
        prompt,
        model,
        viewport,
        edges: snapshotEdges,
        selectedNodeId,
        executionMetadata,
      },
    };
  }
}
