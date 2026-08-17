import type { HistoryEntry, NodeTreeData } from '../../../types/history';

export interface TimelineStep {
  id: string;
  image: string;
  prompt?: string;
  model?: string;
  processingType: string;
  timestamp?: number;
}

export class TimelineService {
  static buildTimeline(entry: HistoryEntry, nodeTree?: NodeTreeData | null): TimelineStep[] {
    const steps: TimelineStep[] = [];

    if (nodeTree && nodeTree.nodes && nodeTree.nodes.length > 0) {
      const activeId = nodeTree.activeNodeId || nodeTree.nodes.find(n => n.historyEntryId === entry.id)?.id || nodeTree.nodes[nodeTree.nodes.length - 1]?.id || nodeTree.sourceNodeId;
      const nodeMap = new Map(nodeTree.nodes.map(n => [n.id, n]));

      let currentId: string | undefined = activeId;
      const path: any[] = [];
      const visited = new Set<string>();

      while (currentId && nodeMap.has(currentId) && !visited.has(currentId)) {
        visited.add(currentId);
        const currNode = nodeMap.get(currentId)!;
        path.push(currNode);
        currentId = currNode.parentId;
      }

      path.reverse();

      for (const node of path) {
        steps.push({
          id: node.historyEntryId || node.id,
          image: node.image || '',
          prompt: node.prompt,
          model: entry.model,
          processingType: node.type === 'source' ? 'source' : (node.processingType || 'render'),
          timestamp: entry.timestamp,
        });
      }
    }

    if (steps.length === 0) {
      steps.push({
        id: entry.parentId || 'before',
        image: entry.inputImage || '',
        prompt: entry.prompt,
        model: entry.model,
        processingType: 'source',
        timestamp: entry.timestamp,
      });
      steps.push({
        id: entry.id,
        image: entry.outputImage || '',
        prompt: entry.prompt,
        model: entry.model,
        processingType: entry.type || 'render',
        timestamp: entry.timestamp,
      });
    }

    return steps;
  }
}
