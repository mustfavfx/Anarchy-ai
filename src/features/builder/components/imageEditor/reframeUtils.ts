import { loadImageElement } from '../../../../services/export/modules/imageExportUtils';

export interface ReframedImageResult {
  dataUrl: string;
  width: number;
  height: number;
  wRatio: number;
  hRatio: number;
  ratioStr: string;
  isExpanded: boolean;
}

/**
 * Creates a canvas with the target aspect ratio, placing the original image intact
 * in the center without cropping or distorting it.
 * The extended borders are softly filled with ambient blur of the image edges
 * so AI engines (like Nano Banana) have seamless color context to outpaint into.
 */
export async function createPaddedReframedImage(
  imageUrl: string,
  targetRatioStr: string // e.g. "3:4" or "16:9"
): Promise<ReframedImageResult> {
  const img = await loadImageElement(imageUrl);
  const origW = img.naturalWidth || img.width || 1024;
  const origH = img.naturalHeight || img.height || 1024;

  let [wStr, hStr] = targetRatioStr.split(':');
  let wRatio = Number(wStr);
  let hRatio = Number(hStr);

  if (!wRatio || !hRatio || isNaN(wRatio) || isNaN(hRatio)) {
    wRatio = 1;
    hRatio = 1;
  }

  const targetRatio = wRatio / hRatio;
  const currentRatio = origW / origH;

  // If already matches aspect ratio within 1% tolerance
  if (Math.abs(targetRatio - currentRatio) < 0.015) {
    const canvas = document.createElement('canvas');
    canvas.width = origW;
    canvas.height = origH;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.drawImage(img, 0, 0);
    return {
      dataUrl: canvas.toDataURL('image/png'),
      width: origW,
      height: origH,
      wRatio,
      hRatio,
      ratioStr: targetRatioStr,
      isExpanded: false,
    };
  }

  let newW = origW;
  let newH = origH;

  if (targetRatio > currentRatio) {
    // Target is wider than current: expand width
    newH = origH;
    newW = Math.round(origH * targetRatio);
  } else {
    // Target is taller than current: expand height
    newW = origW;
    newH = Math.round(origW / targetRatio);
  }

  // Ensure dimensions are even numbers (standard for AI engines)
  if (newW % 2 !== 0) newW += 1;
  if (newH % 2 !== 0) newH += 1;

  const canvas = document.createElement('canvas');
  canvas.width = newW;
  canvas.height = newH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return {
      dataUrl: imageUrl,
      width: origW,
      height: origH,
      wRatio,
      hRatio,
      ratioStr: targetRatioStr,
      isExpanded: false,
    };
  }

  const posX = Math.round((newW - origW) / 2);
  const posY = Math.round((newH - origH) / 2);

  // 1. Softly draw a blurred/scaled background of the image to provide ambient environmental cues
  ctx.save();
  ctx.filter = 'blur(24px)';
  const bgScale = Math.max(newW / origW, newH / origH);
  const bgW = origW * bgScale;
  const bgH = origH * bgScale;
  const bgX = (newW - bgW) / 2;
  const bgY = (newH - bgH) / 2;
  ctx.drawImage(img, bgX, bgY, bgW, bgH);
  ctx.restore();

  // 2. Draw the original crisp image at exact 1:1 scale in the center, untouched
  ctx.drawImage(img, posX, posY, origW, origH);

  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: newW,
    height: newH,
    wRatio,
    hRatio,
    ratioStr: targetRatioStr,
    isExpanded: true,
  };
}
