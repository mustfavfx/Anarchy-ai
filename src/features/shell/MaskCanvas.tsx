import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Brush, Eraser, Scissors, Trash2, RotateCcw, RotateCw, Download, Crop, Check, X } from 'lucide-react';
import { useResolvedImage } from '../../hooks';
import './MaskCanvas.css';

interface CropRect { x: number; y: number; w: number; h: number; }
type CropHandle = 'tl' | 'tr' | 'bl' | 'br' | 't' | 'b' | 'l' | 'r' | 'move' | 'new' | null;

export interface MaskCanvasProps {
  image: string | null;
  onMaskChange?: (maskDataUrl: string | null) => void;
  onGenerate?: (maskDataUrl: string, prompt: string) => void;
  onCrop?: (croppedDataUrl: string) => void;
  showGenerateButton?: boolean;
  className?: string;
}

export const MaskCanvas: React.FC<MaskCanvasProps> = ({
  image,
  onMaskChange,
  onGenerate,
  onCrop,
  showGenerateButton = false,
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  
  const resolvedImage = useResolvedImage(image);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [maskTool, setMaskTool] = useState<'brush' | 'eraser' | 'lasso' | 'crop'>('brush');

  // ── Crop state ─────────────────────────────────────────────────────────────
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const cropDragRef = useRef<{ handle: CropHandle; startX: number; startY: number; origRect: CropRect } | null>(null);
  const [brushSize, setBrushSize] = useState(30);
  const [maskOpacity, setMaskOpacity] = useState(0.55);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [showBrushCursor, setShowBrushCursor] = useState(false);
  const [maskPrompt, setMaskPrompt] = useState('');
  const [imgMeta, setImgMeta] = useState<{ w: number; h: number } | null>(null);
  
  const historyRef = useRef<ImageData[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const lassoPointsRef = useRef<{ x: number; y: number }[]>([]);

  // Sync canvas size to wrapper
  const syncCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper || !imgMeta) return;
    
    const { w, h } = imgMeta;
    const ww = wrapper.clientWidth;
    const wh = wrapper.clientHeight;
    const scale = Math.min(ww / w, wh / h);
    const cw = Math.round(w * scale);
    const ch = Math.round(h * scale);
    
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
      canvas.style.width = `${cw}px`;
      canvas.style.height = `${ch}px`;
    }
    
    // Center canvas within wrapper
    canvas.style.left = `${(wrapper.clientWidth - cw) / 2}px`;
    canvas.style.top = `${(wrapper.clientHeight - ch) / 2}px`;
  }, [imgMeta]);

  useEffect(() => {
    if (!image) return;
    syncCanvasSize();
    const obs = new ResizeObserver(syncCanvasSize);
    if (wrapperRef.current) obs.observe(wrapperRef.current);
    return () => obs.disconnect();
  }, [syncCanvasSize, image]);

  // Initialize default crop rect when crop tool is selected
  useEffect(() => {
    if (maskTool === 'crop' && canvasRef.current) {
      const canvas = canvasRef.current;
      const w = canvas.width;
      const h = canvas.height;
      setCropRect({
        x: Math.round(w * 0.05),
        y: Math.round(h * 0.05),
        w: Math.round(w * 0.9),
        h: Math.round(h * 0.9)
      });
    } else {
      setCropRect(null);
    }
  }, [maskTool]);

  // History management
  const updateHistoryButtons = useCallback(() => {
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  }, []);

  const pushHistory = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    }
    historyRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    historyIndexRef.current = historyRef.current.length - 1;
    updateHistoryButtons();
    
    // Notify parent of mask change
    if (onMaskChange) {
      const maskData = canvas.toDataURL('image/png');
      onMaskChange(maskData);
    }
  }, [onMaskChange, updateHistoryButtons]);

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current--;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const state = historyRef.current[historyIndexRef.current];
    if (state) ctx.putImageData(state, 0, 0);
    updateHistoryButtons();
  }, [updateHistoryButtons]);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current++;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const state = historyRef.current[historyIndexRef.current];
    if (state) ctx.putImageData(state, 0, 0);
    updateHistoryButtons();
  }, [updateHistoryButtons]);

  const clearMask = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pushHistory();
  }, [pushHistory]);

  const exportMask = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const link = document.createElement('a');
    link.download = `mask_${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, []);

  // ── Crop helpers ────────────────────────────────────────────────────────────
  const getCropCssRect = useCallback((): CropRect | null => {
    const canvas = canvasRef.current;
    if (!canvas || !cropRect) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / canvas.width;
    const scaleY = rect.height / canvas.height;
    return {
      x: canvas.offsetLeft + cropRect.x * scaleX,
      y: canvas.offsetTop  + cropRect.y * scaleY,
      w: cropRect.w * scaleX,
      h: cropRect.h * scaleY,
    };
  }, [cropRect]);

  const hitHandle = useCallback((cssX: number, cssY: number): CropHandle => {
    const cr = getCropCssRect();
    if (!cr) return null;
    const R = 15; // hover target tolerance radius
    
    // Corners
    const corners: Array<[CropHandle, number, number]> = [
      ['tl', cr.x,        cr.y],
      ['tr', cr.x + cr.w, cr.y],
      ['bl', cr.x,        cr.y + cr.h],
      ['br', cr.x + cr.w, cr.y + cr.h],
    ];
    for (const [h, hx, hy] of corners) {
      if (Math.abs(cssX - hx) <= R && Math.abs(cssY - hy) <= R) return h;
    }

    // Edges
    const edges: Array<[CropHandle, number, number]> = [
      ['t', cr.x + cr.w / 2, cr.y],
      ['b', cr.x + cr.w / 2, cr.y + cr.h],
      ['l', cr.x,            cr.y + cr.h / 2],
      ['r', cr.x + cr.w,     cr.y + cr.h / 2],
    ];
    for (const [h, hx, hy] of edges) {
      if (Math.abs(cssX - hx) <= R && Math.abs(cssY - hy) <= R) return h;
    }

    // Move
    if (cssX >= cr.x && cssX <= cr.x + cr.w && cssY >= cr.y && cssY <= cr.y + cr.h) return 'move';
    return null;
  }, [getCropCssRect]);

  const applyCrop = useCallback(() => {
    if (!cropRect || !resolvedImage) return;
    const img = new Image();
    img.onload = () => {
      const { x, y, w, h } = cropRect;
      const canvas = canvasRef.current;
      if (!canvas) return;
      // Scale crop rect from canvas display coords → natural image coords
      const scaleX = img.naturalWidth  / canvas.width;
      const scaleY = img.naturalHeight / canvas.height;
      const offscreen = document.createElement('canvas');
      offscreen.width  = Math.round(w * scaleX);
      offscreen.height = Math.round(h * scaleY);
      const ctx = offscreen.getContext('2d')!;
      ctx.drawImage(img, Math.round(x * scaleX), Math.round(y * scaleY),
        offscreen.width, offscreen.height, 0, 0, offscreen.width, offscreen.height);
      const dataUrl = offscreen.toDataURL('image/png');
      onCrop?.(dataUrl);
      setCropRect(null);
      setMaskTool('brush');
    };
    img.src = resolvedImage;
  }, [cropRect, resolvedImage, onCrop]);

  const cancelCrop = useCallback(() => {
    setCropRect(null);
    setMaskTool('brush');
  }, []);

  // ── Crop mouse handlers on wrapper ─────────────────────────────────────────
  const onCropWrapperDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (maskTool !== 'crop') return;
    const wrapper = wrapperRef.current;
    const canvas  = canvasRef.current;
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

    // Safe click-drag start to prevent immediate box destruction on simple clicks
    const cr = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / cr.width;
    const scaleY = canvas.height / cr.height;
    const cx = (e.clientX - cr.left) * scaleX;
    const cy = (e.clientY - cr.top)  * scaleY;
    cropDragRef.current = { handle: 'new', startX: cssX, startY: cssY, origRect: { x: cx, y: cy, w: 0, h: 0 } };
  }, [maskTool, cropRect, hitHandle]);

  const onCropWrapperMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (maskTool !== 'crop' || !cropDragRef.current) return;
    const wrapper = wrapperRef.current;
    const canvas  = canvasRef.current;
    if (!wrapper || !canvas) return;
    const wr = wrapper.getBoundingClientRect();
    const cr = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / cr.width;
    const scaleY = canvas.height / cr.height;
    const cssX = e.clientX - wr.left;
    const cssY = e.clientY - wr.top;
    const dx = (cssX - cropDragRef.current.startX) * scaleX;
    const dy = (cssY - cropDragRef.current.startY) * scaleY;
    const orig = cropDragRef.current.origRect;
    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

    setCropRect(prev => {
      if (!prev) return prev;
      const cw = canvas.width;
      const ch = canvas.height;
      const MIN_SIZE = 20;

      if (cropDragRef.current?.handle === 'new') {
        const startX = cropDragRef.current.startX;
        const startY = cropDragRef.current.startY;
        if (Math.abs(cssX - startX) > 5 || Math.abs(cssY - startY) > 5) {
          cropDragRef.current.handle = 'br';
          return { x: orig.x, y: orig.y, w: 1, h: 1 };
        }
        return prev;
      }

      switch (cropDragRef.current?.handle) {
        case 'move':
          return {
            ...orig,
            x: clamp(orig.x + dx, 0, cw - orig.w),
            y: clamp(orig.y + dy, 0, ch - orig.h)
          };
        case 'br': {
          const newW = dx;
          const newH = dy;
          const newX = newW < 0 ? orig.x + newW : orig.x;
          const newY = newH < 0 ? orig.y + newH : orig.y;
          return {
            x: clamp(newX, 0, cw),
            y: clamp(newY, 0, ch),
            w: clamp(Math.abs(newW), MIN_SIZE, cw - newX),
            h: clamp(Math.abs(newH), MIN_SIZE, ch - newY)
          };
        }
        case 'tl': {
          const nx = clamp(orig.x + dx, 0, orig.x + orig.w - MIN_SIZE);
          const ny = clamp(orig.y + dy, 0, orig.y + orig.h - MIN_SIZE);
          return { x: nx, y: ny, w: orig.w - (nx - orig.x), h: orig.h - (ny - orig.y) };
        }
        case 'tr': {
          const ny = clamp(orig.y + dy, 0, orig.y + orig.h - MIN_SIZE);
          const nw = clamp(orig.w + dx, MIN_SIZE, cw - orig.x);
          return { x: orig.x, y: ny, w: nw, h: orig.h - (ny - orig.y) };
        }
        case 'bl': {
          const nx = clamp(orig.x + dx, 0, orig.x + orig.w - MIN_SIZE);
          const nh = clamp(orig.h + dy, MIN_SIZE, ch - orig.y);
          return { x: nx, y: orig.y, w: orig.w - (nx - orig.x), h: nh };
        }
        case 't': {
          const ny = clamp(orig.y + dy, 0, orig.y + orig.h - MIN_SIZE);
          return { ...orig, y: ny, h: orig.h - (ny - orig.y) };
        }
        case 'b': {
          const nh = clamp(orig.h + dy, MIN_SIZE, ch - orig.y);
          return { ...orig, h: nh };
        }
        case 'l': {
          const nx = clamp(orig.x + dx, 0, orig.x + orig.w - MIN_SIZE);
          return { ...orig, x: nx, w: orig.w - (nx - orig.x) };
        }
        case 'r': {
          const nw = clamp(orig.w + dx, MIN_SIZE, cw - orig.x);
          return { ...orig, w: nw };
        }
        default: return prev;
      }
    });
  }, [maskTool]);

  const onCropWrapperUp = useCallback(() => {
    cropDragRef.current = null;
  }, []);

  // Drawing helpers - clamp to canvas bounds
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const rawX = (e.clientX - rect.left) * scaleX;
    const rawY = (e.clientY - rect.top) * scaleY;
    // Clamp to canvas bounds [0, width/height]
    return {
      x: Math.max(0, Math.min(canvas.width, rawX)),
      y: Math.max(0, Math.min(canvas.height, rawY)),
    };
  };

  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const pt = getCanvasCoords(e);
    if (!pt) return;

    if (maskTool === 'lasso') {
      lassoPointsRef.current = [pt];
      setIsDrawing(true);
      return;
    }

    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.globalCompositeOperation = maskTool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, brushSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(225,29,72,${maskOpacity})`;
    ctx.fill();
    lastPointRef.current = pt;
    setIsDrawing(true);
  }, [brushSize, maskTool, maskOpacity]);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = getCanvasCoords(e);
    if (!pt) return;
    
    // Update cursor position (in canvas coordinates, not CSS pixels)
    setCursorPos({ x: pt.x, y: pt.y });

    if (!isDrawing) return;

    if (maskTool === 'lasso') {
      lassoPointsRef.current.push(pt);
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        const pts = lassoPointsRef.current;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.strokeStyle = `rgba(225,29,72,${maskOpacity})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.restore();
      }
      return;
    }

    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.globalCompositeOperation = maskTool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = `rgba(225,29,72,${maskOpacity})`;

    if (lastPointRef.current) {
      ctx.beginPath();
      ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
      ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
    }
    lastPointRef.current = pt;
  }, [isDrawing, maskTool, brushSize, maskOpacity]);

  const stopDrawing = useCallback(() => {
    if (isDrawing && maskTool === 'lasso') {
      const ctx = canvasRef.current?.getContext('2d');
      const pts = lassoPointsRef.current;
      if (ctx && pts.length > 2) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.closePath();
        ctx.fillStyle = `rgba(225,29,72,${maskOpacity})`;
        ctx.fill();
        ctx.restore();
      }
      lassoPointsRef.current = [];
      pushHistory();
    } else if (isDrawing) {
      pushHistory();
    }
    lastPointRef.current = null;
    setIsDrawing(false);
  }, [isDrawing, maskTool, maskOpacity, pushHistory]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === 'b' || e.key === 'B') setMaskTool('brush');
      if (e.key === 'e' || e.key === 'E') setMaskTool('eraser');
      if (e.key === 'l' || e.key === 'L') setMaskTool('lasso');
      if (e.key === 'c' || e.key === 'C') setMaskTool('crop');
      if (e.key === 'Escape') { setCropRect(null); if (maskTool === 'crop') setMaskTool('brush'); }
      if (e.key === 'Enter' && maskTool === 'crop' && cropRect) applyCrop();
      if (e.key.toLowerCase() === 's' && e.ctrlKey) {
        if (maskTool === 'crop' && cropRect) {
          e.preventDefault();
          e.stopPropagation();
          applyCrop();
        }
      }
      if ((e.key === 'z' || e.key === 'Z') && e.ctrlKey) {
        if (e.shiftKey) { redo(); } else { undo(); }
      }
    };
    globalThis.addEventListener('keydown', onKey);
    return () => globalThis.removeEventListener('keydown', onKey);
  }, [undo, redo, maskTool, cropRect, applyCrop]);

  // Initialize history
  useEffect(() => {
    if (image && historyRef.current.length === 0 && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        historyRef.current = [ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height)];
        historyIndexRef.current = 0;
      }
    }
  }, [image]);

  const handleGenerate = () => {
    const canvas = canvasRef.current;
    if (!canvas || !maskPrompt.trim() || !onGenerate) return;
    const maskData = canvas.toDataURL('image/png');
    onGenerate(maskData, maskPrompt);
  };

  if (!image) {
    return (
      <div className={`mask-canvas-empty ${className}`}>
        <span>No image selected</span>
        <small>Select an image to start masking</small>
      </div>
    );
  }

  return (
    <div className={`mask-canvas-container ${className}`}>
      {/* Toolbar */}
      <div className="mask-canvas-toolbar">
        <div className="mask-canvas-tools">
          <button
            className={`mask-canvas-tool ${maskTool === 'brush' ? 'active' : ''}`}
            onClick={() => setMaskTool('brush')}
            title="Brush (B)"
          >
            <Brush size={16} />
          </button>
          <button
            className={`mask-canvas-tool ${maskTool === 'eraser' ? 'active' : ''}`}
            onClick={() => setMaskTool('eraser')}
            title="Eraser (E)"
          >
            <Eraser size={16} />
          </button>
          <button
            className={`mask-canvas-tool ${maskTool === 'lasso' ? 'active' : ''}`}
            onClick={() => setMaskTool('lasso')}
            title="Lasso (L)"
          >
            <Scissors size={16} />
          </button>
          <button
            className={`mask-canvas-tool ${maskTool === 'crop' ? 'active' : ''}`}
            onClick={() => { setMaskTool('crop'); setCropRect(null); }}
            title="Crop (C)"
          >
            <Crop size={16} />
          </button>
        </div>

        <div className="mask-canvas-divider" />

        <div className="mask-canvas-controls">
          <div className="mask-canvas-control">
            <span className="mask-canvas-label">Size</span>
            <input
              type="range"
              min={5}
              max={100}
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="mask-canvas-slider"
            />
            <span className="mask-canvas-value">{brushSize}</span>
          </div>
          <div className="mask-canvas-control">
            <span className="mask-canvas-label">Opacity</span>
            <input
              type="range"
              min={10}
              max={100}
              value={Math.round(maskOpacity * 100)}
              onChange={(e) => setMaskOpacity(Number(e.target.value) / 100)}
              className="mask-canvas-slider"
            />
            <span className="mask-canvas-value">{Math.round(maskOpacity * 100)}%</span>
          </div>
        </div>

        <div className="mask-canvas-divider" />

        <div className="mask-canvas-actions">
          <button
            className="mask-canvas-action"
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
          >
            <RotateCcw size={14} />
          </button>
          <button
            className="mask-canvas-action"
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
          >
            <RotateCw size={14} />
          </button>
          <button
            className="mask-canvas-action clear"
            onClick={clearMask}
            title="Clear"
          >
            <Trash2 size={14} />
          </button>
          <button
            className="mask-canvas-action"
            onClick={exportMask}
            title="Export Mask"
          >
            <Download size={14} />
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div
        className="mask-canvas-wrapper"
        ref={wrapperRef}
        onMouseDown={maskTool === 'crop' ? onCropWrapperDown : undefined}
        onMouseMove={maskTool === 'crop' ? onCropWrapperMove : undefined}
        onMouseUp={maskTool === 'crop' ? onCropWrapperUp : undefined}
        onMouseLeave={maskTool === 'crop' ? onCropWrapperUp : undefined}
      >
        <img
          src={resolvedImage || image || ''}
          alt="Base"
          className="mask-canvas-base-image"
          onLoad={(e) => setImgMeta({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
        />
        <canvas
          ref={canvasRef}
          className="mask-canvas-draw"
          onMouseDown={maskTool !== 'crop' ? startDrawing : undefined}
          onMouseMove={maskTool !== 'crop' ? draw : undefined}
          onMouseUp={maskTool !== 'crop' ? stopDrawing : undefined}
          onMouseLeave={maskTool !== 'crop' ? () => { stopDrawing(); setShowBrushCursor(false); } : undefined}
          onMouseEnter={maskTool !== 'crop' ? () => setShowBrushCursor(true) : undefined}
          style={{ cursor: maskTool === 'crop' ? 'crosshair' : maskTool === 'brush' ? 'none' : 'crosshair', pointerEvents: maskTool === 'crop' ? 'none' : 'all' }}
        />
        {/* Crop overlay */}
        {maskTool === 'crop' && cropRect && (() => {
          const cr = getCropCssRect();
          if (!cr) return null;
          return (
            <>
              {/* Dark overlay outside crop */}
              <div className="crop-overlay crop-overlay-top"    style={{ top: 0, left: 0, right: 0, height: cr.y }} />
              <div className="crop-overlay crop-overlay-bottom" style={{ top: cr.y + cr.h, left: 0, right: 0, bottom: 0 }} />
              <div className="crop-overlay crop-overlay-left"  style={{ top: cr.y, left: 0, width: cr.x, height: cr.h }} />
              <div className="crop-overlay crop-overlay-right" style={{ top: cr.y, left: cr.x + cr.w, right: 0, height: cr.h }} />
              {/* Crop border */}
              <div className="crop-border" style={{ left: cr.x, top: cr.y, width: cr.w, height: cr.h }}>
                {/* Rule-of-thirds grid */}
                <div className="crop-grid-line crop-grid-h" style={{ top: '33.33%' }} />
                <div className="crop-grid-line crop-grid-h" style={{ top: '66.66%' }} />
                <div className="crop-grid-line crop-grid-v" style={{ left: '33.33%' }} />
                <div className="crop-grid-line crop-grid-v" style={{ left: '66.66%' }} />
                {/* Corner handles */}
                <div className="crop-handle crop-handle-tl" />
                <div className="crop-handle crop-handle-tr" />
                <div className="crop-handle crop-handle-bl" />
                <div className="crop-handle crop-handle-br" />
                {/* Edge handles */}
                <div className="crop-handle crop-handle-t" />
                <div className="crop-handle crop-handle-b" />
                <div className="crop-handle crop-handle-l" />
                <div className="crop-handle crop-handle-r" />
              </div>
              {/* Action buttons */}
              <div className="crop-actions" style={{ left: cr.x + cr.w, top: Math.max(cr.y - 40, 4) }}>
                <button className="crop-btn crop-btn-apply" onClick={applyCrop} title="Apply crop (Enter)">
                  <Check size={13} /> Apply
                </button>
                <button className="crop-btn crop-btn-cancel" onClick={cancelCrop} title="Cancel (Esc)">
                  <X size={13} />
                </button>
              </div>
            </>
          );
        })()}

        {showBrushCursor && maskTool === 'brush' && cursorPos && (() => {
          const canvas = canvasRef.current;
          if (!canvas) return null;
          const rect = canvas.getBoundingClientRect();
          // Convert canvas coordinates back to CSS pixels for display
          const cssX = (cursorPos.x / canvas.width) * rect.width + canvas.offsetLeft;
          const cssY = (cursorPos.y / canvas.height) * rect.height + canvas.offsetTop;
          // Scale brush size to CSS pixels
          const cssBrushSize = (brushSize / canvas.width) * rect.width;
          return (
            <div
              className="mask-canvas-cursor"
              style={{ left: cssX, top: cssY, width: cssBrushSize, height: cssBrushSize }}
            />
          );
        })()}
      </div>

      {/* Generate Section (optional) */}
      {showGenerateButton && (
        <div className="mask-canvas-generate">
          <input
            type="text"
            placeholder="Enter prompt for masked generation..."
            className="mask-canvas-prompt"
            value={maskPrompt}
            onChange={(e) => setMaskPrompt(e.target.value)}
          />
          <button
            className="mask-canvas-generate-btn"
            onClick={handleGenerate}
            disabled={!maskPrompt.trim()}
          >
            Generate
          </button>
        </div>
      )}

      {/* Hint */}
      <div className="mask-canvas-hint">
        {maskTool === 'crop' ? (
          <><span>🔲 Drag to select crop area</span><span>⌨️ Enter=Apply, Esc=Cancel</span></>
        ) : (
          <><span>🖱️ Drag to draw mask</span><span>⌨️ B=Brush E=Eraser L=Lasso C=Crop</span><span>⌨️ Ctrl+Z=Undo</span></>
        )}
      </div>
    </div>
  );
};

export default MaskCanvas;
