import { logger } from '@/utils/logger';
export type { HistoryEntry, NodeTreeData, HistoryGroup } from '@/types/history';
import type { HistoryEntry, HistoryGroup } from '@/types/history';
import { groupHistoryEntries } from './HistoryGroupingService';

// Re-export all storage primitives and helpers for 100% backward compatibility
export {
  registerObjectUrl,
  getObjectUrlRegistrySize,
  revokeAllObjectUrls,
  revokeObjectUrl,
  dataURLtoBlob,
  blobToDataURL,
  compressToThumbnail,
} from './storage/blobRegistry';

export {
  getHistoryStorageKey,
  getIDBName,
  DEFAULT_MAX_ENTRIES,
  IDB_STORE,
  IDB_CACHE_STORE,
  IDB_EMBEDDINGS_STORE,
  openImageDB,
  saveRawData,
  loadRawData,
  deleteRawData,
  resolveUrlToBlob,
  cacheLocalImage,
  getLocalImage,
  getLocalImageAsObjectURL,
  deleteLocalImage,
  exportIndexedDBData,
  importIndexedDBData,
} from './storage/idbImageStorage';

export {
  getMaxEntries,
  loadEntries,
  saveEntries,
  getDateLabel,
  getDateKey,
  formatTime,
  formatDuration,
  saveEmbedding,
  loadEmbedding,
  deleteEmbedding,
} from './storage/historyMetadata';

export {
  saveFullImage,
  loadFullImage,
  saveThumbnail,
  loadThumbnail,
  deleteFullImages,
  saveWorkflowTree,
  loadWorkflowTree,
  enrichWithFullImages,
} from './storage/thumbnailEngine';
export type { ImageSlot } from './storage/thumbnailEngine';

import {
  openImageDB,
  IDB_STORE,
  IDB_CACHE_STORE,
  IDB_EMBEDDINGS_STORE,
  deleteRawData,
  getHistoryStorageKey,
} from './storage/idbImageStorage';
import { revokeAllObjectUrls } from './storage/blobRegistry';
import {
  loadEntries,
  saveEntries,
  getDateKey,
  deleteEmbedding,
} from './storage/historyMetadata';
import {
  saveFullImage,
  saveThumbnail,
  deleteFullImages,
  saveWorkflowTree,
} from './storage/thumbnailEngine';

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return `h_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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

    const existingEntries = loadEntries();
    saveEntries([entryForStorage, ...existingEntries]);

    // Sync with History Engine Production v3.1 Single Source of Truth
    try {
      const { historyEngine } = await import('./engine');
      await historyEngine.addEntry({
        ...entryForStorage,
        outputImage: entry.outputImage,
        inputImage: entry.inputImage,
        rootSourceImage: entry.rootSourceImage,
        nodeTree: entry.nodeTree,
      });
    } catch {}

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

/** Delete an entire history group by its rootSourceId */
export async function deleteHistoryGroup(rootSourceId: string): Promise<void> {
  const entries = loadEntries();
  const toDelete = entries.filter(e => (e.rootSourceId || e.id) === rootSourceId);
  await Promise.allSettled(toDelete.map(e => deleteHistoryEntry(e.id)));
}

/** Clear all history metadata and IndexedDB caches */
export async function clearHistory(): Promise<void> {
  localStorage.removeItem(getHistoryStorageKey());

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
    const raw = localStorage.getItem(getHistoryStorageKey());
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
      const currentRaw = localStorage.getItem(getHistoryStorageKey());
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

      localStorage.setItem(getHistoryStorageKey(), JSON.stringify(currentEntries));
      logger.log('[HistoryMigration] Migration completed successfully. LocalStorage cleared of base64 data.');
    }
  } catch (err) {
    logger.error('[HistoryMigration] Migration failed:', err);
  }
}

export function getHistoryGrouped(): HistoryGroup[] {
  return groupHistoryEntries(getHistory());
}
