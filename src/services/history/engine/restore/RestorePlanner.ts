import type { NodeTreeData } from '@/types/history';
import { GraphValidator, type GraphValidationIssue } from '../GraphValidator';

export interface RestorePlan {
  valid: boolean;
  issues: GraphValidationIssue[];
  totalNodes: number;
  repairedTree: NodeTreeData;
}

export class RestorePlanner {
  static planFullRestore(nodeTree: NodeTreeData): RestorePlan {
    const result = GraphValidator.validate(nodeTree);
    const nodeMap = new Map(result.repaired.nodes.map(n => [n.id, n]));
    const reachable = new Set<string>();
    const queue = [result.repaired.sourceNodeId];
    while (queue.length) {
      const id = queue.shift()!;
      if (reachable.has(id) || !nodeMap.has(id)) continue;
      reachable.add(id);
      queue.push(...(nodeMap.get(id)?.children || []));
    }
    return {
      valid: result.valid,
      issues: result.issues,
      totalNodes: reachable.size,
      repairedTree: result.repaired,
    };
  }
}
