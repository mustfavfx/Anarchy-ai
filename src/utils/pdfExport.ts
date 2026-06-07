import jsPDF from 'jspdf';
import { logger } from './logger';
import { getLocalImage } from '../services/history/HistoryService';

export interface PDFExportOptions {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  includeMetadata?: boolean;
  imageQuality?: number;
  margins?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

type Margins = { top: number; right: number; bottom: number; left: number };
type ImageItem = { url: string; name?: string; prompt?: string };
type PageDims = { pageWidth: number; pageHeight: number; contentWidth: number; contentHeight: number };

async function loadImage(url: string): Promise<HTMLImageElement> {
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

function calcFit(img: HTMLImageElement, dims: PageDims): { w: number; h: number } {
  const ar = img.width / img.height;
  let w = dims.contentWidth;
  let h = w / ar;
  if (h > dims.contentHeight) { h = dims.contentHeight; w = h * ar; }
  return { w, h };
}

function addPromptToPDF(
  pdf: jsPDF, prompt: string, textY: number,
  dims: PageDims, margins: Margins
): void {
  if (textY > dims.pageHeight - margins.bottom - 20) pdf.addPage();
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100);
  const lines = pdf.splitTextToSize(prompt, dims.contentWidth);
  pdf.text(lines, margins.left, textY + 10);
}

async function addImagePage(
  pdf: jsPDF, imageData: ImageItem, index: number,
  dims: PageDims, margins: Margins, includeMetadata: boolean
): Promise<void> {
  if (index > 0) pdf.addPage();
  try {
    const img = await loadImage(imageData.url);
    const { w, h } = calcFit(img, dims);
    const x = (dims.pageWidth - w) / 2;
    const y = margins.top + 20;
    if (imageData.name) {
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text(imageData.name, dims.pageWidth / 2, margins.top, { align: 'center' });
    }
    pdf.addImage(img, 'JPEG', x, y, w, h, undefined, 'MEDIUM');
    if (includeMetadata && imageData.prompt) {
      addPromptToPDF(pdf, imageData.prompt, y + h + 10, dims, margins);
    }
  } catch (error) {
    logger.error(`Failed to process image ${index}:`, error);
    pdf.setFontSize(12);
    pdf.setTextColor(255, 0, 0);
    pdf.text(`Failed to load image: ${imageData.name || 'Unknown'}`, margins.left, margins.top + 30);
  }
}

export async function exportImagesToPDF(
  images: ImageItem[],
  options: PDFExportOptions = {}
): Promise<void> {
  const {
    title = 'Anarchy AI Export',
    author = 'Anarchy AI',
    subject = 'AI Generated Images',
    keywords = 'AI, Image Generation, Anarchy AI',
    includeMetadata = true,
    margins = { top: 20, right: 20, bottom: 20, left: 20 }
  } = options;

  try {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    pdf.setProperties({ title, author, subject, keywords, creator: 'Anarchy AI' });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const dims: PageDims = {
      pageWidth, pageHeight,
      contentWidth: pageWidth - margins.left - margins.right,
      contentHeight: pageHeight - margins.top - margins.bottom,
    };

    for (let i = 0; i < images.length; i++) {
      await addImagePage(pdf, images[i], i, dims, margins, includeMetadata);
    }

    const filename = `${title.replaceAll(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(filename);
  } catch (error) {
    logger.error('PDF export failed:', error);
    throw new Error('Failed to export PDF');
  }
}

export async function exportNodeImagesToPDF(
  nodes: any[],
  options: PDFExportOptions = {}
): Promise<void> {
  const images = nodes
    .filter(node => {
      const data = node.data;
      return data.image || data.outputData?.image;
    })
    .map(node => {
      const data = node.data;
      return {
        url: data.image || data.outputData?.image,
        name: `${data.type}_${node.id}`,
        prompt: data.prompt
      };
    });

  if (images.length === 0) {
    throw new Error('No images found to export');
  }

  await exportImagesToPDF(images, options);
}
