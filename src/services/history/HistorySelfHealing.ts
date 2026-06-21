import { logger } from '@/utils/logger';
import type { HistoryEntry } from '@/types/history';
import {
  saveEntries,
  openImageDB,
  loadRawData,
  saveThumbnail,
  deleteRawData,
  blobToDataURL
} from './HistoryService';

export interface SelfHealReport {
  repairedMetadata: boolean;
  salvagedEntriesCount: number;
  cleanedOrphansCount: number;
  reconstructedThumbnailsCount: number;
  errors: string[];
}

/**
 * Attempts to parse and salvage valid JSON objects from a potentially corrupted JSON string
 */
export function salvageCorruptHistoryJSON(corruptStr: string): HistoryEntry[] {
  const salvaged: HistoryEntry[] = [];
  try {
    // Attempt normal parse first
    const parsed = JSON.parse(corruptStr);
    if (Array.isArray(parsed)) return parsed;
  } catch {}

  // Regex-based salvage: find JSON-like object blocks
  try {
    const objectRegex = /\{[^{}]*"id"\s*:\s*"h_\d+_[a-z0-9]+"[^{}]*\}/g;
    const matches = corruptStr.match(objectRegex);
    if (matches) {
      for (const match of matches) {
        try {
          const entry = JSON.parse(match);
          if (entry && typeof entry.id === 'string' && entry.id.startsWith('h_')) {
            salvaged.push(entry);
          }
        } catch {}
      }
    }
  } catch (err) {
    logger.error('[HistorySelfHealing] Regex salvage failed:', err);
  }

  return salvaged;
}

/**
 * Helper to retrieve all keys from an IndexedDB object store
 */
function getStoreKeys(db: IDBDatabase, storeName: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      if (typeof store.getAllKeys === 'function') {
        const req = store.getAllKeys();
        req.onsuccess = () => resolve((req.result as any[])?.map(k => String(k)) || []);
        req.onerror = () => reject(req.error);
      } else {
        const keys: string[] = [];
        const req = store.openCursor();
        req.onsuccess = (event: any) => {
          const cursor = event.target.result;
          if (cursor) {
            keys.push(String(cursor.key));
            cursor.continue();
          } else {
            resolve(keys);
          }
        };
        req.onerror = () => reject(req.error);
      }
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Scan history entries and IndexedDB to heal corruption, prune orphaned assets, and rebuild missing thumbnails
 */
export async function selfHealHistory(): Promise<SelfHealReport> {
  const report: SelfHealReport = {
    repairedMetadata: false,
    salvagedEntriesCount: 0,
    cleanedOrphansCount: 0,
    reconstructedThumbnailsCount: 0,
    errors: []
  };

  logger.log('[HistorySelfHealing] Starting history integrity self-healing check...');

  let entries: HistoryEntry[] = [];
  const STORAGE_KEY = 'anarchy_history';

  // 1. Metadata Validation & Salvage
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          entries = parsed;
        } else {
          // Reset if it exists but is not an array
          logger.warn('[HistorySelfHealing] Metadata is not an array, performing reset.');
          entries = [];
          localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
          report.repairedMetadata = true;
        }
      } catch (jsonErr) {
        logger.error('[HistorySelfHealing] Detected corrupted JSON metadata in localStorage. Attempting salvage...', jsonErr);
        const salvaged = salvageCorruptHistoryJSON(raw);
        entries = salvaged;
        saveEntries(salvaged);
        report.repairedMetadata = true;
        report.salvagedEntriesCount = salvaged.length;
        logger.log(`[HistorySelfHealing] Successfully salvaged ${salvaged.length} entries from corrupted metadata.`);
      }
    }
  } catch (err: any) {
    const errMsg = `Metadata check failed: ${err?.message || err}`;
    report.errors.push(errMsg);
    logger.error(`[HistorySelfHealing] ${errMsg}`);
  }

  // If no entries metadata and no errors, we are in a clean empty state.
  // Still, let's clean up IndexedDB from any leftover orphaned records.
  const entryIds = new Set(entries.map(e => e.id));

  // 2. IndexedDB Integrity & Garbage Collection
  let db: IDBDatabase | null = null;
  try {
    db = await openImageDB();
    
    // Clean IDB_STORE (images)
    const imagesStoreName = 'images';
    if (db.objectStoreNames.contains(imagesStoreName)) {
      const imageKeys = await getStoreKeys(db, imagesStoreName);
      for (const key of imageKeys) {
        // Extract parent entry ID (e.g. h_1781850683355_4noxt0 from h_1781850683355_4noxt0_output)
        const parts = key.split('_');
        if (parts.length >= 3 && parts[0] === 'h') {
          const entryId = `${parts[0]}_${parts[1]}_${parts[2]}`;
          if (!entryIds.has(entryId)) {
            logger.warn(`[HistorySelfHealing] Pruning orphaned media key in IndexedDB: ${key}`);
            await deleteRawData(key);
            report.cleanedOrphansCount++;
          }
        }
      }
    }

    // Clean IDB_EMBEDDINGS_STORE
    const embeddingsStoreName = 'embeddings';
    if (db.objectStoreNames.contains(embeddingsStoreName)) {
      const embeddingKeys = await getStoreKeys(db, embeddingsStoreName);
      for (const key of embeddingKeys) {
        if (!entryIds.has(key)) {
          logger.warn(`[HistorySelfHealing] Pruning orphaned embedding key in IndexedDB: ${key}`);
          // Import deleteEmbedding dynamically to avoid circular dependencies
          const { deleteEmbedding } = await import('./HistoryService');
          await deleteEmbedding(key);
          report.cleanedOrphansCount++;
        }
      }
    }
  } catch (err: any) {
    const errMsg = `IndexedDB GC failed: ${err?.message || err}`;
    report.errors.push(errMsg);
    logger.error(`[HistorySelfHealing] ${errMsg}`);
  } finally {
    if (db) {
      try {
        db.close();
      } catch {}
    }
  }

  // 3. Reconstruct Missing Thumbnails
  // Scan existing valid entries and see if full image exists but thumbnail is missing
  for (const entry of entries) {
    const id = entry.id;
    const slots: Array<'output' | 'input' | 'root_source'> = ['output', 'input', 'root_source'];
    for (const slot of slots) {
      try {
        const fullImageBlob = await loadRawData(`${id}_${slot}`);
        if (fullImageBlob) {
          const thumbImageBlob = await loadRawData(`${id}_thumb_${slot}`);
          if (!thumbImageBlob) {
            logger.log(`[HistorySelfHealing] Reconstructing missing thumbnail for entry: ${id}, slot: ${slot}`);
            if (fullImageBlob instanceof Blob) {
              const dataUrl = await blobToDataURL(fullImageBlob);
              await saveThumbnail(id, slot, dataUrl);
              report.reconstructedThumbnailsCount++;
            } else if (typeof fullImageBlob === 'string' && fullImageBlob.startsWith('data:')) {
              await saveThumbnail(id, slot, fullImageBlob);
              report.reconstructedThumbnailsCount++;
            } else {
              logger.warn(`[HistorySelfHealing] Cannot reconstruct thumbnail for entry ${id} slot ${slot} because source data is not a Blob or data URL:`, typeof fullImageBlob);
            }
          }
        }
      } catch (err) {
        logger.warn(`[HistorySelfHealing] Failed to check/reconstruct thumbnail for entry ${id} slot ${slot}:`, err);
      }
    }
  }

  // 4. Synchronize Collections
  // Check if any collection references deleted entries
  try {
    const { CollectionService } = await import('./CollectionService');
    const cols = CollectionService.load();
    let collectionsUpdated = false;
    for (const col of cols) {
      const originalLen = col.entryIds.length;
      col.entryIds = col.entryIds.filter(id => entryIds.has(id));
      if (col.entryIds.length !== originalLen) {
        collectionsUpdated = true;
      }
    }
    if (collectionsUpdated) {
      CollectionService.save(cols);
      logger.log('[HistorySelfHealing] Synchronized collection entry references.');
    }
  } catch {}

  logger.log('[HistorySelfHealing] Integrity check complete.', report);
  return report;
}
