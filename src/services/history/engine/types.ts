import type { NodeTreeData } from '@/types/history';

/**
 * A single atomic, replayable/invertible action against a canvas session
 * (create node, move node, connect nodes, restore tree, etc).
 */
export interface Command<TPayload = any, TInverse = any> {
  id: string;
  sessionId: string;
  timestamp: number;
  /** e.g. 'node:create' | 'node:move' | 'node:delete' | 'node:connect' | 'tree:restore' */
  type: string;
  payload: TPayload;
  /** Enough data to undo this command directly, without recomputing a diff. */
  inverse: TInverse;
  /** Human-readable label for undo/redo UI, e.g. "Move node", "Restore workflow". */
  label?: string;
}

/**
 * Implemented by whatever owns the actual canvas. The command log and
 * undo/redo engine have zero knowledge of the underlying rendering engine;
 * they only call apply()/invert().
 */
export interface CommandExecutor {
  apply(command: Command): void | Promise<void>;
  invert(command: Command): void | Promise<void>;
}

/**
 * A full-state checkpoint, captured periodically so replay never has to
 * start from command #0 on a long-lived project.
 */
export interface HistorySnapshot {
  id: string;
  sessionId: string;
  /** Command log position (for that session) this snapshot represents. */
  atCommandIndex: number;
  timestamp: number;
  nodeTree: NodeTreeData;
}
