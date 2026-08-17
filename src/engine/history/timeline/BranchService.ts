import type { HistoryEntry, NodeTreeData } from '../../../types/history';

export interface BranchNode {
  id: string;
  entry: HistoryEntry;
  parentId?: string;
  children: BranchNode[];
}

export class BranchService {
  static buildBranchTree(entries: HistoryEntry[]): BranchNode[] {
    const nodeMap = new Map<string, BranchNode>();

    for (const entry of entries) {
      nodeMap.set(entry.id, {
        id: entry.id,
        entry,
        parentId: entry.parentId || entry.rootSourceId,
        children: [],
      });
    }

    const roots: BranchNode[] = [];

    for (const node of nodeMap.values()) {
      if (node.parentId && nodeMap.has(node.parentId) && node.parentId !== node.id) {
        nodeMap.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }
}
