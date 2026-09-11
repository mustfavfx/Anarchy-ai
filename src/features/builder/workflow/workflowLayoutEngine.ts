import type { Edge } from '@xyflow/react';
import type { BuilderNode, BuilderNodeData } from '../types';
import { HORIZONTAL_SPACING, createEdge } from './workflowConstants';

/**
 * Calculates hierarchical tree layout positions for nodes and edges
 */
export function calculateTreePositions(
  currentNodes: BuilderNode[],
  currentEdges: Edge[]
): Record<string, { x: number; y: number }> {
  if (currentNodes.length === 0) return {};

  // 1. Build Parent-Child map & Child-Parent map
  const childrenMap: Record<string, string[]> = {};
  const hasParent = new Set<string>();

  currentNodes.forEach((n) => {
    childrenMap[n.id] = [];
  });

  currentEdges.forEach((e) => {
    if (e.source && e.target) {
      if (!childrenMap[e.source]) childrenMap[e.source] = [];
      if (!childrenMap[e.source].includes(e.target)) {
        childrenMap[e.source].push(e.target);
      }
      hasParent.add(e.target);
    }
  });

  // Also check lineage.parentId for unlinked nodes
  currentNodes.forEach((n) => {
    const parentId = (n.data as BuilderNodeData)?.lineage?.parentId;
    if (parentId && parentId !== n.id && childrenMap[parentId]) {
      if (!childrenMap[parentId].includes(n.id)) {
        childrenMap[parentId].push(n.id);
      }
      hasParent.add(n.id);
    }
  });

  // 2. Identify Root Nodes (nodes with no parent)
  let rootNodes = currentNodes.filter((n) => !hasParent.has(n.id));
  if (rootNodes.length === 0) {
    rootNodes = [currentNodes[0]];
  }

  // 3. Calculate Subtree Heights for Tree Hierarchy
  const LEAF_HEIGHT = 230; // height + gap per leaf
  const HORIZONTAL_STEP = 360; // spacing between tree generations
  const targetPositions: Record<string, { x: number; y: number }> = {};
  const placedNodes = new Set<string>();

  const calcSubtreeHeight = (nodeId: string, visited = new Set<string>()): number => {
    if (visited.has(nodeId)) return LEAF_HEIGHT;
    visited.add(nodeId);

    const kids = (childrenMap[nodeId] || []).filter((k) => !visited.has(k));
    if (kids.length === 0) return LEAF_HEIGHT;

    const kidsHeight = kids.reduce((sum, kidId) => sum + calcSubtreeHeight(kidId, new Set(visited)), 0);
    return Math.max(LEAF_HEIGHT, kidsHeight);
  };

  const layoutSubtree = (nodeId: string, x: number, startY: number, visited = new Set<string>()): number => {
    if (placedNodes.has(nodeId) || visited.has(nodeId)) return startY;
    visited.add(nodeId);
    placedNodes.add(nodeId);

    const kids = (childrenMap[nodeId] || []).filter((k) => !placedNodes.has(k));
    const subHeight = calcSubtreeHeight(nodeId);

    // Center parent node vertically relative to its subtree
    const parentY = startY + subHeight / 2 - LEAF_HEIGHT / 2;
    targetPositions[nodeId] = {
      x: Math.round(x),
      y: Math.round(parentY),
    };

    if (kids.length === 0) {
      return startY + LEAF_HEIGHT;
    }

    let currentChildY = startY;
    kids.forEach((kidId) => {
      const kidHeight = calcSubtreeHeight(kidId);
      layoutSubtree(kidId, x + HORIZONTAL_STEP, currentChildY, new Set(visited));
      currentChildY += kidHeight;
    });

    return startY + subHeight;
  };

  // 4. Layout roots and unplaced orphan nodes
  let currentY = 100;
  rootNodes.forEach((root) => {
    const height = calcSubtreeHeight(root.id);
    layoutSubtree(root.id, 80, currentY);
    currentY += height + 80; // gap between separate root trees
  });

  // Handle any orphan nodes not connected to root trees
  currentNodes.forEach((n) => {
    if (!placedNodes.has(n.id)) {
      targetPositions[n.id] = {
        x: 80,
        y: Math.round(currentY),
      };
      currentY += LEAF_HEIGHT;
    }
  });

  return targetPositions;
}

/**
 * Generates synthetic node graph benchmark layout
 */
export function generateBenchmarkGraph(
  nodeCount: number,
  edgeCount: number
): { newNodes: BuilderNode[]; newEdges: Edge[] } {
  const newNodes: BuilderNode[] = [];
  const newEdges: Edge[] = [];

  const cols = Math.max(2, Math.ceil(Math.sqrt(nodeCount)));

  for (let i = 0; i < nodeCount; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);

    const x = 100 + col * HORIZONTAL_SPACING;
    const y = 100 + row * 220 + (col % 2 === 0 ? 0 : 50);

    const nodeId = `node_${i}`;
    const type = i === 0 ? 'source' : 'ghost';

    const data: BuilderNodeData = {
      label: i === 0 ? 'Benchmark Source' : `Node #${i}`,
      type: type as any,
      processingType: i === 0 ? 'source' : 'render',
      state: i === 0 ? 'ready' : 'idle',
      image: i === 0 ? 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400' : undefined,
      prompt: i === 0 ? undefined : `Modern architectural render, node ${i}, hyperrealistic`,
      createdAt: Date.now(),
      lineage: {
        parentId: null,
        rootSourceId: 'node_0',
        generation: col,
        branchIndex: row,
        processingType: i === 0 ? 'source' : 'render',
        ancestry: []
      }
    };

    newNodes.push({
      id: nodeId,
      type: i === 0 ? 'baseNode' : 'ghostNode',
      position: { x, y },
      data
    });
  }

  const maxEdges = (nodeCount * (nodeCount - 1)) / 2;
  const targetEdgesCount = Math.min(edgeCount, maxEdges);
  let edgesAdded = 0;

  for (let i = 1; i < nodeCount; i++) {
    const col = i % cols;
    let parentIdx = 0;
    if (col > 0) {
      const prevColNodes = [];
      for (let j = 0; j < i; j++) {
        if (j % cols === col - 1) {
          prevColNodes.push(j);
        }
      }
      if (prevColNodes.length > 0) {
        parentIdx = prevColNodes[Math.floor(Math.random() * prevColNodes.length)];
      } else {
        parentIdx = Math.floor(Math.random() * i);
      }
    } else {
      parentIdx = Math.floor(Math.random() * i);
    }

    const sourceId = `node_${parentIdx}`;
    const targetId = `node_${i}`;

    const edge = createEdge(sourceId, targetId, {
      animated: false,
      targetHandleIndex: 0
    });
    if (sourceId !== 'node_0') {
      edge.sourceHandle = 'ghost-source';
    }
    newEdges.push(edge);
    edgesAdded++;
  }

  let attempts = 0;
  const edgeSet = new Set(newEdges.map(e => `${e.source}->${e.target}`));

  while (edgesAdded < targetEdgesCount && attempts < 2000) {
    attempts++;
    const sourceIdx = Math.floor(Math.random() * (nodeCount - 1));
    const targetIdx = sourceIdx + 1 + Math.floor(Math.random() * (nodeCount - sourceIdx - 1));

    if (sourceIdx === targetIdx) continue;

    const sourceId = `node_${sourceIdx}`;
    const targetId = `node_${targetIdx}`;
    const edgeKey = `${sourceId}->${targetId}`;

    if (!edgeSet.has(edgeKey)) {
      const targetIncomingCount = newEdges.filter(e => e.target === targetId).length;
      const edge = createEdge(sourceId, targetId, {
        animated: false,
        targetHandleIndex: targetIncomingCount
      });
      if (sourceId !== 'node_0') {
        edge.sourceHandle = 'ghost-source';
      }
      newEdges.push(edge);
      edgeSet.add(edgeKey);
      edgesAdded++;
    }
  }

  return { newNodes, newEdges };
}

/**
 * Calculates grid positions for nodes inside a group
 */
export function calculateGroupChildPositions(
  groupNode: BuilderNode,
  childrenIds: string[]
): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
  if (childrenIds.length === 0) return positions;

  const cols = Math.ceil(Math.sqrt(childrenIds.length));
  const spacingX = 300;
  const spacingY = 250;
  const startX = groupNode.position.x + 30;
  const startY = groupNode.position.y + 60;

  childrenIds.forEach((id, idx) => {
    const row = Math.floor(idx / cols);
    const col = idx % cols;
    positions[id] = {
      x: startX + col * spacingX,
      y: startY + row * spacingY
    };
  });

  return positions;
}
