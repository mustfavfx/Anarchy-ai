/**
 * SmartSegmentationEngine.ts
 * High-performance edge-aware client-side auto-segmentation (SAM-style click-to-select).
 * Uses gradient-weighted color clustering and boundary contour extraction for 60fps hover previews and instant masks.
 */

export interface SegmentationResult {
  mask: Uint8Array; // 1 for selected, 0 for unselected
  width: number;
  height: number;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  pixelCount: number;
  contourPoints: { x: number; y: number }[];
}

export class SmartSegmentationEngine {
  private static cachedImageKey: string | null = null;
  private static cachedImageData: ImageData | null = null;
  private static cachedSobel: Uint8Array | null = null;

  /**
   * Precomputes Sobel gradient magnitude for the image data to lock onto true physical edges.
   */
  public static prepareImage(imageData: ImageData, imageKey: string) {
    if (this.cachedImageKey === imageKey && this.cachedImageData === imageData) {
      return;
    }

    const { width, height, data } = imageData;
    const gray = new Uint8Array(width * height);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      gray[p] = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
    }

    const sobel = new Uint8Array(width * height);
    for (let y = 1; y < height - 1; y++) {
      const rowAbove = (y - 1) * width;
      const rowCurrent = y * width;
      const rowBelow = (y + 1) * width;

      for (let x = 1; x < width - 1; x++) {
        const gx =
          -gray[rowAbove + x - 1] + gray[rowAbove + x + 1] -
          (gray[rowCurrent + x - 1] << 1) + (gray[rowCurrent + x + 1] << 1) -
          gray[rowBelow + x - 1] + gray[rowBelow + x + 1];

        const gy =
          -gray[rowAbove + x - 1] - (gray[rowAbove + x] << 1) - gray[rowAbove + x + 1] +
          gray[rowBelow + x - 1] + (gray[rowBelow + x] << 1) + gray[rowBelow + x + 1];

        const mag = Math.min(255, (Math.abs(gx) + Math.abs(gy)) >> 1);
        sobel[rowCurrent + x] = mag;
      }
    }

    this.cachedImageKey = imageKey;
    this.cachedImageData = imageData;
    this.cachedSobel = sobel;
  }

  /**
   * Executes edge-guided seeded region growing from point (startX, startY).
   */
  public static segment(
    imageData: ImageData,
    imageKey: string,
    startX: number,
    startY: number,
    tolerance = 32,
    edgeStopSensitivity = 45
  ): SegmentationResult | null {
    const { width, height, data } = imageData;
    const clampedX = Math.max(0, Math.min(width - 1, Math.floor(startX)));
    const clampedY = Math.max(0, Math.min(height - 1, Math.floor(startY)));

    this.prepareImage(imageData, imageKey);
    const sobel = this.cachedSobel;
    if (!sobel) return null;

    const startIdx = (clampedY * width + clampedX) * 4;
    const seedR = data[startIdx];
    const seedG = data[startIdx + 1];
    const seedB = data[startIdx + 2];

    const visited = new Uint8Array(width * height);
    const mask = new Uint8Array(width * height);
    const queue = new Int32Array(width * height * 2);
    let qHead = 0;
    let qTail = 0;

    queue[qTail++] = clampedX;
    queue[qTail++] = clampedY;
    visited[clampedY * width + clampedX] = 1;
    mask[clampedY * width + clampedX] = 1;

    let minX = clampedX;
    let maxX = clampedX;
    let minY = clampedY;
    let maxY = clampedY;
    let pixelCount = 1;

    // Tolerance thresholds
    const maxColorDelta = tolerance * 1.5;
    const maxLocalDelta = tolerance * 0.8;

    while (qHead < qTail) {
      const cx = queue[qHead++];
      const cy = queue[qHead++];
      const curPIdx = cy * width + cx;
      const curDataIdx = curPIdx * 4;
      const curR = data[curDataIdx];
      const curG = data[curDataIdx + 1];
      const curB = data[curDataIdx + 2];

      const neighbors = [
        cx + 1, cy,
        cx - 1, cy,
        cx, cy + 1,
        cx, cy - 1,
      ];

      for (let n = 0; n < 8; n += 2) {
        const nx = neighbors[n];
        const ny = neighbors[n + 1];

        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

        const npIdx = ny * width + nx;
        if (visited[npIdx]) continue;
        visited[npIdx] = 1;

        // 1. Edge barrier check
        if (sobel[npIdx] > edgeStopSensitivity) {
          continue;
        }

        // 2. Color similarity to seed & local neighbor
        const nDataIdx = npIdx * 4;
        const nr = data[nDataIdx];
        const ng = data[nDataIdx + 1];
        const nb = data[nDataIdx + 2];

        const dSeed = Math.abs(nr - seedR) + Math.abs(ng - seedG) + Math.abs(nb - seedB);
        const dLocal = Math.abs(nr - curR) + Math.abs(ng - curG) + Math.abs(nb - curB);

        if (dSeed <= maxColorDelta && dLocal <= maxLocalDelta) {
          mask[npIdx] = 1;
          pixelCount++;
          if (nx < minX) minX = nx;
          if (nx > maxX) maxX = nx;
          if (ny < minY) minY = ny;
          if (ny > maxY) maxY = ny;

          queue[qTail++] = nx;
          queue[qTail++] = ny;
        }
      }
    }

    if (pixelCount < 5) return null;

    // Extract sparse boundary contour for fast GPU/Canvas preview
    const contourPoints = this.extractContour(mask, width, height, minX, minY, maxX, maxY);

    return {
      mask,
      width,
      height,
      bounds: { minX, minY, maxX, maxY },
      pixelCount,
      contourPoints,
    };
  }

  /**
   * Extracts boundary contour points of the segmented mask for animated highlight stroke.
   */
  private static extractContour(
    mask: Uint8Array,
    width: number,
    height: number,
    minX: number,
    minY: number,
    maxX: number,
    maxY: number
  ): { x: number; y: number }[] {
    const points: { x: number; y: number }[] = [];
    const step = Math.max(1, Math.floor(Math.sqrt((maxX - minX) * (maxY - minY)) / 120));

    for (let y = minY; y <= maxY; y += step) {
      for (let x = minX; x <= maxX; x += step) {
        const idx = y * width + x;
        if (!mask[idx]) continue;

        // Is it a boundary pixel?
        const isBorder =
          x === 0 || x === width - 1 || y === 0 || y === height - 1 ||
          !mask[idx - 1] || !mask[idx + 1] || !mask[idx - width] || !mask[idx + width];

        if (isBorder) {
          points.push({ x, y });
        }
      }
    }
    return points;
  }

  /**
   * Writes the segmented mask onto the target Canvas with customizable blend mode ('add' | 'subtract' | 'replace').
   */
  public static applyMaskToCanvas(
    targetCanvas: HTMLCanvasElement,
    segmentedMask: Uint8Array,
    brushColorHex: string,
    opacity = 1.0,
    mode: 'add' | 'subtract' | 'replace' = 'add'
  ) {
    const ctx = targetCanvas.getContext('2d');
    if (!ctx) return;

    const width = targetCanvas.width;
    const height = targetCanvas.height;
    const imgData = ctx.getImageData(0, 0, width, height);
    const pixels = imgData.data;

    const fillR = parseInt(brushColorHex.slice(1, 3), 16) || 225;
    const fillG = parseInt(brushColorHex.slice(3, 5), 16) || 29;
    const fillB = parseInt(brushColorHex.slice(5, 7), 16) || 72;
    const fillA = Math.round(255 * opacity);

    for (let i = 0; i < segmentedMask.length; i++) {
      if (!segmentedMask[i]) continue;
      const pIdx = i * 4;

      if (mode === 'subtract') {
        pixels[pIdx + 3] = 0; // Erase
      } else {
        pixels[pIdx] = fillR;
        pixels[pIdx + 1] = fillG;
        pixels[pIdx + 2] = fillB;
        pixels[pIdx + 3] = mode === 'add' ? Math.max(pixels[pIdx + 3], fillA) : fillA;
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }
}
