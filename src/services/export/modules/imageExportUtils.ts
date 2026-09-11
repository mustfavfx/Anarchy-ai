import { invoke } from '@tauri-apps/api/core';
import { save, open } from '@tauri-apps/plugin-dialog';
import type { Node } from '@xyflow/react';
import { sanitize, timestamp, type ExportImageItem, type ExportOptions } from './exportTypes';

/**
 * Convert image URL to data URI for export
 */
export async function urlToDataUri(
  url: string,
  format: 'png' | 'jpg' | 'webp' = 'jpg',
  quality: number = 0.92
): Promise<string> {
  if (url.startsWith('data:')) return url;

  // Handle idb:// URLs (IndexedDB local cache)
  if (url.startsWith('idb://')) {
    try {
      const { getLocalImage } = await import('../../history/HistoryService');
      const cached = await getLocalImage(url);
      if (cached) {
        url = cached;
      }
    } catch (err) {
      console.warn('[urlToDataUri] Failed to resolve idb image:', err);
    }
  }

  // Handle blob URLs directly via fetch & FileReader to avoid CORS/security blocks
  if (url.startsWith('blob:')) {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const dataUri = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      return dataUri;
    } catch (err) {
      console.warn('[urlToDataUri] Failed to read blob URL:', err);
    }
  }

  // Try Tauri Rust command to bypass CORS for remote images
  try {
    const dataUri = await invoke<string>('url_to_base64', { url });
    if (dataUri?.startsWith('data:')) return dataUri;
  } catch (err) {
    console.warn('[urlToDataUri] Tauri url_to_base64 failed, falling back to browser:', err);
  }
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!url.startsWith('blob:') && !url.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width || 512;
      canvas.height = img.naturalHeight || img.height || 512;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas unavailable')); return; }
      
      if (format === 'jpg') {
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0);
      
      const mimeMap = { png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg' };
      const mime = mimeMap[format];
      resolve(canvas.toDataURL(mime, format === 'png' ? undefined : quality));
    };
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = url;
  });
}

/**
 * Save data URI to file using Tauri dialog
 */
export async function saveDataUriWithDialog(
  dataUri: string, 
  defaultName: string, 
  filters: { name: string; extensions: string[] }[]
): Promise<string | null> {
  const filePath = await save({
    defaultPath: defaultName,
    filters,
  });
  
  if (!filePath) return null; // User cancelled
  
  const base64Data = dataUri.split(',')[1];
  if (!base64Data) throw new Error('Invalid data URI');
  
  await invoke('save_file', { 
    path: filePath, 
    contents: base64Data,
    binary: true 
  });
  
  return filePath;
}

/**
 * Export single image with native save dialog
 * Returns the saved file path or null if cancelled
 */
export async function exportImageWithDialog(
  url: string,
  name: string,
  options: ExportOptions = {}
): Promise<string | null> {
  const format = options.format ?? 'png';
  const quality = options.quality ?? 0.92;
  
  const dataUri = await urlToDataUri(url, format, quality);
  const defaultName = `${sanitize(name)}_${timestamp()}.${format}`;
  
  return saveDataUriWithDialog(dataUri, defaultName, [
    { name: `${format.toUpperCase()} Image`, extensions: [format] },
    { name: 'All Files', extensions: ['*'] },
  ]);
}

/**
 * Export multiple images with native save dialogs
 * Returns the directory path or null if cancelled
 */
export async function exportImagesBatchWithDialog(
  items: ExportImageItem[],
  options: ExportOptions = {}
): Promise<{ succeeded: number; failed: number; paths: string[] }> {
  if (items.length === 0) return { succeeded: 0, failed: 0, paths: [] };
  
  const selectedDir = await open({
    directory: true,
    multiple: false,
    title: 'Select Export Directory'
  });
  
  if (!selectedDir || typeof selectedDir !== 'string') {
    return { succeeded: 0, failed: 0, paths: [] };
  }
  
  let succeeded = 0;
  let failed = 0;
  const paths: string[] = [];
  
  const format = options.format ?? 'jpg';
  const quality = options.quality ?? 0.92;
  const separator = selectedDir.includes('\\') ? '\\' : '/';
  
  for (const item of items) {
    try {
      const dataUri = await urlToDataUri(item.url, format, quality);
      
      let ext = format === 'jpg' ? 'jpg' : format;
      if (dataUri.startsWith('data:video/')) {
        const mime = dataUri.split(';')[0].split(':')[1];
        if (mime === 'video/mp4') ext = 'mp4';
        else if (mime === 'video/webm') ext = 'webm';
        else if (mime === 'video/quicktime' || mime === 'video/mov') ext = 'mov';
        else ext = 'mp4';
      }
      
      const fileName = `${sanitize(item.name)}_${timestamp()}.${ext}`;
      const filePath = `${selectedDir}${separator}${fileName}`;
      
      const base64Data = dataUri.split(',')[1];
      if (!base64Data) throw new Error('Invalid data URI');
      
      await invoke('save_file', { 
        path: filePath, 
        contents: base64Data,
        binary: true 
      });
      
      succeeded++;
      paths.push(filePath);
      
      await new Promise(r => setTimeout(r, 50));
    } catch (err) {
      console.error('[Export] Failed:', item.name, err);
      failed++;
    }
  }
  
  return { succeeded, failed, paths };
}

/**
 * Extract image items from canvas nodes (handles single images, outputData, and variant batches)
 */
export function extractImagesFromNodes(nodes: Node[]): ExportImageItem[] {
  const images: ExportImageItem[] = [];
  for (const node of nodes) {
    const data = node.data as any;
    const singleUrl = data?.image || data?.outputData?.image;
    const prompt = data?.prompt || data?.outputData?.prompt;
    const baseName = `${data?.type || 'node'}_${node.id}`;

    if (singleUrl) {
      images.push({ url: singleUrl, name: baseName, prompt });
    }

    if (Array.isArray(data?.images)) {
      data.images.forEach((variantUrl: string, idx: number) => {
        if (variantUrl && variantUrl !== singleUrl) {
          images.push({ url: variantUrl, name: `${baseName}_variant_${idx + 1}`, prompt });
        }
      });
    }
  }
  return images;
}

export async function loadImageElement(url: string): Promise<HTMLImageElement> {
  let resolvedUrl = url;
  if (url && url.startsWith('idb://')) {
    try {
      const { getLocalImage } = await import('../../history/HistoryService');
      const cached = await getLocalImage(url);
      if (cached) resolvedUrl = cached;
    } catch (err) {
      console.error('[ExportService] Failed to load local image dynamically:', err);
    }
  }

  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = resolvedUrl;
  });
  return img;
}

/** Strip runtime callbacks from node data */
export function stripCallbacks(data: Record<string, any>): Record<string, any> {
  const rest = { ...data };
  delete rest.onAddChild;
  delete rest.onImageUpload;
  delete rest.onImagesUpload;
  delete rest.onDelete;
  delete rest.onExecute;
  delete rest.onRetry;
  return rest;
}
