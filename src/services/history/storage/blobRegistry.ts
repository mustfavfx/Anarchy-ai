import { logger } from '@/utils/logger';

// Track active Object URLs to prevent memory leaks and reuse identical URLs
const objectUrlRegistry = new Set<string>();
const keyToObjectUrlMap = new Map<string, string>();

export function registerObjectUrl(url: string, key?: string): string {
  objectUrlRegistry.add(url);
  if (key) {
    keyToObjectUrlMap.set(key, url);
  }
  return url;
}

export function getCachedObjectUrl(key: string): string | undefined {
  return keyToObjectUrlMap.get(key);
}

export function getObjectUrlRegistrySize(): number {
  return objectUrlRegistry.size;
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
  keyToObjectUrlMap.clear();
}

export function revokeObjectUrl(url: string): void {
  if (objectUrlRegistry.has(url)) {
    try {
      URL.revokeObjectURL(url);
    } catch {}
    objectUrlRegistry.delete(url);
    for (const [k, v] of keyToObjectUrlMap.entries()) {
      if (v === url) {
        keyToObjectUrlMap.delete(k);
      }
    }
  }
}

export function dataURLtoBlob(dataUrl: string): Blob {
  const commaIdx = dataUrl.indexOf(',');
  const header = commaIdx !== -1 ? dataUrl.slice(0, commaIdx) : 'data:image/png;base64';
  const base64 = commaIdx !== -1 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  const mimeMatch = header.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';

  // 1. Native C++ SIMD decoding where supported (Chromium 128+)
  if (typeof (Uint8Array as any).fromBase64 === 'function') {
    try {
      const u8arr = (Uint8Array as any).fromBase64(base64);
      return new Blob([u8arr], { type: mime });
    } catch {}
  }

  // 2. High-speed chunked decoding avoiding single-byte thread locks
  const bstr = atob(base64);
  const len = bstr.length;
  const u8arr = new Uint8Array(len);
  const BLOCK_SIZE = 65536;
  for (let offset = 0; offset < len; offset += BLOCK_SIZE) {
    const end = Math.min(offset + BLOCK_SIZE, len);
    for (let i = offset; i < end; i++) {
      u8arr[i] = bstr.charCodeAt(i);
    }
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
export async function compressToThumbnail(dataUrl: string, maxSize = 384): Promise<string> {
  if (typeof window === 'undefined' || !window.HTMLCanvasElement || !window.Image) {
    return dataUrl;
  }
  return new Promise((resolve) => {
    try {
      const img = new Image();
      const timeout = setTimeout(() => {
        resolve(dataUrl);
      }, 500); // 500ms safety timeout

      img.onload = () => {
        clearTimeout(timeout);
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
      img.onerror = () => {
        clearTimeout(timeout);
        resolve(dataUrl);
      };
      img.src = dataUrl;
    } catch {
      resolve(dataUrl);
    }
  });
}
