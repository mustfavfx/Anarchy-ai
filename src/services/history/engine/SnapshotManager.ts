import type { NodeTreeData } from '@/types/history';
import type { HistorySnapshot } from './types';

export interface SnapshotManagerOptions {
  everyNCommands?: number;
}

/**
 * Bounds the cost of state replay. Fast in-memory cache for the current session.
 */
export class SnapshotManager {
  private snapshots: HistorySnapshot[] = [];

  constructor(private options: SnapshotManagerOptions = {}) {}

  private get interval(): number {
    return this.options.everyNCommands ?? 50;
  }

  maybeCapture(sessionId: string, atCommandIndex: number, nodeTree: NodeTreeData): HistorySnapshot | null {
    if (atCommandIndex === 0 || atCommandIndex % this.interval !== 0) return null;
    return this.forceCapture(sessionId, atCommandIndex, nodeTree);
  }

  forceCapture(sessionId: string, atCommandIndex: number, nodeTree: NodeTreeData): HistorySnapshot {
    const snapshot: HistorySnapshot = {
      id: `snap_${sessionId}_${atCommandIndex}_${Date.now()}`,
      sessionId,
      atCommandIndex,
      timestamp: Date.now(),
      nodeTree,
    };
    this.snapshots.push(snapshot);
    return snapshot;
  }

  getNearestBefore(sessionId: string, commandIndex: number): HistorySnapshot | null {
    const candidates = this.snapshots
      .filter(s => s.sessionId === sessionId && s.atCommandIndex <= commandIndex)
      .sort((a, b) => b.atCommandIndex - a.atCommandIndex);
    return candidates[0] ?? null;
  }

  clear(sessionId?: string): void {
    this.snapshots = sessionId ? this.snapshots.filter(s => s.sessionId !== sessionId) : [];
  }
}
