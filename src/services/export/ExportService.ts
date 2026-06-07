/**
 * Export Service
 * Enhanced export functionality with native save dialogs
 * Exports images, PDFs, and project files with program identity
 */

import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import type { Node, Edge } from '@xyflow/react';
import jsPDF from 'jspdf';
import { getLocalImage } from '../history/HistoryService';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ExportImageItem {
  url: string;
  name: string;
  prompt?: string | null;
}

export interface ExportOptions {
  format?: 'png' | 'jpg' | 'webp';
  quality?: number;
}

export interface PDFExportOptions {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  includeMetadata?: boolean;
  margins?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

// ── Program Identity ─────────────────────────────────────────────────────────

const PROGRAM_IDENTITY = {
  name: 'Anarchy AI',
  version: '0.07',
  fileExtension: 'ana',
  fileDescription: 'Anarchy AI Project',
  website: 'https://anarchy-ai.com',
  signature: 'ANARCHY_AI_PROJECT_FILE',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const sanitize = (s: string): string =>
  s.replaceAll(/[^a-z0-9._-]+/gi, '_').slice(0, 80) || 'image';

const timestamp = () => new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-').slice(0, 19);

/**
 * Convert image URL to data URI for export
 */
export async function urlToDataUri(url: string, format: 'png' | 'jpg' | 'webp' = 'jpg', quality: number = 0.92): Promise<string> {
  if (url.startsWith('data:')) return url;
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width || 512;
      canvas.height = img.naturalHeight || img.height || 512;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas unavailable')); return; }
      
      if (format === 'jpg') {
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0);
      
      const mimeMap = { png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg' };
      const mime = mimeMap[format];
      resolve(canvas.toDataURL(mime, format === 'png' ? undefined : quality));
    };
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = url;
  });
}

/**
 * Save data URI to file using Tauri dialog
 */
async function saveDataUriWithDialog(
  dataUri: string, 
  defaultName: string, 
  filters: { name: string; extensions: string[] }[]
): Promise<string | null> {
  // Show save dialog
  const filePath = await save({
    defaultPath: defaultName,
    filters,
  });
  
  if (!filePath) return null; // User cancelled
  
  // Extract base64 data
  const base64Data = dataUri.split(',')[1];
  if (!base64Data) throw new Error('Invalid data URI');
  
  // Save via Tauri
  await invoke('save_file', { 
    path: filePath, 
    contents: base64Data,
    binary: true 
  });
  
  return filePath;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Export single image with native save dialog
 * Returns the saved file path or null if cancelled
 */
export async function exportImageWithDialog(
  url: string,
  name: string,
  options: ExportOptions = {}
): Promise<string | null> {
  const format = options.format ?? 'jpg';
  const quality = options.quality ?? 0.92;
  const ext = format === 'jpg' ? 'jpg' : format;
  const fileName = `${sanitize(name)}_${timestamp()}.${ext}`;
  
  // Convert to data URI
  const dataUri = await urlToDataUri(url, format, quality);
  
  // Show save dialog and save
  return saveDataUriWithDialog(dataUri, fileName, [
    { name: `${format.toUpperCase()} Image`, extensions: [ext] },
    { name: 'All Files', extensions: ['*'] },
  ]);
}

/**
 * Export multiple images with native save dialogs
 * Returns count of succeeded and failed exports
 */
export async function exportImagesBatchWithDialog(
  items: ExportImageItem[],
  options: ExportOptions = {}
): Promise<{ succeeded: number; failed: number; paths: string[] }> {
  let succeeded = 0;
  let failed = 0;
  const paths: string[] = [];
  
  for (const item of items) {
    try {
      const path = await exportImageWithDialog(item.url, item.name, options);
      if (path) {
        succeeded++;
        paths.push(path);
      }
      // Small delay between saves
      await new Promise(r => setTimeout(r, 100));
    } catch (err) {
      console.error('[Export] Failed:', item.name, err);
      failed++;
    }
  }
  
  return { succeeded, failed, paths };
}

/**
 * Export canvas nodes to PDF with native save dialog
 */
function extractImagesFromNodes(nodes: Node[]): ExportImageItem[] {
  const images: ExportImageItem[] = [];
  for (const node of nodes) {
    const data = node.data as any;
    const url = data?.image || data?.outputData?.image;
    if (url) {
      images.push({ url, name: `${data?.type || 'node'}_${node.id}`, prompt: data?.prompt });
    }
  }
  return images;
}

async function loadImageElement(url: string): Promise<HTMLImageElement> {
  let resolvedUrl = url;
  if (url && url.startsWith('idb://')) {
    const cached = await getLocalImage(url);
    if (cached) resolvedUrl = cached;
  }

  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = resolvedUrl;
  });
  return img;
}

function fitImageToPDF(
  img: HTMLImageElement,
  contentWidth: number,
  contentHeight: number
): { finalWidth: number; finalHeight: number } {
  const aspectRatio = img.width / img.height;
  let finalWidth = contentWidth;
  let finalHeight = finalWidth / aspectRatio;
  if (finalHeight > contentHeight) {
    finalHeight = contentHeight;
    finalWidth = finalHeight * aspectRatio;
  }
  return { finalWidth, finalHeight };
}

async function addImagePageToPDF(
  pdf: jsPDF,
  imageData: ExportImageItem,
  index: number,
  dims: { pageWidth: number; pageHeight: number; contentWidth: number; contentHeight: number },
  margins: { top: number; right: number; bottom: number; left: number },
  includeMetadata: boolean
): Promise<void> {
  if (index > 0) pdf.addPage();
  try {
    const img = await loadImageElement(imageData.url);
    const { finalWidth, finalHeight } = fitImageToPDF(img, dims.contentWidth, dims.contentHeight);
    const x = (dims.pageWidth - finalWidth) / 2;
    const y = margins.top + 20;
    if (imageData.name) {
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text(imageData.name, dims.pageWidth / 2, margins.top, { align: 'center' });
    }
    pdf.addImage(img, 'JPEG', x, y, finalWidth, finalHeight, undefined, 'MEDIUM');
    if (includeMetadata && imageData.prompt) {
      const textY = y + finalHeight + 10;
      if (textY > dims.pageHeight - margins.bottom - 20) pdf.addPage();
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100);
      const lines = pdf.splitTextToSize(imageData.prompt, dims.contentWidth);
      pdf.text(lines, margins.left, textY + 10);
    }
  } catch (error) {
    console.error(`Failed to process image ${index}:`, error);
    pdf.setFontSize(12);
    pdf.setTextColor(255, 0, 0);
    pdf.text(`Failed to load image: ${imageData.name || 'Unknown'}`, margins.left, margins.top + 30);
  }
}

export async function exportImagesToPDFWithDialog(
  images: ExportImageItem[],
  options: PDFExportOptions = {}
): Promise<string | null> {
  const {
    title = 'Anarchy AI Export',
    author = PROGRAM_IDENTITY.name,
    subject = 'AI Generated Images',
    keywords = 'AI, Image Generation, Anarchy AI',
    includeMetadata = true,
    margins = { top: 20, right: 20, bottom: 20, left: 20 }
  } = options;

  if (images.length === 0) throw new Error('No images found to export');

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  pdf.setProperties({ title, author, subject, keywords, creator: PROGRAM_IDENTITY.name });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margins.left - margins.right;
  const contentHeight = pageHeight - margins.top - margins.bottom;
  const dims = { pageWidth, pageHeight, contentWidth, contentHeight };

  for (let i = 0; i < images.length; i++) {
    await addImagePageToPDF(pdf, images[i], i, dims, margins, includeMetadata);
  }

  const pdfDataUri = pdf.output('datauristring');
  const defaultName = `${sanitize(title)}_${timestamp()}.pdf`;
  const filePath = await save({
    defaultPath: defaultName,
    filters: [
      { name: 'PDF Document', extensions: ['pdf'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (!filePath) return null;
  // Save via Tauri (using save_image_to_path to bypass standard sandbox restrictions for user-initiated exports)
  await invoke('save_image_to_path', { path: filePath, dataUri: pdfDataUri });
  return filePath;
}

export async function exportNodesToPDFWithDialog(
  nodes: Node[],
  options: PDFExportOptions = {}
): Promise<string | null> {
  const images = extractImagesFromNodes(nodes);
  return exportImagesToPDFWithDialog(images, options);
}

// ── Program Identity Export ──────────────────────────────────────────────────

/**
 * Export project with enhanced program identity
 * Returns the saved file path or null if cancelled
 */
export async function exportProjectWithIdentity(
  nodes: Node[],
  edges: Edge[],
  name: string,
  thumbnail?: string
): Promise<string | null> {
  const projectData = {
    signature: PROGRAM_IDENTITY.signature,
    version: PROGRAM_IDENTITY.version,
    fileVersion: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    program: PROGRAM_IDENTITY.name,
    programVersion: PROGRAM_IDENTITY.version,
    website: PROGRAM_IDENTITY.website,
    name,
    nodes: nodes.map(n => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: stripCallbacks(n.data as Record<string, any>),
    })),
    edges: edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      type: e.type,
      animated: e.animated,
      style: e.style,
      data: e.data,
    })),
    thumbnail,
    metadata: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      exportedAt: new Date().toISOString(),
    }
  };
  
  const json = JSON.stringify(projectData, null, 2);
  
  // Show save dialog
  const safeName = sanitize(name) || 'untitled';
  const filePath = await save({
    defaultPath: `${safeName}.${PROGRAM_IDENTITY.fileExtension}`,
    filters: [
      { name: PROGRAM_IDENTITY.fileDescription, extensions: [PROGRAM_IDENTITY.fileExtension] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  
  if (!filePath) return null;
  
  // Save via Tauri
  await invoke('save_file', { path: filePath, contents: json });
  
  return filePath;
}

/**
 * Load project with identity verification
 */
export async function loadProjectWithIdentity(filePath: string): Promise<{
  nodes: Node[];
  edges: Edge[];
  name: string;
  valid: boolean;
  signature?: string;
}> {
  const contents: string = await invoke('load_file', { path: filePath });
  const project = JSON.parse(contents);
  
  // Check signature if present (for backwards compatibility)
  const hasValidSignature = !project.signature || project.signature === PROGRAM_IDENTITY.signature;
  
  return {
    nodes: project.nodes?.map((n: any) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: n.data,
    })) || [],
    edges: project.edges?.map((e: any) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      type: e.type,
      animated: e.animated,
      style: e.style,
      data: e.data,
    })) || [],
    name: project.name || filePath.split(/[\\/]/).pop()?.replace(/\.ana$/i, '') || 'Untitled',
    valid: hasValidSignature,
    signature: project.signature,
  };
}

/**
 * Professional vectorization engine: converts a raster image to clean DXF vectors.
 * Pipeline:
 *   1. Grayscale + Gaussian blur (noise removal)
 *   2. Sobel gradients + Non-maximum suppression (thin edges)
 *   3. Hysteresis thresholding (strong/weak edges)
 *   4. Contour tracing (8-connectivity, thickness suppression)
 *   5. Douglas-Peucker simplification
 *   6. Orthogonal snapping (15° tolerance)
 *   7. Scale to A1 mm space for professional AutoCAD output
 *   8. Emit R2000 DXF with LWPOLYLINE entities on named layers
 */
async function imageToDxfString(url: string): Promise<string> {
  const img = await loadImageElement(url);

  // ── 1. Rasterise at a working resolution ──────────────────────────────────
  const TARGET = 800; // higher resolution → cleaner vectors
  let W = img.naturalWidth  || img.width  || 512;
  let H = img.naturalHeight || img.height || 512;
  if (W > TARGET || H > TARGET) {
    if (W >= H) { H = Math.round(H * TARGET / W); W = TARGET; }
    else         { W = Math.round(W * TARGET / H); H = TARGET; }
  }

  const canvas = document.createElement('canvas');
  canvas.width  = W;
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
  const mag   = new Float32Array(W * H);
  const angle = new Float32Array(W * H); // quantised direction: 0,1,2,3

  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const tl = blurred[(y-1)*W+(x-1)], t  = blurred[(y-1)*W+x], tr = blurred[(y-1)*W+(x+1)];
      const ml = blurred[    y*W+(x-1)],                           mr = blurred[    y*W+(x+1)];
      const bl = blurred[(y+1)*W+(x-1)], b  = blurred[(y+1)*W+x], br = blurred[(y+1)*W+(x+1)];
      const gx = -tl + tr - 2*ml + 2*mr - bl + br;
      const gy = -tl - 2*t - tr + bl + 2*b + br;
      mag[y*W+x] = Math.sqrt(gx*gx + gy*gy);
      // Quantise angle into 4 sectors (0°,45°,90°,135°)
      const a = (Math.atan2(Math.abs(gy), Math.abs(gx)) * 180 / Math.PI);
      angle[y*W+x] = a < 22.5 ? 0 : a < 67.5 ? 1 : a < 112.5 ? 2 : a < 157.5 ? 3 : 0;
    }
  }

  // ── 5. Non-maximum suppression ────────────────────────────────────────────
  const nms = new Float32Array(W * H);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const m = mag[y*W+x];
      let n1 = 0, n2 = 0;
      switch (angle[y*W+x]) {
        case 0: n1 = mag[y*W+(x-1)]; n2 = mag[y*W+(x+1)]; break;
        case 1: n1 = mag[(y-1)*W+(x+1)]; n2 = mag[(y+1)*W+(x-1)]; break;
        case 2: n1 = mag[(y-1)*W+x]; n2 = mag[(y+1)*W+x]; break;
        case 3: n1 = mag[(y-1)*W+(x-1)]; n2 = mag[(y+1)*W+(x+1)]; break;
      }
      nms[y*W+x] = (m >= n1 && m >= n2) ? m : 0;
    }
  }

  // ── 6. Hysteresis thresholding ────────────────────────────────────────────
  // Automatically compute thresholds from image statistics
  let maxMag = 0;
  for (let i = 0; i < W * H; i++) if (nms[i] > maxMag) maxMag = nms[i];
  const hiT = maxMag * 0.20; // 20% of max → strong edge
  const loT = maxMag * 0.08; // 8%  of max → weak edge

  const edgeMap = new Uint8Array(W * H); // 2=strong, 1=weak, 0=none
  for (let i = 0; i < W * H; i++) {
    if      (nms[i] >= hiT) edgeMap[i] = 2;
    else if (nms[i] >= loT) edgeMap[i] = 1;
  }
  // Promote weak pixels connected to strong ones
  const DIRS8 = [-W-1,-W,-W+1,-1,1,W-1,W,W+1];
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
  // Final binary edge: only strong
  const edges = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) edges[i] = edgeMap[i] === 2 ? 255 : 0;

  // ── 7. Contour tracing (8-connectivity, thickness suppression) ────────────
  const visited = new Uint8Array(W * H);
  const paths: { x: number; y: number }[][] = [];

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

            // Suppress perpendicular thickness
            if (dy === 0) { // horizontal step → suppress vertical band
              for (let d = -2; d <= 2; d++) {
                const sy = ny + d;
                if (sy >= 0 && sy < H) visited[sy * W + nx] = 1;
              }
            } else if (dx === 0) { // vertical step → suppress horizontal band
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
        break; // no unvisited neighbour
      }

      if (path.length >= 12) paths.push(path);
    }
  }

  // ── 8. Douglas-Peucker simplification (ε = 2.5 px) ───────────────────────
  const simplified = paths.map(p => simplifyRDP(p, 2.5));

  // ── 9. Orthogonal snapping (±12°) ─────────────────────────────────────────
  const SNAP_TAN = Math.tan(12 * Math.PI / 180); // ≈0.213
  const snapped = simplified.map(path => {
    if (path.length < 2) return path;
    const p = path.map(pt => ({ ...pt }));
    for (let i = 0; i < p.length - 1; i++) {
      const dx = p[i+1].x - p[i].x, dy = p[i+1].y - p[i].y;
      if (dx === 0 || dy === 0) continue;
      const adx = Math.abs(dx), ady = Math.abs(dy);
      if      (ady / adx < SNAP_TAN) p[i+1].y = p[i].y;  // nearly horizontal
      else if (adx / ady < SNAP_TAN) p[i+1].x = p[i].x;  // nearly vertical
    }
    return p;
  });

  // ── 10. Scale pixel coords → mm (fit to A1: 841×594 mm) ──────────────────
  const PAGE_W_MM = 841, PAGE_H_MM = 594;
  const scaleX = PAGE_W_MM / W;
  const scaleY = PAGE_H_MM / H;

  // ── 11. Emit R2000 DXF ───────────────────────────────────────────────────
  //   • HEADER with $ACADVER AC1015 (AutoCAD 2000) + $INSUNITS 4 (mm)
  //   • LAYERS section: "OUTLINE" (white, continuous, lw 0.25 mm)
  //   • ENTITIES: LWPOLYLINE per contour (compact, modern entity)
  //   • EOF

  const nl = '\n';
  let dxf = '';

  // HEADER
  dxf += `  0${nl}SECTION${nl}  2${nl}HEADER${nl}`;
  dxf += `  9${nl}$ACADVER${nl}  1${nl}AC1015${nl}`;   // R2000
  dxf += `  9${nl}$INSUNITS${nl} 70${nl}4${nl}`;       // mm
  dxf += `  9${nl}$EXTMIN${nl} 10${nl}0.0${nl} 20${nl}0.0${nl} 30${nl}0.0${nl}`;
  dxf += `  9${nl}$EXTMAX${nl} 10${nl}${PAGE_W_MM.toFixed(4)}${nl} 20${nl}${PAGE_H_MM.toFixed(4)}${nl} 30${nl}0.0${nl}`;
  dxf += `  0${nl}ENDSEC${nl}`;

  // TABLES (layer definition)
  dxf += `  0${nl}SECTION${nl}  2${nl}TABLES${nl}`;
  dxf += `  0${nl}TABLE${nl}  2${nl}LAYER${nl} 70${nl}1${nl}`;
  dxf += `  0${nl}LAYER${nl}  2${nl}OUTLINE${nl} 70${nl}0${nl} 62${nl}7${nl}  6${nl}Continuous${nl}370${nl}25${nl}`;
  dxf += `  0${nl}ENDTAB${nl}`;
  dxf += `  0${nl}ENDSEC${nl}`;

  // ENTITIES
  dxf += `  0${nl}SECTION${nl}  2${nl}ENTITIES${nl}`;

  let entityHandle = 256; // hex handles from 100 onward

  for (const path of snapped) {
    if (path.length < 2) continue;

    // Remove zero-length segments after snapping
    const pts: { x: number; y: number }[] = [path[0]];
    for (let i = 1; i < path.length; i++) {
      const prev = pts[pts.length - 1];
      if (path[i].x !== prev.x || path[i].y !== prev.y) pts.push(path[i]);
    }
    if (pts.length < 2) continue;

    const handle = (entityHandle++).toString(16).toUpperCase();
    const closed = 0; // open polyline

    dxf += `  0${nl}LWPOLYLINE${nl}`;
    dxf += `  5${nl}${handle}${nl}`;           // entity handle
    dxf += `100${nl}AcDbEntity${nl}`;
    dxf += `  8${nl}OUTLINE${nl}`;             // layer
    dxf += `100${nl}AcDbPolyline${nl}`;
    dxf += ` 90${nl}${pts.length}${nl}`;       // vertex count
    dxf += ` 70${nl}${closed}${nl}`;           // closed flag
    dxf += ` 43${nl}0.0${nl}`;                 // constant width

    for (const pt of pts) {
      const mx = (pt.x * scaleX).toFixed(4);
      const my = ((H - pt.y) * scaleY).toFixed(4); // flip Y → CAD coords
      dxf += ` 10${nl}${mx}${nl} 20${nl}${my}${nl}`;
    }
  }

  dxf += `  0${nl}ENDSEC${nl}  0${nl}EOF${nl}`;
  return dxf;
}

// Ramer-Douglas-Peucker simplification helpers
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

/**
 * Export image to DXF (CAD format) with native save dialog
 */
export async function exportImageToDXFWithDialog(
  url: string,
  name: string
): Promise<string | null> {
  const fileName = `${sanitize(name)}_${timestamp()}.dxf`;
  
  // Vectorize image to DXF string
  const dxfContent = await imageToDxfString(url);
  
  // Show save dialog
  const filePath = await save({
    defaultPath: fileName,
    filters: [
      { name: 'CAD Drawing Exchange Format (*.dxf)', extensions: ['dxf'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  
  if (!filePath) return null;
  
  // Save via Tauri
  const base64Data = btoa(unescape(encodeURIComponent(dxfContent)));
  const dataUri = `data:application/octet-stream;base64,${base64Data}`;
  await invoke('save_image_to_path', { path: filePath, dataUri });
  
  return filePath;
}

/**
 * Save DXF file from the local server to a chosen path
 */
export async function saveDXFFromServer(
  dxfUrl: string,
  name: string
): Promise<string | null> {
  const fileName = `${sanitize(name)}_${timestamp()}.dxf`;
  
  // Show save dialog
  const filePath = await save({
    defaultPath: fileName,
    filters: [
      { name: 'CAD Drawing Exchange Format (*.dxf)', extensions: ['dxf'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  
  if (!filePath) return null;
  
  // Fetch file from the server
  const response = await fetch(dxfUrl);
  if (!response.ok) throw new Error('Failed to download DXF from server');
  const dxfBuffer = await response.arrayBuffer();
  
  // Convert ArrayBuffer to Base64
  let binary = '';
  const bytes = new Uint8Array(dxfBuffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64Data = btoa(binary);
  const dataUri = `data:application/octet-stream;base64,${base64Data}`;
  
  // Save via Tauri native command
  await invoke('save_image_to_path', { path: filePath, dataUri });
  
  return filePath;
}

/** Strip runtime callbacks from node data */
function stripCallbacks(data: Record<string, any>): Record<string, any> {
  const {
    onAddChild, onImageUpload, onImagesUpload, onDelete, onExecute, onRetry,
    ...rest
  } = data;
  return rest;
}

// ── Re-export for compatibility ───────────────────────────────────────────────

export { PROGRAM_IDENTITY };
