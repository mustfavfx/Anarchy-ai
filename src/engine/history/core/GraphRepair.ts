import type { NodeTreeData } from '../../../types/history';
import { GraphValidator, type GraphValidationResult } from './GraphValidator';

export interface RepairLog {
  repairedAt: number;
  repairsCount: number;
  warningsCount: number;
  repairedNodes: string[];
  repairedEdges: string[];
  details: string[];
}

export class GraphRepair {
  static repairGraph(nodeTree: NodeTreeData, edges: any[] = []): { repairedTree: NodeTreeData; repairedEdges: any[]; log: RepairLog } {
    const validation = GraphValidator.validateGraph(nodeTree, edges);
    const log: RepairLog = {
      repairedAt: Date.now(),
      repairsCount: 0,
      warningsCount: validation.warnings.length,
      repairedNodes: [],
      repairedEdges: [],
      details: [],
    };

    if (validation.isValid && validation.warnings.length === 0) {
      return { repairedTree: nodeTree, repairedEdges: edges, log };
    }

    const repairedNodes: any[] = [];
    const seenIds = new Set<string>();

    for (let i = 0; i < nodeTree.nodes.length; i++) {
      const originalNode = nodeTree.nodes[i];
      let cleanId = originalNode.id || `node_repaired_${i}_${Date.now()}`;
      if (seenIds.has(cleanId)) {
        cleanId = `${cleanId}_dup_${i}`;
        log.repairsCount++;
        log.repairedNodes.push(cleanId);
        log.details.push(`Renamed duplicate node ID to ${cleanId}`);
      }
      seenIds.add(cleanId);

      repairedNodes.push({
        ...originalNode,
        id: cleanId,
        children: Array.isArray(originalNode.children) ? [...originalNode.children] : [],
      });
    }

    const nodeMap = new Map(repairedNodes.map(n => [n.id, n]));

    for (const node of repairedNodes) {
      if (node.parentId && !nodeMap.has(node.parentId)) {
        log.repairsCount++;
        log.repairedNodes.push(node.id);
        log.details.push(`Detached broken parentId "${node.parentId}" from node "${node.id}".`);
        delete node.parentId;
      }
    }

    // Filter valid edges
    const validEdges = edges.filter(e => {
      const valid = nodeMap.has(e.source) && nodeMap.has(e.target);
      if (!valid) {
        log.repairsCount++;
        log.repairedEdges.push(e.id || `${e.source}-${e.target}`);
        log.details.push(`Removed broken edge: source=${e.source}, target=${e.target}`);
      }
      return valid;
    });

    let sourceNodeId = nodeTree.sourceNodeId;
    if (!sourceNodeId || !nodeMap.has(sourceNodeId)) {
      sourceNodeId = repairedNodes[0]?.id || 'root';
      log.repairsCount++;
      log.details.push(`Reassigned missing sourceNodeId to "${sourceNodeId}".`);
    }

    const repairedTree: NodeTreeData = {
      nodes: repairedNodes,
      sourceNodeId,
      activeNodeId: nodeTree.activeNodeId && nodeMap.has(nodeTree.activeNodeId) ? nodeTree.activeNodeId : sourceNodeId,
      createdAt: nodeTree.createdAt || Date.now(),
    };

    return { repairedTree, repairedEdges: validEdges, log };
  }
}
