/**
 * Luminance-preserving Color Injection Pipeline
 * Blends a target HEX/RAL color onto image pixels in a masked region while
 * strictly conserving original luminance (shadows, highlights, and ambient occlusion).
 */

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(c => c + c).join('');
  }
  const num = parseInt(cleanHex, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

/**
 * Recovers base luminance from source canvas data and injects target color.
 */
export function blendRalColorWithLuminance(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  targetHex: string,
  opacity: number = 0.85
): void {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const targetRgb = hexToRgb(targetHex);
  const targetHsl = rgbToHsl(targetRgb.r, targetRgb.g, targetRgb.b);

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 0) continue; // Skip unmasked pixels

    const srcR = data[i];
    const srcG = data[i + 1];
    const srcB = data[i + 2];

    // Compute relative perceived luminance Luma = 0.299R + 0.587G + 0.114B
    const srcLuma = (0.299 * srcR + 0.587 * srcG + 0.114 * srcB) / 255;

    // Apply target Hue & Saturation with base pixel Luma
    const blendedRgb = hslToRgb(targetHsl.h, targetHsl.s, srcLuma);

    // Blend between original and tinted luminance
    data[i]     = Math.round(srcR * (1 - opacity) + blendedRgb.r * opacity);
    data[i + 1] = Math.round(srcG * (1 - opacity) + blendedRgb.b * opacity);
    data[i + 2] = Math.round(srcB * (1 - opacity) + blendedRgb.b * opacity);
  }

  ctx.putImageData(imgData, 0, 0);
}
