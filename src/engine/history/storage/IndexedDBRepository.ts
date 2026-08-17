import type { IHistoryRepository, PaginatedResult } from '../core/IHistoryRepository';
import type { HistoryEntry } from '../../../types/history';

const DB_NAME = 'AnarchyHistoryEngineV3_Prod';
const STORE_NAME = 'history_entries';
const DB_VERSION = 1;

export class IndexedDBRepository implements IHistoryRepository {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        if (typeof window === 'undefined' || !window.indexedDB) {
          reject(new Error('IndexedDB is not supported'));
          return;
        }
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event: any) => {
          const db = event.target.result as IDBDatabase;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            store.createIndex('timestamp', 'timestamp', { unique: false });
            store.createIndex('type', 'type', { unique: false });
          }
        };

        request.onsuccess = (event: any) => resolve(event.target.result as IDBDatabase);
        request.onerror = (event: any) => reject(event.target.error);
      });
    }
    return this.dbPromise;
  }

  async getById(id: string): Promise<HistoryEntry | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result as HistoryEntry || null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      const raw = localStorage.getItem(`anarchy_h3_prod_${id}`);
      return raw ? JSON.parse(raw) : null;
    }
  }

  async getPaginated(offset: number, limit: number): Promise<PaginatedResult<HistoryEntry>> {
    const all = await this.getAll();
    const sorted = all.sort((a, b) => b.timestamp - a.timestamp);
    const items = sorted.slice(offset, offset + limit);
    return {
      items,
      total: sorted.length,
      offset,
      limit,
      hasMore: offset + limit < sorted.length,
    };
  }

  async getAll(): Promise<HistoryEntry[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result as HistoryEntry[]);
        req.onerror = () => reject(req.error);
      });
    } catch {
      const entries: HistoryEntry[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('anarchy_h3_prod_')) {
          try {
            entries.push(JSON.parse(localStorage.getItem(k) || '{}'));
          } catch {}
        }
      }
      return entries;
    }
  }

  async save(entry: HistoryEntry): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(entry);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      localStorage.setItem(`anarchy_h3_prod_${entry.id}`, JSON.stringify(entry));
    }
  }

  async saveBatch(entries: HistoryEntry[]): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        for (const entry of entries) {
          store.put(entry);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      for (const entry of entries) {
        localStorage.setItem(`anarchy_h3_prod_${entry.id}`, JSON.stringify(entry));
      }
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      localStorage.removeItem(`anarchy_h3_prod_${id}`);
    }
  }

  async clear(): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith('anarchy_h3_prod_')) {
          localStorage.removeItem(k);
        }
      }
    }
  }

  async count(): Promise<number> {
    const all = await this.getAll();
    return all.length;
  }
}
