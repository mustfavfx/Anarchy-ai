import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X, Download, Maximize2, Minimize2, Brush, Eraser, Scissors, Trash2, RotateCcw, RotateCw, Crop, Check } from 'lucide-react';
import { useAIConfigStore } from '../../stores/aiConfigStore';
import { downloadImage } from '../../utils/imageExport';
import { useResolvedImage } from '../../hooks';
import './EnlargedPreview.css';
import './MaskCanvas.css';

interface CropRect { x: number; y: number; w: number; h: number; }
type CropHandle = 'tl' | 'tr' | 'bl' | 'br' | 't' | 'b' | 'l' | 'r' | 'move' | 'new' | null;

// ─── EnlargedPreview ─────────────────────────────────────────────────────────
// Fills the main content area when isEnlargedView === true.
// Mirrors VizMaker's Enlarge mode: Preview / Compare / Draw tabs
// with real Zoom/Pan, ZoomPercent overlay, image dimensions, and FULL mask drawing.

export const EnlargedPreview: React.FC = () => {
  const selectedNode    = useAIConfigStore(s => s.selectedNode);
  const setSelectedNode = useAIConfigStore(s => s.setSelectedNode);
  const nodeImageUpdateFn = useAIConfigStore(s => s.nodeImageUpdateFn);
  const compareImages   = useAIConfigStore(s => s.compareImages);
  const setCompareImages = useAIConfigStore(s => s.setCompareImages);
  const setCompareSlot  = useAIConfigStore(s => s.setCompareSlot);
  const setIsEnlargedView = useAIConfigStore(s => s.setIsEnlargedView);

  const image = selectedNode?.image ?? null;
  const resolvedImage = useResolvedImage(image);
  const resolvedCompareA = useResolvedImage(compareImages.A);
  const resolvedCompareB = useResolvedImage(compareImages.B);
  const resolvedCompareImages = { A: resolvedCompareA, B: resolvedCompareB };

  const getSafeSrc = (resolved: string | null | undefined, raw: string | null | undefined) => {
    if (resolved && !resolved.startsWith('idb://')) return resolved;
    if (raw && !raw.startsWith('idb://')) return raw;
    return undefined;
  };

  const [tab, setTab]         = useState<'preview' | 'compare' | 'draw'>('preview');
  const [zoom, setZoom]         = useState(1);
  const [panX, setPanX]         = useState(0);
  const [panY, setPanY]         = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [compareSplit, setCompareSplit] = useState(50);
  const [imgMeta, setImgMeta]   = useState<{ w: number; h: number } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ── Mask/Draw mode state ───────────────────────────────────────────────────
  const canvasRef        = useRef<HTMLCanvasElement>(null);
  const wrapperRef       = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing]                 = useState(false);
  const [maskTool, setMaskTool]                   = useState<'brush' | 'eraser' | 'lasso' | 'crop'>('brush');
  const [cropRect, setCropRect]                   = useState<CropRect | null>(null);
  const cropDragRef = useRef<{ handle: CropHandle; startX: number; startY: number; origRect: CropRect } | null>(null);
  const [brushSize, setBrushSize]                 = useState(30);
  const [maskOpacity, setMaskOpacity]             = useState(0.55);
  const [cursorPos, setCursorPos]                 = useState<{ x: number; y: number } | null>(null);
  const [canUndo, setCanUndo]                     = useState(false);
  const [canRedo, setCanRedo]                     = useState(false);
  const [showBrushCursor, setShowBrushCursor]     = useState(false);
  
  const historyRef      = useRef<ImageData[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const lastPointRef    = useRef<{ x: number; y: number } | null>(null);
  const lassoPointsRef  = useRef<{ x: number; y: number }[]>([]);

  const panRef = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);

  // Reset zoom/pan when image changes
  useEffect(() => { setZoom(1); setPanX(0); setPanY(0); setImgMeta(null); }, [image]);

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

  // ── Mask: Sync canvas size to wrapper ─────────────────────────────────────
  const syncCanvasSize = useCallback(() => {
    const canvas  = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper || !imgMeta) return;
    const { w, h } = imgMeta;
    const ww = wrapper.clientWidth;
    const wh = wrapper.clientHeight;
    const scale = Math.min(ww / w, wh / h);
    const cw = Math.round(w * scale);
    const ch = Math.round(h * scale);
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width  = cw;
      canvas.height = ch;
      canvas.style.width  = `${cw}px`;
      canvas.style.height = `${ch}px`;
    }
    // Center canvas to match base image positioning
    canvas.style.left = `${(ww - cw) / 2}px`;
    canvas.style.top  = `${(wh - ch) / 2}px`;
  }, [imgMeta]);

  useEffect(() => {
    if (tab !== 'draw') return;
    syncCanvasSize();
    const obs = new ResizeObserver(syncCanvasSize);
    if (wrapperRef.current) obs.observe(wrapperRef.current);
    return () => obs.disconnect();
  }, [syncCanvasSize, tab]);

  // ── Mask: History management ────────────────────────────────────────────
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
  }, [updateHistoryButtons]);

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

  // ── Crop helpers ──────────────────────────────────────────────────────────
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
      const scaleX = img.naturalWidth  / canvas.width;
      const scaleY = img.naturalHeight / canvas.height;
      const off = document.createElement('canvas');
      off.width  = Math.round(w * scaleX);
      off.height = Math.round(h * scaleY);
      const ctx = off.getContext('2d')!;
      ctx.drawImage(img, Math.round(x * scaleX), Math.round(y * scaleY), off.width, off.height, 0, 0, off.width, off.height);
      const dataUrl = off.toDataURL('image/png');
      if (selectedNode) {
        setSelectedNode({ ...selectedNode, image: dataUrl });
        if (selectedNode.id) {
          nodeImageUpdateFn?.(selectedNode.id, dataUrl);
        }
      }
      setCropRect(null);
      setMaskTool('brush');
    };
    img.src = resolvedImage;
  }, [cropRect, resolvedImage, selectedNode, setSelectedNode, nodeImageUpdateFn]);

  const cancelCrop = useCallback(() => { setCropRect(null); setMaskTool('brush'); }, []);

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
      if (handle) { cropDragRef.current = { handle, startX: cssX, startY: cssY, origRect: { ...cropRect } }; return; }
    }
    const cr = canvas.getBoundingClientRect();
    const sx = canvas.width / cr.width;
    const sy = canvas.height / cr.height;
    const cx = (e.clientX - cr.left) * sx;
    const cy = (e.clientY - cr.top)  * sy;
    cropDragRef.current = { handle: 'new', startX: cssX, startY: cssY, origRect: { x: cx, y: cy, w: 0, h: 0 } };
  }, [maskTool, cropRect, hitHandle]);

  const onCropWrapperMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (maskTool !== 'crop' || !cropDragRef.current) return;
    const wrapper = wrapperRef.current;
    const canvas  = canvasRef.current;
    if (!wrapper || !canvas) return;
    const wr = wrapper.getBoundingClientRect();
    const cr = canvas.getBoundingClientRect();
    const scaleX = canvas.width / cr.width;
    const scaleY = canvas.height / cr.height;
    const cssX = e.clientX - wr.left;
    const cssY = e.clientY - wr.top;
    const dx = (cssX - cropDragRef.current.startX) * scaleX;
    const dy = (cssY - cropDragRef.current.startY) * scaleY;
    const orig = cropDragRef.current.origRect;
    const clamp = (v: number, mn: number, mx: number) => Math.max(mn, Math.min(mx, v));

    setCropRect(prev => {
      if (!prev) return prev;
      const cw = canvas.width; const ch = canvas.height;
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
        case 'move': return { ...orig, x: clamp(orig.x + dx, 0, cw - orig.w), y: clamp(orig.y + dy, 0, ch - orig.h) };
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
        case 'tl': { const nx = clamp(orig.x+dx,0,orig.x+orig.w-MIN_SIZE); const ny = clamp(orig.y+dy,0,orig.y+orig.h-MIN_SIZE); return { x:nx,y:ny,w:orig.w-(nx-orig.x),h:orig.h-(ny-orig.y) }; }
        case 'tr': { const ny = clamp(orig.y+dy,0,orig.y+orig.h-MIN_SIZE); const nw = clamp(orig.w+dx,MIN_SIZE,cw-orig.x); return { x:orig.x, y:ny, w:nw, h:orig.h-(ny-orig.y) }; }
        case 'bl': { const nx = clamp(orig.x+dx,0,orig.x+orig.w-MIN_SIZE); const nh = clamp(orig.h+dy,MIN_SIZE,ch-orig.y); return { x:nx, y:orig.y, w:orig.w-(nx-orig.x), h:nh }; }
        case 't': { const ny = clamp(orig.y+dy,0,orig.y+orig.h-MIN_SIZE); return { ...orig, y:ny, h:orig.h-(ny-orig.y) }; }
        case 'b': { const nh = clamp(orig.h+dy,MIN_SIZE,ch-orig.y); return { ...orig, h:nh }; }
        case 'l': { const nx = clamp(orig.x+dx,0,orig.x+orig.w-MIN_SIZE); return { ...orig, x:nx, w:orig.w-(nx-orig.x) }; }
        case 'r': { const nw = clamp(orig.w+dx,MIN_SIZE,cw-orig.x); return { ...orig, w:nw }; }
        default: return prev;
      }
    });
  }, [maskTool]);

  const onCropWrapperUp = useCallback(() => { cropDragRef.current = null; }, []);

  // ── Mask: Drawing helpers ────────────────────────────────────────────────
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
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
    
    // Update cursor position in canvas coordinates
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
    ctx.lineCap   = 'round';
    ctx.lineJoin  = 'round';
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
      const ctx  = canvasRef.current?.getContext('2d');
      const pts  = lassoPointsRef.current;
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

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === 'Escape') { if (isFullscreen) setIsFullscreen(false); else setIsEnlargedView(false); }
      if (tab === 'preview') {
        if (e.key === '+' || e.key === '=') setZoom(z => Math.min(10, z * 1.2));
        if (e.key === '-') setZoom(z => Math.max(0.05, z / 1.2));
        if (e.key === 'f' || e.key === 'F') { setZoom(1); setPanX(0); setPanY(0); }
      }
      if (tab === 'draw') {
        if (e.key === 'b' || e.key === 'B') setMaskTool('brush');
        if (e.key === 'e' || e.key === 'E') setMaskTool('eraser');
        if (e.key === 'l' || e.key === 'L') setMaskTool('lasso');
        if (e.key === 'c' || e.key === 'C') { setMaskTool('crop'); setCropRect(null); }
        if (e.key === 'Escape' && maskTool === 'crop') cancelCrop();
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
      }
    };
    globalThis.addEventListener('keydown', onKey);
    return () => globalThis.removeEventListener('keydown', onKey);
  }, [setIsEnlargedView, isFullscreen, tab, undo, redo, maskTool, cropRect, applyCrop, cancelCrop]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.min(10, Math.max(0.05, z * (e.deltaY < 0 ? 1.12 : 1 / 1.12))));
  }, []);

  const onPanStart = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    panRef.current = { mx: e.clientX, my: e.clientY, px: panX, py: panY };
    setIsPanning(true);
  }, [panX, panY]);

  const onPanMove = useCallback((e: React.MouseEvent) => {
    if (!panRef.current) return;
    setPanX(panRef.current.px + e.clientX - panRef.current.mx);
    setPanY(panRef.current.py + e.clientY - panRef.current.my);
  }, []);

  const onPanEnd = useCallback(() => { panRef.current = null; setIsPanning(false); }, []);

  const fit = useCallback(() => { setZoom(1); setPanX(0); setPanY(0); }, []);

  // Initialize history on first draw tab open
  useEffect(() => {
    if (tab === 'draw' && historyRef.current.length === 0 && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        historyRef.current = [ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height)];
        historyIndexRef.current = 0;
      }
    }
  }, [tab]);

  return (
    <div className="enlarged-preview">
      {/* ── Top bar ── */}
      <div className="ep-topbar">
        <div className="ep-tabs">
          {(['preview', 'compare', 'draw'] as const).map(t => (
            <button
              key={t}
              className={`ep-tab ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'draw' ? 'Mask' : t === 'compare' ? 'Compare' : 'Preview'}
            </button>
          ))}
        </div>

        <div className="ep-topbar-center">
          {image && tab === 'preview' && imgMeta && (
            <span className="ep-img-dims">{imgMeta.w} × {imgMeta.h}</span>
          )}
          {image && tab === 'preview' && (
            <div className="ep-zoom-group">
              <button className="ep-icon-btn" onClick={() => setZoom(z => Math.min(10, z * 1.25))} title="Zoom In (+)">+</button>
              <span className="ep-zoom-pct">{Math.round(zoom * 100)}%</span>
              <button className="ep-icon-btn" onClick={() => setZoom(z => Math.max(0.05, z / 1.25))} title="Zoom Out (−)">−</button>
              <button className="ep-icon-btn" onClick={fit} title="Fit to screen (F)">⊡</button>
            </div>
          )}
        </div>

        <div className="ep-topbar-actions">
          {selectedNode?.image && selectedNode?.originalImage && selectedNode.image !== selectedNode.originalImage && (
            <button
              className="ep-tab active"
              style={{
                height: '26px',
                padding: '0 10px',
                marginRight: '6px',
                background: 'rgba(225,29,72,0.15)',
                borderColor: 'rgba(225,29,72,0.3)',
                color: '#fecdd3',
                fontSize: '11px',
                fontWeight: 500,
                cursor: 'pointer',
                borderRadius: '4px',
                border: '1px solid rgba(225,29,72,0.3)'
              }}
              onClick={() => {
                if (selectedNode.id && selectedNode.originalImage) {
                  nodeImageUpdateFn?.(selectedNode.id, selectedNode.originalImage);
                  setSelectedNode({ ...selectedNode, image: selectedNode.originalImage });
                }
              }}
              title="Revert to original image"
            >
              Revert Image
            </button>
          )}
          {resolvedImage && (
            <button className="ep-icon-btn" onClick={() => setIsFullscreen(f => !f)} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
              {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
          )}
          {resolvedImage && (
            <button className="ep-icon-btn" onClick={() => downloadImage(resolvedImage, selectedNode?.type ?? 'image')} title="Download">
              <Download size={13} />
            </button>
          )}
          <button className="ep-icon-btn ep-close-btn" onClick={() => setIsEnlargedView(false)} title="Back to canvas (Esc)">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Fullscreen overlay */}
      {isFullscreen && image && (
        <div className="ep-fullscreen-overlay" onClick={() => setIsFullscreen(false)}>
          <img src={getSafeSrc(resolvedImage, image)} alt="Fullscreen" className="ep-fullscreen-img" onClick={e => e.stopPropagation()} />
          <button className="ep-fullscreen-close" onClick={() => setIsFullscreen(false)} title="Close (Esc)">
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Stage ── */}
      <div className="ep-stage">
        
        {/* PREVIEW tab */}
        {tab === 'preview' && (
          <div className={`ep-zoom-stage ${isPanning ? 'panning' : ''}`} onWheel={handleWheel} onMouseDown={onPanStart} onMouseMove={onPanMove} onMouseUp={onPanEnd} onMouseLeave={onPanEnd}>
            {image ? (
              <img src={getSafeSrc(resolvedImage, image)} alt="Preview" className="ep-zoom-img" draggable={false} style={{ transform: `translate(${panX}px,${panY}px) scale(${zoom})` }} onLoad={e => setImgMeta({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
            ) : (
              <div className="ep-empty"><span>No image selected</span><small>Click a node on the canvas</small></div>
            )}
          </div>
        )}

        {/* COMPARE tab */}
        {tab === 'compare' && (
          <div className="ep-compare">
            {compareImages.A && compareImages.B ? (
              <div className="ep-compare-active">
                <img src={getSafeSrc(resolvedCompareB, compareImages.B)} className="ep-compare-base" alt="B" />
                <div className="ep-compare-clip" style={{ clipPath: `inset(0 ${100 - compareSplit}% 0 0)` }}><img src={getSafeSrc(resolvedCompareA, compareImages.A)} alt="A" /></div>
                <div className="ep-compare-handle" style={{ left: `${compareSplit}%` }}><div className="ep-compare-line" /><div className="ep-compare-knob">⇄</div></div>
                <input type="range" min={0} max={100} value={compareSplit} onChange={e => setCompareSplit(Number(e.target.value))} className="ep-compare-slider" />
                <span className="ep-compare-label ep-label-a">A</span>
                <span className="ep-compare-label ep-label-b">B</span>
                <div className="ep-compare-toolbar">
                  <button className="ep-icon-btn" onClick={() => setCompareImages({ A: compareImages.B, B: compareImages.A })} title="Swap">⇄</button>
                  <button className="ep-icon-btn" onClick={() => setCompareImages({ A: null, B: null })} title="Clear"><X size={11} /></button>
                </div>
              </div>
            ) : (
              <div className="ep-compare-slots">
                {(['A', 'B'] as const).map(slot => (
                  <div key={slot} className={`ep-compare-slot ${compareImages[slot] ? 'filled' : ''}`} onClick={() => { if (!compareImages[slot] && image) setCompareSlot(slot, image); }}>
                    {compareImages[slot] ? (<><img src={getSafeSrc(resolvedCompareImages[slot], compareImages[slot]) || ''} alt={slot} /><button className="ep-slot-clear" onClick={e => { e.stopPropagation(); setCompareImages(p => ({ ...p, [slot]: null })); }}><X size={12} /></button><span className="ep-slot-label">{slot}</span></>) : (<><span className="ep-slot-plus">+</span><span>Set as {slot}</span><small>{image ? 'Click to use selected node' : 'Select a node first'}</small></>)}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* DRAW/Mask tab - FULL IMPLEMENTATION */}
        {tab === 'draw' && (
          <div className="ep-draw-stage">
            {image ? (
              <>
                {/* Mask Toolbar */}
                <div className="ep-mask-toolbar">
                  <div className="ep-mask-tools">
                    <button className={`ep-mask-tool ${maskTool === 'brush' ? 'active' : ''}`} onClick={() => setMaskTool('brush')} title="Brush (B)"><Brush size={16} /></button>
                    <button className={`ep-mask-tool ${maskTool === 'eraser' ? 'active' : ''}`} onClick={() => setMaskTool('eraser')} title="Eraser (E)"><Eraser size={16} /></button>
                    <button className={`ep-mask-tool ${maskTool === 'lasso' ? 'active' : ''}`} onClick={() => setMaskTool('lasso')} title="Lasso (L)"><Scissors size={16} /></button>
                    <button className={`ep-mask-tool ep-mask-tool-crop ${maskTool === 'crop' ? 'active' : ''}`} onClick={() => { setMaskTool('crop'); setCropRect(null); }} title="Crop (C)"><Crop size={16} /></button>
                  </div>
                  
                  <div className="ep-mask-divider" />
                  
                  <div className="ep-mask-controls">
                    <div className="ep-mask-control">
                      <span className="ep-mask-label">Size</span>
                      <input type="range" min={5} max={100} value={brushSize} onChange={e => setBrushSize(Number(e.target.value))} className="ep-mask-slider" />
                      <span className="ep-mask-value">{brushSize}</span>
                    </div>
                    <div className="ep-mask-control">
                      <span className="ep-mask-label">Opacity</span>
                      <input type="range" min={10} max={100} value={Math.round(maskOpacity * 100)} onChange={e => setMaskOpacity(Number(e.target.value) / 100)} className="ep-mask-slider" />
                      <span className="ep-mask-value">{Math.round(maskOpacity * 100)}%</span>
                    </div>
                  </div>
                  
                  <div className="ep-mask-divider" />
                  
                  <div className="ep-mask-actions">
                    <button className="ep-mask-action" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)"><RotateCcw size={14} /></button>
                    <button className="ep-mask-action" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)"><RotateCw size={14} /></button>
                    <button className="ep-mask-action clear" onClick={clearMask} title="Clear"><Trash2 size={14} /></button>
                  </div>
                </div>
                
                {/* Canvas Area */}
                <div
                  className="ep-mask-canvas-wrapper"
                  ref={wrapperRef}
                  onMouseDown={maskTool === 'crop' ? onCropWrapperDown : undefined}
                  onMouseMove={maskTool === 'crop' ? onCropWrapperMove : undefined}
                  onMouseUp={maskTool === 'crop' ? onCropWrapperUp : undefined}
                  onMouseLeave={maskTool === 'crop' ? onCropWrapperUp : undefined}
                >
                  <img src={getSafeSrc(resolvedImage, image)} alt="Base" className="ep-mask-base-image" onLoad={e => setImgMeta({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
                  <canvas
                    ref={canvasRef}
                    className="ep-mask-canvas"
                    onMouseDown={maskTool === 'crop' ? undefined : startDrawing}
                    onMouseMove={maskTool === 'crop' ? undefined : draw}
                    onMouseUp={maskTool === 'crop' ? undefined : stopDrawing}
                    onMouseLeave={maskTool === 'crop' ? undefined : () => { stopDrawing(); setShowBrushCursor(false); }}
                    onMouseEnter={maskTool === 'crop' ? undefined : () => setShowBrushCursor(true)}
                    style={{ cursor: maskTool === 'brush' ? 'none' : 'crosshair', pointerEvents: maskTool === 'crop' ? 'none' : 'all' }}
                  />
                  {/* Crop overlay */}
                  {maskTool === 'crop' && cropRect && (() => {
                    const cr = getCropCssRect();
                    if (!cr) return null;
                    return (
                      <>
                        <div className="crop-overlay" style={{ top: 0, left: 0, right: 0, height: cr.y }} />
                        <div className="crop-overlay" style={{ top: cr.y + cr.h, left: 0, right: 0, bottom: 0 }} />
                        <div className="crop-overlay" style={{ top: cr.y, left: 0, width: cr.x, height: cr.h }} />
                        <div className="crop-overlay" style={{ top: cr.y, left: cr.x + cr.w, right: 0, height: cr.h }} />
                        <div className="crop-border" style={{ left: cr.x, top: cr.y, width: cr.w, height: cr.h }}>
                          <div className="crop-grid-line crop-grid-h" style={{ top: '33.33%' }} />
                          <div className="crop-grid-line crop-grid-h" style={{ top: '66.66%' }} />
                          <div className="crop-grid-line crop-grid-v" style={{ left: '33.33%' }} />
                          <div className="crop-grid-line crop-grid-v" style={{ left: '66.66%' }} />
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
                        <div className="crop-actions" style={{ left: cr.x + cr.w, top: Math.max(cr.y - 40, 4) }}>
                          <button className="crop-btn crop-btn-apply" onClick={applyCrop} title="Apply (Enter)"><Check size={13} /> Apply</button>
                          <button className="crop-btn crop-btn-cancel" onClick={cancelCrop} title="Cancel (Esc)"><X size={13} /></button>
                        </div>
                      </>
                    );
                  })()}
                  {showBrushCursor && maskTool === 'brush' && cursorPos && (() => {
                    const canvas = canvasRef.current;
                    if (!canvas) return null;
                    const rect = canvas.getBoundingClientRect();
                    const cssX = (cursorPos.x / canvas.width) * rect.width + canvas.offsetLeft;
                    const cssY = (cursorPos.y / canvas.height) * rect.height + canvas.offsetTop;
                    const cssBrushSize = (brushSize / canvas.width) * rect.width;
                    return (
                      <div className="ep-brush-cursor" style={{ left: cssX, top: cssY, width: cssBrushSize, height: cssBrushSize }} />
                    );
                  })()}
                </div>
                
                {/* Mask Hint */}
                <div className="ep-mask-hint">
                  {maskTool === 'crop' ? (
                    <><span>🔲 Drag to select crop area</span><span>⌨️ Enter=Apply, Esc=Cancel</span></>
                  ) : (
                    <><span>🖱️ Drag to draw mask</span><span>⌨️ B=Brush E=Eraser L=Lasso C=Crop</span><span>⌨️ Ctrl+Z=Undo</span></>
                  )}
                </div>
              </>
            ) : (
              <div className="ep-empty">
                <span>No image selected</span>
                <small>Select an image to start masking</small>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
