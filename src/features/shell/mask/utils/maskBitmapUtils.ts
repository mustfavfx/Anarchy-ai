import { logger } from '../../../../utils/logger';
import type { InpaintLayer } from '../../components/LayersPanel';
import type { ArrowNodeItem } from '../../components/VizMakerArrowCard';
import type { LayerVisibility } from '../types';

export function hexToRgba(hex: string, alpha: number): string {
  const cleanHex = hex.startsWith('#') ? hex.slice(1) : hex;
  const r = parseInt(cleanHex.slice(0, 2), 16) || 0;
  const g = parseInt(cleanHex.slice(2, 4), 16) || 0;
  const b = parseInt(cleanHex.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function generateMaskPreview(canvas: HTMLCanvasElement): { hasWhite: boolean; previewUrl: string | null } {
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = 120;
  maskCanvas.height = Math.round((canvas.height / (canvas.width || 1)) * 120) || 120;
  const mCtx = maskCanvas.getContext('2d');
  if (!mCtx) return { hasWhite: false, previewUrl: null };

  mCtx.fillStyle = '#000000';
  mCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
  mCtx.drawImage(canvas, 0, 0, maskCanvas.width, maskCanvas.height);

  const imgData = mCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
  const data = imgData.data;
  let hasWhite = false;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 5) {
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = 255;
      hasWhite = true;
    } else {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 255;
    }
  }
  mCtx.putImageData(imgData, 0, 0);

  return {
    hasWhite,
    previewUrl: hasWhite ? maskCanvas.toDataURL('image/png') : null,
  };
}

export function invertMask(canvas: HTMLCanvasElement, brushColor: string, maskOpacity: number): boolean {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return false;
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  let anyFilled = false;
  const r = parseInt(brushColor.slice(1, 3), 16) || 225;
  const g = parseInt(brushColor.slice(3, 5), 16) || 29;
  const b = parseInt(brushColor.slice(5, 7), 16) || 72;
  const alphaVal = Math.round(maskOpacity * 255);

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 8) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 0;
    } else {
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = alphaVal;
      anyFilled = true;
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return anyFilled;
}

export function featherMask(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  const temp = document.createElement('canvas');
  temp.width = canvas.width;
  temp.height = canvas.height;
  const tCtx = temp.getContext('2d');
  if (!tCtx) return;
  tCtx.drawImage(canvas, 0, 0);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.filter = 'blur(6px)';
  ctx.drawImage(temp, 0, 0);
  ctx.filter = 'none';
}

export function expandMask(canvas: HTMLCanvasElement, px = 4): void {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  const temp = document.createElement('canvas');
  temp.width = canvas.width;
  temp.height = canvas.height;
  const tCtx = temp.getContext('2d');
  if (!tCtx) return;
  tCtx.drawImage(canvas, 0, 0);

  ctx.save();
  for (let dx = -px; dx <= px; dx += 2) {
    for (let dy = -px; dy <= px; dy += 2) {
      if (dx * dx + dy * dy <= px * px) {
        ctx.drawImage(temp, dx, dy);
      }
    }
  }
  ctx.restore();
}

export function contractMask(canvas: HTMLCanvasElement, px = 4): void {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  const inv = document.createElement('canvas');
  inv.width = canvas.width;
  inv.height = canvas.height;
  const iCtx = inv.getContext('2d');
  if (!iCtx) return;
  iCtx.fillStyle = '#ffffff';
  iCtx.fillRect(0, 0, inv.width, inv.height);
  iCtx.globalCompositeOperation = 'destination-out';
  iCtx.drawImage(canvas, 0, 0);

  const expInv = document.createElement('canvas');
  expInv.width = canvas.width;
  expInv.height = canvas.height;
  const eCtx = expInv.getContext('2d');
  if (!eCtx) return;
  for (let dx = -px; dx <= px; dx += 2) {
    for (let dy = -px; dy <= px; dy += 2) {
      if (dx * dx + dy * dy <= px * px) {
        eCtx.drawImage(inv, dx, dy);
      }
    }
  }

  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.drawImage(expInv, 0, 0);
  ctx.restore();
}

export function fillMask(canvas: HTMLCanvasElement, fillColor: string): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = fillColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

export interface RenderCompositeParams {
  canvas: HTMLCanvasElement;
  baseImgSrc: string;
  imgMeta: { w: number; h: number } | null;
  layerVisibility: LayerVisibility;
  inpaintLayers: InpaintLayer[];
  drawingCanvas: HTMLCanvasElement | null;
  workspaceMode: string;
  arrowNodes: ArrowNodeItem[];
  wrapperEl: HTMLElement | null;
}

export async function renderCompositeAndMask(params: RenderCompositeParams): Promise<{ composite: string; mask: string } | null> {
  const {
    canvas,
    baseImgSrc,
    imgMeta,
    layerVisibility,
    inpaintLayers,
    drawingCanvas,
    workspaceMode,
    arrowNodes,
    wrapperEl,
  } = params;

  if (!canvas || !baseImgSrc) {
    logger.warn('[MaskCanvas] renderCompositeAndMask: missing canvas or baseImgSrc');
    return null;
  }

  const targetW = imgMeta?.w ?? canvas.width;
  const targetH = imgMeta?.h ?? canvas.height;

  const renderWithImage = (img: HTMLImageElement | HTMLCanvasElement): { composite: string; mask: string } | null => {
    const compositeCanvas = document.createElement('canvas');
    compositeCanvas.width = targetW;
    compositeCanvas.height = targetH;
    const compositeCtx = compositeCanvas.getContext('2d');
    if (!compositeCtx) return null;

    compositeCtx.imageSmoothingEnabled = true;
    compositeCtx.imageSmoothingQuality = 'high';

    if (layerVisibility.image !== false) {
      compositeCtx.drawImage(img, 0, 0, targetW, targetH);
    }

    if (inpaintLayers.length > 0) {
      for (const layer of inpaintLayers.slice().reverse()) {
        if (!layer.visible || !layer.image) continue;
        const layerDomImg = wrapperEl?.querySelector(`img[data-layer-id="${layer.id}"]`) as HTMLImageElement | null;
        if (layerDomImg && layerDomImg.complete && layerDomImg.naturalWidth > 0) {
          compositeCtx.save();
          compositeCtx.globalAlpha = (layer.opacity ?? 100) / 100;
          compositeCtx.globalCompositeOperation = (layer.blendMode && layer.blendMode !== 'normal')
            ? (layer.blendMode as GlobalCompositeOperation)
            : 'source-over';
          compositeCtx.drawImage(layerDomImg, 0, 0, targetW, targetH);
          compositeCtx.restore();
        }
      }
    }

    if (drawingCanvas && workspaceMode === 'draw') {
      compositeCtx.drawImage(drawingCanvas, 0, 0, targetW, targetH);
    }

    const compositeDataUrl = compositeCanvas.toDataURL('image/png');

    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = targetW;
    maskCanvas.height = targetH;
    const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
    if (!maskCtx) return null;

    maskCtx.clearRect(0, 0, targetW, targetH);

    if (layerVisibility.selection !== false) {
      maskCtx.drawImage(canvas, 0, 0, targetW, targetH);
    }

    if (layerVisibility.arrows !== false && arrowNodes.length > 0) {
      maskCtx.fillStyle = '#ffffff';
      arrowNodes.forEach((a) => {
        const px = (a.targetPos.x / 100) * targetW;
        const py = (a.targetPos.y / 100) * targetH;
        const userRadius = a.radius || 80;
        const scaleFactor = Math.min(targetW, targetH) / 800;
        const finalRadius = Math.max(25, userRadius * scaleFactor);
        maskCtx.beginPath();
        maskCtx.arc(px, py, finalRadius, 0, Math.PI * 2);
        maskCtx.fill();
      });
    }

    const dilateCanvas = document.createElement('canvas');
    dilateCanvas.width = targetW;
    dilateCanvas.height = targetH;
    const dCtx = dilateCanvas.getContext('2d', { willReadFrequently: true });
    if (dCtx) {
      dCtx.drawImage(maskCanvas, 0, 0);
      const d = 4;
      dCtx.drawImage(maskCanvas, -d, 0);
      dCtx.drawImage(maskCanvas, d, 0);
      dCtx.drawImage(maskCanvas, 0, -d);
      dCtx.drawImage(maskCanvas, 0, d);
      dCtx.drawImage(maskCanvas, -d, -d);
      dCtx.drawImage(maskCanvas, d, d);
      dCtx.drawImage(maskCanvas, -d, d);
      dCtx.drawImage(maskCanvas, d, -d);
    }

    const activeMaskCanvas = dCtx ? dilateCanvas : maskCanvas;
    const actCtx = activeMaskCanvas.getContext('2d', { willReadFrequently: true });
    if (!actCtx) return null;

    const imgData = actCtx.getImageData(0, 0, targetW, targetH);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      const val = alpha > 8 ? 255 : 0;
      data[i] = val;
      data[i + 1] = val;
      data[i + 2] = val;
      data[i + 3] = 255;
    }
    actCtx.putImageData(imgData, 0, 0);

    const featheredCanvas = document.createElement('canvas');
    featheredCanvas.width = targetW;
    featheredCanvas.height = targetH;
    const fCtx = featheredCanvas.getContext('2d');
    if (fCtx) {
      fCtx.filter = 'blur(2px)';
      fCtx.drawImage(activeMaskCanvas, 0, 0);
      fCtx.filter = 'none';
    }

    const maskDataUrl = (fCtx ? featheredCanvas : activeMaskCanvas).toDataURL('image/png');
    return { composite: compositeDataUrl, mask: maskDataUrl };
  };

  const domImg = wrapperEl?.querySelector<HTMLImageElement>('.mask-canvas-base-image');
  if (domImg && domImg.complete && domImg.naturalWidth > 0) {
    try {
      const res = renderWithImage(domImg);
      if (res) return res;
    } catch (err) {
      logger.warn('[MaskCanvas] DOM image canvas export failed, falling back to new Image():', err);
    }
  }

  return new Promise((resolve) => {
    const img = new Image();
    if (baseImgSrc.startsWith('http://') || baseImgSrc.startsWith('https://')) {
      if (!baseImgSrc.startsWith('http://localhost')) {
        img.crossOrigin = 'anonymous';
      }
    }
    img.onload = () => {
      resolve(renderWithImage(img));
    };
    img.onerror = (e) => {
      logger.error('[MaskCanvas] Failed to load image for composite export:', e);
      resolve(null);
    };
    img.src = baseImgSrc;
  });
}
