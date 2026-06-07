/**
 * History Service
 * Persistent generation history with localStorage + auto-cleanup
 */

import { SettingsService } from '../settings';
import { logger } from '../../utils/logger';

const STORAGE_KEY = 'anarchy_history';
const DEFAULT_MAX_ENTRIES = 500;
const IDB_NAME = 'anarchy_history_images';
const IDB_STORE = 'images';
const IDB_CACHE_STORE = 'local_image_cache';

// ── Types ────────────────────────────────────────────────────────────────────

export interface HistoryEntry {
  id: string;
  timestamp: number;
  type: 'render' | 'upscale' | 'variation' | 'edit' | 'generate';
  label: string;
  prompt?: string;
  project?: string;
  model?: string;
  inputImage?: string;
  outputImage?: string;
  duration?: number; // ms
  starred?: boolean;
  params?: Record<string, any>;
  nodeTree?: NodeTreeData; // Builder node tree for restoring workflow
  rootSourceId?: string;
  rootSourceImage?: string;
}

export interface NodeTreeData {
  nodes: Array<{
    id: string;
    type: 'source' | 'ghost' | 'result';
    position: { x: number; y: number };
    image?: string;
    prompt?: string;
    processingType?: string;
    state?: 'idle' | 'processing' | 'ready' | 'completed' | 'error';
    children?: string[]; // Child node IDs
    parentId?: string;
  }>;
  sourceNodeId: string;
  createdAt: number;
}

export interface HistoryGroup {
  label: string;
  date: string; // YYYY-MM-DD
  entries: HistoryEntry[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return `h_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Resize an image data URL to a thumbnail to save localStorage space */
async function compressToThumbnail(dataUrl: string, maxSize = 1024): Promise<string> {
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
        
        // Use better quality settings for crisp images
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);
        
        // Higher quality JPEG (0.92) for better appearance
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    } catch {
      resolve(dataUrl);
    }
  });
}

// ── IndexedDB for full-resolution images ─────────────────────────────────────

function openImageDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 2);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      // v1 store
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
      // v2 store: live canvas image cache (keyed by UUID)
      if (event.oldVersion < 2 && !db.objectStoreNames.contains(IDB_CACHE_STORE)) {
        db.createObjectStore(IDB_CACHE_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new Error(req.error?.message ?? 'IDB open error'));
  });
}

// ── Live canvas image cache (decouples large base64 from React Flow nodes) ───

const localImageMemoryCache = new Map<string, string>();

/** Store a live canvas image in IndexedDB by UUID key. Returns the key. */
export async function cacheLocalImage(key: string, dataUrl: string): Promise<void> {
  localImageMemoryCache.set(key, dataUrl);
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

/** Retrieve a live canvas image from IndexedDB by UUID key. */
export async function getLocalImage(key: string): Promise<string | null> {
  if (localImageMemoryCache.has(key)) {
    return localImageMemoryCache.get(key) ?? null;
  }
  try {
    const db = await openImageDB();
    const tx = db.transaction(IDB_CACHE_STORE, 'readonly');
    const req = tx.objectStore(IDB_CACHE_STORE).get(key);
    const result = await new Promise<string | null>((res) => {
      req.onsuccess = () => res(req.result ?? null);
      req.onerror = () => res(null);
    });
    db.close();
    if (result) {
      localImageMemoryCache.set(key, result);
    }
    return result;
  } catch {
    return null;
  }
}

/** Delete a live canvas image from IndexedDB cache. */
export async function deleteLocalImage(key: string): Promise<void> {
  localImageMemoryCache.delete(key);
  try {
    const db = await openImageDB();
    const tx = db.transaction(IDB_CACHE_STORE, 'readwrite');
    tx.objectStore(IDB_CACHE_STORE).delete(key);
    await new Promise<void>((res) => { tx.oncomplete = () => res(); tx.onerror = () => res(); });
    db.close();
  } catch { /* silent */ }
}

export async function saveFullImage(id: string, slot: 'output' | 'input' | 'root_source', dataUrl: string): Promise<void> {
  try {
    logger.log('[HistoryService] saveFullImage:', { id, slot, dataUrlLength: dataUrl.length });
    const db = await openImageDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(dataUrl, `${id}_${slot}`);
    await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(new Error(tx.error?.message ?? 'IDB write error')); });
    db.close();
    logger.log('[HistoryService] saveFullImage success:', { id, slot });
  } catch (err) {
    logger.error('[HistoryService] saveFullImage failed:', { id, slot, error: err });
  }
}

export async function loadFullImage(id: string, slot: 'output' | 'input' | 'root_source'): Promise<string | null> {
  try {
    logger.log('[HistoryService] loadFullImage:', { id, slot });
    const db = await openImageDB();
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(`${id}_${slot}`);
    const result = await new Promise<string | null>((res) => {
      req.onsuccess = () => res(req.result ?? null);
      req.onerror = () => res(null);
    });
    db.close();
    logger.log('[HistoryService] loadFullImage result:', { id, slot, found: !!result, length: result?.length });
    return result;
  } catch (err) {
    logger.error('[HistoryService] loadFullImage failed:', { id, slot, error: err });
    return null;
  }
}

export async function deleteFullImages(id: string): Promise<void> {
  try {
    const db = await openImageDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(`${id}_output`);
    tx.objectStore(IDB_STORE).delete(`${id}_input`);
    tx.objectStore(IDB_STORE).delete(`${id}_root_source`);
    await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(new Error(tx.error?.message ?? 'IDB delete error')); });
    db.close();
  } catch { /* silent */ }
}

/** Save workflow tree (nodes + edges) to IndexedDB for restoration */
export async function saveWorkflowTree(id: string, nodeTree: NodeTreeData): Promise<void> {
  try {
    logger.log('[HistoryService] saveWorkflowTree:', { id, nodes: nodeTree.nodes.length });
    const db = await openImageDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(nodeTree, `${id}_workflow`);
    await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(new Error(tx.error?.message ?? 'IDB write error')); });
    db.close();
    logger.log('[HistoryService] saveWorkflowTree success:', { id });
  } catch (err) {
    logger.error('[HistoryService] saveWorkflowTree failed:', { id, error: err });
  }
}

/** Load workflow tree from IndexedDB */
export async function loadWorkflowTree(id: string): Promise<NodeTreeData | null> {
  try {
    logger.log('[HistoryService] loadWorkflowTree:', { id });
    const db = await openImageDB();
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(`${id}_workflow`);
    const result = await new Promise<NodeTreeData | null>((res) => {
      req.onsuccess = () => res(req.result ?? null);
      req.onerror = () => res(null);
    });
    db.close();
    logger.log('[HistoryService] loadWorkflowTree result:', { id, found: !!result, nodes: result?.nodes?.length });
    return result;
  } catch (err) {
    logger.error('[HistoryService] loadWorkflowTree failed:', { id, error: err });
    return null;
  }
}

function getDateLabel(ts: number): string {
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

function getDateKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

// ── Storage ──────────────────────────────────────────────────────────────────

function getMaxEntries(): number {
  try {
    return SettingsService.get('maxHistory') || DEFAULT_MAX_ENTRIES;
  } catch {
    return DEFAULT_MAX_ENTRIES;
  }
}

function loadEntries(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const entries = JSON.parse(raw) as HistoryEntry[];
    // Cleanup: strip any leftover data URLs from old entries (should be thumbnails only)
    let changed = false;
    const cleaned = entries.map(entry => {
      if (entry.outputImage && entry.outputImage.length > 10000) {
        changed = true;
        return { ...entry, outputImage: undefined };
      }
      if (entry.inputImage && entry.inputImage.length > 10000) {
        changed = true;
        return { ...entry, inputImage: undefined };
      }
      return entry;
    });
    if (changed) saveEntries(cleaned);
    return cleaned;
  } catch {
    return [];
  }
}

function saveEntries(entries: HistoryEntry[]): void {
  const max = getMaxEntries();
  const trimmed = entries.slice(0, max);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    window.dispatchEvent(new CustomEvent('anarchy:history:updated'));
    globalThis.dispatchEvent(new CustomEvent('anarchy:history:updated'));
  } catch {
    // localStorage quota exceeded — strip images from older entries and retry
    const stripped = trimmed.map((entry, i) => {
      if (i === 0) return entry; // keep latest full
      return { ...entry, outputImage: undefined, inputImage: undefined };
    });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stripped));
    } catch {
      // Last resort: keep only the latest 20 entries without images
      const minimal = trimmed.slice(0, 20).map(entry => ({
        ...entry, outputImage: undefined, inputImage: undefined
      }));
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(minimal));
      } catch {
        logger.warn('[HistoryService] localStorage quota exceeded — cannot save history. Clear history or increase storage.');
      }
    }
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Add a new history entry.
 *  - Saves full-res images to IndexedDB (no size limit).
 *  - Saves 512px thumbnail in localStorage for list display.
 */
export function addHistoryEntry(entry: Omit<HistoryEntry, 'id' | 'timestamp'>): HistoryEntry {
  const full: HistoryEntry = {
    ...entry,
    id: generateId(),
    timestamp: Date.now(),
  };

  const isDataUrl = (url?: string) => url?.startsWith('data:');

  // Debug logging
  logger.log('[HistoryService] Adding entry:', {
    id: full.id,
    type: full.type,
    hasOutputImage: !!full.outputImage,
    hasInputImage: !!full.inputImage,
    hasRootSourceImage: !!full.rootSourceImage,
    outputIsDataUrl: isDataUrl(full.outputImage),
    inputIsDataUrl: isDataUrl(full.inputImage),
    rootSourceIsDataUrl: isDataUrl(full.rootSourceImage),
  });

  // Save full-res to IndexedDB immediately (async, no await needed)
  if (isDataUrl(full.outputImage)) {
    logger.log('[HistoryService] Saving output image to IndexedDB:', full.id);
    saveFullImage(full.id, 'output', full.outputImage!);
  }
  if (isDataUrl(full.inputImage)) {
    logger.log('[HistoryService] Saving input image to IndexedDB:', full.id);
    saveFullImage(full.id, 'input',  full.inputImage!);
  }
  if (isDataUrl(full.rootSourceImage)) {
    logger.log('[HistoryService] Saving root source image to IndexedDB:', full.id);
    saveFullImage(full.id, 'root_source', full.rootSourceImage!);
  }

  // Save nodeTree (workflow) to IndexedDB for restoration
  if (full.nodeTree) {
    saveWorkflowTree(full.id, full.nodeTree);
  }

  // Save thumbnail in localStorage for list display
  // Never store data URLs in localStorage (too large) — thumbnails only
  // But we MUST have at least a thumbnail for display
  const entryForStorage: HistoryEntry = {
    ...full,
    outputImage: isDataUrl(full.outputImage) ? undefined : full.outputImage,
    inputImage:  isDataUrl(full.inputImage)  ? undefined : full.inputImage,
    rootSourceImage: isDataUrl(full.rootSourceImage) ? undefined : full.rootSourceImage,
    nodeTree: undefined, // Saved separately in IndexedDB
  };

  // If we have data URLs, generate thumbnails synchronously before saving
  // This ensures the thumbnail is available immediately for display
  if (isDataUrl(full.outputImage) || isDataUrl(full.inputImage) || isDataUrl(full.rootSourceImage)) {
    // Save initial entry first (without images)
    const entries = loadEntries();
    entries.unshift(entryForStorage);
    saveEntries(entries);

    // Then generate and save thumbnails
    Promise.all([
      isDataUrl(full.outputImage) ? compressToThumbnail(full.outputImage!) : Promise.resolve(full.outputImage),
      isDataUrl(full.inputImage)  ? compressToThumbnail(full.inputImage!)  : Promise.resolve(full.inputImage),
      isDataUrl(full.rootSourceImage) ? compressToThumbnail(full.rootSourceImage!) : Promise.resolve(full.rootSourceImage),
    ]).then(([thumbOut, thumbIn, thumbRoot]) => {
      const updated = loadEntries();
      const idx = updated.findIndex(e => e.id === full.id);
      if (idx !== -1) {
        updated[idx] = { 
          ...updated[idx], 
          outputImage: thumbOut, 
          inputImage: thumbIn,
          rootSourceImage: thumbRoot
        };
        saveEntries(updated);
        // Trigger refresh so HistoryPage shows the thumbnail
        window.dispatchEvent(new CustomEvent('anarchy:history:updated'));
      }
    }).catch(() => {});
  } else {
    // No data URLs - save directly with image references
    const entries = loadEntries();
    entries.unshift(entryForStorage);
    saveEntries(entries);
  }

  return full;
}

/** Get all entries */
export function getHistory(): HistoryEntry[] {
  return loadEntries();
}

/** Get entries grouped by day */
export function getHistoryGrouped(): HistoryGroup[] {
  const entries = loadEntries();
  const groups: Map<string, HistoryGroup> = new Map();

  for (const entry of entries) {
    const key = getDateKey(entry.timestamp);
    if (!groups.has(key)) {
      groups.set(key, {
        label: getDateLabel(entry.timestamp),
        date: key,
        entries: [],
      });
    }
    groups.get(key)!.entries.push(entry);
  }

  return Array.from(groups.values());
}

/** Enrich a history entry with full-resolution images from IndexedDB */
export async function enrichWithFullImages(entry: HistoryEntry): Promise<HistoryEntry> {
  const enriched = { ...entry };
  
  // Try to load full resolution images from IndexedDB
  if (!enriched.outputImage || enriched.outputImage.startsWith('data:') === false) {
    const fullOutput = await loadFullImage(entry.id, 'output');
    if (fullOutput) enriched.outputImage = fullOutput;
  }
  
  if (!enriched.inputImage || enriched.inputImage.startsWith('data:') === false) {
    const fullInput = await loadFullImage(entry.id, 'input');
    if (fullInput) enriched.inputImage = fullInput;
  }

  if (!enriched.rootSourceImage || enriched.rootSourceImage.startsWith('data:') === false) {
    const fullRoot = await loadFullImage(entry.id, 'root_source');
    if (fullRoot) enriched.rootSourceImage = fullRoot;
  }
  
  return enriched;
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

/** Delete a single entry */
export function deleteHistoryEntry(id: string): void {
  const entries = loadEntries().filter(e => e.id !== id);
  saveEntries(entries);
}

/** Clear all history — also purges full-res images from IndexedDB */
export async function clearHistory(): Promise<void> {
  const entries = loadEntries();
  localStorage.removeItem(STORAGE_KEY);
  // Delete full-res images for all entries
  await Promise.all(entries.map(e => deleteFullImages(e.id)));
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

export { formatTime, formatDuration, getDateLabel };
