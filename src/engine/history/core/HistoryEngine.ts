import type { IHistoryRepository, PaginatedResult } from './IHistoryRepository';
import { IndexedDBRepository } from '../storage/IndexedDBRepository';
import { HistoryEventBus, type TypedHistoryEvent, type HistoryEventType } from './HistoryEventBus';
import { SearchEngine } from '../timeline/SearchEngine';
import { CommandEngine, BaseCommand } from '../commands/CommandEngine';
import { RestorePipeline } from './RestorePipeline';
import { AutoBackupEngine } from '../storage/AutoBackupEngine';
import type { HistoryEntry } from '../../../types/history';

export class HistoryEngine {
  private static instance: HistoryEngine;
  private repository: IHistoryRepository;
  private eventBus: HistoryEventBus;
  private searchEngine: SearchEngine;
  private commandEngine: CommandEngine;
  private initialized = false;

  private constructor(repository?: IHistoryRepository) {
    this.repository = repository || new IndexedDBRepository();
    this.eventBus = HistoryEventBus.getInstance();
    this.searchEngine = new SearchEngine();
    this.commandEngine = new CommandEngine();
  }

  public static getInstance(repository?: IHistoryRepository): HistoryEngine {
    if (!HistoryEngine.instance) {
      HistoryEngine.instance = new HistoryEngine(repository);
    }
    return HistoryEngine.instance;
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      const all = await this.repository.getAll();
      for (const entry of all) {
        this.searchEngine.indexEntry(entry);
      }
      this.initialized = true;
      this.eventBus.emit({
        type: 'MigrationFinished',
        payload: { totalCount: all.length },
        timestamp: Date.now(),
      });
    } catch (err) {
      console.error('[HistoryEngine] Failed to initialize:', err);
    }
  }

  public async getPaginated(offset: number, limit: number): Promise<PaginatedResult<HistoryEntry>> {
    await this.initialize();
    return this.repository.getPaginated(offset, limit);
  }

  public async getById(id: string): Promise<HistoryEntry | null> {
    await this.initialize();
    return this.repository.getById(id);
  }

  public async addEntry(entry: HistoryEntry): Promise<void> {
    await this.initialize();
    await this.repository.save(entry);
    this.searchEngine.indexEntry(entry);
    AutoBackupEngine.saveCheckpoint(entry);

    this.eventBus.emit({
      type: 'HistoryAdded',
      entry,
      timestamp: Date.now(),
    });
  }

  public async removeEntry(id: string): Promise<void> {
    await this.initialize();
    await this.repository.delete(id);
    this.searchEngine.removeEntry(id);

    this.eventBus.emit({
      type: 'HistoryRemoved',
      id,
      timestamp: Date.now(),
    });
  }

  public search(query: string): HistoryEntry[] {
    return this.searchEngine.search(query);
  }

  public restoreEntry(entry: HistoryEntry, navigate: (path: string) => void, sessionId?: string): boolean {
    return RestorePipeline.restore(entry, navigate, sessionId);
  }

  public async executeCommand(command: BaseCommand, navigate?: (path: string) => void): Promise<void> {
    await this.commandEngine.execute(command, { historyEngine: this, navigate });
    this.eventBus.emit({
      type: 'CommandExecuted',
      commandId: command.id,
      description: command.description,
      timestamp: Date.now(),
    });
  }

  public subscribe<T extends TypedHistoryEvent>(
    type: T['type'],
    listener: (event: T) => void
  ): () => void {
    return this.eventBus.on(type, listener);
  }

  public subscribeAny(listener: (event: TypedHistoryEvent) => void): () => void {
    return this.eventBus.onAny(listener);
  }

  public async undo(): Promise<boolean> {
    return this.commandEngine.undo({ historyEngine: this });
  }

  public async redo(): Promise<boolean> {
    return this.commandEngine.redo({ historyEngine: this });
  }

  public async clear(): Promise<void> {
    await this.repository.clear();
    this.searchEngine.clear();
    AutoBackupEngine.clearCheckpoint();

    this.eventBus.emit({
      type: 'HistoryRemoved',
      id: 'ALL',
      timestamp: Date.now(),
    });
  }
}

