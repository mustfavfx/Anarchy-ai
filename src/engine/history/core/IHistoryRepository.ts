import type { HistoryEntry } from '../../../types/history';

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

export interface IHistoryRepository {
  getById(id: string): Promise<HistoryEntry | null>;
  getPaginated(offset: number, limit: number): Promise<PaginatedResult<HistoryEntry>>;
  getAll(): Promise<HistoryEntry[]>;
  save(entry: HistoryEntry): Promise<void>;
  saveBatch(entries: HistoryEntry[]): Promise<void>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
  count(): Promise<number>;
}
