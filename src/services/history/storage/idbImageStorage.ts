import { logger } from '@/utils/logger';
import { getCurrentUserId } from '@/services/supabase/supabaseClient';
import {
  blobToDataURL,
  dataURLtoBlob,
  registerObjectUrl
} from './blobRegistry';

export function getHistoryStorageKey(): string {
  const uid = getCurrentUserId();
  return uid && uid !== 'default_user' ? `anarchy_history_${uid}` : 'anarchy_history';
}

export function getIDBName(): string {
  const uid = getCurrentUserId();
  return uid && uid !== 'default_user' ? `anarchy_history_images_${uid}` : 'anarchy_history_images';
}

export const DEFAULT_MAX_ENTRIES = 1000;
export const IDB_STORE = 'images';
export const IDB_CACHE_STORE = 'local_image_cache';
export const IDB_EMBEDDINGS_STORE = 'embeddings';

const IDB_VERSION = 3;

interface IDBMigration {
  version: number;
  up: (db: IDBDatabase, event: IDBVersionChangeEvent) => void;
}

const idbMigrations: IDBMigration[] = [
  {
    version: 1,
    up: (db) => {
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    }
  },
  {
    version: 2,
    up: (db) => {
      if (!db.objectStoreNames.contains(IDB_CACHE_STORE)) {
        db.createObjectStore(IDB_CACHE_STORE);
      }
    }
  },
  {
    version: 3,
    up: (db) => {
      if (!db.objectStoreNames.contains(IDB_EMBEDDINGS_STORE)) {
        db.createObjectStore(IDB_EMBEDDINGS_STORE);
      }
    }
  }
];

export function openImageDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(getIDBName(), IDB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      const oldVersion = event.oldVersion;
      logger.log(`[HistoryService] Upgrading IndexedDB from version ${oldVersion} to ${IDB_VERSION}`);

      for (const migration of idbMigrations) {
        if (oldVersion < migration.version) {
          try {
            logger.log(`[HistoryService] Running migration for version ${migration.version}`);
            migration.up(db, event);
          } catch (err) {
            logger.error(`[HistoryService] Migration for version ${migration.version} failed:`, err);
          }
        }
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      const requiredStores = [IDB_STORE, IDB_CACHE_STORE, IDB_EMBEDDINGS_STORE];
      const missingStores = requiredStores.filter(name => !db.objectStoreNames.contains(name));
      
      if (missingStores.length > 0) {
        logger.error(`[HistoryService] Schema validation failed. Missing stores: ${missingStores.join(', ')}`);
        db.close();
        reject(new Error(`Database validation failed: missing stores ${missingStores.join(', ')}`));
      } else {
        resolve(db);
      }
    };
    req.onerror = () => reject(new Error(req.error?.message ?? 'IDB open error'));
  });
}

/** Helper to retrieve all keys and values from a given store */
async function getAllKeysAndValues(storeName: string): Promise<Record<string, any>> {
  const db = await openImageDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.openCursor();
      const result: Record<string, any> = {};

      req.onsuccess = async (event) => {
        try {
          const cursor = (event.target as any).result;
          if (cursor) {
            const key = cursor.key as string;
            const val = cursor.value;
            if (val instanceof Blob) {
              result[key] = await blobToDataURL(val);
            } else {
              result[key] = val;
            }
            cursor.continue();
          } else {
            db.close();
            resolve(result);
          }
        } catch (err) {
          db.close();
          reject(err);
        }
      };
      req.onerror = () => {
        db.close();
        reject(new Error(req.error?.message ?? 'Cursor error'));
      };
    } catch (err) {
      db.close();
      reject(err);
    }
  });
}

/** Helper to restore all keys and values to a given store */
async function restoreStoreData(storeName: string, data: Record<string, any>): Promise<void> {
  const db = await openImageDB();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);

  for (const [key, value] of Object.entries(data)) {
    let valToPut = value;
    if (typeof value === 'string' && value.startsWith('data:')) {
      try {
        valToPut = dataURLtoBlob(value);
      } catch {}
    }
    store.put(valToPut, key);
  }

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error(tx.error?.message ?? 'Transaction error'));
  });
  db.close();
}

export async function exportIndexedDBData(): Promise<{
  images: Record<string, any>;
  cache: Record<string, any>;
  embeddings: Record<string, any>;
}> {
  const [images, cache, embeddings] = await Promise.all([
    getAllKeysAndValues(IDB_STORE),
    getAllKeysAndValues(IDB_CACHE_STORE),
    getAllKeysAndValues(IDB_EMBEDDINGS_STORE)
  ]);
  return { images, cache, embeddings };
}

export async function importIndexedDBData(data: {
  images?: Record<string, any>;
  cache?: Record<string, any>;
  embeddings?: Record<string, any>;
}): Promise<void> {
  if (data.images) await restoreStoreData(IDB_STORE, data.images);
  if (data.cache) await restoreStoreData(IDB_CACHE_STORE, data.cache);
  if (data.embeddings) await restoreStoreData(IDB_EMBEDDINGS_STORE, data.embeddings);
  window.dispatchEvent(new CustomEvent('history_imported'));
}

export async function saveRawData(key: string, data: any): Promise<void> {
  const startTime = Date.now();
  try {
    const db = await openImageDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(data, key);
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(new Error(tx.error?.message ?? 'IDB write error'));
    });
    db.close();
    
    // Telemetry
    const { HistoryTelemetry } = await import('../HistoryTelemetry');
    HistoryTelemetry.recordLatency('imageSave', Date.now() - startTime);
  } catch (err) {
    logger.error('[HistoryService] saveRawData failed:', { key, error: err });
    try {
      const { HistoryTelemetry } = await import('../HistoryTelemetry');
      HistoryTelemetry.recordError('idbWrite');
    } catch {}
  }
}

export async function loadRawData(key: string): Promise<any | null> {
  const startTime = Date.now();
  try {
    const db = await openImageDB();
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(key);
    const result = await new Promise<any>((res) => {
      req.onsuccess = () => res(req.result ?? null);
      req.onerror = () => res(null);
    });
    db.close();
    
    // Telemetry
    const { HistoryTelemetry } = await import('../HistoryTelemetry');
    HistoryTelemetry.recordLatency('imageLoad', Date.now() - startTime);
    return result;
  } catch {
    try {
      const { HistoryTelemetry } = await import('../HistoryTelemetry');
      HistoryTelemetry.recordError('idbRead');
    } catch {}
    return null;
  }
}

export async function deleteRawData(key: string): Promise<void> {
  try {
    const db = await openImageDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(key);
    await new Promise<void>((res) => { tx.oncomplete = () => res(); tx.onerror = () => res(); });
    db.close();
  } catch {}
}

export async function resolveUrlToBlob(urlOrBlob: string | Blob): Promise<Blob | null> {
  if (urlOrBlob instanceof Blob) {
    return urlOrBlob;
  }
  if (typeof urlOrBlob !== 'string') {
    return null;
  }

  if (urlOrBlob.startsWith('data:')) {
    try {
      return dataURLtoBlob(urlOrBlob);
    } catch (err) {
      logger.error('[HistoryService] resolveUrlToBlob failed dataURLtoBlob:', err);
      return null;
    }
  }

  if (urlOrBlob.startsWith('blob:')) {
    try {
      const response = await fetch(urlOrBlob);
      return await response.blob();
    } catch (err) {
      logger.error('[HistoryService] resolveUrlToBlob failed fetching blob URL:', urlOrBlob, err);
      return null;
    }
  }

  if (urlOrBlob.startsWith('idb://')) {
    try {
      const db = await openImageDB();
      const tx = db.transaction(IDB_CACHE_STORE, 'readonly');
      const req = tx.objectStore(IDB_CACHE_STORE).get(urlOrBlob);
      let result = await new Promise<any>((res) => {
        req.onsuccess = () => res(req.result ?? null);
        req.onerror = () => res(null);
      });
      db.close();

      if (!result) {
        const cleanKey = urlOrBlob.replace('idb://', '');
        const dbImages = await openImageDB();
        const txImages = dbImages.transaction(IDB_STORE, 'readonly');
        const reqImages = txImages.objectStore(IDB_STORE).get(cleanKey);
        result = await new Promise<any>((res) => {
          reqImages.onsuccess = () => res(reqImages.result ?? null);
          reqImages.onerror = () => res(null);
        });
        dbImages.close();
      }

      if (result instanceof Blob) {
        return result;
      }
      if (typeof result === 'string' && result.startsWith('data:')) {
        return dataURLtoBlob(result);
      }
    } catch (err) {
      logger.error('[HistoryService] resolveUrlToBlob failed resolving idb:// URL:', urlOrBlob, err);
    }
    return null;
  }

  if (urlOrBlob.startsWith('http://') || urlOrBlob.startsWith('https://')) {
    try {
      let base64: string | undefined;
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        base64 = await invoke<string>('url_to_base64', { url: urlOrBlob });
      } catch {}
      if (base64 && base64.startsWith('data:')) {
        return dataURLtoBlob(base64);
      }
      const res = await fetch(urlOrBlob);
      if (res.ok) {
        return await res.blob();
      }
    } catch (err) {
      logger.error('[HistoryService] resolveUrlToBlob failed fetching remote URL:', urlOrBlob, err);
    }
    return null;
  }

  return null;
}

export async function cacheLocalImage(key: string, dataUrlOrBlob: string | Blob): Promise<void> {
  try {
    const db = await openImageDB();
    const tx = db.transaction(IDB_CACHE_STORE, 'readwrite');
    let dataToStore: Blob | string = dataUrlOrBlob;

    if (typeof dataUrlOrBlob === 'string') {
      if (dataUrlOrBlob.startsWith('data:')) {
        try {
          dataToStore = dataURLtoBlob(dataUrlOrBlob);
        } catch (e) {
          logger.warn('[HistoryService] Failed to convert dataUrl to Blob, saving as string:', e);
        }
      } else if (dataUrlOrBlob.startsWith('http://') || dataUrlOrBlob.startsWith('https://')) {
        try {
          const resolvedBlob = await resolveUrlToBlob(dataUrlOrBlob);
          if (resolvedBlob) {
            dataToStore = resolvedBlob;
          }
        } catch (e) {
          logger.warn('[HistoryService] Failed to convert remote URL to Blob in cacheLocalImage:', e);
        }
      }
    }

    const cleanKey = key.startsWith('idb://') ? key.replace('idb://', '') : key;
    const idbKey = `idb://${cleanKey}`;

    tx.objectStore(IDB_CACHE_STORE).put(dataToStore, key);
    if (key !== cleanKey) {
      tx.objectStore(IDB_CACHE_STORE).put(dataToStore, cleanKey);
    }
    if (key !== idbKey && cleanKey !== idbKey) {
      tx.objectStore(IDB_CACHE_STORE).put(dataToStore, idbKey);
    }

    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(new Error(tx.error?.message ?? 'IDB cache write error'));
    });
    db.close();
  } catch (err) {
    logger.warn('[HistoryService] Failed to cache local image in IndexedDB:', err);
  }
}

export async function getLocalImage(key: string): Promise<string | null> {
  try {
    const cleanKey = key.startsWith('idb://') ? key.replace('idb://', '') : key;
    const idbKey = `idb://${cleanKey}`;
    const db = await openImageDB();
    const tx = db.transaction(IDB_CACHE_STORE, 'readonly');
    const store = tx.objectStore(IDB_CACHE_STORE);

    let result = await new Promise<any>((res) => {
      const r1 = store.get(key);
      r1.onsuccess = () => {
        if (r1.result) return res(r1.result);
        const r2 = store.get(cleanKey);
        r2.onsuccess = () => {
          if (r2.result) return res(r2.result);
          const r3 = store.get(idbKey);
          r3.onsuccess = () => res(r3.result ?? null);
          r3.onerror = () => res(null);
        };
        r2.onerror = () => res(null);
      };
      r1.onerror = () => res(null);
    });
    db.close();

    if (!result) {
      const dbImages = await openImageDB();
      const txImages = dbImages.transaction(IDB_STORE, 'readonly');
      const storeImages = txImages.objectStore(IDB_STORE);
      result = await new Promise<any>((res) => {
        const r1 = storeImages.get(cleanKey);
        r1.onsuccess = () => {
          if (r1.result) return res(r1.result);
          const r2 = storeImages.get(key);
          r2.onsuccess = () => res(r2.result ?? null);
          r2.onerror = () => res(null);
        };
        r1.onerror = () => res(null);
      });
      dbImages.close();
    }

    if (!result) return null;
    if (result instanceof Blob) {
      return await blobToDataURL(result);
    }
    return result;
  } catch {
    return null;
  }
}

export async function getLocalImageAsObjectURL(key: string): Promise<string | null> {
  try {
    const cleanKey = key.startsWith('idb://') ? key.replace('idb://', '') : key;
    const idbKey = `idb://${cleanKey}`;
    const db = await openImageDB();
    const tx = db.transaction(IDB_CACHE_STORE, 'readonly');
    const store = tx.objectStore(IDB_CACHE_STORE);

    let result = await new Promise<any>((res) => {
      const r1 = store.get(key);
      r1.onsuccess = () => {
        if (r1.result) return res(r1.result);
        const r2 = store.get(cleanKey);
        r2.onsuccess = () => {
          if (r2.result) return res(r2.result);
          const r3 = store.get(idbKey);
          r3.onsuccess = () => res(r3.result ?? null);
          r3.onerror = () => res(null);
        };
        r2.onerror = () => res(null);
      };
      r1.onerror = () => res(null);
    });
    db.close();

    if (!result) {
      const dbImages = await openImageDB();
      const txImages = dbImages.transaction(IDB_STORE, 'readonly');
      const storeImages = txImages.objectStore(IDB_STORE);
      result = await new Promise<any>((res) => {
        const r1 = storeImages.get(cleanKey);
        r1.onsuccess = () => {
          if (r1.result) return res(r1.result);
          const r2 = storeImages.get(key);
          r2.onsuccess = () => res(r2.result ?? null);
          r2.onerror = () => res(null);
        };
        r1.onerror = () => res(null);
      });
      dbImages.close();
    }

    if (!result) return null;

    if (result instanceof Blob) {
      return registerObjectUrl(URL.createObjectURL(result));
    }

    if (typeof result === 'string') {
      if (result.startsWith('data:')) {
        try {
          const blob = dataURLtoBlob(result);
          await cacheLocalImage(key, blob);
          return registerObjectUrl(URL.createObjectURL(blob));
        } catch {
          return result;
        }
      }
      if (result.startsWith('http://') || result.startsWith('https://')) {
        try {
          const blob = await resolveUrlToBlob(result);
          if (blob) {
            await cacheLocalImage(key, blob);
            return registerObjectUrl(URL.createObjectURL(blob));
          }
        } catch {}
        return result;
      }
      return result;
    }
    return null;
  } catch {
    return null;
  }
}

export async function deleteLocalImage(key: string): Promise<void> {
  try {
    const db = await openImageDB();
    const tx = db.transaction(IDB_CACHE_STORE, 'readwrite');
    tx.objectStore(IDB_CACHE_STORE).delete(key);
    await new Promise<void>((res) => { tx.oncomplete = () => res(); tx.onerror = () => res(); });
    db.close();
  } catch {}
}
