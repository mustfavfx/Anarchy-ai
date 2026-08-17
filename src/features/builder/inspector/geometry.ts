/**
 * geometry.ts
 * Screen space -> canvas space -> natural image space conversion, plus the
 * "Preserve Geometry" structural lock used by Enhance Region.
 */

import type {
  CanvasTransform,
  ImageSpaceRegion,
  NaturalDimensions,
  StructuralLine,
} from './types';

/** Converts a canvas-space bounding box (post pan/zoom) to natural image pixels. */
export function toImageSpace(
  box: { x: number; y: number; width: number; height: number },
  node: NaturalDimensions,
  transform: CanvasTransform
): ImageSpaceRegion {
  const factor = node.naturalWidth / (node.displayWidth * transform.zoom);
  const region: ImageSpaceRegion = {
    x: Math.round((box.x - node.canvasX) * factor),
    y: Math.round((box.y - node.canvasY) * factor),
    width: Math.round(box.width * factor),
    height: Math.round(box.height * factor),
  };
  return clampToBounds(region, node.naturalWidth, node.naturalHeight);
}

function clampToBounds(region: ImageSpaceRegion, maxW: number, maxH: number): ImageSpaceRegion {
  const x = Math.max(0, Math.min(region.x, maxW));
  const y = Math.max(0, Math.min(region.y, maxH));
  const width = Math.max(0, Math.min(region.width, maxW - x));
  const height = Math.max(0, Math.min(region.height, maxH - y));
  return { x, y, width, height };
}

/**
 * Detects structural (orthogonal) lines within a region. Wire this to your
 * existing CAD Vision Pro LSD/HAWP pass — this signature matches what that
 * pipeline already returns, filtered down to the lines that matter for a
 * geometry lock (high-confidence orthogonal lines only).
 */
export function detectStructuralLines(
  runLSD: (region: ImageData) => { points: [number, number][]; orthogonalityScore: number }[],
  crop: ImageData
): StructuralLine[] {
  return runLSD(crop)
    .filter((line) => line.orthogonalityScore > 0.6)
    .map((line) => ({ points: line.points, confidence: line.orthogonalityScore }));
}

/**
 * Builds a feathered, weighted geometry-lock mask (0 = free, 255 = locked).
 * Line width scales with per-line confidence so weak detections lock softly.
 */
export function buildGeometryMask(
  lines: StructuralLine[],
  width: number,
  height: number,
  lockRadiusPx = 6
): Promise<ImageData> {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#ffffff';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const line of lines) {
    ctx.lineWidth = lockRadiusPx * 2 * line.confidence;
    ctx.beginPath();
    line.points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.stroke();
  }

  ctx.filter = 'blur(4px)';
  ctx.drawImage(canvas, 0, 0);

  return createImageBitmap(canvas).then((bmp) => {
    const readCtx = new OffscreenCanvas(width, height).getContext('2d')!;
    readCtx.drawImage(bmp, 0, 0);
    return readCtx.getImageData(0, 0, width, height);
  });
}

/**
 * Post-generation fallback blend for engines that don't accept a control
 * image. Weighted per-pixel by the geometry mask so locked structural lines
 * stay close to the original with no hard seam.
 */
export function blendWithGeometryLock(
  original: ImageData,
  generated: ImageData,
  geometryMask: ImageData
): ImageData {
  const result = new ImageData(generated.width, generated.height);
  for (let i = 0; i < result.data.length; i += 4) {
    const lockWeight = geometryMask.data[i] / 255;
    for (let c = 0; c < 3; c++) {
      result.data[i + c] =
        original.data[i + c] * lockWeight + generated.data[i + c] * (1 - lockWeight);
    }
    result.data[i + 3] = 255;
  }
  return result;
}
