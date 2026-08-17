import type { Command } from '../types';
import { CommandType } from '../CommandTypes';
import type { RestoreRequest, RestoreResult } from './types';

export class RestoreCommandFactory {
  static build(sessionId: string, request: RestoreRequest, result: RestoreResult): Command {
    return {
      id: `restore_${sessionId}_${Date.now()}`,
      sessionId,
      timestamp: Date.now(),
      type: request.mode === 'full' ? CommandType.TreeRestore : CommandType.NodeRestore,
      payload: { request },
      inverse: { removeNodeIds: result.createdNodeIds },
      label: request.mode === 'full' ? 'Restore full workflow' : 'Restore node',
    };
  }
}
