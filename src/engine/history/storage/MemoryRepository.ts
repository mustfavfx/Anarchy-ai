import type { IHistoryRepository, PaginatedResult } from '../core/IHistoryRepository';
import type { HistoryEntry } from '../../../types/history';

export class MemoryRepository implements IHistoryRepository {
  private store: Map<string, HistoryEntry> = new Map();

  async getById(id: string): Promise<HistoryEntry | null> {
    return this.store.get(id) || null;
  }

  async getPaginated(offset: number, limit: number): Promise<PaginatedResult<HistoryEntry>> {
    const all = Array.from(this.store.values()).sort((a, b) => b.timestamp - a.timestamp);
    const items = all.slice(offset, offset + limit);
    return {
      items,
      total: all.length,
      offset,
      limit,
      hasMore: offset + limit < all.length,
    };
  }

  async getAll(): Promise<HistoryEntry[]> {
    return Array.from(this.store.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  async save(entry: HistoryEntry): Promise<void> {
    this.store.set(entry.id, entry);
  }

  async saveBatch(entries: HistoryEntry[]): Promise<void> {
    for (const entry of entries) {
      this.store.set(entry.id, entry);
    }
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  async count(): Promise<number> {
    return this.store.size;
  }
}
