import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X, Download, Maximize2, Minimize2, Brush, Eraser, Scissors, Trash2, RotateCcw, RotateCw } from 'lucide-react';
import { useAIConfigStore } from '../../stores/aiConfigStore';
import { downloadImage } from '../../utils/imageExport';
import './EnlargedPreview.css';

// ─── EnlargedPreview ─────────────────────────────────────────────────────────
// Fills the main content area when isEnlargedView === true.
// Mirrors VizMaker's Enlarge mode: Preview / Compare / Draw tabs
// with real Zoom/Pan, ZoomPercent overlay, image dimensions, and FULL mask drawing.

export const EnlargedPreview: React.FC = () => {
  const selectedNode    = useAIConfigStore(s => s.selectedNode);
  const compareImages   = useAIConfigStore(s => s.compareImages);
  const setCompareImages = useAIConfigStore(s => s.setCompareImages);
  const setCompareSlot  = useAIConfigStore(s => s.setCompareSlot);
  const setIsEnlargedView = useAIConfigStore(s => s.setIsEnlargedView);

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
  const [maskTool, setMaskTool]                   = useState<'brush' | 'eraser' | 'lasso'>('brush');
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
  const image  = selectedNode?.image ?? null;

  // Reset zoom/pan when image changes
  useEffect(() => { setZoom(1); setPanX(0); setPanY(0); setImgMeta(null); }, [image]);

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
        if ((e.key === 'z' || e.key === 'Z') && e.ctrlKey) {
          e.shiftKey ? redo() : undo();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setIsEnlargedView, isFullscreen, tab, undo, redo]);

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
          {image && (
            <button className="ep-icon-btn" onClick={() => setIsFullscreen(f => !f)} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
              {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
          )}
          {image && (
            <button className="ep-icon-btn" onClick={() => downloadImage(image, selectedNode?.type ?? 'image')} title="Download">
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
          <img src={image} alt="Fullscreen" className="ep-fullscreen-img" onClick={e => e.stopPropagation()} />
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
              <img src={image} alt="Preview" className="ep-zoom-img" draggable={false} style={{ transform: `translate(${panX}px,${panY}px) scale(${zoom})` }} onLoad={e => setImgMeta({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
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
                <img src={compareImages.B} className="ep-compare-base" alt="B" />
                <div className="ep-compare-clip" style={{ clipPath: `inset(0 ${100 - compareSplit}% 0 0)` }}><img src={compareImages.A} alt="A" /></div>
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
                    {compareImages[slot] ? (<><img src={compareImages[slot]!} alt={slot} /><button className="ep-slot-clear" onClick={e => { e.stopPropagation(); setCompareImages(p => ({ ...p, [slot]: null })); }}><X size={12} /></button><span className="ep-slot-label">{slot}</span></>) : (<><span className="ep-slot-plus">+</span><span>Set as {slot}</span><small>{image ? 'Click to use selected node' : 'Select a node first'}</small></>)}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* DRAW/Mask tab - FULL IMPLEMENTATION */}
        {tab === 'draw' && (
          <div className="ep-draw-stage">
            {/* Mask Toolbar */}
            <div className="ep-mask-toolbar">
              <div className="ep-mask-tools">
                <button className={`ep-mask-tool ${maskTool === 'brush' ? 'active' : ''}`} onClick={() => setMaskTool('brush')} title="Brush (B)"><Brush size={16} /></button>
                <button className={`ep-mask-tool ${maskTool === 'eraser' ? 'active' : ''}`} onClick={() => setMaskTool('eraser')} title="Eraser (E)"><Eraser size={16} /></button>
                <button className={`ep-mask-tool ${maskTool === 'lasso' ? 'active' : ''}`} onClick={() => setMaskTool('lasso')} title="Lasso (L)"><Scissors size={16} /></button>
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
            <div className="ep-mask-canvas-wrapper" ref={wrapperRef}>
              {image ? (
                <>
                  <img src={image} alt="Base" className="ep-mask-base-image" onLoad={e => setImgMeta({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
                  <canvas
                    ref={canvasRef}
                    className="ep-mask-canvas"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={() => { stopDrawing(); setShowBrushCursor(false); }}
                    onMouseEnter={() => setShowBrushCursor(true)}
                    style={{ cursor: maskTool === 'brush' ? 'none' : 'crosshair' }}
                  />
                  {showBrushCursor && maskTool === 'brush' && cursorPos && (() => {
                    const canvas = canvasRef.current;
                    if (!canvas) return null;
                    const rect = canvas.getBoundingClientRect();
                    // Convert canvas coordinates to CSS pixels for display
                    const cssX = (cursorPos.x / canvas.width) * rect.width + canvas.offsetLeft;
                    const cssY = (cursorPos.y / canvas.height) * rect.height + canvas.offsetTop;
                    // Scale brush size to CSS pixels
                    const cssBrushSize = (brushSize / canvas.width) * rect.width;
                    return (
                      <div className="ep-brush-cursor" style={{ left: cssX, top: cssY, width: cssBrushSize, height: cssBrushSize }} />
                    );
                  })()}
                </>
              ) : (
                <div className="ep-empty"><span>No image selected</span><small>Select an image to start masking</small></div>
              )}
            </div>
            
            {/* Mask Hint */}
            <div className="ep-mask-hint">
              <span>🖱️ Drag to draw mask</span>
              <span>⌨️ B=Brush, E=Eraser, L=Lasso</span>
              <span>⌨️ Ctrl+Z=Undo, Ctrl+Shift+Z=Redo</span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
