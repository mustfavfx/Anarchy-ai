import type { NodeTreeData } from '../../../types/history';

export interface GraphValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  hasCycle: boolean;
  orphanNodes: string[];
  duplicateNodeIds: string[];
  brokenEdges: string[];
}

export class GraphValidator {
  static validateGraph(nodeTree?: NodeTreeData | null, edges: any[] = []): GraphValidationResult {
    const result: GraphValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      hasCycle: false,
      orphanNodes: [],
      duplicateNodeIds: [],
      brokenEdges: [],
    };

    if (!nodeTree || !Array.isArray(nodeTree.nodes) || nodeTree.nodes.length === 0) {
      result.isValid = false;
      result.errors.push('Empty or missing node tree');
      return result;
    }

    const nodeIds = new Set<string>();
    const nodeMap = new Map<string, any>();

    // 1. Check Duplicate IDs
    for (const node of nodeTree.nodes) {
      if (!node.id) {
        result.errors.push('Node missing ID');
        result.isValid = false;
        continue;
      }
      if (nodeIds.has(node.id)) {
        result.duplicateNodeIds.push(node.id);
        result.errors.push(`Duplicate node ID detected: ${node.id}`);
        result.isValid = false;
      } else {
        nodeIds.add(node.id);
        nodeMap.set(node.id, node);
      }
    }

    // 2. Validate Root Node
    if (nodeTree.sourceNodeId && !nodeMap.has(nodeTree.sourceNodeId)) {
      result.warnings.push(`sourceNodeId "${nodeTree.sourceNodeId}" not found among graph nodes.`);
    }

    // 3. Check Broken Edges
    if (Array.isArray(edges)) {
      for (const edge of edges) {
        if (!nodeMap.has(edge.source) || !nodeMap.has(edge.target)) {
          result.brokenEdges.push(edge.id || `${edge.source}-${edge.target}`);
          result.warnings.push(`Edge "${edge.id}" links non-existent nodes: source=${edge.source}, target=${edge.target}`);
        }
      }
    }

    // 4. Check Parent Links & Orphans
    for (const node of nodeTree.nodes) {
      if (node.parentId && !nodeMap.has(node.parentId) && node.parentId !== node.id) {
        result.orphanNodes.push(node.id);
        result.warnings.push(`Node "${node.id}" references non-existent parent "${node.parentId}".`);
      }
    }

    // 5. DFS Cycle Detection on Edges + Children
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfsCheckCycle = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const node = nodeMap.get(nodeId);
      const childTargets = new Set<string>(node?.children || []);

      for (const edge of edges) {
        if (edge.source === nodeId) {
          childTargets.add(edge.target);
        }
      }

      for (const childId of childTargets) {
        if (!visited.has(childId)) {
          if (dfsCheckCycle(childId)) return true;
        } else if (recursionStack.has(childId)) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const nodeId of nodeIds) {
      if (!visited.has(nodeId)) {
        if (dfsCheckCycle(nodeId)) {
          result.hasCycle = true;
          result.errors.push(`Circular cycle detected in graph execution flow starting at node: ${nodeId}`);
          result.isValid = false;
          break;
        }
      }
    }

    return result;
  }
}
