import { SettingsService } from '@/services/settings';
import { logger } from '@/utils/logger';
import type { HistoryEntry } from '@/types/history';
import { getHistoryStorageKey, DEFAULT_MAX_ENTRIES, openImageDB, IDB_EMBEDDINGS_STORE } from './idbImageStorage';

export function getMaxEntries(): number {
  try {
    return SettingsService.get('maxHistory') || DEFAULT_MAX_ENTRIES;
  } catch {
    return DEFAULT_MAX_ENTRIES;
  }
}

export function loadEntries(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(getHistoryStorageKey());
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
    localStorage.setItem(getHistoryStorageKey(), JSON.stringify(trimmed));
    window.dispatchEvent(new CustomEvent('anarchy:history:updated'));
    window.dispatchEvent(new CustomEvent('history_updated'));
    globalThis.dispatchEvent(new CustomEvent('anarchy:history:updated'));
  } catch (err) {
    logger.error('[HistoryService] saveEntries failed to write metadata to localStorage:', err);
  }
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
