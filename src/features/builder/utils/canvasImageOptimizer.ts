import { logger } from '@/utils/logger';
import { cacheLocalImage, getLocalImage, getLocalImageAsObjectURL, dataURLtoBlob, blobToDataURL } from '@/services/history/HistoryService';
import { isVideoUrl } from './builderHelpers';
import {
  memoryThumbnailCache,
  inFlightThumbnails,
  trimMemoryCache,
  invalidateCanvasThumbnail,
  primeCanvasThumbnail,
  getCachedCanvasThumbnail,
} from '@/services/image/memoryThumbnailCache';

export {
  memoryThumbnailCache,
  inFlightThumbnails,
  trimMemoryCache,
  invalidateCanvasThumbnail,
  primeCanvasThumbnail,
  getCachedCanvasThumbnail,
};

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
    let imageSource: any = null;

    if (typeof source === 'string') {
      if (source.startsWith('data:')) {
        try {
          blob = dataURLtoBlob(source);
        } catch {
          return null;
        }
      } else if (source.startsWith('blob:')) {
        try {
          const res = await fetch(source);
          if (res.ok) blob = await res.blob();
        } catch {}
      } else if (source.startsWith('http://') || source.startsWith('https://')) {
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          const b64 = await invoke<string>('url_to_base64', { url: source });
          if (b64 && b64.startsWith('data:')) {
            blob = dataURLtoBlob(b64);
          }
        } catch {}
        if (!blob) {
          try {
            const res = await fetch(source, { referrerPolicy: 'no-referrer' });
            if (res.ok) blob = await res.blob();
          } catch {}
        }
      }

      if (!blob && typeof Image !== 'undefined') {
        try {
          const img = new Image();
          img.referrerPolicy = 'no-referrer';
          img.src = source;
          if (typeof img.decode === 'function') {
            await img.decode();
          } else {
            await new Promise<void>((res, rej) => {
              img.onload = () => res();
              img.onerror = rej;
            });
          }
          imageSource = img;
        } catch {
          // Fall through
        }
      }
    } else {
      blob = source;
    }

    const bitmapSource = imageSource || blob;
    if (!bitmapSource) return null;

    // Use native createImageBitmap with browser-side hardware downsampling in a single decode pass
    if (typeof createImageBitmap !== 'undefined') {
      try {
        const probeBitmap = await createImageBitmap(bitmapSource);
        const w = probeBitmap.width;
        const h = probeBitmap.height;

        // If image is already smaller or equal to maxDimension, use as-is
        if (w <= maxDimension && h <= maxDimension) {
          probeBitmap.close();
          if (blob) return blob;
          if (typeof source === 'string' && source.startsWith('data:')) {
            return dataURLtoBlob(source);
          }
        }

        const scale = Math.min(maxDimension / w, maxDimension / h);
        const targetW = Math.max(1, Math.round(w * scale));
        const targetH = Math.max(1, Math.round(h * scale));

        if (typeof OffscreenCanvas !== 'undefined') {
          const canvas = new OffscreenCanvas(targetW, targetH);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(probeBitmap, 0, 0, targetW, targetH);
            probeBitmap.close();
            return await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
          }
        }

        if (typeof document !== 'undefined') {
          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(probeBitmap, 0, 0, targetW, targetH);
            probeBitmap.close();
            return await new Promise<Blob | null>((resolve) => {
              canvas.toBlob(resolve, 'image/jpeg', 0.85);
            });
          }
        }
        probeBitmap.close();
      } catch (bitmapErr) {
        logger.warn('[canvasImageOptimizer] createImageBitmap failed, falling back to HTMLImageElement:', bitmapErr);
      }
    }

    // Fallback: HTMLImageElement
    if (typeof document !== 'undefined') {
      if (!blob) return null;
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

  const cached = getCachedCanvasThumbnail(rawKeyOrUrl);
  if (cached) return cached;

  const inFlight = inFlightThumbnails.get(rawKeyOrUrl);
  if (inFlight) return inFlight;

  const promise = (async () => {
    try {
      if (rawKeyOrUrl.startsWith('idb://')) {
        const cleanKey = rawKeyOrUrl.replace(/^idb:\/\//, '').replace(/_canvas_thumb$/, '');
        const thumbKey = `idb://${cleanKey}_canvas_thumb`;

        // Check memory cache under alternate keys
        const altCached = getCachedCanvasThumbnail(thumbKey) || getCachedCanvasThumbnail(`idb://${cleanKey}`) || getCachedCanvasThumbnail(cleanKey);
        if (altCached) {
          primeCanvasThumbnail(rawKeyOrUrl, altCached);
          return altCached;
        }

        // 1. Check if thumbnail is already cached in IndexedDB - fetch as Base64 Data URL
        // (30KB JPEG Base64 is immune to revocation, renders instantly in Chromium WebView2)
        const cachedThumbBase64 = await getLocalImage(thumbKey);
        if (cachedThumbBase64) {
          trimMemoryCache();
          primeCanvasThumbnail(rawKeyOrUrl, cachedThumbBase64);
          primeCanvasThumbnail(thumbKey, cachedThumbBase64);
          primeCanvasThumbnail(`idb://${cleanKey}`, cachedThumbBase64);
          return cachedThumbBase64;
        }

        // 2. Load full image from IndexedDB
        let fullData = await getLocalImage(`idb://${cleanKey}`);
        if (!fullData && rawKeyOrUrl !== `idb://${cleanKey}`) {
          fullData = await getLocalImage(rawKeyOrUrl);
        }
        if (!fullData) {
          const objUrl = await getLocalImageAsObjectURL(`idb://${cleanKey}`) || await getLocalImageAsObjectURL(rawKeyOrUrl);
          if (objUrl) fullData = objUrl;
        }
        if (!fullData) return '';

        const thumbBlob = await createOptimizedThumbnailBlob(fullData, maxDimension);
        if (thumbBlob) {
          await cacheLocalImage(thumbKey, thumbBlob).catch(() => {});
          const thumbUrl = await blobToDataURL(thumbBlob);
          trimMemoryCache();
          primeCanvasThumbnail(rawKeyOrUrl, thumbUrl);
          primeCanvasThumbnail(thumbKey, thumbUrl);
          primeCanvasThumbnail(`idb://${cleanKey}`, thumbUrl);
          return thumbUrl;
        }
        return fullData;
      }

      // For data:, blob:, or remote URLs
      const thumbBlob = await createOptimizedThumbnailBlob(rawKeyOrUrl, maxDimension);
      if (thumbBlob) {
        const thumbUrl = await blobToDataURL(thumbBlob);
        trimMemoryCache();
        primeCanvasThumbnail(rawKeyOrUrl, thumbUrl);
        return thumbUrl;
      }
      return rawKeyOrUrl;
    } catch (err) {
      logger.warn('[canvasImageOptimizer] resolveCanvasThumbnail failed:', err);
      if (rawKeyOrUrl.startsWith('idb://')) {
        const cleanKey = rawKeyOrUrl.replace(/^idb:\/\//, '').replace(/_canvas_thumb$/, '');
        const fallback = (await getLocalImage(`idb://${cleanKey}`)) || (await getLocalImageAsObjectURL(`idb://${cleanKey}`));
        return fallback || '';
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
