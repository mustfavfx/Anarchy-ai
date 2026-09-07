import type { StorageAdapter } from './StorageAdapter';

const DB_VERSION = 1;

export class IndexedDBStorageAdapter implements StorageAdapter {
  private dbPromise: Promise<IDBDatabase | null>;

  constructor(private dbName: string, private storeName: string) {
    this.dbPromise = this.openDB();
  }

  private openDB(): Promise<IDBDatabase | null> {
    return new Promise((resolve) => {
      if (typeof indexedDB === 'undefined') {
        resolve(null);
        return;
      }
      try {
        const request = indexedDB.open(this.dbName, DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName);
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  async get(key: string): Promise<string | null> {
    const db = await this.dbPromise;
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(this.storeName, 'readonly');
        const req = tx.objectStore(this.storeName).get(key);
        req.onsuccess = () => resolve((req.result as string | undefined) ?? null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  async set(key: string, value: string): Promise<void> {
    const db = await this.dbPromise;
    if (!db) return;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(this.storeName, 'readwrite');
        const req = tx.objectStore(this.storeName).put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  async delete(key: string): Promise<void> {
    const db = await this.dbPromise;
    if (!db) return;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(this.storeName, 'readwrite');
        const req = tx.objectStore(this.storeName).delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  async keys(): Promise<string[]> {
    const db = await this.dbPromise;
    if (!db) return [];
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(this.storeName, 'readonly');
        const req = tx.objectStore(this.storeName).getAllKeys();
        req.onsuccess = () => resolve((req.result as string[]) ?? []);
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  }

  async clear(): Promise<void> {
    const db = await this.dbPromise;
    if (!db) return;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(this.storeName, 'readwrite');
        const req = tx.objectStore(this.storeName).clear();
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  async list(prefix?: string): Promise<string[]> {
    const all = await this.keys();
    return prefix ? all.filter(k => k.startsWith(prefix)) : all;
  }

  async setMany(entries: Array<[string, string]>): Promise<void> {
    for (const [k, v] of entries) {
      await this.set(k, v);
    }
  }

  async getMany(keys: string[]): Promise<Map<string, string | null>> {
    const map = new Map<string, string | null>();
    for (const k of keys) {
      map.set(k, await this.get(k));
    }
    return map;
  }

  async deleteMany(keys: string[]): Promise<void> {
    for (const k of keys) {
      await this.delete(k);
    }
  }

  async iterateEntries(prefix?: string): Promise<Array<[string, string]>> {
    const keys = await this.list(prefix);
    const result: Array<[string, string]> = [];
    for (const k of keys) {
      const v = await this.get(k);
      if (v !== null) result.push([k, v]);
    }
    return result;
  }
}
