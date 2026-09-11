import { type DxfCalibration } from './exportTypes';
import { loadImageElement } from './imageExportUtils';

/**
 * Professional vectorization engine: converts a raster image to clean DXF vectors.
 * Pipeline:
 *   1. Grayscale + Gaussian blur (noise removal)
 *   2. Sobel gradients + Non-maximum suppression (thin edges)
 *   3. Hysteresis thresholding (strong/weak edges)
 *   4. Contour tracing (8-connectivity, thickness suppression)
 *   5. Circle / Arc fitting
 *   6. Douglas-Peucker simplification
 *   7. Orthogonal snapping (15° tolerance)
 *   8. Layer-aware output (WALLS/SYMBOLS/DETAILS)
 *   9. Emit R2010 DXF
 */
export async function imageToDxfString(
  url: string,
  calibration?: DxfCalibration
): Promise<string> {
  const img = await loadImageElement(url);

  // ── 1. Rasterise at a working resolution ──────────────────────────────────
  const TARGET = 800; // higher resolution → cleaner vectors
  const naturalW = img.naturalWidth || img.width || 512;
  const naturalH = img.naturalHeight || img.height || 512;
  let W = naturalW;
  let H = naturalH;
  if (W > TARGET || H > TARGET) {
    if (W >= H) { H = Math.round(H * TARGET / W); W = TARGET; }
    else { W = Math.round(W * TARGET / H); H = TARGET; }
  }

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, W, H);
  const { data } = ctx.getImageData(0, 0, W, H);

  // ── 2. Grayscale ──────────────────────────────────────────────────────────
  const gray = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  }

  // ── 3. Gaussian blur (σ=1.4, 5×5 kernel) ─────────────────────────────────
  const K5 = [2, 4, 5, 4, 2, 4, 9, 12, 9, 4, 5, 12, 15, 12, 5, 4, 9, 12, 9, 4, 2, 4, 5, 4, 2];
  const K5_SUM = 115;
  const blurred = new Float32Array(W * H);
  for (let y = 2; y < H - 2; y++) {
    for (let x = 2; x < W - 2; x++) {
      let acc = 0;
      for (let ky = -2; ky <= 2; ky++) {
        for (let kx = -2; kx <= 2; kx++) {
          acc += K5[(ky + 2) * 5 + (kx + 2)] * gray[(y + ky) * W + (x + kx)];
        }
      }
      blurred[y * W + x] = acc / K5_SUM;
    }
  }

  // ── 4. Sobel gradients ────────────────────────────────────────────────────
  const mag = new Float32Array(W * H);
  const angleQ = new Float32Array(W * H); // quantised direction: 0,1,2,3

  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const tl = blurred[(y - 1) * W + (x - 1)], t = blurred[(y - 1) * W + x], tr = blurred[(y - 1) * W + (x + 1)];
      const ml = blurred[y * W + (x - 1)], mr = blurred[y * W + (x + 1)];
      const bl = blurred[(y + 1) * W + (x - 1)], b = blurred[(y + 1) * W + x], br = blurred[(y + 1) * W + (x + 1)];
      const gx = -tl + tr - 2 * ml + 2 * mr - bl + br;
      const gy = -tl - 2 * t - tr + bl + 2 * b + br;
      mag[y * W + x] = Math.sqrt(gx * gx + gy * gy);
      const a = (Math.atan2(Math.abs(gy), Math.abs(gx)) * 180 / Math.PI);
      angleQ[y * W + x] = a < 22.5 ? 0 : a < 67.5 ? 1 : a < 112.5 ? 2 : a < 157.5 ? 3 : 0;
    }
  }

  // ── 5. Non-maximum suppression ────────────────────────────────────────────
  const nms = new Float32Array(W * H);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const m = mag[y * W + x];
      let n1 = 0, n2 = 0;
      switch (angleQ[y * W + x]) {
        case 0: n1 = mag[y * W + (x - 1)]; n2 = mag[y * W + (x + 1)]; break;
        case 1: n1 = mag[(y - 1) * W + (x + 1)]; n2 = mag[(y + 1) * W + (x - 1)]; break;
        case 2: n1 = mag[(y - 1) * W + x]; n2 = mag[(y + 1) * W + x]; break;
        case 3: n1 = mag[(y - 1) * W + (x - 1)]; n2 = mag[(y + 1) * W + (x + 1)]; break;
      }
      nms[y * W + x] = (m >= n1 && m >= n2) ? m : 0;
    }
  }

  // ── 6. Hysteresis thresholding ────────────────────────────────────────────
  let maxMag = 0;
  for (let i = 0; i < W * H; i++) if (nms[i] > maxMag) maxMag = nms[i];
  const hiT = maxMag * 0.20;
  const loT = maxMag * 0.08;

  const edgeMap = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    if (nms[i] >= hiT) edgeMap[i] = 2;
    else if (nms[i] >= loT) edgeMap[i] = 1;
  }
  const DIRS8 = [-W - 1, -W, -W + 1, -1, 1, W - 1, W, W + 1];
  const queue: number[] = [];
  for (let i = 0; i < W * H; i++) if (edgeMap[i] === 2) queue.push(i);
  let qi = 0;
  while (qi < queue.length) {
    const idx = queue[qi++];
    for (const d of DIRS8) {
      const ni = idx + d;
      if (ni >= 0 && ni < W * H && edgeMap[ni] === 1) {
        edgeMap[ni] = 2;
        queue.push(ni);
      }
    }
  }
  const edges = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) edges[i] = edgeMap[i] === 2 ? 255 : 0;

  // ── 7. Contour tracing (8-connectivity, thickness suppression) ────────────
  const visited = new Uint8Array(W * H);
  const rawPaths: { x: number; y: number }[][] = [];

  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const idx = y * W + x;
      if (edges[idx] !== 255 || visited[idx]) continue;

      const path: { x: number; y: number }[] = [{ x, y }];
      visited[idx] = 1;
      let cx = x, cy = y;

      outer: while (true) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = cx + dx, ny = cy + dy;
            if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
            const ni = ny * W + nx;
            if (edges[ni] !== 255 || visited[ni]) continue;

            if (dy === 0) {
              for (let d = -2; d <= 2; d++) {
                const sy = ny + d;
                if (sy >= 0 && sy < H) visited[sy * W + nx] = 1;
              }
            } else if (dx === 0) {
              for (let d = -2; d <= 2; d++) {
                const sx = nx + d;
                if (sx >= 0 && sx < W) visited[ny * W + sx] = 1;
              }
            }

            visited[ni] = 1;
            cx = nx; cy = ny;
            path.push({ x: cx, y: cy });
            continue outer;
          }
        }
        break;
      }

      if (path.length >= 12) rawPaths.push(path);
    }
  }

  // ── 8. Transform every contour into CAD space FIRST ───────────────────────
  const PAGE_W_MM = 841, PAGE_H_MM = 594;
  const scale = calibration
    ? calibration.mmPerPixel * (naturalW / W)
    : Math.min(PAGE_W_MM / W, PAGE_H_MM / H);

  const toCad = (p: { x: number; y: number }) => ({
    x: p.x * scale,
    y: (H - p.y) * scale,
  });

  const cadPaths = rawPaths.map(p => p.map(toCad));

  // ── 9. Circle / arc fitting ────────────────────────────────────────────────
  type ArcEntity = { cx: number; cy: number; r: number; startDeg: number; endDeg: number; isFull: boolean };
  const arcs: ArcEntity[] = [];
  const remainingPaths: { x: number; y: number }[][] = [];
  const maxArcRadius = Math.max(W, H) * scale * 0.28;

  for (const path of cadPaths) {
    const fit = path.length >= 10 ? fitCircle(path) : null;
    if (fit && fit.r > 3 && fit.r < maxArcRadius) {
      const span = arcSpan(path, fit.cx, fit.cy);
      arcs.push({ cx: fit.cx, cy: fit.cy, r: fit.r, startDeg: span.startDeg, endDeg: span.endDeg, isFull: span.isFull });
    } else {
      remainingPaths.push(path);
    }
  }

  // ── 10. Douglas-Peucker simplification (ε scaled to real units) ──────────
  const simplified = remainingPaths.map(p => simplifyRDP(p, 2.5 * scale));

  // ── 11. Orthogonal snapping (±12°) ────────────────────────────────────────
  const SNAP_TAN = Math.tan(12 * Math.PI / 180);
  const snapped = simplified.map(path => {
    if (path.length < 2) return path;
    const p = path.map(pt => ({ ...pt }));
    for (let i = 0; i < p.length - 1; i++) {
      const dx = p[i + 1].x - p[i].x, dy = p[i + 1].y - p[i].y;
      if (dx === 0 || dy === 0) continue;
      const adx = Math.abs(dx), ady = Math.abs(dy);
      if (ady / adx < SNAP_TAN) p[i + 1].y = p[i].y;
      else if (adx / ady < SNAP_TAN) p[i + 1].x = p[i].x;
    }
    return p;
  });

  // ── 12. Classify remaining polylines: WALLS vs DETAILS ────────────────────
  const wallPaths: { x: number; y: number }[][] = [];
  const detailPaths: { x: number; y: number }[][] = [];
  const minWallAreaMM2 = (200) * (200);

  for (const path of snapped) {
    if (path.length < 2) continue;
    const first = path[0], last = path[path.length - 1];
    const closed = Math.hypot(last.x - first.x, last.y - first.y) < 15 * scale;
    const area = closed ? Math.abs(polygonArea(path)) : 0;
    if (closed && area > minWallAreaMM2) wallPaths.push(path);
    else detailPaths.push(path);
  }

  // ── 13. Emit AC1024 (R2010) DXF ──────────────────────────────────────────
  const nl = '\n';
  let dxf = '';

  const allX = [...wallPaths, ...detailPaths].flat().map(p => p.x).concat(arcs.map(a => a.cx + a.r), arcs.map(a => a.cx - a.r));
  const allY = [...wallPaths, ...detailPaths].flat().map(p => p.y).concat(arcs.map(a => a.cy + a.r), arcs.map(a => a.cy - a.r));
  const extMinX = allX.length ? Math.min(...allX) : 0;
  const extMinY = allY.length ? Math.min(...allY) : 0;
  const extMaxX = allX.length ? Math.max(...allX) : PAGE_W_MM;
  const extMaxY = allY.length ? Math.max(...allY) : PAGE_H_MM;

  dxf += `  0${nl}SECTION${nl}  2${nl}HEADER${nl}`;
  dxf += `  9${nl}$ACADVER${nl}  1${nl}AC1024${nl}`;
  dxf += `  9${nl}$INSUNITS${nl} 70${nl}4${nl}`;
  dxf += `  9${nl}$EXTMIN${nl} 10${nl}${extMinX.toFixed(4)}${nl} 20${nl}${extMinY.toFixed(4)}${nl} 30${nl}0.0${nl}`;
  dxf += `  9${nl}$EXTMAX${nl} 10${nl}${extMaxX.toFixed(4)}${nl} 20${nl}${extMaxY.toFixed(4)}${nl} 30${nl}0.0${nl}`;
  dxf += `  0${nl}ENDSEC${nl}`;

  dxf += `  0${nl}SECTION${nl}  2${nl}TABLES${nl}`;
  dxf += `  0${nl}TABLE${nl}  2${nl}LAYER${nl} 70${nl}3${nl}`;
  dxf += `  0${nl}LAYER${nl}  2${nl}WALLS${nl} 70${nl}0${nl} 62${nl}7${nl}  6${nl}Continuous${nl}370${nl}35${nl}`;
  dxf += `  0${nl}LAYER${nl}  2${nl}SYMBOLS${nl} 70${nl}0${nl} 62${nl}1${nl}  6${nl}Continuous${nl}370${nl}18${nl}`;
  dxf += `  0${nl}LAYER${nl}  2${nl}DETAILS${nl} 70${nl}0${nl} 62${nl}4${nl}  6${nl}Continuous${nl}370${nl}13${nl}`;
  dxf += `  0${nl}ENDTAB${nl}`;
  dxf += `  0${nl}ENDSEC${nl}`;

  dxf += `  0${nl}SECTION${nl}  2${nl}ENTITIES${nl}`;
  let entityHandle = 256;

  const emitPolyline = (path: { x: number; y: number }[], layer: string, closed: 0 | 1) => {
    const pts: { x: number; y: number }[] = [path[0]];
    for (let i = 1; i < path.length; i++) {
      const prev = pts[pts.length - 1];
      if (path[i].x !== prev.x || path[i].y !== prev.y) pts.push(path[i]);
    }
    if (pts.length < 2) return;
    const handle = (entityHandle++).toString(16).toUpperCase();
    dxf += `  0${nl}LWPOLYLINE${nl}`;
    dxf += `  5${nl}${handle}${nl}`;
    dxf += `100${nl}AcDbEntity${nl}`;
    dxf += `  8${nl}${layer}${nl}`;
    dxf += `100${nl}AcDbPolyline${nl}`;
    dxf += ` 90${nl}${pts.length}${nl}`;
    dxf += ` 70${nl}${closed}${nl}`;
    dxf += ` 43${nl}0.0${nl}`;
    for (const pt of pts) {
      dxf += ` 10${nl}${pt.x.toFixed(4)}${nl} 20${nl}${pt.y.toFixed(4)}${nl}`;
    }
  };

  for (const path of wallPaths) emitPolyline(path, 'WALLS', 1);
  for (const path of detailPaths) emitPolyline(path, 'DETAILS', 0);

  for (const a of arcs) {
    const handle = (entityHandle++).toString(16).toUpperCase();
    if (a.isFull) {
      dxf += `  0${nl}CIRCLE${nl}`;
      dxf += `  5${nl}${handle}${nl}`;
      dxf += `100${nl}AcDbEntity${nl}`;
      dxf += `  8${nl}SYMBOLS${nl}`;
      dxf += `100${nl}AcDbCircle${nl}`;
      dxf += ` 10${nl}${a.cx.toFixed(4)}${nl} 20${nl}${a.cy.toFixed(4)}${nl} 30${nl}0.0${nl}`;
      dxf += ` 40${nl}${a.r.toFixed(4)}${nl}`;
    } else {
      dxf += `  0${nl}ARC${nl}`;
      dxf += `  5${nl}${handle}${nl}`;
      dxf += `100${nl}AcDbEntity${nl}`;
      dxf += `  8${nl}SYMBOLS${nl}`;
      dxf += `100${nl}AcDbCircle${nl}`;
      dxf += ` 10${nl}${a.cx.toFixed(4)}${nl} 20${nl}${a.cy.toFixed(4)}${nl} 30${nl}0.0${nl}`;
      dxf += ` 40${nl}${a.r.toFixed(4)}${nl}`;
      dxf += `100${nl}AcDbArc${nl}`;
      dxf += ` 50${nl}${a.startDeg.toFixed(4)}${nl} 51${nl}${a.endDeg.toFixed(4)}${nl}`;
    }
  }

  dxf += `  0${nl}ENDSEC${nl}  0${nl}EOF${nl}`;
  return dxf;
}

// ── Geometry helpers ─────────────────────────────────────────────────────────

function fitCircle(points: { x: number; y: number }[]): { cx: number; cy: number; r: number; rmse: number } | null {
  const n = points.length;
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, sxz = 0, syz = 0, sz = 0;
  for (const p of points) {
    const z = p.x * p.x + p.y * p.y;
    sx += p.x; sy += p.y; sxx += p.x * p.x; syy += p.y * p.y; sxy += p.x * p.y;
    sxz += p.x * z; syz += p.y * z; sz += z;
  }
  const M = [
    [sxx, sxy, sx],
    [sxy, syy, sy],
    [sx, sy, n],
  ];
  const V = [-sxz, -syz, -sz];
  const det3 = det3x3(M);
  if (Math.abs(det3) < 1e-6) return null;

  const A = det3x3(replaceCol(M, 0, V)) / det3;
  const B = det3x3(replaceCol(M, 1, V)) / det3;
  const C = det3x3(replaceCol(M, 2, V)) / det3;

  const cx = -A / 2, cy = -B / 2;
  const r2 = cx * cx + cy * cy - C;
  if (r2 <= 0) return null;
  const r = Math.sqrt(r2);

  let sqErr = 0;
  for (const p of points) {
    const d = Math.hypot(p.x - cx, p.y - cy) - r;
    sqErr += d * d;
  }
  const rmse = Math.sqrt(sqErr / n);

  if (rmse > Math.max(r * 0.045, 1.2)) return null;
  return { cx, cy, r, rmse };
}

function arcSpan(points: { x: number; y: number }[], cx: number, cy: number): { startDeg: number; endDeg: number; isFull: boolean } {
  const angles = points.map(p => {
    let deg = Math.atan2(p.y - cy, p.x - cx) * 180 / Math.PI;
    if (deg < 0) deg += 360;
    return deg;
  }).sort((a, b) => a - b);

  let maxGap = 0, gapStartIdx = 0;
  for (let i = 0; i < angles.length; i++) {
    const next = angles[(i + 1) % angles.length];
    const gap = i === angles.length - 1 ? (360 - angles[i] + angles[0]) : (next - angles[i]);
    if (gap > maxGap) { maxGap = gap; gapStartIdx = i; }
  }

  if (maxGap < 20) return { startDeg: 0, endDeg: 360, isFull: true };

  const startDeg = angles[(gapStartIdx + 1) % angles.length];
  const endDeg = angles[gapStartIdx];
  return { startDeg, endDeg, isFull: false };
}

function polygonArea(path: { x: number; y: number }[]): number {
  let a = 0;
  for (let i = 0; i < path.length; i++) {
    const p1 = path[i], p2 = path[(i + 1) % path.length];
    a += p1.x * p2.y - p2.x * p1.y;
  }
  return a / 2;
}

function det3x3(m: number[][]): number {
  return (
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  );
}

function replaceCol(m: number[][], col: number, v: number[]): number[][] {
  return m.map((row, i) => row.map((val, j) => (j === col ? v[i] : val)));
}

function getSqSegDist(p: { x: number; y: number }, p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  let x = p1.x;
  let y = p1.y;
  let dx = p2.x - x;
  let dy = p2.y - y;
  
  if (dx !== 0 || dy !== 0) {
    const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = p2.x;
      y = p2.y;
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  
  dx = p.x - x;
  dy = p.y - y;
  return dx * dx + dy * dy;
}

function simplifyDPStep(
  points: { x: number; y: number }[],
  first: number,
  last: number,
  sqTolerance: number,
  simplified: { x: number; y: number }[]
) {
  let maxSqDist = sqTolerance;
  let index = -1;
  
  for (let i = first + 1; i < last; i++) {
    const sqDist = getSqSegDist(points[i], points[first], points[last]);
    if (sqDist > maxSqDist) {
      index = i;
      maxSqDist = sqDist;
    }
  }
  
  if (maxSqDist > sqTolerance) {
    if (index - first > 1) simplifyDPStep(points, first, index, sqTolerance, simplified);
    simplified.push(points[index]);
    if (last - index > 1) simplifyDPStep(points, index, last, sqTolerance, simplified);
  }
}

function simplifyRDP(points: { x: number; y: number }[], tolerance: number): { x: number; y: number }[] {
  if (points.length <= 2) return points;
  const sqTolerance = tolerance * tolerance;
  const simplified = [points[0]];
  simplifyDPStep(points, 0, points.length - 1, sqTolerance, simplified);
  simplified.push(points[points.length - 1]);
  return simplified;
}
