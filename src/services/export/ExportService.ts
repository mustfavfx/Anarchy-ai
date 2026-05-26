/**
 * Export Service
 * Enhanced export functionality with native save dialogs
 * Exports images, PDFs, and project files with program identity
 */

import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
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
async function urlToDataUri(url: string, format: 'png' | 'jpg' | 'webp' = 'jpg', quality: number = 0.92): Promise<string> {
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
export async function exportNodesToPDFWithDialog(
  nodes: Node[],
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

  // Get images from nodes
  const images: ExportImageItem[] = [];
  for (const node of nodes) {
    const data = node.data as any;
    const url = data?.image || data?.outputData?.image;
    if (url) {
      images.push({
        url,
        name: `${data?.type || 'node'}_${node.id}`,
        prompt: data?.prompt
      });
    }
  }

  if (images.length === 0) {
    throw new Error('No images found to export');
  }

  // Create PDF
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Set metadata
  pdf.setProperties({
    title,
    author,
    subject,
    keywords,
    creator: PROGRAM_IDENTITY.name
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margins.left - margins.right;
  const contentHeight = pageHeight - margins.top - margins.bottom;

  // Process each image
  for (let i = 0; i < images.length; i++) {
    const imageData = images[i];
    
    if (i > 0) pdf.addPage();

    try {
      // Load and add image
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageData.url;
      });

      const aspectRatio = img.width / img.height;
      let finalWidth = contentWidth;
      let finalHeight = finalWidth / aspectRatio;

      if (finalHeight > contentHeight) {
        finalHeight = contentHeight;
        finalWidth = finalHeight * aspectRatio;
      }

      const x = (pageWidth - finalWidth) / 2;
      const y = margins.top + 20;

      // Add title
      if (imageData.name) {
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.text(imageData.name, pageWidth / 2, margins.top, { align: 'center' });
      }

      pdf.addImage(img, 'JPEG', x, y, finalWidth, finalHeight, undefined, 'MEDIUM');

      // Add metadata
      if (includeMetadata && imageData.prompt) {
        const textY = y + finalHeight + 10;
        if (textY > pageHeight - margins.bottom - 20) pdf.addPage();

        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(100);
        const lines = pdf.splitTextToSize(imageData.prompt, contentWidth);
        pdf.text(lines, margins.left, textY + 10);
      }
    } catch (error) {
      console.error(`Failed to process image ${i}:`, error);
      pdf.setFontSize(12);
      pdf.setTextColor(255, 0, 0);
      pdf.text(`Failed to load image: ${imageData.name || 'Unknown'}`, margins.left, margins.top + 30);
    }
  }

  // Get PDF as base64
  const pdfBase64 = pdf.output('datauristring').split(',')[1];
  
  // Show save dialog
  const defaultName = `${sanitize(title)}_${timestamp()}.pdf`;
  const filePath = await save({
    defaultPath: defaultName,
    filters: [
      { name: 'PDF Document', extensions: ['pdf'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  
  if (!filePath) return null;
  
  // Save PDF via Tauri
  await invoke('save_file', { 
    path: filePath, 
    contents: pdfBase64,
    binary: true 
  });
  
  return filePath;
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
