import { useCallback, useRef, useState, type RefObject } from 'react';

export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type CropHandle = 'tl' | 'tr' | 'bl' | 'br' | 't' | 'b' | 'l' | 'r' | 'move' | 'new' | 'new-drag' | null;

interface CropDragState {
  handle: CropHandle;
  startX: number; // css px, relative to wrapper
  startY: number;
  origRect: CropRect;
}

const MIN_SIZE = 20;
const HANDLE_HIT_RADIUS = 15;

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export function useCropTool(params: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  wrapperRef: RefObject<HTMLDivElement | null>;
  resolvedImage: string | null | undefined;
  onCrop?: (croppedDataUrl: string) => void;
  onApplied?: () => void;
}) {
  const { canvasRef, wrapperRef, resolvedImage, onCrop, onApplied } = params;
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const cropDragRef = useRef<CropDragState | null>(null);

  const initCropRect = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.width;
    const h = canvas.height;
    setCropRect({
      x: Math.round(w * 0.05),
      y: Math.round(h * 0.05),
      w: Math.round(w * 0.9),
      h: Math.round(h * 0.9),
    });
  }, [canvasRef]);

  const clearCropRect = useCallback(() => setCropRect(null), []);

  const getCropCssRect = useCallback((): CropRect | null => {
    const canvas = canvasRef.current;
    if (!canvas || !cropRect) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / canvas.width;
    const scaleY = rect.height / canvas.height;
    return {
      x: canvas.offsetLeft + cropRect.x * scaleX,
      y: canvas.offsetTop + cropRect.y * scaleY,
      w: cropRect.w * scaleX,
      h: cropRect.h * scaleY,
    };
  }, [canvasRef, cropRect]);

  const hitHandle = useCallback(
    (cssX: number, cssY: number): CropHandle => {
      const cr = getCropCssRect();
      if (!cr) return null;
      const R = HANDLE_HIT_RADIUS;

      const corners: Array<[CropHandle, number, number]> = [
        ['tl', cr.x, cr.y],
        ['tr', cr.x + cr.w, cr.y],
        ['bl', cr.x, cr.y + cr.h],
        ['br', cr.x + cr.w, cr.y + cr.h],
      ];
      for (const [h, hx, hy] of corners) {
        if (Math.abs(cssX - hx) <= R && Math.abs(cssY - hy) <= R) return h;
      }

      const edges: Array<[CropHandle, number, number]> = [
        ['t', cr.x + cr.w / 2, cr.y],
        ['b', cr.x + cr.w / 2, cr.y + cr.h],
        ['l', cr.x, cr.y + cr.h / 2],
        ['r', cr.x + cr.w, cr.y + cr.h / 2],
      ];
      for (const [h, hx, hy] of edges) {
        if (Math.abs(cssX - hx) <= R && Math.abs(cssY - hy) <= R) return h;
      }

      if (cssX >= cr.x && cssX <= cr.x + cr.w && cssY >= cr.y && cssY <= cr.y + cr.h) return 'move';
      return null;
    },
    [getCropCssRect]
  );

  const onCropWrapperDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const wrapper = wrapperRef.current;
      const canvas = canvasRef.current;
      if (!wrapper || !canvas) return;
      const wr = wrapper.getBoundingClientRect();
      const cssX = e.clientX - wr.left;
      const cssY = e.clientY - wr.top;

      if (cropRect) {
        const handle = hitHandle(cssX, cssY);
        if (handle) {
          cropDragRef.current = { handle, startX: cssX, startY: cssY, origRect: { ...cropRect } };
          return;
        }
      }

      // Click-drag start (no box yet, or clicked outside the existing box):
      // stash the canvas-space start point so a plain click doesn't immediately
      // collapse into a zero-size box.
      const cr = canvas.getBoundingClientRect();
      const scaleX = canvas.width / cr.width;
      const scaleY = canvas.height / cr.height;
      const cx = (e.clientX - cr.left) * scaleX;
      const cy = (e.clientY - cr.top) * scaleY;
      cropDragRef.current = { handle: 'new', startX: cssX, startY: cssY, origRect: { x: cx, y: cy, w: 0, h: 0 } };
    },
    [canvasRef, cropRect, hitHandle, wrapperRef]
  );

  const onCropWrapperMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const drag = cropDragRef.current;
      if (!drag) return;
      const wrapper = wrapperRef.current;
      const canvas = canvasRef.current;
      if (!wrapper || !canvas) return;

      // Measure once per move event and reuse everywhere below — the original
      // code re-queried getBoundingClientRect() a second time inside the
      // 'new'/'new-drag' branches, forcing an extra layout read on every
      // mousemove while dragging out a fresh crop box.
      const wr = wrapper.getBoundingClientRect();
      const cr = canvas.getBoundingClientRect();
      const scaleX = canvas.width / cr.width;
      const scaleY = canvas.height / cr.height;

      const cssX = e.clientX - wr.left;
      const cssY = e.clientY - wr.top;
      const canvasX = clamp((e.clientX - cr.left) * scaleX, 0, canvas.width);
      const canvasY = clamp((e.clientY - cr.top) * scaleY, 0, canvas.height);

      const dx = (cssX - drag.startX) * scaleX;
      const dy = (cssY - drag.startY) * scaleY;
      const orig = drag.origRect;
      const cw = canvas.width;
      const ch = canvas.height;

      if (drag.handle === 'new') {
        if (Math.abs(cssX - drag.startX) > 10 || Math.abs(cssY - drag.startY) > 10) {
          // Convert the drag's start point (stored in wrapper-relative css px)
          // to canvas pixel space using the single measurement taken above —
          // the original re-called getBoundingClientRect() here to do the
          // same conversion a second time.
          const startCanvasX = clamp((drag.startX - (cr.left - wr.left)) * scaleX, 0, cw);
          const startCanvasY = clamp((drag.startY - (cr.top - wr.top)) * scaleY, 0, ch);

          const x = Math.min(startCanvasX, canvasX);
          const y = Math.min(startCanvasY, canvasY);
          const w = Math.abs(canvasX - startCanvasX);
          const h = Math.abs(canvasY - startCanvasY);

          cropDragRef.current = { handle: 'new-drag', startX: drag.startX, startY: drag.startY, origRect: { x, y, w, h } };
          setCropRect({ x, y, w, h });
        }
        return;
      }

      if (drag.handle === 'new-drag') {
        const startCanvasX = clamp((drag.startX - (cr.left - wr.left)) * scaleX, 0, cw);
        const startCanvasY = clamp((drag.startY - (cr.top - wr.top)) * scaleY, 0, ch);

        const x = clamp(Math.min(startCanvasX, canvasX), 0, cw);
        const y = clamp(Math.min(startCanvasY, canvasY), 0, ch);
        const w = clamp(Math.abs(canvasX - startCanvasX), MIN_SIZE, cw - x);
        const h = clamp(Math.abs(canvasY - startCanvasY), MIN_SIZE, ch - y);
        setCropRect({ x, y, w, h });
        return;
      }

      switch (drag.handle) {
        case 'move':
          setCropRect({
            ...orig,
            x: clamp(orig.x + dx, 0, cw - orig.w),
            y: clamp(orig.y + dy, 0, ch - orig.h),
          });
          return;
        case 'br': {
          const newW = dx;
          const newH = dy;
          const newX = newW < 0 ? orig.x + newW : orig.x;
          const newY = newH < 0 ? orig.y + newH : orig.y;
          setCropRect({
            x: clamp(newX, 0, cw),
            y: clamp(newY, 0, ch),
            w: clamp(Math.abs(newW), MIN_SIZE, cw - newX),
            h: clamp(Math.abs(newH), MIN_SIZE, ch - newY),
          });
          return;
        }
        case 'tl': {
          const nx = clamp(orig.x + dx, 0, orig.x + orig.w - MIN_SIZE);
          const ny = clamp(orig.y + dy, 0, orig.y + orig.h - MIN_SIZE);
          setCropRect({ x: nx, y: ny, w: orig.w - (nx - orig.x), h: orig.h - (ny - orig.y) });
          return;
        }
        case 'tr': {
          const ny = clamp(orig.y + dy, 0, orig.y + orig.h - MIN_SIZE);
          const nw = clamp(orig.w + dx, MIN_SIZE, cw - orig.x);
          setCropRect({ x: orig.x, y: ny, w: nw, h: orig.h - (ny - orig.y) });
          return;
        }
        case 'bl': {
          const nx = clamp(orig.x + dx, 0, orig.x + orig.w - MIN_SIZE);
          const nh = clamp(orig.h + dy, MIN_SIZE, ch - orig.y);
          setCropRect({ x: nx, y: orig.y, w: orig.w - (nx - orig.x), h: nh });
          return;
        }
        case 't': {
          const ny = clamp(orig.y + dy, 0, orig.y + orig.h - MIN_SIZE);
          setCropRect({ ...orig, y: ny, h: orig.h - (ny - orig.y) });
          return;
        }
        case 'b': {
          const nh = clamp(orig.h + dy, MIN_SIZE, ch - orig.y);
          setCropRect({ ...orig, h: nh });
          return;
        }
        case 'l': {
          const nx = clamp(orig.x + dx, 0, orig.x + orig.w - MIN_SIZE);
          setCropRect({ ...orig, x: nx, w: orig.w - (nx - orig.x) });
          return;
        }
        case 'r': {
          const nw = clamp(orig.w + dx, MIN_SIZE, cw - orig.x);
          setCropRect({ ...orig, w: nw });
          return;
        }
        default:
          return;
      }
    },
    [canvasRef, wrapperRef]
  );

  const onCropWrapperUp = useCallback(() => {
    cropDragRef.current = null;
  }, []);

  const applyCrop = useCallback(() => {
    if (!cropRect || !resolvedImage) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const img = new Image();
    img.onload = () => {
      const { x, y, w, h } = cropRect;
      const scaleX = img.naturalWidth / canvas.width;
      const scaleY = img.naturalHeight / canvas.height;
      const offscreen = document.createElement('canvas');
      offscreen.width = Math.round(w * scaleX);
      offscreen.height = Math.round(h * scaleY);
      const ctx = offscreen.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(
        img,
        Math.round(x * scaleX),
        Math.round(y * scaleY),
        offscreen.width,
        offscreen.height,
        0,
        0,
        offscreen.width,
        offscreen.height
      );
      const dataUrl = offscreen.toDataURL('image/png');
      onCrop?.(dataUrl);
      setCropRect(null);
      onApplied?.();
    };
    img.onerror = () => {
      // The original silently did nothing here on a load failure — surface
      // it so a broken/blocked image source doesn't look like a no-op crop.
      console.error('[useCropTool] Failed to load source image for cropping.');
    };
    img.src = resolvedImage;
  }, [canvasRef, cropRect, onApplied, onCrop, resolvedImage]);

  return {
    cropRect,
    initCropRect,
    clearCropRect,
    getCropCssRect,
    onCropWrapperDown,
    onCropWrapperMove,
    onCropWrapperUp,
    applyCrop,
  };
}
