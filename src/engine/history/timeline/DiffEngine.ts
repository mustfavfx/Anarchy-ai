import type { HistoryEntry, NodeTreeData } from '../../../types/history';

export interface ComprehensiveDiff {
  promptDiff?: { before: string; after: string };
  modelDiff?: { before: string; after: string };
  nodeDiffs: Array<{ nodeId: string; changeType: 'added' | 'removed' | 'modified'; details: any }>;
  edgeDiffs: Array<{ edgeId: string; changeType: 'added' | 'removed' }>;
  paramDiffs: Array<{ key: string; before: any; after: any }>;
}

export class DiffEngine {
  static compareEntries(a: HistoryEntry, b: HistoryEntry): ComprehensiveDiff {
    const diff: ComprehensiveDiff = {
      promptDiff: a.prompt !== b.prompt ? { before: a.prompt || '', after: b.prompt || '' } : undefined,
      modelDiff: a.model !== b.model ? { before: a.model || '', after: b.model || '' } : undefined,
      nodeDiffs: [],
      edgeDiffs: [],
      paramDiffs: [],
    };

    // Compare parameters
    const paramsA = a.params || {};
    const paramsB = b.params || {};
    const paramKeys = new Set([...Object.keys(paramsA), ...Object.keys(paramsB)]);

    for (const key of paramKeys) {
      if (paramsA[key] !== paramsB[key]) {
        diff.paramDiffs.push({ key, before: paramsA[key], after: paramsB[key] });
      }
    }

    // Compare node trees if present
    if (a.nodeTree && b.nodeTree) {
      this.compareNodeTrees(a.nodeTree, b.nodeTree, diff);
    }

    return diff;
  }

  private static compareNodeTrees(treeA: NodeTreeData, treeB: NodeTreeData, diff: ComprehensiveDiff): void {
    const mapA = new Map(treeA.nodes.map(n => [n.id, n]));
    const mapB = new Map(treeB.nodes.map(n => [n.id, n]));

    for (const [id, nodeA] of mapA.entries()) {
      if (!mapB.has(id)) {
        diff.nodeDiffs.push({ nodeId: id, changeType: 'removed', details: nodeA });
      } else {
        const nodeB = mapB.get(id)!;
        if (nodeA.prompt !== nodeB.prompt || nodeA.image !== nodeB.image) {
          diff.nodeDiffs.push({ nodeId: id, changeType: 'modified', details: { before: nodeA, after: nodeB } });
        }
      }
    }

    for (const [id, nodeB] of mapB.entries()) {
      if (!mapA.has(id)) {
        diff.nodeDiffs.push({ nodeId: id, changeType: 'added', details: nodeB });
      }
    }
  }
}
