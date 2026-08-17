import type { CommandLog } from './CommandLog';
import type { SnapshotManager } from './SnapshotManager';
import type { HistoryRepository } from './persistence/HistoryRepository';
import type { NodeTreeData } from '@/types/history';

export interface BackgroundAutoSnapshotOptions {
  persist?: boolean;
  idleDelayMs?: number;
}

/**
 * Listens for new commands and captures persistent auto-snapshots on idle.
 */
export class BackgroundAutoSnapshot {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private unsubscribe: (() => void) | null = null;
  private getCurrentTree: (sessionId: string) => NodeTreeData | null;

  constructor(
    private commandLog: CommandLog,
    private snapshots: SnapshotManager,
    getCurrentTree: (sessionId: string) => NodeTreeData | null = () => null,
    private repository?: HistoryRepository,
    private options: BackgroundAutoSnapshotOptions = {}
  ) {
    this.getCurrentTree = getCurrentTree;
  }

  private get idleDelayMs(): number {
    return this.options.idleDelayMs ?? 3000;
  }

  private get shouldPersist(): boolean {
    return this.options.persist ?? Boolean(this.repository);
  }

  setTreeReader(reader: (sessionId: string) => NodeTreeData | null): void {
    this.getCurrentTree = reader;
  }

  start(): void {
    if (this.unsubscribe) return;
    this.unsubscribe = this.commandLog.onAppend(command => {
      const existing = this.timers.get(command.sessionId);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(() => {
        this.timers.delete(command.sessionId);
        void this.captureIfDue(command.sessionId);
      }, this.idleDelayMs);

      this.timers.set(command.sessionId, timer);
    });
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }

  private async captureIfDue(sessionId: string): Promise<void> {
    const tree = this.getCurrentTree(sessionId);
    if (!tree) return;

    const commandIndex = this.commandLog.lengthFor(sessionId);
    const snapshot = this.snapshots.forceCapture(sessionId, commandIndex, tree);

    if (this.shouldPersist && this.repository) {
      try {
        await this.repository.saveSnapshot(snapshot);
      } catch (err) {
        console.error(`[BackgroundAutoSnapshot] Failed persisting snapshot for session "${sessionId}":`, err);
      }
    }
  }
}
