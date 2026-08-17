import type { NodeTreeData } from '@/types/history';
import { restoreNodeTree, type CanvasNodeFactory } from '@/services/canvas/NodeTreeRestoreService';
import { restoreSingleNode } from '@/services/canvas/SingleNodeRestoreService';
import { CanvasSessionManager } from '../CanvasSessionManager';
import type { RestoreRequest, RestoreOptions } from './types';

export interface ExecuteResult {
  ok: boolean;
  createdNodeIds: string[];
  aborted: boolean;
  rolledBack: boolean;
  rollbackFailedNodeIds: string[];
  error?: string;
}

export class RestoreExecutor {
  static async execute(
    sessionId: string,
    request: RestoreRequest,
    treeToUse: NodeTreeData,
    factory: CanvasNodeFactory,
    options: RestoreOptions
  ): Promise<ExecuteResult> {
    const { resolveImage, rollbackOnFailure, rollbackOnAbort, applyCanvasContext } = options;

    if (request.mode === 'single') {
      const result = await restoreSingleNode(treeToUse, request.nodeId, factory, {
        resolveImage,
        attachToNodeId: request.attachToNodeId,
        positionOffset: request.positionOffset,
      });
      return {
        ok: result.ok,
        createdNodeIds: result.createdNodeId ? [result.createdNodeId] : [],
        aborted: false,
        rolledBack: result.rolledBack,
        rollbackFailedNodeIds: result.rollbackFailed && result.createdNodeId ? [result.createdNodeId] : [],
      };
    }

    const controller = CanvasSessionManager.beginRestore(sessionId, 0);
    try {
      const walk = await restoreNodeTree(treeToUse, factory, {
        resolveImage,
        replaceExisting: request.replaceExisting,
        rollbackOnFailure,
        rollbackOnAbort,
        applyCanvasContext,
        signal: controller.signal,
        onProgress: (done, total, currentNodeId) => {
          CanvasSessionManager.updateRestoreProgress(sessionId, done, total, currentNodeId);
          request.onProgress?.(done, total, currentNodeId);
        },
      });
      return {
        ok: walk.ok,
        createdNodeIds: walk.createdNodeIds,
        aborted: walk.aborted,
        rolledBack: walk.rolledBack,
        rollbackFailedNodeIds: walk.rollbackFailedNodeIds,
        error: walk.error,
      };
    } finally {
      CanvasSessionManager.endRestore(sessionId);
    }
  }
}
