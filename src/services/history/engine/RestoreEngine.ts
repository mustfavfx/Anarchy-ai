import type { CanvasNodeFactory } from '@/services/canvas/NodeTreeRestoreService';
import type { NodeTreeData } from '@/types/history';
import { RestoreCoordinator, type RestoreRunOutcome } from './restore/RestoreCoordinator';
import type { RestoreRequest, RestoreOptions } from './restore/types';

export type { RestoreRequest, RestoreOptions, RestoreResult } from './restore/types';
export type { RestorePlan } from './restore/RestorePlanner';

export class RestoreEngine {
  static async restore(
    sessionId: string,
    request: RestoreRequest,
    factory: CanvasNodeFactory,
    options: RestoreOptions = {}
  ): Promise<RestoreRunOutcome> {
    return RestoreCoordinator.run(sessionId, request, factory, options);
  }

  static planFullRestore(nodeTree: NodeTreeData) {
    return RestoreCoordinator.planFullRestore(nodeTree);
  }

  static isRestoring(sessionId: string): boolean {
    return RestoreCoordinator.isRestoring(sessionId);
  }

  static cancel(sessionId: string): void {
    RestoreCoordinator.cancel(sessionId);
  }
}
