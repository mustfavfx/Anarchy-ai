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
type ImageItem = { url: string; name?: string; prompt?: string; model?: string; date?: string };
type PageDims = { pageWidth: number; pageHeight: number; contentWidth: number; contentHeight: number };

async function loadImage(url: string): Promise<HTMLImageElement> {
  let resolvedUrl = url;
  if (url && url.startsWith('idb://')) {
    const cached = await getLocalImage(url);
    if (cached) resolvedUrl = cached;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      // Fallback: try fetching as Blob -> Data URL if direct assignment fails
      fetch(resolvedUrl)
        .then(r => r.blob())
        .then(blob => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const fallbackImg = new Image();
            fallbackImg.onload = () => resolve(fallbackImg);
            fallbackImg.onerror = () => reject(new Error('Image decode failed'));
            fallbackImg.src = reader.result as string;
          };
          reader.readAsDataURL(blob);
        })
        .catch(reject);
    };
    img.src = resolvedUrl;
  });
}

function calcFit(img: HTMLImageElement, maxWidth: number, maxHeight: number): { w: number; h: number } {
  const ar = (img.naturalWidth || img.width) / (img.naturalHeight || img.height || 1);
  let w = maxWidth;
  let h = w / ar;
  if (h > maxHeight) {
    h = maxHeight;
    w = h * ar;
  }
  return { w, h };
}

async function addImagePage(
  pdf: jsPDF, 
  imageData: ImageItem, 
  index: number,
  total: number,
  dims: PageDims, 
  margins: Margins, 
  includeMetadata: boolean,
  docTitle: string
): Promise<void> {
  if (index > 0) pdf.addPage();

  // Dark header banner
  pdf.setFillColor(18, 18, 22);
  pdf.rect(0, 0, dims.pageWidth, 16, 'F');

  // Red accent line
  pdf.setFillColor(225, 29, 72);
  pdf.rect(0, 16, dims.pageWidth, 1, 'F');

  // Header Title
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(255, 255, 255);
  pdf.text(docTitle.toUpperCase(), margins.left, 11);

  // Header Brand
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(251, 113, 133);
  pdf.text('ANARCHY AI', dims.pageWidth - margins.right, 11, { align: 'right' });

  // Page Footer
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(140, 140, 150);
  pdf.text(`Page ${index + 1} of ${total}`, dims.pageWidth / 2, dims.pageHeight - 8, { align: 'center' });

  const maxImageHeight = includeMetadata && imageData.prompt ? dims.contentHeight - 45 : dims.contentHeight - 20;

  try {
    const img = await loadImage(imageData.url);
    const { w, h } = calcFit(img, dims.contentWidth, maxImageHeight);
    const x = (dims.pageWidth - w) / 2;
    const y = margins.top + 5;

    // Render image
    pdf.addImage(img, 'JPEG', x, y, w, h, undefined, 'FAST');

    // Render metadata card below image
    if (includeMetadata && imageData.prompt) {
      const cardY = y + h + 6;
      const cardHeight = dims.pageHeight - margins.bottom - cardY - 6;

      if (cardHeight > 15) {
        // Prompt background card
        pdf.setFillColor(245, 245, 248);
        pdf.roundedRect(margins.left, cardY, dims.contentWidth, cardHeight, 3, 3, 'F');

        // Prompt Label
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8.5);
        pdf.setTextColor(80, 80, 95);
        pdf.text('PROMPT', margins.left + 5, cardY + 6);

        // Prompt text
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(30, 30, 40);
        const maxLines = Math.floor((cardHeight - 10) / 4);
        const lines = pdf.splitTextToSize(imageData.prompt, dims.contentWidth - 10);
        const displayedLines = lines.slice(0, Math.max(1, maxLines));
        pdf.text(displayedLines, margins.left + 5, cardY + 12);
      }
    }
  } catch (error) {
    logger.error(`Failed to render image ${index}:`, error);
    pdf.setFontSize(12);
    pdf.setTextColor(225, 29, 72);
    pdf.text(`Image ${index + 1}: ${imageData.name || 'Unavailable'}`, margins.left, margins.top + 30);
  }
}

export async function exportImagesToPDF(
  images: ImageItem[],
  options: PDFExportOptions = {}
): Promise<string | null> {
  const {
    title = 'Anarchy AI History Portfolio',
    author = 'Anarchy AI',
    subject = 'AI Generated Images',
    keywords = 'AI, Architecture, Design, Anarchy AI',
    includeMetadata = true,
    margins = { top: 22, right: 16, bottom: 16, left: 16 }
  } = options;

  if (!images || images.length === 0) return null;

  try {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    pdf.setProperties({ title, author, subject, keywords, creator: 'Anarchy AI' });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const dims: PageDims = {
      pageWidth, 
      pageHeight,
      contentWidth: pageWidth - margins.left - margins.right,
      contentHeight: pageHeight - margins.top - margins.bottom,
    };

    for (let i = 0; i < images.length; i++) {
      await addImagePage(pdf, images[i], i, images.length, dims, margins, includeMetadata, title);
    }

    const safeTitle = title.replaceAll(/[^a-zA-Z0-9]/g, '_');
    const defaultFilename = `${safeTitle}_${new Date().toISOString().split('T')[0]}.pdf`;
    const pdfDataUri = pdf.output('datauristring');

    // Attempt Native Tauri Dialog Save
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { invoke } = await import('@tauri-apps/api/core');
      const filePath = await save({
        defaultPath: defaultFilename,
        filters: [{ name: 'PDF Document', extensions: ['pdf'] }]
      });

      if (filePath) {
        await invoke('save_image_to_path', { path: filePath, dataUri: pdfDataUri });
        return filePath;
      }
      return null;
    } catch {
      // Browser fallback
      pdf.save(defaultFilename);
      return defaultFilename;
    }
  } catch (error) {
    logger.error('PDF export failed:', error);
    throw new Error('Failed to export PDF');
  }
}

export async function exportNodeImagesToPDF(
  nodes: any[],
  options: PDFExportOptions = {}
): Promise<string | null> {
  const images = nodes
    .filter(node => {
      const data = node?.data || {};
      return data?.image || data?.outputData?.image;
    })
    .map(node => {
      const data = node?.data || {};
      return {
        url: data?.image || data?.outputData?.image,
        name: `${data?.type || 'node'}_${node?.id}`,
        prompt: data?.prompt
      };
    });

  return exportImagesToPDF(images, options);
}
