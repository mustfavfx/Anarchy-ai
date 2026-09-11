import { logger } from '@/utils/logger';

// Track active Object URLs to prevent memory leaks
const objectUrlRegistry = new Set<string>();

export function registerObjectUrl(url: string): string {
  objectUrlRegistry.add(url);
  return url;
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
}

export function revokeObjectUrl(url: string): void {
  if (objectUrlRegistry.has(url)) {
    try {
      URL.revokeObjectURL(url);
    } catch {}
    objectUrlRegistry.delete(url);
  }
}

export function dataURLtoBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
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
