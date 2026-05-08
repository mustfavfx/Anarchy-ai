/**
 * History Service
 * Persistent generation history with localStorage + auto-cleanup
 */

import { SettingsService } from '../settings';

const STORAGE_KEY = 'anarchy_history';
const DEFAULT_MAX_ENTRIES = 500;
const IDB_NAME = 'anarchy_history_images';
const IDB_STORE = 'images';

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
async function compressToThumbnail(dataUrl: string, maxSize = 512): Promise<string> {
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
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
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
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveFullImage(id: string, slot: 'output' | 'input', dataUrl: string): Promise<void> {
  try {
    const db = await openImageDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(dataUrl, `${id}_${slot}`);
    await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
    db.close();
  } catch { /* silent */ }
}

export async function loadFullImage(id: string, slot: 'output' | 'input'): Promise<string | null> {
  try {
    const db = await openImageDB();
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(`${id}_${slot}`);
    const result = await new Promise<string | null>((res) => {
      req.onsuccess = () => res(req.result ?? null);
      req.onerror = () => res(null);
    });
    db.close();
    return result;
  } catch { return null; }
}

export async function deleteFullImages(id: string): Promise<void> {
  try {
    const db = await openImageDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(`${id}_output`);
    tx.objectStore(IDB_STORE).delete(`${id}_input`);
    await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
    db.close();
  } catch { /* silent */ }
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
    return JSON.parse(raw) as HistoryEntry[];
  } catch {
    return [];
  }
}

function saveEntries(entries: HistoryEntry[]): void {
  const max = getMaxEntries();
  const trimmed = entries.slice(0, max);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
  } catch (e) {
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(minimal));
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

  // Save full-res to IndexedDB immediately (async, no await needed)
  if (isDataUrl(full.outputImage)) saveFullImage(full.id, 'output', full.outputImage!);
  if (isDataUrl(full.inputImage))  saveFullImage(full.id, 'input',  full.inputImage!);

  // Save thumbnail in localStorage for list display
  const entryForStorage: HistoryEntry = {
    ...full,
    outputImage: isDataUrl(full.outputImage) ? undefined : full.outputImage,
    inputImage:  isDataUrl(full.inputImage)  ? undefined : full.inputImage,
  };
  const entries = loadEntries();
  entries.unshift(entryForStorage);
  saveEntries(entries);

  // Async: generate thumbnails and store them in localStorage for preview
  Promise.all([
    isDataUrl(full.outputImage) ? compressToThumbnail(full.outputImage!) : Promise.resolve(full.outputImage),
    isDataUrl(full.inputImage)  ? compressToThumbnail(full.inputImage!)  : Promise.resolve(full.inputImage),
  ]).then(([thumbOut, thumbIn]) => {
    const updated = loadEntries();
    const idx = updated.findIndex(e => e.id === full.id);
    if (idx !== -1) {
      updated[idx] = { ...updated[idx], outputImage: thumbOut, inputImage: thumbIn };
      saveEntries(updated);
    }
  }).catch(() => {});

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
