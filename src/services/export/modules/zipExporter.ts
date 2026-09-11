import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import type { Node } from '@xyflow/react';
import JSZip from 'jszip';
import {
  sanitize,
  timestamp,
  PROGRAM_IDENTITY,
  type ExportImageItem,
  type ZipExportOptions
} from './exportTypes';
import { urlToDataUri, extractImagesFromNodes } from './imageExportUtils';

/**
 * Export multiple images and their prompts into a structured ZIP archive
 */
export async function exportImagesToZipWithDialog(
  items: ExportImageItem[],
  options: ZipExportOptions = {}
): Promise<string | null> {
  if (!items || items.length === 0) {
    throw new Error('No images to export in archive');
  }

  const zip = new JSZip();
  const includePrompts = options.includePrompts ?? true;
  const includeManifest = options.includeManifest ?? true;
  const manifestItems: any[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      let dataUri = item.url;
      if (!dataUri.startsWith('data:')) {
        dataUri = await urlToDataUri(item.url, options.format === 'jpg' ? 'jpg' : 'png', 0.95);
      }

      let ext = 'png';
      const match = dataUri.match(/^data:image\/([a-zA-Z0-9-+]+);base64,/);
      if (match && match[1]) {
        ext = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
      }

      const indexPrefix = String(i + 1).padStart(2, '0');
      const baseName = sanitize(item.name || `image_${i + 1}`);
      const imageFileName = `${indexPrefix}_${baseName}.${ext}`;

      const base64Content = dataUri.split(',')[1];
      if (base64Content) {
        zip.file(imageFileName, base64Content, { base64: true });
      }

      if (includePrompts && item.prompt) {
        const promptFileName = `${indexPrefix}_${baseName}_prompt.txt`;
        zip.file(promptFileName, String(item.prompt));
      }

      manifestItems.push({
        index: i + 1,
        filename: imageFileName,
        name: item.name,
        prompt: item.prompt || null,
      });
    } catch (err) {
      console.warn(`[exportImagesToZipWithDialog] Failed to package ${item.name}:`, err);
    }
  }

  if (includeManifest) {
    const manifest = {
      generator: PROGRAM_IDENTITY.name,
      version: PROGRAM_IDENTITY.version,
      exportedAt: new Date().toISOString(),
      totalImages: manifestItems.length,
      items: manifestItems,
    };
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  }

  const zipBase64 = await zip.generateAsync({
    type: 'base64',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const defaultFileName = `${sanitize(options.zipName || 'anarchy_batch_export')}_${timestamp()}.zip`;

  try {
    const selected = await save({
      defaultPath: defaultFileName,
      filters: [{ name: 'ZIP Archive (*.zip)', extensions: ['zip'] }],
      title: 'Export Batch Images to ZIP',
    });

    if (!selected) return null;

    const dataUri = `data:application/zip;base64,${zipBase64}`;
    await invoke('save_image_to_path', { path: selected, dataUri });
    return selected;
  } catch (tauriErr) {
    console.warn('[exportImagesToZipWithDialog] Tauri native save failed, using browser fallback:', tauriErr);

    const byteCharacters = atob(zipBase64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let j = 0; j < byteCharacters.length; j++) {
      byteNumbers[j] = byteCharacters.charCodeAt(j);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/zip' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = defaultFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(link.href), 10000);
    return defaultFileName;
  }
}

/**
 * Export canvas nodes to structured ZIP archive with native save dialog
 */
export async function exportNodesToZipWithDialog(
  nodes: Node[],
  options: ZipExportOptions = {},
  selectedOnly: boolean = false
): Promise<string | null> {
  const targetNodes = selectedOnly ? nodes.filter(n => n.selected) : nodes;
  const effectiveNodes = targetNodes.length > 0 ? targetNodes : nodes;
  const items = extractImagesFromNodes(effectiveNodes);
  if (items.length === 0) {
    throw new Error(selectedOnly ? 'No images found in selected nodes' : 'No images found on canvas');
  }
  return exportImagesToZipWithDialog(items, {
    zipName: selectedOnly ? 'anarchy_selected_batch' : 'anarchy_canvas_batch',
    ...options,
  });
}
