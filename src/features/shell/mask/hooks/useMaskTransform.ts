import React, { useState, useRef, useCallback } from 'react';

export interface UseMaskTransformOptions {
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  maskTool: string;
}

export function useMaskTransform(options: UseMaskTransformOptions) {
  const { wrapperRef, maskTool } = options;
  const [zoomScale, setZoomScale] = useState(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isSpacebarDown, setIsSpacebarDown] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLElement>) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1.15 : 0.87;
      const newZoom = Math.max(0.2, Math.min(6, zoomScale * delta));
      if (wrapperRef.current) {
        const rect = wrapperRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left - rect.width / 2;
        const mouseY = e.clientY - rect.top - rect.height / 2;
        const ratio = newZoom / zoomScale;
        const newPanX = mouseX - (mouseX - panOffset.x) * ratio;
        const newPanY = mouseY - (mouseY - panOffset.y) * ratio;
        setPanOffset({ x: newPanX, y: newPanY });
      }
      setZoomScale(newZoom);
    },
    [zoomScale, panOffset, wrapperRef]
  );

  const startPan = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (isSpacebarDown || e.button === 1 || maskTool === 'hand' || (maskTool === 'select' && e.altKey)) {
        e.preventDefault();
        setIsPanning(true);
        panStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
        return true;
      }
      return false;
    },
    [isSpacebarDown, maskTool, panOffset]
  );

  const onPanMove = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (isPanning) {
        e.preventDefault();
        setPanOffset({
          x: e.clientX - panStartRef.current.x,
          y: e.clientY - panStartRef.current.y,
        });
        return true;
      }
      return false;
    },
    [isPanning]
  );

  const endPan = useCallback(() => {
    if (isPanning) {
      setIsPanning(false);
      return true;
    }
    return false;
  }, [isPanning]);

  const resetTransform = useCallback(() => {
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  return {
    zoomScale,
    setZoomScale,
    panOffset,
    setPanOffset,
    isSpacebarDown,
    setIsSpacebarDown,
    isPanning,
    setIsPanning,
    handleWheel,
    startPan,
    onPanMove,
    endPan,
    resetTransform,
  };
}
