/**
 * Image export utilities — download images from the canvas to the user's computer.
 * Uses blob + anchor click which works inside Tauri's webview (no extra plugins required).
 */

const sanitize = (s: string): string =>
  s.replace(/[^a-z0-9._-]+/gi, '_').slice(0, 80) || 'image';

const extFromMime = (mime: string): string => {
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif')) return 'gif';
  return 'jpg';
};

const extFromUrl = (url: string): string | null => {
  const clean = url.split('?')[0].split('#')[0];
  const m = clean.match(/\.(png|jpe?g|webp|gif)$/i);
  return m ? m[1].toLowerCase().replace('jpeg', 'jpg') : null;
};

/**
 * Download a single image given its URL (http, data: or blob:).
 * If no explicit extension is found, the MIME type is used.
 */
export async function downloadImage(
  url: string,
  baseName: string = 'anarchy-image'
): Promise<void> {
  if (!url) throw new Error('No image URL provided');

  let blob: Blob;
  if (url.startsWith('data:')) {
    const res = await fetch(url);
    blob = await res.blob();
  } else {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error(`Failed to fetch image (${res.status})`);
    blob = await res.blob();
  }

  const ext = extFromUrl(url) ?? extFromMime(blob.type);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const fileName = `${sanitize(baseName)}_${timestamp}.${ext}`;

  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

/**
 * Download many images sequentially (small delay between each so the browser
 * doesn't collapse them into a single prompt).
 */
export async function downloadImagesBatch(
  items: Array<{ url: string; name?: string }>
): Promise<{ succeeded: number; failed: number }> {
  let succeeded = 0;
  let failed = 0;
  for (let i = 0; i < items.length; i++) {
    const { url, name } = items[i];
    try {
      await downloadImage(url, name ?? `image_${i + 1}`);
      succeeded++;
      // Small delay so the webview doesn't block subsequent downloads
      await new Promise(r => setTimeout(r, 250));
    } catch (err) {
      console.error('[downloadImagesBatch] failed:', url, err);
      failed++;
    }
  }
  return { succeeded, failed };
}
