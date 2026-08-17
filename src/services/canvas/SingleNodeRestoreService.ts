import type { NodeTreeData } from '@/types/history';
import type { CanvasNodeFactory, RestoredCanvasNode } from './NodeTreeRestoreService';

export interface RestoreSingleNodeOptions {
  resolveImage?: (node: NodeTreeData['nodes'][number]) => Promise<string> | string;
  attachToNodeId?: string;
  positionOffset?: { x: number; y: number };
}

export interface RestoreSingleNodeResult {
  ok: boolean;
  createdNodeId: string | null;
  rolledBack: boolean;
  rollbackFailed: boolean;
}

async function tryRemoveNode(factory: CanvasNodeFactory, id: string): Promise<boolean> {
  if (!factory.removeNode) return false;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await factory.removeNode(id);
      return true;
    } catch (err) {
      console.error(`[SingleNodeRestoreService] removeNode(${id}) failed (attempt ${attempt + 1}/2):`, err);
    }
  }
  return false;
}

export async function restoreSingleNode(
  nodeTree: NodeTreeData,
  nodeId: string,
  factory: CanvasNodeFactory,
  options: RestoreSingleNodeOptions = {}
): Promise<RestoreSingleNodeResult> {
  const { resolveImage, attachToNodeId, positionOffset } = options;

  const node = nodeTree.nodes.find(n => n.id === nodeId);
  if (!node) {
    console.error(`[SingleNodeRestoreService] Node "${nodeId}" not found in nodeTree.`);
    return { ok: false, createdNodeId: null, rolledBack: false, rollbackFailed: false };
  }

  let image = node.image || '';
  if (!image && resolveImage) {
    try {
      image = await resolveImage(node);
    } catch (err) {
      console.error(`[SingleNodeRestoreService] resolveImage failed for node ${node.id}:`, err);
    }
  }

  const hasValidPosition =
    node.position && typeof node.position.x === 'number' && typeof node.position.y === 'number' &&
    !Number.isNaN(node.position.x) && !Number.isNaN(node.position.y);
  if (!hasValidPosition) {
    console.warn(`[SingleNodeRestoreService] Node "${node.id}" has invalid position — defaulting to {0, 0}.`);
  }
  const basePosition = hasValidPosition ? node.position : { x: 0, y: 0 };
  const position = positionOffset
    ? { x: basePosition.x + positionOffset.x, y: basePosition.y + positionOffset.y }
    : basePosition;

  const restored: RestoredCanvasNode = {
    id: node.id,
    role: node.type,
    position,
    image,
    prompt: node.prompt,
    parentId: attachToNodeId,
  };

  try {
    await factory.createNode(restored);
  } catch (err) {
    console.error(`[SingleNodeRestoreService] createNode failed for ${node.id}:`, err);
    return { ok: false, createdNodeId: null, rolledBack: false, rollbackFailed: false };
  }

  if (attachToNodeId) {
    try {
      await factory.createConnection(attachToNodeId, node.id);
    } catch (err) {
      console.error(`[SingleNodeRestoreService] createConnection failed for ${node.id}:`, err);
      const removed = await tryRemoveNode(factory, node.id);
      return { ok: false, createdNodeId: removed ? null : node.id, rolledBack: removed, rollbackFailed: !removed };
    }
  }

  factory.focusNode(node.id);
  return { ok: true, createdNodeId: node.id, rolledBack: false, rollbackFailed: false };
}
