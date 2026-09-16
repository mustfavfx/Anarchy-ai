import { logger } from '@/utils/logger';
import { cacheLocalImage, getLocalImageAsObjectURL } from '@/services/history/HistoryService';
import { isVideoUrl } from './builderHelpers';

const memoryThumbnailCache = new Map<string, string>();
const inFlightThumbnails = new Map<string, Promise<string>>();

const MAX_CACHE_ENTRIES = 200;

function trimMemoryCache() {
  if (memoryThumbnailCache.size > MAX_CACHE_ENTRIES) {
    const keysToDelete = Array.from(memoryThumbnailCache.keys()).slice(0, 50);
    keysToDelete.forEach(k => {
      const url = memoryThumbnailCache.get(k);
      if (url && url.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(url);
        } catch {}
      }
      memoryThumbnailCache.delete(k);
    });
  }
}

/**
 * Invalidates any cached thumbnail in memory or in-flight promises for the given key.
 */
export function invalidateCanvasThumbnail(rawKeyOrUrl?: string | null): void {
  if (!rawKeyOrUrl) return;
  const cleanKey = rawKeyOrUrl.replace(/^idb:\/\//, '').replace(/_canvas_thumb$/, '');
  const keysToPurge = [
    rawKeyOrUrl,
    `idb://${cleanKey}`,
    `idb://${cleanKey}_canvas_thumb`
  ];
  for (const k of keysToPurge) {
    const url = memoryThumbnailCache.get(k);
    if (url && url.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    }
    memoryThumbnailCache.delete(k);
    inFlightThumbnails.delete(k);
  }
}

let activeThumbnailJobs = 0;
const thumbnailQueue: Array<() => void> = [];

function acquireThumbnailSlot(): Promise<void> {
  if (activeThumbnailJobs < 4) {
    activeThumbnailJobs++;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    thumbnailQueue.push(() => {
      activeThumbnailJobs++;
      resolve();
    });
  });
}

function releaseThumbnailSlot(): void {
  activeThumbnailJobs--;
  if (thumbnailQueue.length > 0) {
    const next = thumbnailQueue.shift();
    next?.();
  }
}

/**
 * Creates an optimized lightweight thumbnail Blob from a source image
 * Uses native off-thread createImageBitmap where available for microsecond resizing.
 */
export async function createOptimizedThumbnailBlob(
  source: Blob | string,
  maxDimension = 640
): Promise<Blob | null> {
  await acquireThumbnailSlot();
  try {
    let blob: Blob | null = null;
    if (typeof source === 'string') {
      if (source.startsWith('data:')) {
        // Safe in-memory decoding to avoid CSP connect-src issues with fetch(data:...)
        try {
          const [header, base64] = source.split(',');
          const mimeMatch = header.match(/data:([^;]+)/);
          const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          blob = new Blob([bytes], { type: mime });
        } catch {
          return null;
        }
      } else if (source.startsWith('blob:') || source.startsWith('http')) {
        const res = await fetch(source);
        blob = await res.blob();
      } else {
        return null;
      }
    } else {
      blob = source;
    }

    if (!blob) return null;

    // Use native createImageBitmap with browser-side hardware downsampling
    if (typeof createImageBitmap !== 'undefined') {
      try {
        const probeBitmap = await createImageBitmap(blob);
        const w = probeBitmap.width;
        const h = probeBitmap.height;
        probeBitmap.close();

        // If image is already smaller or equal to maxDimension, use as-is
        if (w <= maxDimension && h <= maxDimension) {
          return blob;
        }

        const scale = Math.min(maxDimension / w, maxDimension / h);
        const targetW = Math.max(1, Math.round(w * scale));
        const targetH = Math.max(1, Math.round(h * scale));

        const resizedBitmap = await createImageBitmap(blob, {
          resizeWidth: targetW,
          resizeHeight: targetH,
          resizeQuality: 'high'
        });

        if (typeof OffscreenCanvas !== 'undefined') {
          const canvas = new OffscreenCanvas(targetW, targetH);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(resizedBitmap, 0, 0);
            resizedBitmap.close();
            return await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
          }
        }

        if (typeof document !== 'undefined') {
          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(resizedBitmap, 0, 0);
            resizedBitmap.close();
            return await new Promise<Blob | null>((resolve) => {
              canvas.toBlob(resolve, 'image/jpeg', 0.85);
            });
          }
        }
        resizedBitmap.close();
      } catch (bitmapErr) {
        logger.warn('[canvasImageOptimizer] createImageBitmap failed, falling back to HTMLImageElement:', bitmapErr);
      }
    }

    // Fallback: HTMLImageElement
    if (typeof document !== 'undefined') {
      return new Promise<Blob | null>((resolve) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(blob);
        const timeout = setTimeout(() => {
          URL.revokeObjectURL(objectUrl);
          resolve(blob);
        }, 2000);

        img.onload = () => {
          clearTimeout(timeout);
          URL.revokeObjectURL(objectUrl);
          const w = img.naturalWidth || img.width;
          const h = img.naturalHeight || img.height;

          if (w <= maxDimension && h <= maxDimension) {
            resolve(blob);
            return;
          }

          const scale = Math.min(maxDimension / w, maxDimension / h);
          const targetW = Math.max(1, Math.round(w * scale));
          const targetH = Math.max(1, Math.round(h * scale));

          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(blob);
            return;
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, targetW, targetH);
          canvas.toBlob(resolve, 'image/jpeg', 0.85);
        };

        img.onerror = () => {
          clearTimeout(timeout);
          URL.revokeObjectURL(objectUrl);
          resolve(blob);
        };

        img.src = objectUrl;
      });
    }
  } catch (err) {
    logger.warn('[canvasImageOptimizer] Failed to create thumbnail blob:', err);
  } finally {
    releaseThumbnailSlot();
  }

  return null;
}

/**
 * Resolves a high-resolution image identifier or URL to a lightweight, GPU-optimized
 * canvas display proxy URL. Results are persistently cached in IndexedDB and memory.
 */
export async function resolveCanvasThumbnail(
  rawKeyOrUrl: string,
  maxDimension = 640
): Promise<string> {
  if (!rawKeyOrUrl) return '';
  if (isVideoUrl(rawKeyOrUrl)) return rawKeyOrUrl;

  const cached = memoryThumbnailCache.get(rawKeyOrUrl);
  if (cached) return cached;

  const inFlight = inFlightThumbnails.get(rawKeyOrUrl);
  if (inFlight) return inFlight;

  const promise = (async () => {
    try {
      if (rawKeyOrUrl.startsWith('idb://')) {
        const cleanKey = rawKeyOrUrl.replace(/^idb:\/\//, '').replace(/_canvas_thumb$/, '');
        const thumbKey = `idb://${cleanKey}_canvas_thumb`;

        // Check memory cache under alternate keys
        const altCached = memoryThumbnailCache.get(thumbKey) || memoryThumbnailCache.get(`idb://${cleanKey}`);
        if (altCached) {
          memoryThumbnailCache.set(rawKeyOrUrl, altCached);
          return altCached;
        }

        // Check if thumbnail is already cached in IndexedDB
        const cachedThumbUrl = await getLocalImageAsObjectURL(thumbKey);
        if (cachedThumbUrl) {
          trimMemoryCache();
          memoryThumbnailCache.set(rawKeyOrUrl, cachedThumbUrl);
          memoryThumbnailCache.set(thumbKey, cachedThumbUrl);
          memoryThumbnailCache.set(`idb://${cleanKey}`, cachedThumbUrl);
          return cachedThumbUrl;
        }

        // Load full image to generate the thumbnail
        let fullUrl = await getLocalImageAsObjectURL(`idb://${cleanKey}`);
        if (!fullUrl && rawKeyOrUrl !== `idb://${cleanKey}`) {
          fullUrl = await getLocalImageAsObjectURL(rawKeyOrUrl);
        }
        if (!fullUrl) return '';

        const thumbBlob = await createOptimizedThumbnailBlob(fullUrl, maxDimension);
        if (thumbBlob) {
          await cacheLocalImage(thumbKey, thumbBlob).catch(() => {});
          const thumbUrl = URL.createObjectURL(thumbBlob);
          trimMemoryCache();
          memoryThumbnailCache.set(rawKeyOrUrl, thumbUrl);
          memoryThumbnailCache.set(thumbKey, thumbUrl);
          memoryThumbnailCache.set(`idb://${cleanKey}`, thumbUrl);
          return thumbUrl;
        }
        return fullUrl;
      }

      // For data:, blob:, or remote URLs
      const thumbBlob = await createOptimizedThumbnailBlob(rawKeyOrUrl, maxDimension);
      if (thumbBlob) {
        const thumbUrl = URL.createObjectURL(thumbBlob);
        trimMemoryCache();
        memoryThumbnailCache.set(rawKeyOrUrl, thumbUrl);
        return thumbUrl;
      }
      return rawKeyOrUrl;
    } catch (err) {
      logger.warn('[canvasImageOptimizer] resolveCanvasThumbnail failed:', err);
      if (rawKeyOrUrl.startsWith('idb://')) {
        const cleanKey = rawKeyOrUrl.replace(/^idb:\/\//, '').replace(/_canvas_thumb$/, '');
        const fallbackUrl = await getLocalImageAsObjectURL(`idb://${cleanKey}`);
        return fallbackUrl || '';
      }
    }
    return rawKeyOrUrl.startsWith('idb://') ? '' : rawKeyOrUrl;
  })();

  inFlightThumbnails.set(rawKeyOrUrl, promise);
  try {
    const result = await promise;
    return result;
  } finally {
    inFlightThumbnails.delete(rawKeyOrUrl);
  }
}
