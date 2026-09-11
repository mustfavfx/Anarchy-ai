import { invoke } from '@tauri-apps/api/core';
import { logger } from '../../../utils/logger';

/**
 * Universal image resolver for Reve API.
 * 
 * Strategy:
 * - For URL types (https://, blob:, etc.): use Tauri's url_to_base64 command 
 *   which runs in Rust and bypasses browser CORS restrictions entirely.
 * - For data URIs: strip the prefix and return raw base64.
 * - Reve API auto-detects the image format from binary magic bytes,
 *   so we just need to send clean raw base64 without any prefix.
 */
export async function resolveImageToPngBase64(src: string): Promise<string> {
  if (!src) throw new Error('No image source provided');

  // Helper to extract raw base64 string from data URI
  const getRawBase64 = (s: string): string => {
    const idx = s.indexOf(',');
    return idx !== -1 ? s.substring(idx + 1).trim() : s.trim();
  };

  // Helper to check if raw base64 is already PNG or JPEG by binary magic header
  const isAlreadyPngOrJpeg = (b64: string): boolean => {
    return b64.startsWith('iVBORw0') || b64.startsWith('/9j/') || b64.startsWith('iVBORw');
  };

  // Helper: Draw WebP/GIF/other images onto 2D Canvas and return clean PNG base64
  const convertToPngBase64 = (imageSource: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      if (imageSource.startsWith('http://') || imageSource.startsWith('https://')) {
        img.crossOrigin = 'anonymous';
      }
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width || 1024;
          canvas.height = img.naturalHeight || img.height || 1024;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas 2D context unavailable'));
            return;
          }
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);

          const dataUrl = canvas.toDataURL('image/png', 0.95);
          resolve(getRawBase64(dataUrl));
        } catch (err) {
          reject(new Error(`Canvas PNG export failed: ${err}`));
        }
      };
      img.onerror = () => reject(new Error(`Image element failed to load source: ${imageSource.substring(0, 60)}`));
      img.src = imageSource;
    });
  };

  // ── Step 0: IndexedDB key (idb://) ──────────────────────────────────────
  if (src.startsWith('idb://')) {
    try {
      const { getLocalImageAsObjectURL } = await import('../../history/HistoryService');
      const resolved = await getLocalImageAsObjectURL(src);
      if (resolved) {
        src = resolved;
      }
    } catch (err) {
      logger.warn('[AnarchyService] Failed to resolve idb:// image:', err);
    }
  }

  // ── Step 1: Check if src is already a data URI ──────────────────────────
  if (src.startsWith('data:')) {
    const rawB64 = getRawBase64(src);
    if (isAlreadyPngOrJpeg(rawB64)) {
      return rawB64; // ✅ Already PNG or JPEG binary — send directly!
    }
    const mimeMatch = src.substring(0, src.indexOf(',')).match(/data:([^;]+)/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/webp';
    const validMime = mime.startsWith('image/') ? mime : 'image/webp';
    const validDataUri = `data:${validMime};base64,${rawB64}`;
    return await convertToPngBase64(validDataUri);
  }

  // ── Step 2: Blob URL (in-memory browser object) ─────────────────────────
  if (src.startsWith('blob:')) {
    logger.log('[AnarchyService] Reading blob URL directly in browser...');
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = async () => {
          const resDataUrl = reader.result as string;
          const rawB64 = getRawBase64(resDataUrl);
          if (isAlreadyPngOrJpeg(rawB64)) {
            resolve(rawB64);
          } else {
            try {
              const converted = await convertToPngBase64(`data:image/webp;base64,${rawB64}`);
              resolve(converted);
            } catch (e) {
              reject(e);
            }
          }
        };
        reader.onerror = (e) => reject(new Error(`FileReader failed: ${e}`));
        reader.readAsDataURL(blob);
      });
    } catch (err) {
      logger.warn('[AnarchyService] Blob fetch failed, converting directly:', err);
      return await convertToPngBase64(src);
    }
  }

  // ── Step 3: Local/External URL (https://, http://, asset://) via Tauri ──
  const isTauri = globalThis.window !== undefined && '__TAURI_INTERNALS__' in globalThis;
  if (isTauri) {
    try {
      logger.log('[AnarchyService] Fetching URL via Tauri url_to_base64:', src.substring(0, 60));
      const dataUri = await invoke<string>('url_to_base64', { url: src });
      if (dataUri) {
        const rawB64 = getRawBase64(dataUri);
        if (isAlreadyPngOrJpeg(rawB64)) {
          return rawB64; // ✅ Already PNG or JPEG binary — send directly!
        }
        return await convertToPngBase64(`data:image/webp;base64,${rawB64}`);
      }
    } catch (err) {
      logger.warn('[AnarchyService] Tauri url_to_base64 failed, trying Canvas fallback:', err);
    }
  }

  // ── Step 4: Final Canvas fallback ───────────────────────────────────────
  return await convertToPngBase64(src);
}
