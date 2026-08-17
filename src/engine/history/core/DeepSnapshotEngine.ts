import type { HistoryEntry, NodeTreeData } from '../../../types/history';

export interface DeepCanvasSnapshot {
  nodes: any[];
  edges: any[];
  viewport: { x: number; y: number; zoom: number };
  selectedNodeId?: string;
  sourceNodeId: string;
  activeNodeId?: string;
  createdAt: number;
}

export class DeepSnapshotEngine {
  static createSnapshot(
    id: string,
    type: any,
    label: string,
    nodes: any[],
    edges: any[] = [],
    viewport: { x: number; y: number; zoom: number } = { x: 0, y: 0, zoom: 1 },
    selectedNodeId?: string,
    prompt?: string,
    model?: string,
    outputImage?: string
  ): HistoryEntry {
    const rootNode = nodes.find(n => n.data?.type === 'source') || nodes[0];
    const sourceNodeId = rootNode ? rootNode.id : (nodes[0]?.id || 'root');

    const treeNodes = nodes.map(n => ({
      id: n.id,
      type: n.data?.type || n.type || 'source',
      position: n.position ? { x: n.position.x, y: n.position.y } : { x: 0, y: 0 },
      image: n.data?.image || '',
      prompt: n.data?.prompt || n.data?.config?.prompt || '',
      processingType: n.data?.processingType || n.data?.type || 'generate',
      state: n.data?.state || 'ready',
      parentId: n.data?.parentId,
      historyEntryId: n.data?.historyEntryId,
    }));

    const nodeTree: NodeTreeData = {
      nodes: treeNodes as any,
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
        edges,
        selectedNodeId,
      },
    };
  }
}
