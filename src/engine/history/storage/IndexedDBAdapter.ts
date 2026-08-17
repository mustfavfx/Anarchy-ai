import type { HistoryEntry } from '../../../types/history';

const DB_NAME = 'AnarchyHistoryEngineV3';
const STORE_NAME = 'history_entries';
const DB_VERSION = 1;

export class IndexedDBAdapter {
  private static dbPromise: Promise<IDBDatabase> | null = null;

  private static getDB(): Promise<IDBDatabase> {
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

  static async saveEntry(entry: HistoryEntry): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(entry);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('[IndexedDBAdapter] Falling back to localStorage:', err);
      try {
        const key = `anarchy_h3_${entry.id}`;
        localStorage.setItem(key, JSON.stringify(entry));
      } catch {}
    }
  }

  static async getAllEntries(): Promise<HistoryEntry[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result as HistoryEntry[]);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      const entries: HistoryEntry[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('anarchy_h3_')) {
          try {
            entries.push(JSON.parse(localStorage.getItem(k) || '{}'));
          } catch {}
        }
      }
      return entries;
    }
  }

  static async deleteEntry(id: string): Promise<void> {
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
      localStorage.removeItem(`anarchy_h3_${id}`);
    }
  }

  static async clearAll(): Promise<void> {
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
        if (k && k.startsWith('anarchy_h3_')) {
          localStorage.removeItem(k);
        }
      }
    }
  }
}
