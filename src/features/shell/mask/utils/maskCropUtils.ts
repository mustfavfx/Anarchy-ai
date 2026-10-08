import type { InpaintLayer } from '../../components/LayersPanel';
import type { CropResultDetails } from '../../hooks/useCropTool';

export interface ApplyCropParams {
  croppedDataUrl: string;
  details?: CropResultDetails;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  drawingCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  inpaintLayers: InpaintLayer[];
  setInpaintLayers: React.Dispatch<React.SetStateAction<InpaintLayer[]>>;
  setCurrentCanvasImage: React.Dispatch<React.SetStateAction<string | null>>;
  setBaseOriginalImage: React.Dispatch<React.SetStateAction<string | null>>;
  setImgMeta: React.Dispatch<React.SetStateAction<{ w: number; h: number } | null>>;
  isCroppingRef: React.MutableRefObject<boolean>;
  updateMaskPreview: () => void;
  pushHistory: () => void;
  onCrop?: (dataUrl: string) => void;
}

export async function executeMaskCrop({
  croppedDataUrl,
  details,
  canvasRef,
  drawingCanvasRef,
  inpaintLayers,
  setInpaintLayers,
  setCurrentCanvasImage,
  setBaseOriginalImage,
  setImgMeta,
  isCroppingRef,
  updateMaskPreview,
  pushHistory,
  onCrop,
}: ApplyCropParams): Promise<void> {
  if (!details) {
    setCurrentCanvasImage(croppedDataUrl);
    setBaseOriginalImage(croppedDataUrl);
    onCrop?.(croppedDataUrl);
    return;
  }

  const { cropRect, canvasWidth, canvasHeight, croppedNaturalWidth, croppedNaturalHeight } = details;

  isCroppingRef.current = true;

  // 1. Crop inpaint mask on canvasRef (the user-drawn red inpaint stencil)
  const maskCanvas = canvasRef.current;
  let croppedMaskDataUrl: string | null = null;
  if (maskCanvas && maskCanvas.width > 0 && maskCanvas.height > 0) {
    const mOff = document.createElement('canvas');
    mOff.width = Math.max(1, Math.round(cropRect.w));
    mOff.height = Math.max(1, Math.round(cropRect.h));
    const mCtx = mOff.getContext('2d');
    if (mCtx) {
      mCtx.drawImage(
        maskCanvas,
        cropRect.x, cropRect.y, cropRect.w, cropRect.h,
        0, 0, mOff.width, mOff.height
      );
      croppedMaskDataUrl = mOff.toDataURL('image/png');
    }
  }

  // 2. Crop drawing ink layer on drawingCanvasRef
  const drawingCanvas = drawingCanvasRef.current;
  let croppedDrawingDataUrl: string | null = null;
  if (drawingCanvas && drawingCanvas.width > 0 && drawingCanvas.height > 0) {
    const dOff = document.createElement('canvas');
    dOff.width = Math.max(1, Math.round(cropRect.w));
    dOff.height = Math.max(1, Math.round(cropRect.h));
    const dCtx = dOff.getContext('2d');
    if (dCtx) {
      dCtx.drawImage(
        drawingCanvas,
        cropRect.x, cropRect.y, cropRect.w, cropRect.h,
        0, 0, dOff.width, dOff.height
      );
      croppedDrawingDataUrl = dOff.toDataURL('image/png');
    }
  }

  // 3. Crop all layers in inpaintLayers stack to match the exact same crop viewport
  if (inpaintLayers.length > 0) {
    const normX = cropRect.x / canvasWidth;
    const normY = cropRect.y / canvasHeight;
    const normW = cropRect.w / canvasWidth;
    const normH = cropRect.h / canvasHeight;

    const cropLayerSrc = (src: string): Promise<string> => {
      return new Promise((resolve) => {
        const lImg = new Image();
        lImg.crossOrigin = 'anonymous';
        lImg.onload = () => {
          const lCanvas = document.createElement('canvas');
          const nw = lImg.naturalWidth || lImg.width;
          const nh = lImg.naturalHeight || lImg.height;
          const lx = Math.round(normX * nw);
          const ly = Math.round(normY * nh);
          const lw = Math.max(1, Math.round(normW * nw));
          const lh = Math.max(1, Math.round(normH * nh));
          lCanvas.width = lw;
          lCanvas.height = lh;
          const lCtx = lCanvas.getContext('2d');
          if (lCtx) {
            lCtx.drawImage(lImg, lx, ly, lw, lh, 0, 0, lw, lh);
            resolve(lCanvas.toDataURL('image/png'));
          } else {
            resolve(src);
          }
        };
        lImg.onerror = () => resolve(src);
        lImg.src = src;
      });
    };

    const updatedLayers = await Promise.all(
      inpaintLayers.map(async (l) => {
        let updatedImg = l.image;
        let updatedMask = l.maskDataUrl;
        if (l.image) {
          updatedImg = await cropLayerSrc(l.image);
        }
        if (l.maskDataUrl) {
          updatedMask = await cropLayerSrc(l.maskDataUrl);
        }
        return {
          ...l,
          image: updatedImg,
          maskDataUrl: updatedMask,
        };
      })
    );
    setInpaintLayers(updatedLayers);
  }

  // 4. Update the base image and current canvas image in-place
  setCurrentCanvasImage(croppedDataUrl);
  setBaseOriginalImage(croppedDataUrl);

  // 5. Update imgMeta dimensions — forces syncCanvasSize() to calculate new aspect ratio & cw/ch
  setImgMeta({ w: croppedNaturalWidth, h: croppedNaturalHeight });

  // 6. Restore the cropped inpaint mask and drawing mask onto the newly-sized canvases
  setTimeout(() => {
    isCroppingRef.current = false;
    if (croppedMaskDataUrl && maskCanvas) {
      const maskImg = new Image();
      maskImg.onload = () => {
        const ctx = maskCanvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
          ctx.drawImage(maskImg, 0, 0, maskCanvas.width, maskCanvas.height);
          updateMaskPreview();
          pushHistory();
        }
      };
      maskImg.src = croppedMaskDataUrl;
    } else if (maskCanvas) {
      const ctx = maskCanvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
        updateMaskPreview();
        pushHistory();
      }
    }

    if (croppedDrawingDataUrl && drawingCanvas) {
      const drawImg = new Image();
      drawImg.onload = () => {
        const ctx = drawingCanvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
          ctx.drawImage(drawImg, 0, 0, drawingCanvas.width, drawingCanvas.height);
        }
      };
      drawImg.src = croppedDrawingDataUrl;
    }
  }, 60);

  // 7. Propagate to parent callback (and node in the canvas)
  onCrop?.(croppedDataUrl);
}
