import type { CanvasViewportState, NodeTreeData } from '@/types/history';
import { NodeRole } from '../history/engine/classification';

export interface RestoredCanvasNode {
  id: string;
  role: NodeRole;
  position: { x: number; y: number };
  image?: string;
  prompt?: string;
  parentId?: string;
}

export interface CanvasNodeFactory {
  createNode(node: RestoredCanvasNode): void | Promise<void>;
  createConnection(parentId: string, childId: string): void | Promise<void>;
  focusNode(nodeId: string): void;
  clearCanvas?(): void;
  removeNode?(nodeId: string): void | Promise<void>;
  removeConnection?(parentId: string, childId: string): void | Promise<void>;
  setViewport?(viewport: CanvasViewportState): void | Promise<void>;
  setSelection?(nodeIds: string[]): void | Promise<void>;
  collapseGroup?(groupNodeId: string): void | Promise<void>;
}

export interface RestoreNodeTreeOptions {
  replaceExisting?: boolean;
  resolveImage?: (node: NodeTreeData['nodes'][number]) => Promise<string> | string;
  dryRun?: boolean;
  onProgress?: (done: number, total: number, currentNodeId?: string) => void;
  signal?: AbortSignal;
  rollbackOnFailure?: boolean;
  rollbackOnAbort?: boolean;
  applyCanvasContext?: boolean;
}

export interface RestoreNodeTreeResult {
  ok: boolean;
  createdNodeIds: string[];
  aborted: boolean;
  rolledBack: boolean;
  rollbackFailedNodeIds: string[];
  totalNodes: number;
  error?: string;
}

export function findPresentationSourceId(nodeTree: NodeTreeData): string | undefined {
  return nodeTree.nodes.find(n => n.isPresentationSource)?.id;
}

export async function restoreNodeTree(
  nodeTree: NodeTreeData,
  factory: CanvasNodeFactory,
  options: RestoreNodeTreeOptions = {}
): Promise<RestoreNodeTreeResult> {
  const {
    replaceExisting = false,
    resolveImage,
    dryRun = false,
    onProgress,
    signal,
    rollbackOnFailure = true,
    rollbackOnAbort = true,
    applyCanvasContext = true,
  } = options;

  if (!nodeTree?.nodes?.length) {
    console.warn('[NodeTreeRestoreService] Empty or missing nodeTree — nothing to restore.');
    return { ok: true, createdNodeIds: [], aborted: false, rolledBack: false, rollbackFailedNodeIds: [], totalNodes: 0 };
  }

  const nodeMap = new Map(nodeTree.nodes.map(n => [n.id, n]));
  const rootId = nodeTree.sourceNodeId;

  if (!nodeMap.has(rootId)) {
    const error = `sourceNodeId "${rootId}" not found among nodeTree.nodes`;
    console.error(`[NodeTreeRestoreService] ${error} — aborting restore.`);
    return { ok: false, createdNodeIds: [], aborted: false, rolledBack: false, rollbackFailedNodeIds: [], totalNodes: 0, error };
  }

  const reachable = new Set<string>();
  {
    const q = [rootId];
    while (q.length) {
      const id = q.shift()!;
      if (reachable.has(id) || !nodeMap.has(id)) continue;
      reachable.add(id);
      q.push(...(nodeMap.get(id)?.children || []));
    }
  }
  const totalNodes = reachable.size;
  const usingExplicitConnections = !dryRun && Array.isArray(nodeTree.connections);

  if (!dryRun && replaceExisting) {
    factory.clearCanvas?.();
  }

  const visited = new Set<string>();
  const createdNodeIds: string[] = [];
  const createdConnections: Array<{ parentId: string; childId: string }> = [];
  const queue: string[] = [rootId];
  let aborted = false;
  let error: string | undefined;
  let done = 0;

  const tryRemoveNode = async (id: string): Promise<boolean> => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await factory.removeNode!(id);
        return true;
      } catch (err) {
        console.error(`[NodeTreeRestoreService] removeNode(${id}) failed (attempt ${attempt + 1}/2):`, err);
      }
    }
    return false;
  };

  const tryRemoveConnection = async (parentId: string, childId: string): Promise<boolean> => {
    if (!factory.removeConnection) return true;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await factory.removeConnection(parentId, childId);
        return true;
      } catch (err) {
        console.error(`[NodeTreeRestoreService] removeConnection(${parentId}->${childId}) failed (attempt ${attempt + 1}/2):`, err);
      }
    }
    return false;
  };

  const rollback = async (): Promise<{ ok: boolean; failedNodeIds: string[] }> => {
    if (!factory.removeNode) {
      console.error(`[NodeTreeRestoreService] Restore failed/aborted but removeNode is not implemented.`);
      return { ok: false, failedNodeIds: [...createdNodeIds] };
    }

    for (const conn of [...createdConnections].reverse()) {
      await tryRemoveConnection(conn.parentId, conn.childId);
    }

    const failedNodeIds: string[] = [];
    for (const id of [...createdNodeIds].reverse()) {
      const removed = await tryRemoveNode(id);
      if (!removed) failedNodeIds.push(id);
    }

    createdNodeIds.length = 0;
    createdNodeIds.push(...failedNodeIds);
    createdConnections.length = 0;

    return { ok: failedNodeIds.length === 0, failedNodeIds };
  };

  while (queue.length > 0) {
    if (signal?.aborted) {
      aborted = true;
      break;
    }

    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const node = nodeMap.get(currentId);
    if (!node) continue;

    if (!dryRun) {
      try {
        let image = node.image || '';
        if (!image && resolveImage) {
          try {
            image = await resolveImage(node);
          } catch (err) {
            console.error(`[NodeTreeRestoreService] resolveImage failed for node ${node.id}:`, err);
          }
        }

        await factory.createNode({
          id: node.id,
          role: node.type as NodeRole,
          position: node.position,
          image,
          prompt: node.prompt,
          parentId: node.parentId,
        });
        createdNodeIds.push(node.id);

        if (!usingExplicitConnections && node.parentId && visited.has(node.parentId)) {
          await factory.createConnection(node.parentId, node.id);
          createdConnections.push({ parentId: node.parentId, childId: node.id });
        }
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
        console.error(`[NodeTreeRestoreService] Failed creating node ${node.id}:`, err);
        break;
      }
    }

    done++;
    onProgress?.(done, totalNodes, node.id);

    for (const childId of node.children || []) {
      if (!visited.has(childId)) queue.push(childId);
    }
  }

  if (!error && !aborted && usingExplicitConnections) {
    for (const conn of nodeTree.connections!) {
      if (!visited.has(conn.sourceId) || !visited.has(conn.targetId)) continue;
      try {
        await factory.createConnection(conn.sourceId, conn.targetId);
        createdConnections.push({ parentId: conn.sourceId, childId: conn.targetId });
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
        console.error(`[NodeTreeRestoreService] Failed creating explicit connection ${conn.sourceId}->${conn.targetId}:`, err);
        break;
      }
    }
  }

  let rolledBack = false;
  let rollbackFailedNodeIds: string[] = [];
  if (!dryRun && (error || aborted)) {
    const shouldRollback = error ? rollbackOnFailure : rollbackOnAbort;
    if (shouldRollback) {
      const rollbackResult = await rollback();
      rolledBack = rollbackResult.ok;
      rollbackFailedNodeIds = rollbackResult.failedNodeIds;
    }
  }

  const succeeded = !dryRun && !error && !aborted;

  if (succeeded) {
    const presentationSourceId = findPresentationSourceId(nodeTree);
    const focusTarget =
      (nodeTree.activeNodeId && visited.has(nodeTree.activeNodeId) && nodeTree.activeNodeId) ||
      (presentationSourceId && visited.has(presentationSourceId) && presentationSourceId) ||
      rootId;
    factory.focusNode(focusTarget);

    if (applyCanvasContext) {
      if (nodeTree.viewport) {
        try {
          await factory.setViewport?.(nodeTree.viewport);
        } catch (err) {
          console.error('[NodeTreeRestoreService] setViewport failed:', err);
        }
      }

      if (nodeTree.selectedNodeIds?.length) {
        const validSelection = nodeTree.selectedNodeIds.filter(id => visited.has(id));
        if (validSelection.length) {
          try {
            await factory.setSelection?.(validSelection);
          } catch (err) {
            console.error('[NodeTreeRestoreService] setSelection failed:', err);
          }
        }
      }

      if (nodeTree.collapsedGroupIds?.length) {
        for (const groupId of nodeTree.collapsedGroupIds) {
          const groupNode = nodeMap.get(groupId);
          if (!visited.has(groupId) || groupNode?.type !== NodeRole.Group) continue;
          try {
            await factory.collapseGroup?.(groupId);
          } catch (err) {
            console.error(`[NodeTreeRestoreService] collapseGroup(${groupId}) failed:`, err);
          }
        }
      }
    }
  }

  return {
    ok: succeeded,
    createdNodeIds,
    aborted,
    rolledBack,
    rollbackFailedNodeIds,
    totalNodes,
    error,
  };
}
