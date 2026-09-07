/**
 * PSD Export Service
 * Exports layered Photoshop (.psd) files from Mask & Layer studio
 */

import { writePsd, type Psd, type Layer } from 'ag-psd';
import { save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { resolveImageUrl } from '../../features/builder/utils/builderHelpers';
import type { InpaintLayer, PhotoshopBlendMode } from '../../features/shell/components/LayersPanel';
import { logger } from '../../utils/logger';

// Helper to convert Uint8Array to base64
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Map PhotoshopBlendMode to ag-psd blendMode string
function mapBlendMode(mode?: PhotoshopBlendMode): any {
  if (!mode) return 'normal';
  switch (mode) {
    case 'color-dodge': return 'color dodge';
    case 'color-burn': return 'color burn';
    case 'hard-light': return 'hard light';
    case 'soft-light': return 'soft light';
    default: return mode;
  }
}

// Convert any image URL to an HTMLCanvasElement
async function imageToCanvas(src: string, targetWidth?: number, targetHeight?: number): Promise<HTMLCanvasElement> {
  const resolvedUrl = await resolveImageUrl(src);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const w = targetWidth || img.naturalWidth || img.width || 1024;
      const h = targetHeight || img.naturalHeight || img.height || 1024;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas);
    };
    img.onerror = (err) => reject(new Error(`Failed to load image for PSD: ${err}`));
    img.src = resolvedUrl;
  });
}

export interface PsdExportOptions {
  fileName?: string;
  baseImage: string | null | undefined;
  baseImageVisible?: boolean;
  baseImageOpacity?: number;
  layers: InpaintLayer[];
  activeMaskDataUrl?: string | null;
  canvasWidth?: number;
  canvasHeight?: number;
}

/**
 * Export canvas with all layers, blend modes, opacity, and masks into a Photoshop .psd file.
 * Returns the saved file path, or null if cancelled.
 */
export async function exportToPsdWithDialog(options: PsdExportOptions): Promise<string | null> {
  const {
    fileName = 'anarchy_layers',
    baseImage,
    baseImageVisible = true,
    baseImageOpacity = 100,
    layers = [],
    activeMaskDataUrl,
    canvasWidth,
    canvasHeight,
  } = options;

  // 1. Determine canvas dimensions
  let width = canvasWidth || 1024;
  let height = canvasHeight || 1024;

  let baseCanvas: HTMLCanvasElement | null = null;
  if (baseImage) {
    try {
      baseCanvas = await imageToCanvas(baseImage);
      width = baseCanvas.width;
      height = baseCanvas.height;
    } catch (err) {
      logger.warn('[PsdExport] Could not load base image:', err);
    }
  }

  // 2. Build PSD layer structure
  const children: Layer[] = [];

  // Base background layer
  if (baseCanvas) {
    children.push({
      name: 'Background Base',
      canvas: baseCanvas,
      opacity: (baseImageOpacity ?? 100) / 100,
      hidden: !baseImageVisible,
      blendMode: 'normal',
    });
  }

  // Convert each InpaintLayer to a PSD layer
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    try {
      let layerCanvas: HTMLCanvasElement;
      if (layer.image) {
        layerCanvas = await imageToCanvas(layer.image, width, height);
      } else {
        layerCanvas = document.createElement('canvas');
        layerCanvas.width = width;
        layerCanvas.height = height;
      }

      const psdLayer: Layer = {
        name: layer.name || `Layer ${i + 1}`,
        canvas: layerCanvas,
        opacity: (layer.opacity ?? 100) / 100,
        blendMode: mapBlendMode(layer.blendMode),
        hidden: !layer.visible,
      };

      // If the layer has an associated mask, attach it as a PSD layer mask
      if (layer.maskDataUrl) {
        try {
          const maskCanvas = await imageToCanvas(layer.maskDataUrl, width, height);
          psdLayer.mask = {
            canvas: maskCanvas,
            defaultColor: 0,
          };
        } catch (maskErr) {
          logger.warn(`[PsdExport] Could not attach mask for ${layer.name}:`, maskErr);
        }
      }

      children.push(psdLayer);
    } catch (layerErr) {
      logger.error(`[PsdExport] Failed to process layer ${layer.name}:`, layerErr);
    }
  }

  // Active mask layer if present
  if (activeMaskDataUrl) {
    try {
      const activeMaskCanvas = await imageToCanvas(activeMaskDataUrl, width, height);
      children.push({
        name: 'Active Inpaint Mask',
        canvas: activeMaskCanvas,
        opacity: 0.8,
        blendMode: 'screen',
      });
    } catch (err) {
      logger.warn('[PsdExport] Could not attach active mask layer:', err);
    }
  }

  // 3. Construct PSD object
  const psd: Psd = {
    width,
    height,
    children,
  };

  // 4. Generate PSD binary
  const psdBytes = new Uint8Array(writePsd(psd));
  const base64Data = uint8ArrayToBase64(psdBytes);

  // 5. Open native save dialog
  const safeName = fileName.replace(/[^\p{L}\p{N}_\-\s]/gu, '').trim() || 'anarchy_layers';
  const defaultPath = `${safeName}.psd`;
  const dataUri = `data:image/vnd.adobe.photoshop;base64,${base64Data}`;

  try {
    const selected = await save({
      defaultPath,
      filters: [{ name: 'Photoshop Document (*.psd)', extensions: ['psd'] }],
      title: 'Export Photoshop PSD',
    });

    if (!selected) return null; // Cancelled

    // save_image_to_path decodes base64 data URIs into binary and writes directly
    await invoke('save_image_to_path', {
      path: selected,
      dataUri,
    });

    return selected;
  } catch (tauriErr) {
    logger.warn('[PsdExport] Tauri native save failed or not in Tauri environment, falling back to browser download:', tauriErr);
    
    // Browser download fallback
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/vnd.adobe.photoshop' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = defaultPath;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(link.href), 10000);
    return defaultPath;
  }
}
