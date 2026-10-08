/**
 * inpaintAlgorithm.ts
 * Intelligent client-side inpainting algorithm.
 * Performs radial boundary ray-casting with inverse square weighting
 * followed by multi-pass directional diffusion smoothing.
 */

export function inpaintMaskedArea(baseCanvas: HTMLCanvasElement, maskCanvas: HTMLCanvasElement): void {
  const ctx = baseCanvas.getContext('2d');
  const maskCtx = maskCanvas.getContext('2d');
  if (!ctx || !maskCtx) return;

  const w = baseCanvas.width;
  const h = baseCanvas.height;
  const baseImgData = ctx.getImageData(0, 0, w, h);
  const maskImgData = maskCtx.getImageData(0, 0, w, h);

  const baseData = baseImgData.data;
  const maskData = maskImgData.data;

  // 1. Detect masked pixels
  const isMasked = new Uint8Array(w * h);
  let minX = w;
  let maxX = 0;
  let minY = h;
  let maxY = 0;
  let maskedCount = 0;

  for (let y = 0; y < h; y++) {
    const rowOffset = y * w;
    for (let x = 0; x < w; x++) {
      const idx = (rowOffset + x) * 4;
      if (maskData[idx + 3] > 20) {
        isMasked[rowOffset + x] = 1;
        maskedCount++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maskedCount === 0) return;

  // Add margin around bounding box
  minX = Math.max(0, minX - 8);
  maxX = Math.min(w - 1, maxX + 8);
  minY = Math.max(0, minY - 8);
  maxY = Math.min(h - 1, maxY + 8);

  // 2. Multi-directional border sampling
  const angles = 16;
  const dirX = new Float32Array(angles);
  const dirY = new Float32Array(angles);
  for (let a = 0; a < angles; a++) {
    const rad = (a * 2 * Math.PI) / angles;
    dirX[a] = Math.cos(rad);
    dirY[a] = Math.sin(rad);
  }

  const maxRadius = Math.max(40, Math.min(200, Math.max(maxX - minX, maxY - minY) * 1.5));

  for (let y = minY; y <= maxY; y++) {
    const rowOffset = y * w;
    for (let x = minX; x <= maxX; x++) {
      const pIdx = rowOffset + x;
      if (isMasked[pIdx] !== 1) continue;

      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let wSum = 0;

      for (let a = 0; a < angles; a++) {
        const dx = dirX[a];
        const dy = dirY[a];

        for (let step = 1; step <= maxRadius; step++) {
          const sx = Math.round(x + dx * step);
          const sy = Math.round(y + dy * step);

          if (sx < 0 || sx >= w || sy < 0 || sy >= h) break;

          const sIdx = sy * w + sx;
          if (isMasked[sIdx] === 0) {
            const weight = 1 / (step * step);
            const bByte = sIdx * 4;
            rSum += baseData[bByte] * weight;
            gSum += baseData[bByte + 1] * weight;
            bSum += baseData[bByte + 2] * weight;
            wSum += weight;
            break;
          }
        }
      }

      if (wSum > 0) {
        const byteIdx = pIdx * 4;
        baseData[byteIdx] = Math.round(rSum / wSum);
        baseData[byteIdx + 1] = Math.round(gSum / wSum);
        baseData[byteIdx + 2] = Math.round(bSum / wSum);
      }
    }
  }

  // 3. Multi-pass smoothing on only masked pixels
  const tempR = new Float32Array(w * h);
  const tempG = new Float32Array(w * h);
  const tempB = new Float32Array(w * h);

  for (let pass = 0; pass < 3; pass++) {
    for (let y = minY; y <= maxY; y++) {
      const rowOffset = y * w;
      for (let x = minX; x <= maxX; x++) {
        const pIdx = rowOffset + x;
        if (isMasked[pIdx] !== 1) continue;

        let rAcc = 0;
        let gAcc = 0;
        let bAcc = 0;
        let count = 0;
        for (let ky = -1; ky <= 1; ky++) {
          const ny = y + ky;
          if (ny < 0 || ny >= h) continue;
          const nRow = ny * w;
          for (let kx = -1; kx <= 1; kx++) {
            const nx = x + kx;
            if (nx < 0 || nx >= w) continue;
            const nByte = (nRow + nx) * 4;
            rAcc += baseData[nByte];
            gAcc += baseData[nByte + 1];
            bAcc += baseData[nByte + 2];
            count++;
          }
        }

        tempR[pIdx] = rAcc / count;
        tempG[pIdx] = gAcc / count;
        tempB[pIdx] = bAcc / count;
      }
    }

    for (let y = minY; y <= maxY; y++) {
      const rowOffset = y * w;
      for (let x = minX; x <= maxX; x++) {
        const pIdx = rowOffset + x;
        if (isMasked[pIdx] === 1) {
          const bIdx = pIdx * 4;
          baseData[bIdx] = Math.round(tempR[pIdx]);
          baseData[bIdx + 1] = Math.round(tempG[pIdx]);
          baseData[bIdx + 2] = Math.round(tempB[pIdx]);
        }
      }
    }
  }

  ctx.putImageData(baseImgData, 0, 0);
}
