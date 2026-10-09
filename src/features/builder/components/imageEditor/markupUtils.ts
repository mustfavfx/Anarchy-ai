import { loadImageElement } from '../../../../services/export/modules/imageExportUtils';

/**
 * Composites the base image with the SVG markup annotations onto a full-resolution canvas
 * and returns the resulting PNG data URL.
 */
export async function rasterizeMarkupToImage(
  imageUrl: string,
  svgElement: SVGSVGElement | null
): Promise<string> {
  const img = await loadImageElement(imageUrl);
  const canvas = document.createElement('canvas');
  const w = img.naturalWidth || img.width || 1024;
  const h = img.naturalHeight || img.height || 1024;
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d');
  if (!ctx) return imageUrl;

  // 1. Draw base image
  ctx.drawImage(img, 0, 0, w, h);

  if (!svgElement) {
    return canvas.toDataURL('image/png');
  }

  try {
    // 2. Clone SVG element for clean rasterization
    const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
    const clientW = svgElement.clientWidth || w;
    const clientH = svgElement.clientHeight || h;

    clonedSvg.setAttribute('width', String(w));
    clonedSvg.setAttribute('height', String(h));
    clonedSvg.setAttribute('viewBox', `0 0 ${clientW} ${clientH}`);

    // Remove any selection bounding boxes and cursor artifacts from output
    const selectionGroup = clonedSvg.querySelector('.markup-selection-box-group');
    if (selectionGroup) {
      selectionGroup.remove();
    }

    const svgString = new XMLSerializer().serializeToString(clonedSvg);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const URLObj = window.URL || window.webkitURL || window;
    const blobURL = URLObj.createObjectURL(svgBlob);

    return await new Promise<string>((resolve) => {
      const markupImg = new Image();
      markupImg.onload = () => {
        ctx.drawImage(markupImg, 0, 0, w, h);
        URLObj.revokeObjectURL(blobURL);
        resolve(canvas.toDataURL('image/png'));
      };
      markupImg.onerror = () => {
        URLObj.revokeObjectURL(blobURL);
        resolve(canvas.toDataURL('image/png'));
      };
      markupImg.src = blobURL;
    });
  } catch (err) {
    console.warn('Could not serialize SVG markup overlay:', err);
    return canvas.toDataURL('image/png');
  }
}
