import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Brush, Eraser, Scissors, Trash2, RotateCcw, RotateCw, Download } from 'lucide-react';
import './MaskCanvas.css';

export interface MaskCanvasProps {
  image: string | null;
  onMaskChange?: (maskDataUrl: string | null) => void;
  onGenerate?: (maskDataUrl: string, prompt: string) => void;
  showGenerateButton?: boolean;
  className?: string;
}

export const MaskCanvas: React.FC<MaskCanvasProps> = ({
  image,
  onMaskChange,
  onGenerate,
  showGenerateButton = false,
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [maskTool, setMaskTool] = useState<'brush' | 'eraser' | 'lasso'>('brush');
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
      if ((e.key === 'z' || e.key === 'Z') && e.ctrlKey) {
        e.shiftKey ? redo() : undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

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
      <div className="mask-canvas-wrapper" ref={wrapperRef}>
        <img
          src={image}
          alt="Base"
          className="mask-canvas-base-image"
          onLoad={(e) => setImgMeta({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
        />
        <canvas
          ref={canvasRef}
          className="mask-canvas-draw"
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
        <span>🖱️ Drag to draw mask</span>
        <span>⌨️ B=Brush, E=Eraser, L=Lasso</span>
        <span>⌨️ Ctrl+Z=Undo, Ctrl+Shift+Z=Redo</span>
      </div>
    </div>
  );
};

export default MaskCanvas;
