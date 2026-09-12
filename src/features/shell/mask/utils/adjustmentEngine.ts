export interface AdjustmentParams {
  key: string;
  name: string;
  brightness?: number; // -100 to 100
  contrast?: number; // -100 to 100
  vibrance?: number; // -100 to 100
  saturation?: number; // -100 to 100
  hue?: number; // -180 to 180
  lightness?: number; // -100 to 100
  exposure?: number; // -2 to 2
  offset?: number; // -0.5 to 0.5
  gamma?: number; // 0.2 to 3
  blackPoint?: number; // 0 to 255
  whitePoint?: number; // 0 to 255
  midtones?: number; // 0.2 to 3
  curveAmount?: number; // 0 to 100
  curvePreset?: string;
  redBalance?: number; // -100 to 100
  greenBalance?: number; // -100 to 100
  blueBalance?: number; // -100 to 100
  filterPreset?: string;
  filterDensity?: number; // 1 to 100
  channelRed?: number; // -100 to 200
  channelGreen?: number; // -100 to 200
  channelBlue?: number; // -100 to 200
  channelMono?: boolean;
  lutPreset?: string;
  lutIntensity?: number; // 10 to 100
  posterizeLevels?: number; // 2 to 16
  thresholdLevel?: number; // 1 to 255
  gradientPreset?: string;
  gradientReverse?: boolean;
  selectiveCyan?: number;
  selectiveMagenta?: number;
  selectiveYellow?: number;
  selectiveBlack?: number;
  bwRed?: number;
  bwGreen?: number;
  bwBlue?: number;
}

/**
 * Applies high-performance 2D Canvas pixel adjustments across all 16 tools
 */
export function applyAdjustmentParamsToImageData(
  imgData: ImageData,
  params: AdjustmentParams,
  isMask = false
): void {
  const d = imgData.data;
  const len = d.length;
  const key = params.key;

  // Mask adjustments
  if (isMask) {
    if (key === 'invert') {
      for (let i = 0; i < len; i += 4) {
        d[i + 3] = d[i + 3] > 10 ? 0 : 220;
      }
      return;
    }
    if (key === 'threshold') {
      const th = params.thresholdLevel ?? 128;
      for (let i = 0; i < len; i += 4) {
        d[i + 3] = d[i + 3] >= th ? 240 : 0;
      }
      return;
    }
    if (key === 'levels') {
      const bp = params.blackPoint ?? 0;
      const wp = Math.max(bp + 1, params.whitePoint ?? 255);
      const range = wp - bp;
      for (let i = 0; i < len; i += 4) {
        const a = d[i + 3];
        d[i + 3] = Math.min(255, Math.max(0, ((a - bp) / range) * 255));
      }
      return;
    }
    if (key === 'posterize') {
      const step = Math.max(2, params.posterizeLevels ?? 4);
      const factor = 255 / (step - 1);
      for (let i = 0; i < len; i += 4) {
        d[i + 3] = Math.round(Math.round(d[i + 3] / factor) * factor);
      }
      return;
    }
    if (key === 'black-white') {
      for (let i = 0; i < len; i += 4) {
        if (d[i + 3] > 15) d[i + 3] = 255;
      }
      return;
    }
  }

  // Standard RGB adjustments
  if (key === 'brightness' || key === 'brightness-contrast') {
    const b = (params.brightness ?? 0) * 1.5;
    const c = params.contrast ?? 0;
    const factor = (259 * (c + 255)) / (255 * (259 - c));
    for (let i = 0; i < len; i += 4) {
      if (d[i + 3] === 0) continue;
      d[i] = Math.min(255, Math.max(0, factor * (d[i] - 128) + 128 + b));
      d[i + 1] = Math.min(255, Math.max(0, factor * (d[i + 1] - 128) + 128 + b));
      d[i + 2] = Math.min(255, Math.max(0, factor * (d[i + 2] - 128) + 128 + b));
    }
    return;
  }

  if (key === 'vibrance') {
    const vib = (params.vibrance ?? 0) / 100;
    const sat = (params.saturation ?? 0) / 100;
    for (let i = 0; i < len; i += 4) {
      if (d[i + 3] === 0) continue;
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const max = Math.max(r, g, b);
      const avg = (r + g + b) / 3;
      const saturation = max === 0 ? 0 : (max - avg) / max;
      const vAmount = (1 - saturation) * vib * 1.5;
      d[i] = Math.min(255, Math.max(0, r + (r - avg) * (vAmount + sat)));
      d[i + 1] = Math.min(255, Math.max(0, g + (g - avg) * (vAmount + sat)));
      d[i + 2] = Math.min(255, Math.max(0, b + (b - avg) * (vAmount + sat)));
    }
    return;
  }

  if (key === 'exposure') {
    const exp = Math.pow(2, params.exposure ?? 0);
    const off = (params.offset ?? 0) * 255;
    const gam = 1 / Math.max(0.01, params.gamma ?? 1.0);
    for (let i = 0; i < len; i += 4) {
      if (d[i + 3] === 0) continue;
      const r = Math.min(255, Math.max(0, d[i] * exp + off));
      const g = Math.min(255, Math.max(0, d[i + 1] * exp + off));
      const b = Math.min(255, Math.max(0, d[i + 2] * exp + off));
      d[i] = Math.min(255, Math.pow(r / 255, gam) * 255);
      d[i + 1] = Math.min(255, Math.pow(g / 255, gam) * 255);
      d[i + 2] = Math.min(255, Math.pow(b / 255, gam) * 255);
    }
    return;
  }

  if (key === 'hue-sat') {
    const hueShift = params.hue ?? 0;
    const satMult = 1 + (params.saturation ?? 0) / 100;
    const lightShift = (params.lightness ?? 0) * 1.28;
    for (let i = 0; i < len; i += 4) {
      if (d[i + 3] === 0) continue;
      let r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h = 0, s = 0;
      const l = (max + min) / 2;
      if (max !== min) {
        const d_ = max - min;
        s = l > 0.5 ? d_ / (2 - max - min) : d_ / (max + min);
        if (max === r) h = (g - b) / d_ + (g < b ? 6 : 0);
        else if (max === g) h = (b - r) / d_ + 2;
        else h = (r - g) / d_ + 4;
        h /= 6;
      }
      h = (h + hueShift / 360 + 1) % 1;
      s = Math.min(1, Math.max(0, s * satMult));

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      const hue2rgb = (t: number) => {
        let val = t;
        if (val < 0) val += 1;
        if (val > 1) val -= 1;
        if (val < 1/6) return p + (q - p) * 6 * val;
        if (val < 1/2) return q;
        if (val < 2/3) return p + (q - p) * (2/3 - val) * 6;
        return p;
      };

      if (s === 0) {
        r = g = b = l;
      } else {
        r = hue2rgb(h + 1/3);
        g = hue2rgb(h);
        b = hue2rgb(h - 1/3);
      }
      d[i] = Math.min(255, Math.max(0, r * 255 + lightShift));
      d[i + 1] = Math.min(255, Math.max(0, g * 255 + lightShift));
      d[i + 2] = Math.min(255, Math.max(0, b * 255 + lightShift));
    }
    return;
  }

  if (key === 'black-white') {
    const rw = (params.bwRed ?? 40) / 100;
    const gw = (params.bwGreen ?? 60) / 100;
    const bw = (params.bwBlue ?? 20) / 100;
    const total = Math.max(0.01, rw + gw + bw);
    for (let i = 0; i < len; i += 4) {
      if (d[i + 3] === 0) continue;
      const lum = Math.min(255, Math.max(0, (d[i] * rw + d[i + 1] * gw + d[i + 2] * bw) / total));
      d[i] = lum; d[i + 1] = lum; d[i + 2] = lum;
    }
    return;
  }

  if (key === 'levels') {
    const bp = params.blackPoint ?? 0;
    const wp = Math.max(bp + 1, params.whitePoint ?? 255);
    const gamma = Math.max(0.1, params.midtones ?? 1.0);
    const invGamma = 1 / gamma;
    const range = wp - bp;
    for (let i = 0; i < len; i += 4) {
      if (d[i + 3] === 0) continue;
      for (let c = 0; c < 3; c++) {
        let v = (d[i + c] - bp) / range;
        v = Math.min(1, Math.max(0, v));
        d[i + c] = Math.round(Math.pow(v, invGamma) * 255);
      }
    }
    return;
  }

  if (key === 'curves') {
    const amt = (params.curveAmount ?? 50) / 50;
    for (let i = 0; i < len; i += 4) {
      if (d[i + 3] === 0) continue;
      for (let c = 0; c < 3; c++) {
        const v = d[i + c] / 255;
        const sCurve = v * v * (3 - 2 * v);
        const blended = v + (sCurve - v) * amt;
        d[i + c] = Math.min(255, Math.max(0, Math.round(blended * 255)));
      }
    }
    return;
  }

  if (key === 'color-balance') {
    const rShift = params.redBalance ?? 0;
    const gShift = params.greenBalance ?? 0;
    const bShift = params.blueBalance ?? 0;
    for (let i = 0; i < len; i += 4) {
      if (d[i + 3] === 0) continue;
      d[i] = Math.min(255, Math.max(0, d[i] + rShift));
      d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + gShift));
      d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + bShift));
    }
    return;
  }

  if (key === 'photo-filter') {
    const density = (params.filterDensity ?? 25) / 100;
    const preset = params.filterPreset || 'warm';
    let tr = 236, tg = 138, tb = 25;
    if (preset === 'cool') { tr = 25; tg = 120; tb = 220; }
    else if (preset === 'sepia') { tr = 180; tg = 135; tb = 70; }
    else if (preset === 'emerald') { tr = 30; tg = 190; tb = 100; }
    else if (preset === 'violet') { tr = 160; tg = 60; tb = 220; }
    for (let i = 0; i < len; i += 4) {
      if (d[i + 3] === 0) continue;
      d[i] = Math.round(d[i] * (1 - density) + tr * density);
      d[i + 1] = Math.round(d[i + 1] * (1 - density) + tg * density);
      d[i + 2] = Math.round(d[i + 2] * (1 - density) + tb * density);
    }
    return;
  }

  if (key === 'channel-mixer') {
    const mr = (params.channelRed ?? 100) / 100;
    const mg = (params.channelGreen ?? 0) / 100;
    const mb = (params.channelBlue ?? 0) / 100;
    const isMono = params.channelMono ?? false;
    for (let i = 0; i < len; i += 4) {
      if (d[i + 3] === 0) continue;
      const r = d[i], g = d[i + 1], b = d[i + 2];
      if (isMono) {
        const gray = Math.min(255, Math.max(0, r * 0.4 * mr + g * 0.5 * mg + b * 0.1 * mb));
        d[i] = gray; d[i + 1] = gray; d[i + 2] = gray;
      } else {
        d[i] = Math.min(255, Math.max(0, r * mr + g * 0.1 + b * 0.1));
        d[i + 1] = Math.min(255, Math.max(0, g * mg + r * 0.1 + b * 0.1));
        d[i + 2] = Math.min(255, Math.max(0, b * mb + r * 0.1 + g * 0.1));
      }
    }
    return;
  }

  if (key === 'color-lookup') {
    const intensity = (params.lutIntensity ?? 80) / 100;
    const lut = params.lutPreset || 'teal-orange';
    for (let i = 0; i < len; i += 4) {
      if (d[i + 3] === 0) continue;
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      let nr = r, ng = g, nb = b;
      if (lut === 'teal-orange') {
        if (lum < 128) { ng = g * 1.08 + 8; nb = b * 1.25 + 16; }
        else { nr = r * 1.2 + 20; ng = g * 1.05 + 5; }
      } else if (lut === 'vintage') {
        nr = r * 1.1 + 15; ng = g * 0.95; nb = b * 0.8;
      } else if (lut === 'cyberpunk') {
        if (lum < 128) { nb = b * 1.4 + 20; }
        else { nr = r * 1.3 + 25; nb = b * 1.2; }
      } else if (lut === 'noir') {
        const n = lum < 100 ? lum * 0.7 : Math.min(255, lum * 1.2);
        nr = ng = nb = n;
      }
      d[i] = Math.min(255, Math.max(0, r * (1 - intensity) + nr * intensity));
      d[i + 1] = Math.min(255, Math.max(0, g * (1 - intensity) + ng * intensity));
      d[i + 2] = Math.min(255, Math.max(0, b * (1 - intensity) + nb * intensity));
    }
    return;
  }

  if (key === 'invert') {
    for (let i = 0; i < len; i += 4) {
      if (d[i + 3] === 0) continue;
      d[i] = 255 - d[i];
      d[i + 1] = 255 - d[i + 1];
      d[i + 2] = 255 - d[i + 2];
    }
    return;
  }

  if (key === 'posterize') {
    const step = Math.max(2, params.posterizeLevels ?? 4);
    const factor = 255 / (step - 1);
    for (let i = 0; i < len; i += 4) {
      if (d[i + 3] === 0) continue;
      d[i] = Math.round(Math.round(d[i] / factor) * factor);
      d[i + 1] = Math.round(Math.round(d[i + 1] / factor) * factor);
      d[i + 2] = Math.round(Math.round(d[i + 2] / factor) * factor);
    }
    return;
  }

  if (key === 'threshold') {
    const th = params.thresholdLevel ?? 128;
    for (let i = 0; i < len; i += 4) {
      if (d[i + 3] === 0) continue;
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const val = lum >= th ? 255 : 0;
      d[i] = val; d[i + 1] = val; d[i + 2] = val;
    }
    return;
  }

  if (key === 'gradient-map') {
    const preset = params.gradientPreset || 'navy-coral';
    const rev = params.gradientReverse ?? false;
    let r1 = 15, g1 = 23, b1 = 42, r2 = 249, g2 = 115, b2 = 22;
    if (preset === 'sunset') { r1 = 60; g1 = 10; b1 = 80; r2 = 255; g2 = 190; b2 = 30; }
    else if (preset === 'emerald') { r1 = 5; g1 = 35; b1 = 25; r2 = 70; g2 = 230; b2 = 150; }
    else if (preset === 'neon') { r1 = 20; g1 = 0; b1 = 40; r2 = 0; g2 = 255; b2 = 240; }
    if (rev) {
      const tr_ = r1; r1 = r2; r2 = tr_;
      const tg_ = g1; g1 = g2; g2 = tg_;
      const tb_ = b1; b1 = b2; b2 = tb_;
    }
    for (let i = 0; i < len; i += 4) {
      if (d[i + 3] === 0) continue;
      const t = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
      d[i] = Math.round(r1 + t * (r2 - r1));
      d[i + 1] = Math.round(g1 + t * (g2 - g1));
      d[i + 2] = Math.round(b1 + t * (b2 - b1));
    }
    return;
  }

  if (key === 'selective-color') {
    const c = (params.selectiveCyan ?? 0) / 100;
    const m = (params.selectiveMagenta ?? 0) / 100;
    const y = (params.selectiveYellow ?? 0) / 100;
    const k = (params.selectiveBlack ?? 0) / 100;
    for (let i = 0; i < len; i += 4) {
      if (d[i + 3] === 0) continue;
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      if (max - min > 20) {
        d[i] = Math.min(255, Math.max(0, r * (1 - c) * (1 - k)));
        d[i + 1] = Math.min(255, Math.max(0, g * (1 - m) * (1 - k)));
        d[i + 2] = Math.min(255, Math.max(0, b * (1 - y) * (1 - k)));
      }
    }
  }
}

/**
 * Applies adjustments to an image URL or data URL and returns the new data URL
 */
export function applyAdjustmentParamsToImageUrl(
  src: string,
  params: AdjustmentParams
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth || img.width;
      c.height = img.naturalHeight || img.height;
      const ctx = c.getContext('2d');
      if (!ctx) {
        resolve(src);
        return;
      }
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, c.width, c.height);
      applyAdjustmentParamsToImageData(imgData, params, false);
      ctx.putImageData(imgData, 0, 0);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}
