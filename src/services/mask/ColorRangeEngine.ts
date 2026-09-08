/**
 * ColorRangeEngine.ts
 * Smart Color Range & Luminance Mask extraction.
 * Enables isolating Highlights, Midtones, Shadows, or sampled colors via Eyedropper
 * with tolerance, feathering (separable box blur), and inversion.
 */

export type LumaRangeType = 'highlights' | 'midtones' | 'shadows';

export interface ColorRangeOptions {
  targetR?: number;
  targetG?: number;
  targetB?: number;
  tolerance?: number; // 0 to 100
  feather?: number; // feather radius in pixels (0 to 50)
  invert?: boolean;
}

export interface LumaRangeOptions {
  type: LumaRangeType;
  lowThreshold?: number;  // 0 - 255
  highThreshold?: number; // 0 - 255
  feather?: number;
  invert?: boolean;
}

export class ColorRangeEngine {
  /**
   * Computes standard ITU-R BT.601 perceptual luminance: Y = 0.299R + 0.587G + 0.114B
   */
  public static calculateLuminance(r: number, g: number, b: number): number {
    return (r * 77 + g * 150 + b * 29) >> 8;
  }

  /**
   * Generates a 0..255 alpha mask based on luminance brackets (Highlights, Midtones, Shadows).
   */
  public static generateLumaMask(
    imageData: ImageData,
    options: LumaRangeOptions
  ): Uint8Array {
    const { width, height, data } = imageData;
    const mask = new Uint8Array(width * height);
    const { type, invert = false, feather = 0 } = options;

    let low = options.lowThreshold;
    let high = options.highThreshold;

    if (low === undefined || high === undefined) {
      if (type === 'highlights') {
        low = 192;
        high = 255;
      } else if (type === 'midtones') {
        low = 64;
        high = 192;
      } else {
        // shadows
        low = 0;
        high = 64;
      }
    }

    const rampWidth = 16; // smooth ramp at threshold boundaries

    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      const luma = this.calculateLuminance(data[i], data[i + 1], data[i + 2]);
      let alpha = 0;

      if (type === 'highlights') {
        if (luma >= low) {
          alpha = 255;
        } else if (luma >= low - rampWidth) {
          alpha = Math.round(((luma - (low - rampWidth)) / rampWidth) * 255);
        }
      } else if (type === 'shadows') {
        if (luma <= high) {
          alpha = 255;
        } else if (luma <= high + rampWidth) {
          alpha = Math.round(((high + rampWidth - luma) / rampWidth) * 255);
        }
      } else {
        // midtones
        if (luma >= low && luma <= high) {
          alpha = 255;
        } else if (luma >= low - rampWidth && luma < low) {
          alpha = Math.round(((luma - (low - rampWidth)) / rampWidth) * 255);
        } else if (luma > high && luma <= high + rampWidth) {
          alpha = Math.round(((high + rampWidth - luma) / rampWidth) * 255);
        }
      }

      mask[p] = invert ? 255 - alpha : alpha;
    }

    if (feather > 0) {
      return this.applyFeather(mask, width, height, feather);
    }

    return mask;
  }

  /**
   * Generates a 0..255 alpha mask based on sampled RGB color and tolerance.
   */
  public static generateColorRangeMask(
    imageData: ImageData,
    options: ColorRangeOptions
  ): Uint8Array {
    const { width, height, data } = imageData;
    const mask = new Uint8Array(width * height);
    const {
      targetR = 255,
      targetG = 255,
      targetB = 255,
      tolerance = 30, // 0 to 100
      feather = 0,
      invert = false,
    } = options;

    // Convert tolerance (0-100) to max Euclidean distance (0 to ~441)
    const maxDist = (tolerance / 100) * 441.67;
    const ramp = Math.max(1, maxDist * 0.25); // Falloff ramp

    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const dr = r - targetR;
      const dg = g - targetG;
      const db = b - targetB;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);

      let alpha = 0;
      if (dist <= maxDist) {
        alpha = 255;
      } else if (dist <= maxDist + ramp) {
        alpha = Math.round((1 - (dist - maxDist) / ramp) * 255);
      }

      mask[p] = invert ? 255 - alpha : alpha;
    }

    if (feather > 0) {
      return this.applyFeather(mask, width, height, feather);
    }

    return mask;
  }

  /**
   * Fast 2-pass separable box blur for feathering edges.
   */
  public static applyFeather(
    mask: Uint8Array,
    width: number,
    height: number,
    radius: number
  ): Uint8Array {
    const r = Math.min(Math.max(1, Math.round(radius)), 50);
    const temp = new Float32Array(width * height);
    const output = new Uint8Array(width * height);
    const windowSize = 2 * r + 1;

    // Horizontal Pass
    for (let y = 0; y < height; y++) {
      const rowOffset = y * width;
      let sum = 0;

      for (let x = -r; x <= r; x++) {
        const clampedX = Math.min(Math.max(x, 0), width - 1);
        sum += mask[rowOffset + clampedX];
      }

      for (let x = 0; x < width; x++) {
        temp[rowOffset + x] = sum / windowSize;
        const removeX = Math.max(x - r, 0);
        const addX = Math.min(x + r + 1, width - 1);
        sum += mask[rowOffset + addX] - mask[rowOffset + removeX];
      }
    }

    // Vertical Pass
    for (let x = 0; x < width; x++) {
      let sum = 0;

      for (let y = -r; y <= r; y++) {
        const clampedY = Math.min(Math.max(y, 0), height - 1);
        sum += temp[clampedY * width + x];
      }

      for (let y = 0; y < height; y++) {
        output[y * width + x] = Math.min(255, Math.max(0, Math.round(sum / windowSize)));
        const removeY = Math.max(y - r, 0);
        const addY = Math.min(y + r + 1, height - 1);
        sum += temp[addY * width + x] - temp[removeY * width + x];
      }
    }

    return output;
  }

  /**
   * Applies the generated alpha mask directly to the canvas in the specified mode.
   */
  public static applyMaskToCanvas(
    targetCanvas: HTMLCanvasElement,
    alphaMask: Uint8Array,
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

    for (let i = 0; i < alphaMask.length; i++) {
      const maskVal = alphaMask[i];
      if (maskVal === 0 && mode !== 'replace') continue;

      const pIdx = i * 4;
      const effectiveAlpha = Math.round((maskVal / 255) * 255 * opacity);

      if (mode === 'subtract') {
        const currentAlpha = pixels[pIdx + 3];
        pixels[pIdx + 3] = Math.max(0, currentAlpha - effectiveAlpha);
      } else if (mode === 'replace') {
        pixels[pIdx] = fillR;
        pixels[pIdx + 1] = fillG;
        pixels[pIdx + 2] = fillB;
        pixels[pIdx + 3] = effectiveAlpha;
      } else {
        // 'add'
        pixels[pIdx] = fillR;
        pixels[pIdx + 1] = fillG;
        pixels[pIdx + 2] = fillB;
        pixels[pIdx + 3] = Math.max(pixels[pIdx + 3], effectiveAlpha);
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }
}
