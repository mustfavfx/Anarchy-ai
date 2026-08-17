import type { HistoryEntry } from '../../../types/history';
import { HistoryEngine } from './HistoryEngine';

/**
 * @deprecated Legacy Compatibility Wrapper around HistoryEngine v3.
 * Delegates 100% of operations to HistoryEngine.getInstance() to guarantee a Single Source of Truth.
 */
export class HistoryService {
  private static instance: HistoryService;
  private engine: HistoryEngine;

  private constructor() {
    this.engine = HistoryEngine.getInstance();
  }

  public static getInstance(): HistoryService {
    if (!HistoryService.instance) {
      HistoryService.instance = new HistoryService();
    }
    return HistoryService.instance;
  }

  public async initialize(): Promise<void> {
    await this.engine.initialize();
  }

  public getEntries(): HistoryEntry[] {
    return this.engine.search('');
  }

  public getEntry(id: string): HistoryEntry | undefined {
    return this.engine.search('').find(e => e.id === id);
  }

  public async addEntry(entry: HistoryEntry): Promise<void> {
    await this.engine.addEntry(entry);
  }

  public async removeEntry(id: string): Promise<void> {
    await this.engine.removeEntry(id);
  }

  public async clearAll(): Promise<void> {
    await this.engine.clear();
  }

  public subscribe(listener: (entries: HistoryEntry[]) => void): () => void {
    return this.engine.subscribeAny(() => {
      listener(this.getEntries());
    });
  }
}
