/**
 * Storage Manager Service
 * Manages IndexedDB image cache metrics and provides safe cache purge functionality
 */

import { openImageDB, revokeAllObjectUrls } from '../history/HistoryService';
import { logger } from '../../utils/logger';

export interface StorageMetrics {
  totalUsageBytes: number;
  quotaBytes: number;
  imageCacheBytes: number;
  imageCacheCount: number;
  storedImagesBytes: number;
  storedImagesCount: number;
  projectsBytes: number;
  historyBytes: number;
  formattedTotalUsage: string;
  formattedQuota: string;
  formattedImageCache: string;
  percentUsed: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export class StorageManagerService {
  /**
   * Compute comprehensive storage metrics across IndexedDB and LocalStorage
   */
  static async getStorageMetrics(): Promise<StorageMetrics> {
    let totalUsageBytes = 0;
    let quotaBytes = 0;

    // 1. Browser Storage Estimate
    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        totalUsageBytes = estimate.usage || 0;
        quotaBytes = estimate.quota || 0;
      } catch (err) {
        logger.warn('[StorageManager] Storage estimate error:', err);
      }
    }

    let imageCacheBytes = 0;
    let imageCacheCount = 0;
    let storedImagesBytes = 0;
    let storedImagesCount = 0;

    // 2. Scan IndexedDB Object Stores
    try {
      const db = await openImageDB();

      // Scan local_image_cache store
      if (db.objectStoreNames.contains('local_image_cache')) {
        await new Promise<void>((resolve) => {
          const tx = db.transaction('local_image_cache', 'readonly');
          const store = tx.objectStore('local_image_cache');
          const cursorReq = store.openCursor();

          cursorReq.onsuccess = (e) => {
            const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
              imageCacheCount++;
              const val = cursor.value;
              if (val instanceof Blob) {
                imageCacheBytes += val.size;
              } else if (typeof val === 'string') {
                imageCacheBytes += val.length * 2;
              } else if (val?.data && typeof val.data === 'string') {
                imageCacheBytes += val.data.length * 2;
              } else {
                imageCacheBytes += 1024;
              }
              cursor.continue();
            } else {
              resolve();
            }
          };

          cursorReq.onerror = () => resolve();
          tx.oncomplete = () => resolve();
        });
      }

      // Scan images store
      if (db.objectStoreNames.contains('images')) {
        await new Promise<void>((resolve) => {
          const tx = db.transaction('images', 'readonly');
          const store = tx.objectStore('images');
          const cursorReq = store.openCursor();

          cursorReq.onsuccess = (e) => {
            const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
              storedImagesCount++;
              const val = cursor.value;
              if (val instanceof Blob) {
                storedImagesBytes += val.size;
              } else if (typeof val === 'string') {
                storedImagesBytes += val.length * 2;
              } else if (val?.data && typeof val.data === 'string') {
                storedImagesBytes += val.data.length * 2;
              } else {
                storedImagesBytes += 1024;
              }
              cursor.continue();
            } else {
              resolve();
            }
          };

          cursorReq.onerror = () => resolve();
          tx.oncomplete = () => resolve();
        });
      }

      db.close();
    } catch (err) {
      logger.warn('[StorageManager] IndexedDB inspection error:', err);
    }

    // 3. Scan LocalStorage for Projects and History
    let projectsBytes = 0;
    let historyBytes = 0;

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        const val = localStorage.getItem(key) || '';
        const byteLength = (key.length + val.length) * 2;

        if (key.includes('project') || key.includes('workflow') || key.includes('builder_tab')) {
          projectsBytes += byteLength;
        } else if (key.includes('history')) {
          historyBytes += byteLength;
        }
      }
    } catch (err) {
      logger.warn('[StorageManager] LocalStorage calculation error:', err);
    }

    const calculatedIdbBytes = imageCacheBytes + storedImagesBytes;
    const finalTotalUsage = Math.max(totalUsageBytes, calculatedIdbBytes + projectsBytes + historyBytes);
    const percentUsed = quotaBytes > 0 ? Math.min(100, (finalTotalUsage / quotaBytes) * 100) : 0;

    return {
      totalUsageBytes: finalTotalUsage,
      quotaBytes,
      imageCacheBytes,
      imageCacheCount,
      storedImagesBytes,
      storedImagesCount,
      projectsBytes,
      historyBytes,
      formattedTotalUsage: formatBytes(finalTotalUsage),
      formattedQuota: formatBytes(quotaBytes),
      formattedImageCache: formatBytes(imageCacheBytes),
      percentUsed: Math.round(percentUsed * 10) / 10,
    };
  }

  /**
   * Safely purges temporary cached images from IndexedDB (local_image_cache)
   * while completely preserving .ana project files and active workspace nodes.
   */
  static async cleanImageCache(): Promise<{ freedBytes: number; freedCount: number }> {
    let freedBytes = 0;
    let freedCount = 0;

    try {
      // First measure current cache store
      const metricsBefore = await this.getStorageMetrics();
      freedBytes = metricsBefore.imageCacheBytes;
      freedCount = metricsBefore.imageCacheCount;

      const db = await openImageDB();

      // 1. Clear local_image_cache store
      if (db.objectStoreNames.contains('local_image_cache')) {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction('local_image_cache', 'readwrite');
          const store = tx.objectStore('local_image_cache');
          const clearReq = store.clear();
          clearReq.onsuccess = () => resolve();
          clearReq.onerror = () => reject(clearReq.error);
        });
      }

      // 2. Revoke any leaked browser object URLs
      revokeAllObjectUrls();

      db.close();
      logger.log(`[StorageManager] Purged ${freedCount} cached images (${formatBytes(freedBytes)})`);
    } catch (err) {
      logger.error('[StorageManager] Clean image cache failed:', err);
      throw err;
    }

    return { freedBytes, freedCount };
  }
}
