/**
 * Image export utilities — download / save images from anywhere in the app.
 * Supports format conversion (PNG / JPG / WebP) and quality control.
 * Works inside Tauri's webview (no extra plugins required).
 */

export type ExportFormat = 'png' | 'jpg' | 'webp';

export interface ExportOptions {
  format?: ExportFormat;
  quality?: number;      // 0–1, used for jpg/webp
  baseName?: string;
  saveToDocuments?: boolean; // Tauri: save to Documents/Anarchy AI
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export const sanitize = (s: string): string =>
  s.replace(/[^a-z0-9._-]+/gi, '_').slice(0, 80) || 'image';

const extFromMime = (mime: string): ExportFormat => {
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  return 'jpg';
};

const extFromUrl = (url: string): ExportFormat | null => {
  const clean = url.split('?')[0].split('#')[0];
  const m = clean.match(/\.(png|jpe?g|webp)$/i);
  if (!m) return null;
  const e = m[1].toLowerCase();
  return (e === 'jpeg' ? 'jpg' : e) as ExportFormat;
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
 */
function drawDataUri(dataUri: string, format: ExportFormat, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = img.naturalWidth  || img.width  || 512;
      canvas.height = img.naturalHeight || img.height || 512;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas 2D unavailable')); return; }
      if (format === 'jpg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
      ctx.drawImage(img, 0, 0);
      const mime = format === 'png' ? 'image/png' : format === 'webp' ? 'image/webp' : 'image/jpeg';
      const q    = format === 'png' ? undefined : quality;
      resolve(canvas.toDataURL(mime, q));
    };
    img.onerror = () => reject(new Error('img load failed'));
    img.src = dataUri;
  });
}

/**
 * Convert any image URL to a data-URI in the requested format/quality.
 *
 * Strategy:
 *   1. For data: URIs — draw directly to canvas (no network needed).
 *   2. For external URLs — invoke Tauri's `url_to_base64` Rust command which
 *      bypasses all CORS/CSP by fetching from the Rust backend (reqwest).
 *      Then redraw through canvas for format conversion.
 *   3. If Tauri invoke fails (browser/dev env) — return original URL as fallback
 *      so the caller can do a direct anchor click.
 */
export async function convertImage(
  url: string,
  format: ExportFormat,
  quality: number = 0.92
): Promise<string> {
  if (!url) throw new Error('No image URL provided');

  // data: and blob: URIs are local to the webview — draw directly, no network needed.
  // blob: URLs are same-origin so canvas.toDataURL() is never tainted.
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    try {
      return await drawDataUri(url, format, quality);
    } catch {
      return url;
    }
  }

  // External URL — use Tauri Rust backend (reqwest) to fetch raw bytes.
  // This bypasses all CORS/CSP restrictions completely.
  // __TAURI_INTERNALS__ is defined only inside a real Tauri webview.
  const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

  if (isTauri) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const dataUri: string = await invoke('url_to_base64', { url });
      if (dataUri?.startsWith('data:')) {
        return await drawDataUri(dataUri, format, quality);
      }
      console.warn('[imageExport] url_to_base64 returned unexpected value:', String(dataUri).slice(0, 80));
    } catch (err) {
      console.warn('[imageExport] url_to_base64 invoke failed:', err);
      throw new Error(err instanceof Error ? err.message : String(err));
    }
  }

  // Browser / dev fallback — direct anchor download of the original URL
  return url;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Download a single image to the browser / Tauri download folder.
 */
export async function downloadImage(
  url: string,
  baseName: string = 'anarchy-image',
  options: Omit<ExportOptions, 'baseName'> = {}
): Promise<void> {
  if (!url) throw new Error('No image URL provided');

  const format  = options.format  ?? extFromUrl(url) ?? extFromMime('');
  const quality = options.quality ?? 0.92;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const ext       = format === 'jpg' ? 'jpg' : format;
  const fileName  = `${sanitize(baseName)}_${timestamp}.${ext}`;

  // Convert to data URI (no fetch calls — canvas-based)
  const dataUri = await convertImage(url, format, quality);

  // Pass 3 fallback: convertImage returned the original URL because canvas
  // conversion failed. Do a direct anchor download (browser/Tauri handles it).
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
    document.body.removeChild(a);
    return;
  }

  if (options.saveToDocuments) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('save_image_to_documents', { dataUri, fileName });
    return;
  }

  // Convert data URI → blob → object URL for download
  const res       = await fetch(dataUri);
  const blob      = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href     = objectUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

/**
 * Export with full options object (used by ExportModal).
 */
export async function exportImage(url: string, options: ExportOptions): Promise<void> {
  await downloadImage(url, options.baseName ?? 'anarchy-image', options);
}

/**
 * Download many images sequentially (small delay between each).
 */
export async function downloadImagesBatch(
  items: Array<{ url: string; name?: string; options?: ExportOptions }>
): Promise<{ succeeded: number; failed: number }> {
  let succeeded = 0;
  let failed = 0;
  for (let i = 0; i < items.length; i++) {
    const { url, name, options } = items[i];
    try {
      await exportImage(url, { baseName: name ?? `image_${i + 1}`, ...options });
      succeeded++;
      await new Promise(r => setTimeout(r, 250));
    } catch (err) {
      console.error('[downloadImagesBatch] failed:', url, err);
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
    const img = await loadImg(url);
    return { w: img.naturalWidth, h: img.naturalHeight };
  } catch {
    return null;
  }
}
