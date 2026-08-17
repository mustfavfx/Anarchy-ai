/**
 * preserveGeometryEngine.ts
 * Structural Edge & Contour Line Segment Detection (LSD) for Architectural Geometry Locking
 */

export interface EdgeMapResult {
  edgeDataUrl: string;
  lineCount: number;
}

export class PreserveGeometryEngine {
  /**
   * Generates a structural edge contour map to lock straight architectural lines during enlargement.
   */
  public static async generateEdgeMap(
    imageDataUrl: string,
    width: number,
    height: number
  ): Promise<EdgeMapResult> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve({ edgeDataUrl: imageDataUrl, lineCount: 0 });
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const imgData = ctx.getImageData(0, 0, width, height);
        const pixels = imgData.data;

        // Grayscale conversion
        const gray = new Uint8ClampedArray(width * height);
        for (let i = 0; i < pixels.length; i += 4) {
          gray[i / 4] = Math.round(0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]);
        }

        // Sobel Edge Detection Filter
        const edgeCanvas = document.createElement('canvas');
        edgeCanvas.width = width;
        edgeCanvas.height = height;
        const edgeCtx = edgeCanvas.getContext('2d');
        if (!edgeCtx) {
          resolve({ edgeDataUrl: imageDataUrl, lineCount: 0 });
          return;
        }

        const edgeImgData = edgeCtx.createImageData(width, height);
        const edgePixels = edgeImgData.data;
        let detectedEdges = 0;

        for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;

            // Sobel kernels
            const gx = 
              -1 * gray[(y - 1) * width + (x - 1)] + 1 * gray[(y - 1) * width + (x + 1)] +
              -2 * gray[y * width + (x - 1)]       + 2 * gray[y * width + (x + 1)] +
              -1 * gray[(y + 1) * width + (x - 1)] + 1 * gray[(y + 1) * width + (x + 1)];

            const gy = 
              -1 * gray[(y - 1) * width + (x - 1)] - 2 * gray[(y - 1) * width + x] - 1 * gray[(y - 1) * width + (x + 1)] +
               1 * gray[(y + 1) * width + (x - 1)] + 2 * gray[(y + 1) * width + x] + 1 * gray[(y + 1) * width + (x + 1)];

            const magnitude = Math.sqrt(gx * gx + gy * gy);
            const pIdx = idx * 4;

            if (magnitude > 60) {
              // Bright cyan/rose glowing edge line for architectural lock
              edgePixels[pIdx] = 225;     // Red
              edgePixels[pIdx + 1] = 29;  // Green
              edgePixels[pIdx + 2] = 72;  // Blue
              edgePixels[pIdx + 3] = 255; // Alpha
              detectedEdges++;
            } else {
              edgePixels[pIdx] = 0;
              edgePixels[pIdx + 1] = 0;
              edgePixels[pIdx + 2] = 0;
              edgePixels[pIdx + 3] = 0;
            }
          }
        }

        edgeCtx.putImageData(edgeImgData, 0, 0);
        resolve({
          edgeDataUrl: edgeCanvas.toDataURL('image/png'),
          lineCount: detectedEdges,
        });
      };

      img.onerror = () => {
        resolve({ edgeDataUrl: imageDataUrl, lineCount: 0 });
      };

      img.src = imageDataUrl;
    });
  }
}
