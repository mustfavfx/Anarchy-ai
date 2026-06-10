import { SettingsService } from '../../../services/settings';
import { logger } from '../../../utils/logger';
import type { HistoryEntry, NodeTreeData } from '../types';

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
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
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
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    } catch {
      resolve(dataUrl);
    }
  });
}

// ── IndexedDB Configuration ──────────────────────────────────────────────────

function openImageDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 3); // Upgraded version to 3 to support embeddings
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
      if (!db.objectStoreNames.contains(IDB_CACHE_STORE)) {
        db.createObjectStore(IDB_CACHE_STORE);
      }
      if (!db.objectStoreNames.contains(IDB_EMBEDDINGS_STORE)) {
        db.createObjectStore(IDB_EMBEDDINGS_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new Error(req.error?.message ?? 'IDB open error'));
  });
}

// ── IndexedDB Storage Methods ───────────────────────────────────────────────

export async function saveRawData(key: string, data: any): Promise<void> {
  try {
    const db = await openImageDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(data, key);
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(new Error(tx.error?.message ?? 'IDB write error'));
    });
    db.close();
  } catch (err) {
    logger.error('[HistoryService] saveRawData failed:', { key, error: err });
  }
}

export async function loadRawData(key: string): Promise<any | null> {
  try {
    const db = await openImageDB();
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(key);
    const result = await new Promise<any>((res) => {
      req.onsuccess = () => res(req.result ?? null);
      req.onerror = () => res(null);
    });
    db.close();
    return result;
  } catch {
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

/** Store a full resolution image as a Blob in IndexedDB */
export async function saveFullImage(id: string, slot: 'output' | 'input' | 'root_source', dataUrlOrBlob: string | Blob): Promise<void> {
  let blob: Blob;
  if (typeof dataUrlOrBlob === 'string') {
    if (!dataUrlOrBlob.startsWith('data:')) return;
    blob = dataURLtoBlob(dataUrlOrBlob);
  } else {
    blob = dataUrlOrBlob;
  }
  await saveRawData(`${id}_${slot}`, blob);
}

/** Load a full resolution image from IndexedDB, returning a revocable Object URL */
export async function loadFullImage(id: string, slot: 'output' | 'input' | 'root_source'): Promise<string | null> {
  const result = await loadRawData(`${id}_${slot}`);
  if (!result) return null;
  
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
export async function saveThumbnail(id: string, slot: 'output' | 'input' | 'root_source', dataUrl: string): Promise<void> {
  if (!dataUrl.startsWith('data:')) return;
  try {
    const compressedUrl = await compressToThumbnail(dataUrl);
    const blob = dataURLtoBlob(compressedUrl);
    await saveRawData(`${id}_thumb_${slot}`, blob);
  } catch (err) {
    logger.error('[HistoryService] saveThumbnail failed:', err);
  }
}

/** Load a compressed thumbnail image from IndexedDB, returning a revocable Object URL */
export async function loadThumbnail(id: string, slot: 'output' | 'input' | 'root_source'): Promise<string | null> {
  const result = await loadRawData(`${id}_thumb_${slot}`);
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
  await Promise.all([
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

export async function cacheLocalImage(key: string, dataUrl: string): Promise<void> {
  try {
    const db = await openImageDB();
    const tx = db.transaction(IDB_CACHE_STORE, 'readwrite');
    tx.objectStore(IDB_CACHE_STORE).put(dataUrl, key);
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
    const result = await new Promise<string | null>((res) => {
      req.onsuccess = () => res(req.result ?? null);
      req.onerror = () => res(null);
    });
    db.close();
    return result;
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
    return JSON.parse(raw) as HistoryEntry[];
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
    globalThis.dispatchEvent(new CustomEvent('anarchy:history:updated'));
  } catch (err) {
    logger.error('[HistoryService] saveEntries failed to write metadata to localStorage:', err);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Add a new history entry, writing large image binaries into IndexedDB Blobs */
export function addHistoryEntry(entry: Omit<HistoryEntry, 'id' | 'timestamp'>): HistoryEntry {
  const id = generateId();
  const timestamp = Date.now();

  const isDataUrl = (url?: string) => url?.startsWith('data:');

  // Async tasks to store images in IndexedDB as Blobs
  if (entry.outputImage && isDataUrl(entry.outputImage)) {
    saveFullImage(id, 'output', entry.outputImage);
    saveThumbnail(id, 'output', entry.outputImage);
  }
  if (entry.inputImage && isDataUrl(entry.inputImage)) {
    saveFullImage(id, 'input', entry.inputImage);
    saveThumbnail(id, 'input', entry.inputImage);
  }
  if (entry.rootSourceImage && isDataUrl(entry.rootSourceImage)) {
    saveFullImage(id, 'root_source', entry.rootSourceImage);
    saveThumbnail(id, 'root_source', entry.rootSourceImage);
  }

  // Save nodeTree to IndexedDB
  if (entry.nodeTree) {
    saveWorkflowTree(id, entry.nodeTree);
  }

  // Store metadata-only in localStorage to prevent quota overflows
  const entryForStorage: HistoryEntry = {
    ...entry,
    id,
    timestamp,
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
  await deleteFullImages(id);
  await deleteRawData(`${id}_workflow`);
  await deleteEmbedding(id);
}

/** Clear all history metadata and IndexedDB caches */
export async function clearHistory(): Promise<void> {
  localStorage.removeItem(STORAGE_KEY);
  
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
    const entries = JSON.parse(raw) as any[];
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
      logger.log('[HistoryMigration] Migration completed successfully. LocalStorage cleared of base64 data.');
    }
  } catch (err) {
    logger.error('[HistoryMigration] Migration failed:', err);
  }
}
