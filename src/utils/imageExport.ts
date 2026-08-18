/**
 * Image and Video export utilities — download / save media from anywhere in the app.
 * Supports format conversion (PNG / JPG / WebP), quality control, and MP4/WebM video export.
 * Works inside Tauri's webview (no extra plugins required).
 */

import { logger } from './logger';

export type ExportFormat = 'png' | 'jpg' | 'webp' | 'mp4';
export type ExportScale = 1 | 2 | 4;

export interface ExportOptions {
  format?: ExportFormat;
  quality?: number;      // 0–1, used for jpg/webp
  baseName?: string;
  saveToDocuments?: boolean; // Tauri: save to Documents/Anarchy AI
  scale?: ExportScale;   // 1x, 2x (2K), 4x (4K) upscaling
  isVideo?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export const sanitize = (s: string): string =>
  s.replaceAll(/[^a-z0-9._-]+/gi, '_').slice(0, 80) || 'media';

export function isVideoUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  const clean = url.split('?')[0].split('#')[0].toLowerCase();
  return (
    clean.endsWith('.mp4') ||
    clean.endsWith('.webm') ||
    clean.endsWith('.mov') ||
    clean.endsWith('.avi') ||
    clean.endsWith('.mkv') ||
    url.startsWith('data:video/') ||
    url.includes('/video/') ||
    url.includes('.mp4?') ||
    url.includes('.webm?')
  );
}

const extFromMime = (mime: string): ExportFormat => {
  if (mime.includes('mp4') || mime.includes('video')) return 'mp4';
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  return 'jpg';
};

const extFromUrl = (url: string): ExportFormat | null => {
  const clean = url.split('?')[0].split('#')[0];
  const m = /\.(png|jpe?g|webp|mp4|webm|mov)$/i.exec(clean);
  if (!m) return null;
  const e = m[1].toLowerCase();
  if (e === 'jpeg') return 'jpg';
  return e as ExportFormat;
};

/**
 * Load an img element (for dimensions only — no canvas taint concern).
 */
function loadImg(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error('img load failed'));
    img.src = url;
  });
}

/**
 * Draw a data-URI onto a canvas and return converted data-URI.
 * Supports upscaling for 2K/4K export.
 */
function drawDataUri(dataUri: string, format: ExportFormat, quality: number, scale: number = 1): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const w = img.naturalWidth || img.width || 512;
      const h = img.naturalHeight || img.height || 512;
      canvas.width  = Math.floor(w * scale);
      canvas.height = Math.floor(h * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas 2D unavailable')); return; }
      
      // Enable smooth scaling for upscaling
      if (scale > 1) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
      }
      
      if (format === 'jpg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const mimeMap: Record<string, string> = { png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg' };
      const mime = mimeMap[format] || 'image/png';
      const q    = format === 'png' ? undefined : quality;
      resolve(canvas.toDataURL(mime, q));
    };
    img.onerror = () => reject(new Error('img load failed'));
    img.src = dataUri;
  });
}

/**
 * Convert any image URL to a data-URI in the requested format/quality.
 */
export async function convertImage(
  url: string,
  format: ExportFormat,
  quality: number = 0.92,
  scale: number = 1
): Promise<string> {
  if (!url) throw new Error('No image URL provided');

  if (isVideoUrl(url) || format === 'mp4') {
    return url;
  }

  // data: and blob: URIs are local to the webview — draw directly, no network needed.
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    try {
      return await drawDataUri(url, format, quality, scale);
    } catch {
      return url;
    }
  }

  // External URL — use Tauri Rust backend (reqwest) to fetch raw bytes.
  const isTauri = globalThis.window !== undefined && '__TAURI_INTERNALS__' in globalThis;

  if (isTauri) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const dataUri: string = await invoke('url_to_base64', { url });
      if (dataUri?.startsWith('data:')) {
        return await drawDataUri(dataUri, format, quality, scale);
      }
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : String(err));
    }
  }

  // Browser / dev fallback — direct anchor download of the original URL
  return url;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Download a single image or video to the browser / Tauri download folder.
 */
export async function downloadImage(
  url: string,
  baseName: string = 'anarchy-media',
  options: Omit<ExportOptions, 'baseName'> = {}
): Promise<void> {
  if (!url) throw new Error('No media URL provided');

  const isVideo = options.isVideo || isVideoUrl(url) || options.format === 'mp4';

  // ── VIDEO DOWNLOAD PATH ────────────────────────────────────────────────────
  if (isVideo) {
    const ext = url.toLowerCase().includes('.webm') ? 'webm' : (url.toLowerCase().includes('.mov') ? 'mov' : 'mp4');
    const timestamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-').slice(0, 19);
    const fileName = `${sanitize(baseName)}_${timestamp}.${ext}`;
    const isTauri = globalThis.window !== undefined && '__TAURI_INTERNALS__' in globalThis;

    if (isTauri) {
      try {
        if (options.saveToDocuments) {
          let dataUri = url;
          if (!url.startsWith('data:')) {
            const { invoke } = await import('@tauri-apps/api/core');
            dataUri = await invoke('url_to_base64', { url });
          }
          if (dataUri?.startsWith('data:')) {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('save_image_to_documents', { dataUri, fileName });
            return;
          }
        } else {
          const { save } = await import('@tauri-apps/plugin-dialog');
          const selectedPath = await save({
            defaultPath: fileName,
            filters: [{
              name: `${ext.toUpperCase()} Video`,
              extensions: [ext, 'mp4', 'webm', 'mov']
            }]
          });

          if (!selectedPath) {
            return; // user cancelled
          }

          let dataUri = url;
          if (!url.startsWith('data:')) {
            const { invoke } = await import('@tauri-apps/api/core');
            dataUri = await invoke('url_to_base64', { url });
          }

          if (dataUri?.startsWith('data:')) {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('save_image_to_path', { path: selectedPath, dataUri });
            return;
          }
        }
      } catch (err) {
        logger.error('[downloadVideo] Tauri save failed, falling back to browser download:', err);
      }
    }

    // Web / fallback download for video
    if (url.startsWith('data:')) {
      const parts = url.split(',');
      const mime = parts[0].split(':')[1].split(';')[0];
      const byteString = atob(parts[1]);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.codePointAt(i) ?? 0;
      }
      const blob = new Blob([ab], { type: mime || 'video/mp4' });
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
      return;
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }
  }

  // ── IMAGE DOWNLOAD PATH ────────────────────────────────────────────────────
  const format  = options.format  ?? extFromUrl(url) ?? extFromMime('');
  const quality = options.quality ?? 0.92;
  const scale   = options.scale   ?? 1;

  const timestamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-').slice(0, 19);
  const scaleSuffix = scale > 1 ? `_${scale}x` : '';
  const ext       = format === 'jpg' ? 'jpg' : format;
  const fileName  = `${sanitize(baseName)}${scaleSuffix}_${timestamp}.${ext}`;

  // Convert to data URI (no fetch calls — canvas-based)
  const dataUri = await convertImage(url, format, quality, scale);

  const isTauri = globalThis.window !== undefined && '__TAURI_INTERNALS__' in globalThis;

  if (isTauri) {
    if (options.saveToDocuments) {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('save_image_to_documents', { dataUri, fileName });
      return;
    } else {
      try {
        const { save } = await import('@tauri-apps/plugin-dialog');
        const selectedPath = await save({
          defaultPath: fileName,
          filters: [{
            name: `${format.toUpperCase()} Image`,
            extensions: [ext]
          }]
        });

        if (!selectedPath) {
          return; // user cancelled
        }

        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('save_image_to_path', { path: selectedPath, dataUri });
        return;
      } catch (err) {
        logger.error('[downloadImage] Tauri save failed, falling back:', err);
      }
    }
  }

  // Pass 3 fallback: direct anchor download
  if (!dataUri.startsWith('data:')) {
    if (options.saveToDocuments) {
      throw new Error('Cannot save external URL to Documents — canvas conversion failed');
    }
    const a = document.createElement('a');
    a.href     = dataUri;
    a.download = fileName;
    a.target   = '_blank';
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }

  if (options.saveToDocuments) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('save_image_to_documents', { dataUri, fileName });
    return;
  }

  // Convert data URI → blob → object URL for download
  const byteString = atob(dataUri.split(',')[1]);
  const mimeString = dataUri.split(',')[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.codePointAt(i) ?? 0;
  }
  const blob = new Blob([ab], { type: mimeString });
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href     = objectUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

/**
 * Export with full options object (used by ExportModal).
 */
export async function exportImage(url: string, options: ExportOptions): Promise<void> {
  await downloadImage(url, options.baseName ?? 'anarchy-media', options);
}

/**
 * Download many media files sequentially (small delay between each).
 */
export async function downloadImagesBatch(
  items: Array<{ url: string; name?: string; options?: ExportOptions }>
): Promise<{ succeeded: number; failed: number }> {
  let succeeded = 0;
  let failed = 0;
  for (let i = 0; i < items.length; i++) {
    const { url, name, options } = items[i];
    try {
      await exportImage(url, { baseName: name ?? `media_${i + 1}`, ...options });
      succeeded++;
      await new Promise(r => setTimeout(r, 250));
    } catch (err) {
      logger.error('[downloadImagesBatch] failed:', url, err);
      failed++;
    }
  }
  return { succeeded, failed };
}

/**
 * Get image dimensions from a URL without downloading.
 */
export async function getImageDimensions(url: string): Promise<{ w: number; h: number } | null> {
  try {
    if (isVideoUrl(url)) {
      return null;
    }
    const img = await loadImg(url);
    return { w: img.naturalWidth, h: img.naturalHeight };
  } catch {
    return null;
  }
}