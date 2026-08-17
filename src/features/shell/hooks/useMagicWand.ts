import { useCallback, useRef } from 'react';

interface PixelCache {
  key: string;
  data: ImageData;
}

/**
 * Flood-fill "magic wand" tool.
 *
 * The original implementation re-created an <img>, re-drew it to an
 * offscreen canvas, and re-ran getImageData() on every single click —
 * expensive and unnecessary since the source image doesn't change between
 * clicks. This caches the decoded pixel buffer, keyed by the image source
 * and the canvas size it was sampled at (the buffer is invalid if the
 * canvas has since been resized).
 */
export function useMagicWand(resolvedImage: string | null | undefined) {
  const cacheRef = useRef<PixelCache | null>(null);

  const getSourcePixels = useCallback(
    (width: number, height: number): Promise<ImageData | null> => {
      if (!resolvedImage || width <= 0 || height <= 0) return Promise.resolve(null);

      const key = `${resolvedImage}|${width}x${height}`;
      if (cacheRef.current && cacheRef.current.key === key) {
        return Promise.resolve(cacheRef.current.data);
      }

      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const offscreen = document.createElement('canvas');
          offscreen.width = width;
          offscreen.height = height;
          const offCtx = offscreen.getContext('2d');
          if (!offCtx) {
            resolve(null);
            return;
          }
          offCtx.drawImage(img, 0, 0, width, height);
          const data = offCtx.getImageData(0, 0, width, height);
          cacheRef.current = { key, data };
          resolve(data);
        };
        img.onerror = () => resolve(null);
        img.src = resolvedImage;
      });
    },
    [resolvedImage]
  );

  const floodFill = useCallback(
    async (
      canvas: HTMLCanvasElement,
      startXFloat: number,
      startYFloat: number,
      brushColorHex: string,
      opacity: number,
      tolerance = 40
    ): Promise<boolean> => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;

      const width = canvas.width;
      const height = canvas.height;
      const sourcePixels = await getSourcePixels(width, height);
      if (!sourcePixels) return false;
      const pixels = sourcePixels.data;

      const startX = Math.floor(startXFloat);
      const startY = Math.floor(startYFloat);
      if (startX < 0 || startX >= width || startY < 0 || startY >= height) return false;

      const startIdx = (startY * width + startX) * 4;
      const startR = pixels[startIdx];
      const startG = pixels[startIdx + 1];
      const startB = pixels[startIdx + 2];

      const visited = new Uint8Array(width * height);
      const queue = new Int32Array(width * height * 2);
      let qHead = 0;
      let qTail = 0;
      queue[qTail++] = startX;
      queue[qTail++] = startY;
      visited[startY * width + startX] = 1;

      const toleranceSq = tolerance * tolerance * 3;

      const maskData = ctx.getImageData(0, 0, width, height);
      const maskPixels = maskData.data;

      const fillR = parseInt(brushColorHex.slice(1, 3), 16);
      const fillG = parseInt(brushColorHex.slice(3, 5), 16);
      const fillB = parseInt(brushColorHex.slice(5, 7), 16);
      const fillA = Math.round(255 * opacity);

      while (qHead < qTail) {
        const cx = queue[qHead++];
        const cy = queue[qHead++];

        const maskIdx = (cy * width + cx) * 4;
        maskPixels[maskIdx] = fillR;
        maskPixels[maskIdx + 1] = fillG;
        maskPixels[maskIdx + 2] = fillB;
        maskPixels[maskIdx + 3] = fillA;

        const neighbors: Array<[number, number]> = [
          [cx + 1, cy],
          [cx - 1, cy],
          [cx, cy + 1],
          [cx, cy - 1],
        ];

        for (let i = 0; i < neighbors.length; i++) {
          const [nx, ny] = neighbors[i];
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nPos = ny * width + nx;
            if (!visited[nPos]) {
              visited[nPos] = 1;
              const nIdx = nPos * 4;
              const dr = pixels[nIdx] - startR;
              const dg = pixels[nIdx + 1] - startG;
              const db = pixels[nIdx + 2] - startB;
              const diffSq = dr * dr + dg * dg + db * db;
              if (diffSq <= toleranceSq) {
                queue[qTail++] = nx;
                queue[qTail++] = ny;
              }
            }
          }
        }
      }

      ctx.putImageData(maskData, 0, 0);
      return true;
    },
    [getSourcePixels]
  );

  return { floodFill };
}
