import type { CanvasNodeFactory } from '@/services/canvas/NodeTreeRestoreService';
import { RestorePlanner, type RestorePlan } from './RestorePlanner';
import { RestoreExecutor } from './RestoreExecutor';
import { RestoreCommandFactory } from './RestoreCommandFactory';
import { CanvasSessionManager } from '../CanvasSessionManager';
import type { RestoreRequest, RestoreOptions, RestoreResult } from './types';
import type { Command } from '../types';
import type { NodeTreeData } from '@/types/history';

export interface RestoreRunOutcome {
  result: RestoreResult;
  command: Command | null;
}

export class RestoreCoordinator {
  static async run(
    sessionId: string,
    request: RestoreRequest,
    factory: CanvasNodeFactory,
    options: RestoreOptions = {}
  ): Promise<RestoreRunOutcome> {
    const { validate = true, rollbackOnFailure = true, rollbackOnAbort = true, resolveImage } = options;

    let treeToUse = request.nodeTree;
    let issues: RestoreResult['issues'] = [];

    if (request.mode === 'full' && validate) {
      const plan = RestorePlanner.planFullRestore(request.nodeTree);
      issues = plan.issues;
      treeToUse = plan.repairedTree;

      if (!plan.valid) {
        console.error(`[RestoreCoordinator] Tree failed validation for session "${sessionId}":`, issues);
        const result: RestoreResult = {
          ok: false,
          issues,
          createdNodeIds: [],
          aborted: false,
          rolledBack: false,
          rollbackFailedNodeIds: [],
        };
        return { result, command: null };
      }
    }

    const execResult = await RestoreExecutor.execute(sessionId, request, treeToUse, factory, {
      resolveImage,
      rollbackOnFailure,
      rollbackOnAbort,
    });

    const result: RestoreResult = { ...execResult, issues };
    const command =
      result.ok && result.createdNodeIds.length > 0
        ? RestoreCommandFactory.build(sessionId, request, result)
        : null;

    return { result, command };
  }

  static planFullRestore(nodeTree: NodeTreeData): RestorePlan {
    return RestorePlanner.planFullRestore(nodeTree);
  }

  static isRestoring(sessionId: string): boolean {
    return CanvasSessionManager.isRestoring(sessionId);
  }

  static cancel(sessionId: string): void {
    CanvasSessionManager.cancelRestore(sessionId);
  }
}
