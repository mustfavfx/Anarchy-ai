import type { NodeTreeData } from '@/types/history';
import type { GraphValidationIssue } from '../GraphValidator';

export type RestoreRequest =
  | {
      mode: 'full';
      nodeTree: NodeTreeData;
      replaceExisting?: boolean;
      onProgress?: (done: number, total: number, currentNodeId?: string) => void;
    }
  | {
      mode: 'single';
      nodeTree: NodeTreeData;
      nodeId: string;
      attachToNodeId?: string;
      positionOffset?: { x: number; y: number };
    };

export interface RestoreOptions {
  validate?: boolean;
  resolveImage?: (node: NodeTreeData['nodes'][number]) => Promise<string> | string;
  rollbackOnFailure?: boolean;
  rollbackOnAbort?: boolean;
  applyCanvasContext?: boolean;
}

export interface RestoreResult {
  ok: boolean;
  issues: GraphValidationIssue[];
  createdNodeIds: string[];
  aborted: boolean;
  rolledBack: boolean;
  rollbackFailedNodeIds: string[];
  error?: string;
}
