import { SettingsService } from '@/services/settings';
import { logger } from '@/utils/logger';
import type { HistoryEntry, NodeTreeData, HistoryGroup } from '@/types/history';
import { groupHistoryEntries } from './HistoryGroupingService';

const STORAGE_KEY = 'anarchy_history';
const DEFAULT_MAX_ENTRIES = 1000; // Increased max entries since localStorage is metadata-only now!
const IDB_NAME = 'anarchy_history_images';
const IDB_STORE = 'images';
const IDB_CACHE_STORE = 'local_image_cache';
const IDB_EMBEDDINGS_STORE = 'embeddings';

// Track active Object URLs to prevent memory leaks
const objectUrlRegistry = new Set<string>();

export function registerObjectUrl(url: string): string {
  objectUrlRegistry.add(url);
  return url;
}

export function getObjectUrlRegistrySize(): number {
  return objectUrlRegistry.size;
}

export function revokeAllObjectUrls(): void {
  objectUrlRegistry.forEach(url => {
    try {
      URL.revokeObjectURL(url);
    } catch (e) {
      logger.warn('[HistoryService] Failed to revoke Object URL:', url, e);
    }
  });
  objectUrlRegistry.clear();
}

export function revokeObjectUrl(url: string): void {
  if (objectUrlRegistry.has(url)) {
    try {
      URL.revokeObjectURL(url);
    } catch {}
    objectUrlRegistry.delete(url);
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return `h_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function dataURLtoBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Resize an image to thumbnail dimensions */
async function compressToThumbnail(dataUrl: string, maxSize = 384): Promise<string> {
  if (typeof window === 'undefined' || !window.HTMLCanvasElement || !window.Image) {
    return dataUrl;
  }
  return new Promise((resolve) => {
    try {
      const img = new Image();
      const timeout = setTimeout(() => {
        resolve(dataUrl);
      }, 500); // 500ms safety timeout

      img.onload = () => {
        clearTimeout(timeout);
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(dataUrl); return; }
        
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);
        
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => {
        clearTimeout(timeout);
        resolve(dataUrl);
      };
      img.src = dataUrl;
    } catch {
      resolve(dataUrl);
    }
  });
}

// ── IndexedDB Configuration & Structured Migrations ─────────────────────────

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
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
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
function getAllKeysAndValues(storeName: string): Promise<Record<string, any>> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openImageDB();
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.openCursor();
      const result: Record<string, any> = {};

      req.onsuccess = async (event) => {
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
      };
      req.onerror = () => {
        db.close();
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
  db.close();
}

/** Export all IndexedDB stores as serialized Base64/JSON objects */
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

/** Import all IndexedDB stores from serialized Base64/JSON objects */
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

/** Delete an entire history group (all entries in it) and their media */
export async function deleteHistoryGroup(rootSourceId: string): Promise<void> {
  const entries = loadEntries();
  const toDelete = entries.filter(e => e.rootSourceId === rootSourceId || e.id === rootSourceId);
  for (const entry of toDelete) {
    await deleteHistoryEntry(entry.id);
  }
}

// ── IndexedDB Storage Methods ───────────────────────────────────────────────

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
    const { HistoryTelemetry } = await import('./HistoryTelemetry');
    HistoryTelemetry.recordLatency('imageSave', Date.now() - startTime);
  } catch (err) {
    logger.error('[HistoryService] saveRawData failed:', { key, error: err });
    try {
      const { HistoryTelemetry } = await import('./HistoryTelemetry');
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
    const { HistoryTelemetry } = await import('./HistoryTelemetry');
    HistoryTelemetry.recordLatency('imageLoad', Date.now() - startTime);
    return result;
  } catch {
    try {
      const { HistoryTelemetry } = await import('./HistoryTelemetry');
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

/** Helper to resolve data:, blob:, idb://, or http/https URLs into a Blob object */
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
      } catch {
        // Tauri invoke failed or not available
      }
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

/** Store a full resolution image as a Blob in IndexedDB */
export async function saveFullImage(id: string, slot: 'output' | 'input' | 'root_source', dataUrlOrBlob: string | Blob): Promise<void> {
  const blob = await resolveUrlToBlob(dataUrlOrBlob);
  if (blob) {
    await saveRawData(`${id}_${slot}`, blob);
  }
}

/** Load a full resolution image from IndexedDB, returning a revocable Object URL */
export async function loadFullImage(id: string, slot: 'output' | 'input' | 'root_source'): Promise<string | null> {
  const result = await loadRawData(`${id}_${slot}`);
  if (!result) {
    // Fallback: Check if the legacy HistoryEntry in localStorage contains the image directly
    try {
      const entries = loadEntries();
      const entry = entries.find(e => e.id === id);
      if (entry) {
        const legacyImage = slot === 'output' 
          ? entry.outputImage 
          : slot === 'input' 
          ? entry.inputImage 
          : entry.rootSourceImage;
            
        if (legacyImage) {
          logger.log(`[HistoryService] Found legacy image in localStorage for entry ${id}, slot ${slot}. Migrating to IndexedDB...`);
          if (legacyImage.startsWith('data:')) {
            const blob = dataURLtoBlob(legacyImage);
            await saveFullImage(id, slot, blob);
            await saveThumbnail(id, slot, blob);
            return registerObjectUrl(URL.createObjectURL(blob));
          } else {
            await saveRawData(`${id}_${slot}`, legacyImage);
            return legacyImage;
          }
        }
      }
    } catch (e) {
      logger.warn(`[HistoryService] Failed to migrate legacy image for ${id}:`, e);
    }
    return null;
  }
  
  if (result instanceof Blob) {
    return registerObjectUrl(URL.createObjectURL(result));
  } else if (typeof result === 'string' && result.startsWith('data:')) {
    // Migrate legacy base64 in IndexedDB to Blob
    try {
      const blob = dataURLtoBlob(result);
      await saveFullImage(id, slot, blob);
      return registerObjectUrl(URL.createObjectURL(blob));
    } catch {
      return result;
    }
  }
  return null;
}

/** Save a compressed thumbnail image as a Blob in IndexedDB */
export async function saveThumbnail(
  id: string,
  slot: 'output' | 'input' | 'root_source',
  dataUrlOrBlob: string | Blob
): Promise<void> {
  try {
    const blob = await resolveUrlToBlob(dataUrlOrBlob);
    if (!blob) return;
    const dataUrl = await blobToDataURL(blob);
    const compressedUrl = await compressToThumbnail(dataUrl);
    const compressedBlob = dataURLtoBlob(compressedUrl);
    await saveRawData(`${id}_thumb_${slot}`, compressedBlob);
  } catch (err) {
    logger.error('[HistoryService] saveThumbnail failed:', err);
  }
}

/** Load a compressed thumbnail image from IndexedDB, returning a revocable Object URL */
export async function loadThumbnail(id: string, slot: 'output' | 'input' | 'root_source'): Promise<string | null> {
  const result = await loadRawData(`${id}_thumb_${slot}`);
  
  // Log the thumbnail query result for diagnostic purposes
  logger.log('[Thumbnail]', id, slot, result ? 'Exists (Blob/String)' : 'null');
  
  if (!result) {
    // Fall back to full-res image if thumbnail not found
    return loadFullImage(id, slot);
  }
  
  if (result instanceof Blob) {
    return registerObjectUrl(URL.createObjectURL(result));
  } else if (typeof result === 'string' && result.startsWith('data:')) {
    try {
      const blob = dataURLtoBlob(result);
      await saveRawData(`${id}_thumb_${slot}`, blob);
      return registerObjectUrl(URL.createObjectURL(blob));
    } catch {
      return result;
    }
  }
  return null;
}

export async function deleteFullImages(id: string): Promise<void> {
  await Promise.allSettled([
    deleteRawData(`${id}_output`),
    deleteRawData(`${id}_input`),
    deleteRawData(`${id}_root_source`),
    deleteRawData(`${id}_thumb_output`),
    deleteRawData(`${id}_thumb_input`),
    deleteRawData(`${id}_thumb_root_source`),
  ]);
}

/** Save workflow tree to IndexedDB */
export async function saveWorkflowTree(id: string, nodeTree: NodeTreeData): Promise<void> {
  await saveRawData(`${id}_workflow`, nodeTree);
}

/** Load workflow tree from IndexedDB */
export async function loadWorkflowTree(id: string): Promise<NodeTreeData | null> {
  return loadRawData(`${id}_workflow`);
}

// ── Live Canvas Image Cache ──────────────────────────────────────────────────

export async function cacheLocalImage(key: string, dataUrlOrBlob: string | Blob): Promise<void> {
  try {
    const db = await openImageDB();
    const tx = db.transaction(IDB_CACHE_STORE, 'readwrite');
    let dataToStore = dataUrlOrBlob;
    if (typeof dataUrlOrBlob === 'string' && dataUrlOrBlob.startsWith('data:')) {
      try {
        dataToStore = dataURLtoBlob(dataUrlOrBlob);
      } catch (e) {
        logger.warn('[HistoryService] Failed to convert dataUrl to Blob, saving as string:', e);
      }
    }
    tx.objectStore(IDB_CACHE_STORE).put(dataToStore, key);
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(new Error(tx.error?.message ?? 'IDB cache write error'));
    });
    db.close();
  } catch (err) {
    logger.error('[HistoryService] cacheLocalImage failed:', { key, error: err });
  }
}

export async function getLocalImage(key: string): Promise<string | null> {
  try {
    const db = await openImageDB();
    const tx = db.transaction(IDB_CACHE_STORE, 'readonly');
    const req = tx.objectStore(IDB_CACHE_STORE).get(key);
    let result = await new Promise<any>((res) => {
      req.onsuccess = () => res(req.result ?? null);
      req.onerror = () => res(null);
    });
    db.close();

    if (!result) {
      const cleanKey = key.startsWith('idb://') ? key.replace('idb://', '') : key;
      const dbImages = await openImageDB();
      const txImages = dbImages.transaction(IDB_STORE, 'readonly');
      const reqImages = txImages.objectStore(IDB_STORE).get(cleanKey);
      result = await new Promise<any>((res) => {
        reqImages.onsuccess = () => res(reqImages.result ?? null);
        reqImages.onerror = () => res(null);
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
    const db = await openImageDB();
    const tx = db.transaction(IDB_CACHE_STORE, 'readonly');
    const req = tx.objectStore(IDB_CACHE_STORE).get(key);
    let result = await new Promise<any>((res) => {
      req.onsuccess = () => res(req.result ?? null);
      req.onerror = () => res(null);
    });
    db.close();

    if (!result) {
      const cleanKey = key.startsWith('idb://') ? key.replace('idb://', '') : key;
      const dbImages = await openImageDB();
      const txImages = dbImages.transaction(IDB_STORE, 'readonly');
      const reqImages = txImages.objectStore(IDB_STORE).get(cleanKey);
      result = await new Promise<any>((res) => {
        reqImages.onsuccess = () => res(reqImages.result ?? null);
        reqImages.onerror = () => res(null);
      });
      dbImages.close();
    }

    if (!result) return null;
    if (result instanceof Blob) {
      return registerObjectUrl(URL.createObjectURL(result));
    }
    if (typeof result === 'string' && result.startsWith('data:')) {
      try {
        const blob = dataURLtoBlob(result);
        // Save back as Blob to migrate it
        await cacheLocalImage(key, blob);
        return registerObjectUrl(URL.createObjectURL(blob));
      } catch {
        return result;
      }
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

// ── Date Formatting Utilities ────────────────────────────────────────────────

export function getDateLabel(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const entryDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (entryDay.getTime() === today.getTime()) return 'Today';
  if (entryDay.getTime() === yesterday.getTime()) return 'Yesterday';

  const diff = today.getTime() - entryDay.getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 7) return `${days} days ago`;

  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

export function getDateKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

// ── Embeddings Database Storage ──────────────────────────────────────────────

export async function saveEmbedding(id: string, embedding: number[]): Promise<void> {
  try {
    const db = await openImageDB();
    const tx = db.transaction(IDB_EMBEDDINGS_STORE, 'readwrite');
    tx.objectStore(IDB_EMBEDDINGS_STORE).put(embedding, id);
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(new Error(tx.error?.message ?? 'IDB embedding write error'));
    });
    db.close();
  } catch (err) {
    logger.error('[HistoryService] saveEmbedding failed:', { id, error: err });
  }
}

export async function loadEmbedding(id: string): Promise<number[] | null> {
  try {
    const db = await openImageDB();
    const tx = db.transaction(IDB_EMBEDDINGS_STORE, 'readonly');
    const req = tx.objectStore(IDB_EMBEDDINGS_STORE).get(id);
    const result = await new Promise<number[] | null>((res) => {
      req.onsuccess = () => res(req.result ?? null);
      req.onerror = () => res(null);
    });
    db.close();
    return result;
  } catch {
    return null;
  }
}

export async function deleteEmbedding(id: string): Promise<void> {
  try {
    const db = await openImageDB();
    const tx = db.transaction(IDB_EMBEDDINGS_STORE, 'readwrite');
    tx.objectStore(IDB_EMBEDDINGS_STORE).delete(id);
    await new Promise<void>((res) => { tx.oncomplete = () => res(); tx.onerror = () => res(); });
    db.close();
  } catch {}
}

// ── Metadata Storage ─────────────────────────────────────────────────────────

function getMaxEntries(): number {
  try {
    return SettingsService.get('maxHistory') || DEFAULT_MAX_ENTRIES;
  } catch {
    return DEFAULT_MAX_ENTRIES;
  }
}

export function loadEntries(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveEntries(entries: HistoryEntry[]): void {
  const max = getMaxEntries();
  const trimmed = entries.slice(0, max);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    window.dispatchEvent(new CustomEvent('anarchy:history:updated'));
    window.dispatchEvent(new CustomEvent('history_updated'));
    globalThis.dispatchEvent(new CustomEvent('anarchy:history:updated'));
  } catch (err) {
    logger.error('[HistoryService] saveEntries failed to write metadata to localStorage:', err);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

let addHistoryLock: Promise<any> = Promise.resolve();

/** Add a new history entry, writing large image binaries into IndexedDB Blobs asynchronously and atomically */
export async function addHistoryEntry(entry: Omit<HistoryEntry, 'id' | 'timestamp'>): Promise<HistoryEntry> {
  const currentLock = addHistoryLock;
  
  // Create a new promise to chain the next operation
  let resolveLock: () => void;
  addHistoryLock = new Promise<void>((resolve) => {
    resolveLock = resolve;
  });

  try {
    // Wait for the previous add operation to complete fully (including its storage writes)
    await currentLock;

    const id = generateId();
    const timestamp = Date.now();

    const isSaveable = (url?: string) => 
      !!(url && (
        url.startsWith('data:') || 
        url.startsWith('blob:') || 
        url.startsWith('idb://') || 
        url.startsWith('http://') || 
        url.startsWith('https://')
      ));

    const writePromises: Promise<any>[] = [];

    // Async tasks to store images in IndexedDB as Blobs
    if (entry.outputImage && isSaveable(entry.outputImage)) {
      writePromises.push(saveFullImage(id, 'output', entry.outputImage));
      writePromises.push(saveThumbnail(id, 'output', entry.outputImage));
    }
    if (entry.inputImage && isSaveable(entry.inputImage)) {
      writePromises.push(saveFullImage(id, 'input', entry.inputImage));
      writePromises.push(saveThumbnail(id, 'input', entry.inputImage));
    }
    if (entry.rootSourceImage && isSaveable(entry.rootSourceImage)) {
      writePromises.push(saveFullImage(id, 'root_source', entry.rootSourceImage));
      writePromises.push(saveThumbnail(id, 'root_source', entry.rootSourceImage));
    }

    // Save nodeTree to IndexedDB
    if (entry.nodeTree) {
      writePromises.push(saveWorkflowTree(id, entry.nodeTree));
    }

    // Await all IndexedDB writes to complete successfully before saving metadata to localStorage
    try {
      await Promise.all(writePromises);
    } catch (err) {
      logger.error('[HistoryService] Failed to persist binary assets to IndexedDB:', err);
    }

    // Resolve root ID dynamically if not provided
    const resolvedRootId = entry.rootId || (entry.parentId ? (loadEntries().find(e => e.id === entry.parentId)?.rootId || entry.parentId) : id);

    // Store metadata-only in localStorage to prevent quota overflows
    const entryForStorage: HistoryEntry = {
      ...entry,
      id,
      timestamp,
      rootId: resolvedRootId,
      outputImage: undefined,      // Stripped base64, loaded dynamically via useLazyImage
      inputImage: undefined,       // Stripped base64, loaded dynamically via useLazyImage
      rootSourceImage: undefined,  // Stripped base64, loaded dynamically via useLazyImage
      nodeTree: undefined,         // Stripped tree structure, loaded dynamically
    };

    const entries = loadEntries();
    entries.unshift(entryForStorage);
    saveEntries(entries);

    // Return the original full object including data URLs for immediate local use in UI if needed
    return {
      ...entryForStorage,
      outputImage: entry.outputImage,
      inputImage: entry.inputImage,
      rootSourceImage: entry.rootSourceImage,
      nodeTree: entry.nodeTree,
    };
  } finally {
    resolveLock!();
  }
}

/** Get all metadata entries */
export function getHistory(): HistoryEntry[] {
  return loadEntries();
}

/** Toggle star on an entry */
export function toggleStar(id: string): void {
  const entries = loadEntries();
  const entry = entries.find(e => e.id === id);
  if (entry) {
    entry.starred = !entry.starred;
    saveEntries(entries);
  }
}

/** Delete a single entry and its media */
export async function deleteHistoryEntry(id: string): Promise<void> {
  const entries = loadEntries().filter(e => e.id !== id);
  saveEntries(entries);
  window.dispatchEvent(new CustomEvent('history_deleted'));

  // Clean up collection references
  try {
    const { CollectionService } = await import('./CollectionService');
    const cols = CollectionService.load();
    let updated = false;
    for (const col of cols) {
      if (col.entryIds.includes(id)) {
        col.entryIds = col.entryIds.filter(entryId => entryId !== id);
        updated = true;
      }
    }
    if (updated) {
      CollectionService.save(cols);
    }
  } catch (err) {
    logger.error('[HistoryService] Failed to clean up collection references on delete:', err);
  }

  await deleteFullImages(id);
  await deleteRawData(`${id}_workflow`);
  await deleteEmbedding(id);
}

/** Clear all history metadata and IndexedDB caches */
export async function clearHistory(): Promise<void> {
  localStorage.removeItem(STORAGE_KEY);

  // Empty all collection entries to prevent dangling IDs
  try {
    const { CollectionService } = await import('./CollectionService');
    const cols = CollectionService.load();
    for (const col of cols) {
      col.entryIds = [];
    }
    CollectionService.save(cols);
  } catch {}
  
  // Revoke object URLs first
  revokeAllObjectUrls();

  // Clear IndexedDB stores
  const db = await openImageDB();
  const tx = db.transaction([IDB_STORE, IDB_CACHE_STORE, IDB_EMBEDDINGS_STORE], 'readwrite');
  tx.objectStore(IDB_STORE).clear();
  tx.objectStore(IDB_CACHE_STORE).clear();
  tx.objectStore(IDB_EMBEDDINGS_STORE).clear();

  await new Promise<void>((res) => {
    tx.oncomplete = () => res();
    tx.onerror = () => res();
  });
  db.close();

  window.dispatchEvent(new CustomEvent('anarchy:history:updated'));
  window.dispatchEvent(new CustomEvent('history_deleted'));
  globalThis.dispatchEvent(new CustomEvent('anarchy:history:updated'));
}

/** Get stats */
export function getHistoryStats() {
  const entries = loadEntries();
  const totalDuration = entries.reduce((sum, e) => sum + (e.duration || 0), 0);
  const types = entries.reduce((acc, e) => {
    acc[e.type] = (acc[e.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    total: entries.length,
    starred: entries.filter(e => e.starred).length,
    totalDuration,
    types,
    todayCount: entries.filter(e => getDateKey(e.timestamp) === getDateKey(Date.now())).length,
  };
}

// ── Database Migration for Legacy localStorage Images ──────────────────────

export async function migrateLegacyHistory(): Promise<void> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const entries = JSON.parse(raw);
    if (!Array.isArray(entries)) return;
    let migrated = false;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const id = entry.id;

      // Check if entry has inline base64 images inside localStorage
      if (entry.outputImage && entry.outputImage.startsWith('data:')) {
        logger.log(`[HistoryMigration] Migrating output image to Blob for entry: ${id}`);
        await saveFullImage(id, 'output', entry.outputImage);
        await saveThumbnail(id, 'output', entry.outputImage);
        entry.outputImage = undefined;
        migrated = true;
      }
      if (entry.inputImage && entry.inputImage.startsWith('data:')) {
        logger.log(`[HistoryMigration] Migrating input image to Blob for entry: ${id}`);
        await saveFullImage(id, 'input', entry.inputImage);
        await saveThumbnail(id, 'input', entry.inputImage);
        entry.inputImage = undefined;
        migrated = true;
      }
      if (entry.rootSourceImage && entry.rootSourceImage.startsWith('data:')) {
        logger.log(`[HistoryMigration] Migrating root source image to Blob for entry: ${id}`);
        await saveFullImage(id, 'root_source', entry.rootSourceImage);
        await saveThumbnail(id, 'root_source', entry.rootSourceImage);
        entry.rootSourceImage = undefined;
        migrated = true;
      }
      if (entry.nodeTree) {
        logger.log(`[HistoryMigration] Migrating node tree to IDB for entry: ${id}`);
        await saveWorkflowTree(id, entry.nodeTree);
        entry.nodeTree = undefined;
        migrated = true;
      }
    }

    if (migrated) {
      // Reload current entries from localStorage to avoid overwriting any updates/new entries
      // that happened during the async IndexedDB migration phase.
      const currentRaw = localStorage.getItem(STORAGE_KEY);
      let currentEntries = currentRaw ? JSON.parse(currentRaw) : [];
      if (!Array.isArray(currentEntries)) currentEntries = [];

      for (const currentEntry of currentEntries) {
        const migratedEntry = entries.find((e: any) => e.id === currentEntry.id);
        if (migratedEntry) {
          currentEntry.outputImage = undefined;
          currentEntry.inputImage = undefined;
          currentEntry.rootSourceImage = undefined;
          currentEntry.nodeTree = undefined;
        }
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentEntries));
      logger.log('[HistoryMigration] Migration completed successfully. LocalStorage cleared of base64 data.');
    }
  } catch (err) {
    logger.error('[HistoryMigration] Migration failed:', err);
  }
}

// ── Merged Compatibility Exports from small HistoryService.ts ───────────────

export async function enrichWithFullImages(entry: HistoryEntry): Promise<HistoryEntry> {
  const enriched = { ...entry };
  const fullOutput = await loadFullImage(entry.id, 'output');
  if (fullOutput) enriched.outputImage = fullOutput;
  const fullInput = await loadFullImage(entry.id, 'input');
  if (fullInput) enriched.inputImage = fullInput;
  const fullRoot = await loadFullImage(entry.id, 'root_source');
  if (fullRoot) enriched.rootSourceImage = fullRoot;
  return enriched;
}

export function getHistoryGrouped(): HistoryGroup[] {
  return groupHistoryEntries(getHistory());
}
