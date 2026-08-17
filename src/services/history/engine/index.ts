import type { NodeTreeData } from '@/types/history';
import type { CommandExecutor } from './types';
import { CommandLog } from './CommandLog';
import { UndoRedoEngine } from './UndoRedoEngine';
import { SnapshotManager } from './SnapshotManager';
import { BackgroundAutoSnapshot } from './BackgroundAutoSnapshot';
import { Diagnostics } from './Diagnostics';
import { CanvasSessionManager } from './CanvasSessionManager';
import { SearchIndex } from './search/SearchIndex';
import { MigrationEngine } from './MigrationEngine';
import { HistoryRepository } from './persistence/HistoryRepository';
import { IndexedDBStorageAdapter } from './persistence/IndexedDBStorageAdapter';
import { combineExecutors } from './combineExecutors';

export { CommandType, isCommandType } from './CommandTypes';
export { CanvasCommandFactory, createCanvasCommandExecutor } from './CanvasCommandFactory';
export { combineExecutors } from './combineExecutors';
export { RestoreEngine } from './RestoreEngine';
export { GraphValidator } from './GraphValidator';
export { CanvasSessionManager } from './CanvasSessionManager';
export { TimelineEngine } from './TimelineEngine';
export { CollectionEngine } from './CollectionEngine';
export { SearchIndex } from './search/SearchIndex';
export { CompressionEngine } from './CompressionEngine';
export { ConflictResolver } from './ConflictResolver';
export { MigrationEngine } from './MigrationEngine';
export { HistoryRepository } from './persistence/HistoryRepository';
export { IndexedDBStorageAdapter } from './persistence/IndexedDBStorageAdapter';
export type { StorageAdapter } from './persistence/StorageAdapter';
export * from './types';
export * from './restore/types';
export * from './classification';

export interface HistoryEngineOptions {
  dbName?: string;
  storeName?: string;
  snapshotEveryNCommands?: number;
  autoSnapshotIdleMs?: number;
}

export class HistoryEngine {
  readonly commandLog = new CommandLog();
  readonly snapshots: SnapshotManager;
  readonly repository: HistoryRepository;
  readonly search = new SearchIndex();
  readonly migrations = new MigrationEngine({ currentVersion: 1 });
  readonly diagnostics: Diagnostics;
  readonly autoSnapshot: BackgroundAutoSnapshot;

  private undoRedo: UndoRedoEngine | null = null;

  constructor(options: HistoryEngineOptions = {}) {
    this.snapshots = new SnapshotManager({ everyNCommands: options.snapshotEveryNCommands ?? 50 });

    const storage = new IndexedDBStorageAdapter(options.dbName ?? 'anarchy-history', options.storeName ?? 'entries');
    this.repository = new HistoryRepository(storage, { migrationEngine: this.migrations });

    this.diagnostics = new Diagnostics(this.commandLog);

    this.autoSnapshot = new BackgroundAutoSnapshot(this.commandLog, this.snapshots, () => null, this.repository, {
      idleDelayMs: options.autoSnapshotIdleMs,
    });
  }

  configureExecutors(...executors: CommandExecutor[]): UndoRedoEngine {
    this.undoRedo = new UndoRedoEngine(this.commandLog, combineExecutors(...executors));
    return this.undoRedo;
  }

  get undo(): UndoRedoEngine {
    if (!this.undoRedo) {
      throw new Error('[HistoryEngine] configureExecutors() must be called before use.');
    }
    return this.undoRedo;
  }

  setTreeReader(reader: (sessionId: string) => NodeTreeData | null): void {
    this.autoSnapshot.setTreeReader(reader);
  }

  async rebuildSearchIndex(): Promise<void> {
    const entries = await this.repository.listEntries();
    this.search.rebuild(
      entries.map(e => ({
        id: e.id,
        text: [e.label, e.prompt, e.model].filter(Boolean).join(' '),
        timestamp: e.timestamp,
      }))
    );
  }

  async recoverSession(sessionId: string) {
    return this.repository.getLatestSnapshot(sessionId);
  }

  endSession(sessionId: string): void {
    CanvasSessionManager.endSession(sessionId);
  }
}

export const historyEngine = new HistoryEngine();
