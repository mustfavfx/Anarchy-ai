/**
 * Export Service
 * Enhanced export functionality with native save dialogs
 * Exports images, PDFs, and project files with program identity
 */

import { invoke } from '@tauri-apps/api/core';
import { save, open } from '@tauri-apps/plugin-dialog';
import type { Node, Edge } from '@xyflow/react';
import jsPDF from 'jspdf';


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

export interface DxfCalibration {
  /** Real-world millimeters per pixel, measured at the image's natural (original) resolution. */
  mmPerPixel: number;
}

// ── Program Identity ─────────────────────────────────────────────────────────

const PROGRAM_IDENTITY = {
  name: 'Anarchy AI',
  version: '0.2.1',
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

  // Handle idb:// URLs (IndexedDB local cache)
  if (url.startsWith('idb://')) {
    try {
      const { getLocalImage } = await import('../history/HistoryService');
      const cached = await getLocalImage(url);
      if (cached) {
        url = cached;
      }
    } catch (err) {
      console.warn('[urlToDataUri] Failed to resolve idb image:', err);
    }
  }

  // Handle blob URLs directly via fetch & FileReader to avoid CORS/security blocks
  if (url.startsWith('blob:')) {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const dataUri = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      return dataUri;
    } catch (err) {
      console.warn('[urlToDataUri] Failed to read blob URL:', err);
    }
  }

  // Try Tauri Rust command to bypass CORS for remote images
  try {
    const dataUri = await invoke<string>('url_to_base64', { url });
    if (dataUri?.startsWith('data:')) return dataUri;
  } catch (err) {
    console.warn('[urlToDataUri] Tauri url_to_base64 failed, falling back to browser:', err);
  }
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!url.startsWith('blob:') && !url.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
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
  
  // Show open directory dialog (once!)
  const selectedDir = await open({
    directory: true,
    multiple: false,
    title: 'Select Export Directory'
  });
  
  if (!selectedDir || typeof selectedDir !== 'string') {
    return { succeeded, failed, paths }; // User cancelled or invalid
  }
  
  const format = options.format ?? 'jpg';
  const quality = options.quality ?? 0.92;
  const separator = selectedDir.includes('\\') ? '\\' : '/';
  
  for (const item of items) {
    try {
      // Convert to data URI
      const dataUri = await urlToDataUri(item.url, format, quality);
      
      // Determine file extension
      let ext = format === 'jpg' ? 'jpg' : format;
      if (dataUri.startsWith('data:video/')) {
        const mime = dataUri.split(';')[0].split(':')[1];
        if (mime === 'video/mp4') ext = 'mp4';
        else if (mime === 'video/webm') ext = 'webm';
        else if (mime === 'video/quicktime' || mime === 'video/mov') ext = 'mov';
        else ext = 'mp4';
      }
      
      const fileName = `${sanitize(item.name)}_${timestamp()}.${ext}`;
      const filePath = `${selectedDir}${separator}${fileName}`;
      
      // Extract base64 data
      const base64Data = dataUri.split(',')[1];
      if (!base64Data) throw new Error('Invalid data URI');
      
      // Save via Tauri
      await invoke('save_file', { 
        path: filePath, 
        contents: base64Data,
        binary: true 
      });
      
      succeeded++;
      paths.push(filePath);
      
      // Small delay between saves
      await new Promise(r => setTimeout(r, 50));
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
    try {
      const { getLocalImage } = await import('../history/HistoryService');
      const cached = await getLocalImage(url);
      if (cached) resolvedUrl = cached;
    } catch (err) {
      console.error('[ExportService] Failed to load local image dynamically:', err);
    }
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
 *   5. Circle / Arc fitting
 *   6. Douglas-Peucker simplification
 *   7. Orthogonal snapping (15° tolerance)
 *   8. Layer-aware output (WALLS/SYMBOLS/DETAILS)
 *   9. Emit R2010 DXF
 */
async function imageToDxfString(
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

/** Algebraic (Kasa) least-squares circle fit. Returns null if points are near-collinear. */
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
  if (Math.abs(det3) < 1e-6) return null; // collinear / degenerate

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
  name: string,
  calibration?: DxfCalibration
): Promise<string | null> {
  const fileName = `${sanitize(name)}_${timestamp()}.dxf`;
  
  // Vectorize image to DXF string
  const dxfContent = await imageToDxfString(url, calibration);
  
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
  const rest = { ...data };
  delete rest.onAddChild;
  delete rest.onImageUpload;
  delete rest.onImagesUpload;
  delete rest.onDelete;
  delete rest.onExecute;
  delete rest.onRetry;
  return rest;
}

// ── Re-export for compatibility ───────────────────────────────────────────────

export { PROGRAM_IDENTITY };
