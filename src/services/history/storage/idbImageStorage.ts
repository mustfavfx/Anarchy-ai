import { logger } from '@/utils/logger';
import { getCurrentUserId } from '@/services/supabase/supabaseClient';
import {
  blobToDataURL,
  dataURLtoBlob,
  registerObjectUrl,
  getCachedObjectUrl
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

const IDB_VERSION = 4;

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
  },
  {
    version: 4,
    up: (db) => {
      for (const name of [IDB_STORE, IDB_CACHE_STORE, IDB_EMBEDDINGS_STORE]) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name);
        }
      }
    }
  }
];

const dbConnectionCache = new Map<string, Promise<IDBDatabase>>();

export function openNamedDB(dbName: string, version = IDB_VERSION): Promise<IDBDatabase> {
  if (dbConnectionCache.has(dbName)) {
    return dbConnectionCache.get(dbName)!;
  }
  const promise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported'));
    }
    const req = indexedDB.open(dbName, version);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      const oldVersion = event.oldVersion;
      logger.log(`[HistoryService] Upgrading IndexedDB (${dbName}) from version ${oldVersion} to ${version}`);

      for (const migration of idbMigrations) {
        if (oldVersion < migration.version) {
          try {
            migration.up(db, event);
          } catch (err) {
            logger.error(`[HistoryService] Migration for version ${migration.version} failed:`, err);
          }
        }
      }

      // Safety check: guarantee all primary stores exist
      for (const name of [IDB_STORE, IDB_CACHE_STORE, IDB_EMBEDDINGS_STORE]) {
        if (!db.objectStoreNames.contains(name)) {
          try { db.createObjectStore(name); } catch {}
        }
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onclose = () => {
        dbConnectionCache.delete(dbName);
      };
      db.onversionchange = () => {
        try { db.close(); } catch {}
        dbConnectionCache.delete(dbName);
      };

      if (!db.objectStoreNames.contains(IDB_STORE)) {
        logger.warn(`[HistoryService] Warning: store ${IDB_STORE} not in ${dbName}`);
      }
      resolve(db);
    };
    req.onerror = () => {
      dbConnectionCache.delete(dbName);
      reject(new Error(req.error?.message ?? `IDB open error for ${dbName}`));
    };
  });
  dbConnectionCache.set(dbName, promise);
  return promise;
}

export function openImageDB(): Promise<IDBDatabase> {
  return openNamedDB(getIDBName(), IDB_VERSION);
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
            resolve(result);
          }
        } catch (err) {
          reject(err);
        }
      };
      req.onerror = () => {
        reject(new Error(req.error?.message ?? 'Cursor error'));
      };
    } catch (err) {
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
    // 1. Try direct lookup in IDB_STORE
    let result: any = null;
    if (db.objectStoreNames.contains(IDB_STORE)) {
      try {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const req = tx.objectStore(IDB_STORE).get(key);
        result = await new Promise<any>((res) => {
          req.onsuccess = () => res(req.result ?? null);
          req.onerror = () => res(null);
        });
      } catch {}
    }

    // 2. Fall back to IDB_CACHE_STORE if not in IDB_STORE
    if (!result && db.objectStoreNames.contains(IDB_CACHE_STORE)) {
      try {
        const tx = db.transaction(IDB_CACHE_STORE, 'readonly');
        const req = tx.objectStore(IDB_CACHE_STORE).get(key);
        result = await new Promise<any>((res) => {
          req.onsuccess = () => res(req.result ?? null);
          req.onerror = () => res(null);
        });
      } catch {}
    }

    // 3. Fall back to findRawImageInStores with all key variants across stores and fallback DBs
    if (!result) {
      result = await findRawImageInStores(key);
    }
    
    // Telemetry
    if (result) {
      try {
        const { HistoryTelemetry } = await import('../HistoryTelemetry');
        HistoryTelemetry.recordLatency('imageLoad', Date.now() - startTime);
      } catch {}
    }
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
    const stores = [IDB_STORE, IDB_CACHE_STORE].filter(s => db.objectStoreNames.contains(s));
    if (stores.length > 0) {
      const tx = db.transaction(stores, 'readwrite');
      stores.forEach(s => tx.objectStore(s).delete(key));
      await new Promise<void>((res) => { tx.oncomplete = () => res(); tx.onerror = () => res(); });
    }
  } catch {}
}

function getKeyVariants(key: string): string[] {
  if (!key) return [];
  const cleanKey = key.replace(/^idb:\/\//, '').replace(/_canvas_thumb$/, '');
  const rootId = cleanKey.replace(/_(thumb_)?(output|input|root_source)$/, '');

  const baseIds = Array.from(new Set([key, cleanKey, rootId].filter(Boolean)));
  const variants = new Set<string>();

  variants.add(key);
  variants.add(cleanKey);

  for (const base of baseIds) {
    variants.add(base);
    variants.add(`idb://${base}`);
    variants.add(`${base}_output`);
    variants.add(`${base}_thumb_output`);
    variants.add(`${base}_input`);
    variants.add(`${base}_thumb_input`);
    variants.add(`${base}_root_source`);
    variants.add(`${base}_thumb_root_source`);
    variants.add(`${base}_canvas_thumb`);
    variants.add(`idb://${base}_output`);
    variants.add(`idb://${base}_thumb_output`);
    variants.add(`idb://${base}_canvas_thumb`);
    variants.add(`entry:${base}`);
  }

  return Array.from(variants);
}

/** Queries an object store for a list of candidate keys concurrently within a single transaction turn */
async function queryStoreForKeys(db: IDBDatabase, storeName: string, keys: string[]): Promise<any | null> {
  if (!db.objectStoreNames.contains(storeName) || keys.length === 0) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      let resolved = false;
      let remaining = keys.length;

      for (const k of keys) {
        try {
          const req = store.get(k);
          req.onsuccess = () => {
            if (!resolved) {
              const val = req.result;
              if (val != null) {
                resolved = true;
                resolve(val);
                return;
              }
              remaining--;
              if (remaining === 0) resolve(null);
            }
          };
          req.onerror = () => {
            remaining--;
            if (remaining === 0 && !resolved) resolve(null);
          };
        } catch {
          remaining--;
          if (remaining === 0 && !resolved) resolve(null);
        }
      }
    } catch {
      resolve(null);
    }
  });
}

export async function findRawImageInStores(key: string, visitedKeys = new Set<string>()): Promise<any | null> {
  if (!key || visitedKeys.has(key)) return null;
  visitedKeys.add(key);

  const keysToTry = getKeyVariants(key);

  // 1. Gather all candidate databases to check
  const candidateDbNames = new Set<string>();
  const activeName = getIDBName();
  candidateDbNames.add(activeName);
  candidateDbNames.add('anarchy_history_images');

  const currentUid = getCurrentUserId();
  if (currentUid && currentUid !== 'default_user') {
    candidateDbNames.add(`anarchy_history_images_${currentUid}`);
  }

  candidateDbNames.add('anarchy-history');
  candidateDbNames.add('AnarchyHistoryEngineV3_Prod');
  candidateDbNames.add('AnarchyHistoryEngineV3');

  // Discover all existing IndexedDB databases dynamically if supported by browser/WebView2
  if (typeof indexedDB !== 'undefined' && typeof (indexedDB as any).databases === 'function') {
    try {
      const dbInfos = await (indexedDB as any).databases();
      if (Array.isArray(dbInfos)) {
        for (const info of dbInfos) {
          if (info.name && (info.name.startsWith('anarchy') || info.name.includes('history'))) {
            candidateDbNames.add(info.name);
          }
        }
      }
    } catch {}
  }

  const targetStores = [IDB_CACHE_STORE, IDB_STORE, 'entries', 'history_entries'];

  for (const dbName of candidateDbNames) {
    try {
      const db = await openNamedDB(dbName).catch(async () => {
        return new Promise<IDBDatabase>((res, rej) => {
          const req = indexedDB.open(dbName);
          req.onsuccess = () => res(req.result);
          req.onerror = () => rej(req.error);
        });
      });

      if (!db) continue;

      for (const storeName of targetStores) {
        if (!db.objectStoreNames.contains(storeName)) continue;
        const val = await queryStoreForKeys(db, storeName, keysToTry);
        if (val != null) {
          if (val instanceof Blob) return val;
          if (typeof val === 'string') {
            if (val.startsWith('data:') || val.startsWith('blob:') || val.startsWith('http://') || val.startsWith('https://')) {
              return val;
            }
            if (val.startsWith('idb://')) {
              const nested = await findRawImageInStores(val, visitedKeys);
              if (nested) return nested;
            }
            if (val.startsWith('{') || val.startsWith('[')) {
              try {
                const parsed = JSON.parse(val);
                const candidate = parsed?.data?.outputImage || parsed?.outputImage || parsed?.thumbnailUrl || parsed?.inputImage || parsed?.rootSourceImage;
                if (candidate && typeof candidate === 'string') {
                  if (candidate.startsWith('idb://')) {
                    const nested = await findRawImageInStores(candidate, visitedKeys);
                    if (nested) return nested;
                  }
                  return candidate;
                }
              } catch {}
            }
            return val;
          } else if (typeof val === 'object') {
            const candidate = (val as any)?.data?.outputImage || (val as any)?.outputImage || (val as any)?.thumbnailUrl || (val as any)?.inputImage || (val as any)?.rootSourceImage;
            if (candidate) {
              if (candidate instanceof Blob) return candidate;
              if (typeof candidate === 'string') {
                if (candidate.startsWith('idb://')) {
                  const nested = await findRawImageInStores(candidate, visitedKeys);
                  if (nested) return nested;
                }
                return candidate;
              }
            }
            return val;
          }
          return val;
        }
      }
    } catch {}
  }

  return null;
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
      const result = await findRawImageInStores(urlOrBlob);
      if (result instanceof Blob) {
        return result;
      }
      if (typeof result === 'string') {
        if (result.startsWith('data:')) {
          return dataURLtoBlob(result);
        }
        if (result.startsWith('blob:')) {
          const response = await fetch(result);
          return await response.blob();
        }
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

    // Open transaction ONLY after all async fetches/decodes are completed
    const db = await openImageDB();
    const tx = db.transaction(IDB_CACHE_STORE, 'readwrite');

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
  } catch (err) {
    logger.warn('[HistoryService] Failed to cache local image in IndexedDB:', err);
  }
}

export async function getLocalImage(key: string): Promise<string | null> {
  try {
    const result = await findRawImageInStores(key);
    if (!result) return null;
    if (result instanceof Blob) {
      return await blobToDataURL(result);
    }
    if (typeof result === 'string') {
      return result;
    }
    return null;
  } catch (err) {
    logger.warn('[HistoryService] getLocalImage failed:', err);
    return null;
  }
}

export async function getLocalImageAsObjectURL(key: string): Promise<string | null> {
  try {
    const cachedUrl = getCachedObjectUrl(key);
    if (cachedUrl) return cachedUrl;

    const result = await findRawImageInStores(key);
    if (!result) return null;

    if (result instanceof Blob) {
      const url = URL.createObjectURL(result);
      return registerObjectUrl(url, key);
    }

    if (typeof result === 'string') {
      if (result.startsWith('data:')) {
        try {
          const blob = dataURLtoBlob(result);
          await cacheLocalImage(key, blob);
          const url = URL.createObjectURL(blob);
          return registerObjectUrl(url, key);
        } catch {
          return result;
        }
      }
      if (result.startsWith('http://') || result.startsWith('https://')) {
        try {
          const blob = await resolveUrlToBlob(result);
          if (blob) {
            await cacheLocalImage(key, blob);
            const url = URL.createObjectURL(blob);
            return registerObjectUrl(url, key);
          }
        } catch {}
        return result;
      }
      if (result.startsWith('blob:')) {
        return registerObjectUrl(result, key);
      }
      return result;
    }
    return null;
  } catch (err) {
    logger.warn('[HistoryService] getLocalImageAsObjectURL failed:', err);
    return null;
  }
}

export async function deleteLocalImage(key: string): Promise<void> {
  try {
    const db = await openImageDB();
    const tx = db.transaction(IDB_CACHE_STORE, 'readwrite');
    tx.objectStore(IDB_CACHE_STORE).delete(key);
    await new Promise<void>((res) => { tx.oncomplete = () => res(); tx.onerror = () => res(); });
  } catch {}
}
