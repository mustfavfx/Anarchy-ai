import { useState, useRef, useEffect, useCallback } from 'react';
import { SmartSegmentationEngine } from '../../../../services/mask/SmartSegmentationEngine';
import { logger } from '../../../../utils/logger';

interface UseSmartSegmentationProps {
  resolvedImage: string | null;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

export function useSmartSegmentation({
  resolvedImage,
  canvasRef,
}: UseSmartSegmentationProps) {
  const baseImgDataRef = useRef<ImageData | null>(null);
  const [smartHoverContour, setSmartHoverContour] = useState<{ x: number; y: number }[] | null>(null);
  const [smartHoverMask, setSmartHoverMask] = useState<Uint8Array | null>(null);
  const [wandTolerance, setWandTolerance] = useState<number>(40);
  const hoverThrottlerRef = useRef<number | null>(null);

  // Preload and cache ImageData for instantaneous Smart Auto-Segmentation (SAM)
  useEffect(() => {
    if (!resolvedImage) {
      baseImgDataRef.current = null;
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = resolvedImage;
    img.onload = () => {
      const offscreen = document.createElement('canvas');
      offscreen.width = img.naturalWidth || img.width;
      offscreen.height = img.naturalHeight || img.height;
      const ctx = offscreen.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        try {
          const idata = ctx.getImageData(0, 0, offscreen.width, offscreen.height);
          baseImgDataRef.current = idata;
          SmartSegmentationEngine.prepareImage(idata, resolvedImage);
        } catch (err) {
          logger.warn('Could not extract imageData for smart segmentation', err);
        }
      }
    };
  }, [resolvedImage]);

  // Real-time 60fps edge-guided hover segmentation
  const handleSmartHover = useCallback(
    (canvasX: number, canvasY: number) => {
      if (hoverThrottlerRef.current) return;
      hoverThrottlerRef.current = window.requestAnimationFrame(() => {
        hoverThrottlerRef.current = null;
        const imgData = baseImgDataRef.current;
        const canvas = canvasRef.current;
        if (!imgData || !resolvedImage || !canvas) return;

        const naturalScaleX = imgData.width / (canvas.width || imgData.width);
        const naturalScaleY = imgData.height / (canvas.height || imgData.height);
        const startX = canvasX * naturalScaleX;
        const startY = canvasY * naturalScaleY;

        const result = SmartSegmentationEngine.segment(
          imgData,
          resolvedImage,
          startX,
          startY,
          wandTolerance,
          45
        );

        if (result && result.contourPoints.length > 2) {
          const mappedContour = result.contourPoints.map((p: { x: number; y: number }) => ({
            x: p.x / naturalScaleX,
            y: p.y / naturalScaleY,
          }));
          setSmartHoverContour(mappedContour);
          setSmartHoverMask(result.mask);
        } else {
          setSmartHoverContour(null);
          setSmartHoverMask(null);
        }
      });
    },
    [resolvedImage, wandTolerance, canvasRef]
  );

  return {
    baseImgDataRef,
    smartHoverContour,
    smartHoverMask,
    wandTolerance,
    setWandTolerance,
    handleSmartHover,
  };
}
