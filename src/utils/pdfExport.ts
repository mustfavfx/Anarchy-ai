import jsPDF from 'jspdf';

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

export async function exportImagesToPDF(
  images: { url: string; name?: string; prompt?: string }[],
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
    // Create PDF document
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Set document metadata
    pdf.setProperties({
      title,
      author,
      subject,
      keywords,
      creator: 'Anarchy AI'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const contentWidth = pageWidth - margins.left - margins.right;
    const contentHeight = pageHeight - margins.top - margins.bottom;

    // Process each image
    for (let i = 0; i < images.length; i++) {
      const imageData = images[i];
      
      // Add new page for each image (except first one)
      if (i > 0) {
        pdf.addPage();
      }

      try {
        // Load image
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = imageData.url;
        });

        // Calculate image dimensions to fit page
        const imgWidth = img.width;
        const imgHeight = img.height;
        const aspectRatio = imgWidth / imgHeight;

        let finalWidth = contentWidth;
        let finalHeight = finalWidth / aspectRatio;

        // If image is too tall, limit by height
        if (finalHeight > contentHeight) {
          finalHeight = contentHeight;
          finalWidth = finalHeight * aspectRatio;
        }

        // Center image on page
        const x = (pageWidth - finalWidth) / 2;
        const y = margins.top + 20; // Add some space for title

        // Add image name as title
        if (imageData.name) {
          pdf.setFontSize(16);
          pdf.setFont('helvetica', 'bold');
          pdf.text(imageData.name, pageWidth / 2, margins.top, { align: 'center' });
        }

        // Add image to PDF
        pdf.addImage(img, 'JPEG', x, y, finalWidth, finalHeight, undefined, 'MEDIUM');

        // Add metadata if requested
        if (includeMetadata && imageData.prompt) {
          const textY = y + finalHeight + 10;
          
          // Check if we need a new page for metadata
          if (textY > pageHeight - margins.bottom - 20) {
            pdf.addPage();
          }

          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(100);
          
          // Split long prompts into multiple lines
          const lines = pdf.splitTextToSize(imageData.prompt, contentWidth);
          pdf.text(lines, margins.left, textY + 10);
        }

      } catch (error) {
        console.error(`Failed to process image ${i}:`, error);
        
        // Add error message to PDF
        pdf.setFontSize(12);
        pdf.setTextColor(255, 0, 0);
        pdf.text(`Failed to load image: ${imageData.name || 'Unknown'}`, margins.left, margins.top + 30);
      }
    }

    // Save PDF
    const filename = `${title.replaceAll(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(filename);

  } catch (error) {
    console.error('PDF export failed:', error);
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
