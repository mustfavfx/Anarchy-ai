/**
 * maskTools.ts
 * Two mask sources (manual brush, snap-to-element) that both converge on the
 * same binary mask output. Includes the spatial grid used to make
 * snap-to-element clicks O(1) regardless of how many contours were detected.
 */

import type { BrushStroke, DetectedElement, MaskSource } from './types';

// ---------- Element pre-computation (runs once per image, on load) ----------

export function douglasPeucker(
  points: { x: number; y: number }[],
  epsilon: number
): { x: number; y: number }[] {
  if (points.length < 3) return points;
  let maxDist = 0;
  let index = 0;
  const [start, end] = [points[0], points[points.length - 1]];
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], start, end);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }
  if (maxDist > epsilon) {
    const left = douglasPeucker(points.slice(0, index + 1), epsilon);
    const right = douglasPeucker(points.slice(index), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [start, end];
}

function perpendicularDistance(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  const num = Math.abs((b.y - a.y) * p.x - (b.x - a.x) * p.y + b.x * a.y - b.y * a.x);
  const den = Math.hypot(b.y - a.y, b.x - a.x) || 1;
  return num / den;
}

function polygonArea(points: { x: number; y: number }[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

function getBounds(points: { x: number; y: number }[]) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/**
 * `detectClosedContours` should wrap your existing CAD Vision Pro contour
 * pass (findContours-style), filtered here for closed shapes only.
 */
export function precomputeElements(
  image: ImageData,
  detectClosedContours: (
    img: ImageData
  ) => { points: { x: number; y: number }[]; isClosed: boolean; pointCount: number }[]
): DetectedElement[] {
  const raw = detectClosedContours(image).filter((c) => c.isClosed && c.pointCount >= 4);

  const elements: DetectedElement[] = raw.map((c) => ({
    id: crypto.randomUUID(),
    contour: c.points,
    simplifiedContour: douglasPeucker(c.points, 2.0),
    boundingBox: getBounds(c.points),
    area: polygonArea(c.points),
    depth: 0,
  }));

  // depth = how many other elements' bounding boxes contain this one (nesting)
  for (const el of elements) {
    el.depth = elements.filter(
      (other) =>
        other.id !== el.id &&
        other.boundingBox.x <= el.boundingBox.x &&
        other.boundingBox.y <= el.boundingBox.y &&
        other.boundingBox.x + other.boundingBox.w >= el.boundingBox.x + el.boundingBox.w &&
        other.boundingBox.y + other.boundingBox.h >= el.boundingBox.y + el.boundingBox.h
    ).length;
  }

  return elements;
}

// ---------- Spatial grid for O(1)-ish hit testing ----------

export class SpatialGrid {
  private cellSize = 64;
  private cells = new Map<string, DetectedElement[]>();

  constructor(elements: DetectedElement[]) {
    for (const el of elements) {
      for (const key of this.cellsForBounds(el.boundingBox)) {
        if (!this.cells.has(key)) this.cells.set(key, []);
        this.cells.get(key)!.push(el);
      }
    }
  }

  private cellsForBounds(b: { x: number; y: number; w: number; h: number }): string[] {
    const keys: string[] = [];
    const x0 = Math.floor(b.x / this.cellSize);
    const x1 = Math.floor((b.x + b.w) / this.cellSize);
    const y0 = Math.floor(b.y / this.cellSize);
    const y1 = Math.floor((b.y + b.h) / this.cellSize);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) keys.push(`${x},${y}`);
    return keys;
  }

  query(point: { x: number; y: number }): DetectedElement[] {
    const key = `${Math.floor(point.x / this.cellSize)},${Math.floor(point.y / this.cellSize)}`;
    return this.cells.get(key) ?? [];
  }
}

function pointInPolygon(point: { x: number; y: number }, polygon: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** On overlapping elements (window inside wall inside facade), pick the smallest area — the most specific hit. */
export function pickElementAt(point: { x: number; y: number }, grid: SpatialGrid): DetectedElement | null {
  const candidates = grid.query(point).filter((el) => pointInPolygon(point, el.contour));
  if (candidates.length === 0) return null;
  return candidates.reduce((smallest, el) => (el.area < smallest.area ? el : smallest));
}

// ---------- Mask rasterization (both sources converge here) ----------

export function toBinaryMask(source: MaskSource, width: number, height: number): ImageData {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#ffffff';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (source.kind === 'brush') {
    for (const stroke of source.strokes as BrushStroke[]) {
      if (stroke.points.length === 0) continue;
      ctx.lineWidth = stroke.brushSize;
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      ctx.stroke();
    }
  } else {
    const contour = source.element.contour;
    ctx.beginPath();
    contour.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.fill();
  }

  ctx.filter = 'blur(2px)';
  ctx.drawImage(canvas, 0, 0);
  return ctx.getImageData(0, 0, width, height);
}
