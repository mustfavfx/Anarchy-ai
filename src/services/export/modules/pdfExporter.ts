import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import type { Node } from '@xyflow/react';
import jsPDF from 'jspdf';
import {
  sanitize,
  timestamp,
  PROGRAM_IDENTITY,
  type ExportImageItem,
  type PDFExportOptions
} from './exportTypes';
import { extractImagesFromNodes, loadImageElement } from './imageExportUtils';

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
