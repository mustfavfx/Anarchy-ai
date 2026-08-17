import type { NodeTreeData } from '../../../types/history';

export class CanvasSnapshotService {
  static captureSnapshot(nodes: any[], activeNodeId?: string): NodeTreeData {
    const rootNode = nodes.find(n => n.data?.type === 'source') || nodes[0];
    const sourceNodeId = rootNode ? rootNode.id : (nodes[0]?.id || 'root');

    const treeNodes = nodes.map(n => {
      const data = n.data || {};
      return {
        id: n.id,
        type: data.type || 'source',
        position: n.position || { x: 0, y: 0 },
        image: data.image || '',
        prompt: data.prompt || data.config?.prompt || '',
        processingType: data.processingType || data.type || 'generate',
        state: data.state || 'ready',
        parentId: data.parentId,
        historyEntryId: data.historyEntryId,
      };
    });

    return {
      nodes: treeNodes as any,
      sourceNodeId,
      activeNodeId: activeNodeId || sourceNodeId,
      createdAt: Date.now(),
    };
  }
}
