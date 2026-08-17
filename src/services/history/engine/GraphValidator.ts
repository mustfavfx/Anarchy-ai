import type { NodeTreeData } from '@/types/history';
import { NodeRole } from './classification';

export interface GraphValidationIssue {
  severity: 'error' | 'warning';
  nodeId?: string;
  message: string;
}

export interface GraphValidationResult {
  valid: boolean;
  issues: GraphValidationIssue[];
  repaired: NodeTreeData;
}

/**
 * Validates and repairs NodeTreeData structures.
 */
export class GraphValidator {
  static validate(nodeTree: NodeTreeData): GraphValidationResult {
    const issues: GraphValidationIssue[] = [];
    const nodeMap = new Map(nodeTree.nodes.map(n => [n.id, { ...n, children: [...(n.children || [])] }]));

    if (!nodeMap.has(nodeTree.sourceNodeId)) {
      issues.push({
        severity: 'error',
        message: `sourceNodeId "${nodeTree.sourceNodeId}" not found among nodes — cannot restore.`,
      });
      return { valid: false, issues, repaired: nodeTree };
    }

    // Drop parentId pointers to nodes that don't exist
    for (const node of nodeMap.values()) {
      if (node.parentId && !nodeMap.has(node.parentId)) {
        issues.push({
          severity: 'warning',
          nodeId: node.id,
          message: `parentId "${node.parentId}" not found — treating as orphan.`,
        });
        node.parentId = undefined;
      }
    }

    // Drop children[] entries pointing at nodes that don't exist
    for (const node of nodeMap.values()) {
      node.children = node.children.filter(childId => {
        const exists = nodeMap.has(childId);
        if (!exists) {
          issues.push({
            severity: 'warning',
            nodeId: node.id,
            message: `children[] referenced missing node "${childId}" — dropped.`,
          });
        }
        return exists;
      });
    }

    // Repair one-directional links
    for (const node of nodeMap.values()) {
      if (node.parentId) {
        const parent = nodeMap.get(node.parentId)!;
        if (!parent.children.includes(node.id)) {
          parent.children.push(node.id);
          issues.push({
            severity: 'warning',
            nodeId: node.id,
            message: `Parent "${node.parentId}" was missing this node in children[] — relinked.`,
          });
        }
      }
    }

    // Cycle detection
    const visiting = new Set<string>();
    const settled = new Set<string>();
    const hasCycle = (id: string): boolean => {
      if (settled.has(id)) return false;
      if (visiting.has(id)) return true;
      visiting.add(id);
      for (const childId of nodeMap.get(id)?.children || []) {
        if (hasCycle(childId)) return true;
      }
      visiting.delete(id);
      settled.add(id);
      return false;
    };
    if (hasCycle(nodeTree.sourceNodeId)) {
      issues.push({
        severity: 'error',
        message: 'Cycle detected in tree — restore would loop.',
      });
    }

    // Sanity-check positions
    for (const node of nodeMap.values()) {
      const pos = node.position;
      const valid = pos && typeof pos.x === 'number' && typeof pos.y === 'number' && !Number.isNaN(pos.x) && !Number.isNaN(pos.y);
      if (!valid) {
        issues.push({
          severity: 'warning',
          nodeId: node.id,
          message: 'Invalid or missing position — defaulted to {x: 0, y: 0}.',
        });
        node.position = { x: 0, y: 0 };
      }
    }

    // Unreachable nodes
    const reachable = new Set<string>();
    const queue = [nodeTree.sourceNodeId];
    while (queue.length) {
      const id = queue.shift()!;
      if (reachable.has(id)) continue;
      reachable.add(id);
      queue.push(...(nodeMap.get(id)?.children || []));
    }
    for (const id of nodeMap.keys()) {
      if (!reachable.has(id)) {
        issues.push({
          severity: 'warning',
          nodeId: id,
          message: 'Not reachable from sourceNodeId — restore will skip this node.',
        });
      }
    }

    // Connections
    let repairedConnections = nodeTree.connections;
    if (nodeTree.connections) {
      repairedConnections = nodeTree.connections.filter(conn => {
        const valid = nodeMap.has(conn.sourceId) && nodeMap.has(conn.targetId);
        if (!valid) {
          issues.push({
            severity: 'warning',
            message: `connections[] entry "${conn.sourceId}->${conn.targetId}" references a missing node — dropped.`,
          });
        }
        return valid;
      });
    }

    // isPresentationSource uniqueness
    const presentationSourceIds = Array.from(nodeMap.values()).filter(n => n.isPresentationSource);
    if (presentationSourceIds.length > 1) {
      issues.push({
        severity: 'warning',
        message: `${presentationSourceIds.length} nodes were marked isPresentationSource — kept only "${presentationSourceIds[0].id}", cleared the rest.`,
      });
      for (const extra of presentationSourceIds.slice(1)) {
        extra.isPresentationSource = false;
      }
    }

    // Collapsed groups
    let repairedCollapsedGroupIds = nodeTree.collapsedGroupIds;
    if (nodeTree.collapsedGroupIds) {
      repairedCollapsedGroupIds = nodeTree.collapsedGroupIds.filter(id => {
        const node = nodeMap.get(id);
        const valid = Boolean(node && node.type === NodeRole.Group);
        if (!valid) {
          issues.push({
            severity: 'warning',
            nodeId: id,
            message: 'collapsedGroupIds referenced a missing or non-group node — dropped.',
          });
        }
        return valid;
      });
    }

    return {
      valid: !issues.some(i => i.severity === 'error'),
      issues,
      repaired: {
        ...nodeTree,
        nodes: Array.from(nodeMap.values()),
        connections: repairedConnections,
        collapsedGroupIds: repairedCollapsedGroupIds,
      },
    };
  }
}
