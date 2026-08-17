import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Paintbrush, Eraser, RotateCcw, Trash2, Check, X, Sliders, MousePointerClick, Sparkles
} from 'lucide-react';
import './CanvasMaskEditor.css';

interface CanvasMaskEditorProps {
  imageUrl: string;
  onApplyMask: (maskDataUrl: string) => void;
  onCancel: () => void;
  onSelectPreset?: (presetText: string) => void;
  isArabic?: boolean;
}

interface StrokePoint {
  x: number;
  y: number;
}

interface Stroke {
  points: StrokePoint[];
  brushSize: number;
  isErase: boolean;
}

const ARCHITECTURAL_INPAINT_PRESETS = [
  { id: 'curtain-wall', label: 'Curtain Wall Glass', labelAr: 'زجاج واجهة ستائرية' },
  { id: 'polished-concrete', label: 'Polished Concrete Panel', labelAr: 'لوحة خرسانية مصقولة' },
  { id: 'warm-lighting', label: 'Warm Cove Lighting', labelAr: 'إضاءة مخفية دافئة' },
  { id: 'vertical-louvers', label: 'Vertical Timber Louvers', labelAr: 'كاسرات شمس خشبية' },
  { id: 'landscape-garden', label: 'Zen Garden Landscaping', labelAr: 'لاندسكيب حديقة زان' },
  { id: 'travertine-stone', label: 'Travertine Marble Facing', labelAr: 'تكسية رخام ترافيرتين' },
];

export const CanvasMaskEditor: React.FC<CanvasMaskEditorProps> = ({
  imageUrl,
  onApplyMask,
  onCancel,
  onSelectPreset,
  isArabic = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [brushSize, setBrushSize] = useState<number>(35);
  const [isErase, setIsErase] = useState<boolean>(false);
  const [isSnapMode, setIsSnapMode] = useState<boolean>(false);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<StrokePoint[]>([]);
  const [imgLoaded, setImgLoaded] = useState<boolean>(false);
  const [naturalDimensions, setNaturalDimensions] = useState<{ width: number; height: number }>({ width: 1024, height: 1024 });

  // Handle Image Load
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNaturalDimensions({ width: img.naturalWidth, height: img.naturalHeight });
    setImgLoaded(true);
  };

  // Render Display Canvas
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all completed strokes
    const allStrokes = currentStroke.length > 0 
      ? [...strokes, { points: currentStroke, brushSize, isErase }]
      : strokes;

    for (const stroke of allStrokes) {
      if (stroke.points.length === 0) continue;

      ctx.save();
      ctx.globalCompositeOperation = stroke.isErase ? 'destination-out' : 'source-over';
      ctx.strokeStyle = 'rgba(230, 48, 48, 0.75)'; // ANARCHY Brand Signature Red Overlay (#E63030)
      ctx.fillStyle = 'rgba(230, 48, 48, 0.75)';
      ctx.lineWidth = stroke.brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
      ctx.restore();
    }
  }, [strokes, currentStroke, brushSize, isErase]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Adjust canvas resolution to match display size
  useEffect(() => {
    if (!imgLoaded || !imageRef.current || !canvasRef.current) return;
    const img = imageRef.current;
    const canvas = canvasRef.current;
    canvas.width = img.clientWidth;
    canvas.height = img.clientHeight;
    redrawCanvas();
  }, [imgLoaded, redrawCanvas]);

  // Coordinate Extractor
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>): StrokePoint | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = getCanvasCoords(e);
    if (!pt) return;
    setIsDrawing(true);
    setCurrentStroke([pt]);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const pt = getCanvasCoords(e);
    if (!pt) return;
    setCurrentStroke(prev => [...prev, pt]);
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentStroke.length > 0) {
      setStrokes(prev => [...prev, { points: currentStroke, brushSize, isErase }]);
      setCurrentStroke([]);
    }
  };

  const handleUndo = () => {
    setStrokes(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setStrokes([]);
    setCurrentStroke([]);
  };

  // Generate 1:1 Binary Mask (Black background, White mask area)
  const handleConfirm = () => {
    const offscreen = document.createElement('canvas');
    offscreen.width = naturalDimensions.width;
    offscreen.height = naturalDimensions.height;
    const ctx = offscreen.getContext('2d');
    if (!ctx || !canvasRef.current) return;

    // Fill background with Black (#000000 = preserve)
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, offscreen.width, offscreen.height);

    const displayCanvas = canvasRef.current;
    const scaleX = naturalDimensions.width / displayCanvas.width;
    const scaleY = naturalDimensions.height / displayCanvas.height;

    // Draw White strokes (#ffffff = inpaint region)
    for (const stroke of strokes) {
      if (stroke.points.length === 0) continue;

      ctx.save();
      ctx.globalCompositeOperation = stroke.isErase ? 'destination-out' : 'source-over';
      ctx.strokeStyle = '#ffffff';
      ctx.fillStyle = '#ffffff';
      ctx.lineWidth = stroke.brushSize * ((scaleX + scaleY) / 2);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x * scaleX, stroke.points[0].y * scaleY);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x * scaleX, stroke.points[i].y * scaleY);
      }
      ctx.stroke();
      ctx.restore();
    }

    const maskDataUrl = offscreen.toDataURL('image/png');
    onApplyMask(maskDataUrl);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSnapMode) return;
    const pt = getCanvasCoords(e);
    if (!pt || !canvasRef.current) return;

    // Snap-to-Element Contour Extractor: Automatically generates a rectangular element stroke around clicked point
    const w = canvasRef.current.width;
    const h = canvasRef.current.height;
    const boxW = Math.min(w * 0.25, 120);
    const boxH = Math.min(h * 0.25, 120);

    const snappedPoints: StrokePoint[] = [
      { x: Math.max(0, pt.x - boxW / 2), y: Math.max(0, pt.y - boxH / 2) },
      { x: Math.min(w, pt.x + boxW / 2), y: Math.max(0, pt.y - boxH / 2) },
      { x: Math.min(w, pt.x + boxW / 2), y: Math.min(h, pt.y + boxH / 2) },
      { x: Math.max(0, pt.x - boxW / 2), y: Math.min(h, pt.y + boxH / 2) },
      { x: Math.max(0, pt.x - boxW / 2), y: Math.max(0, pt.y - boxH / 2) },
    ];

    setStrokes(prev => [...prev, { points: snappedPoints, brushSize: 45, isErase: false }]);
  };

  return (
    <div className="mask-editor-container" ref={containerRef} style={{ direction: isArabic ? 'rtl' : 'ltr' }}>
      {/* Floating Toolbar */}
      <div className="mask-editor-toolbar">
        <div className="mask-tools-group">
          {/* Paint Mode */}
          <button 
            type="button" 
            className={`mask-tool-btn ${!isErase && !isSnapMode ? 'active' : ''}`}
            onClick={() => { setIsErase(false); setIsSnapMode(false); }}
            title="Paint Mask Region"
          >
            <Paintbrush size={15} />
            <span>{isArabic ? 'رسم يدوي' : 'Draw'}</span>
          </button>

          {/* Snap to Element Mode */}
          <button 
            type="button" 
            className={`mask-tool-btn ${isSnapMode ? 'active' : ''}`}
            onClick={() => { setIsSnapMode(true); setIsErase(false); }}
            title="Snap-to-Element Auto Masking"
          >
            <MousePointerClick size={15} />
            <span>{isArabic ? 'الانجذاب التلقائي (Snap-to-Element)' : 'Snap-to-Element'}</span>
          </button>

          {/* Erase Mode */}
          <button 
            type="button" 
            className={`mask-tool-btn ${isErase ? 'active' : ''}`}
            onClick={() => { setIsErase(true); setIsSnapMode(false); }}
            title="Erase Mask Region"
          >
            <Eraser size={15} />
            <span>{isArabic ? 'محاية' : 'Erase'}</span>
          </button>
        </div>

        {/* Brush Size Slider */}
        <div className="mask-slider-wrap">
          <Sliders size={13} className="text-rose-400" />
          <input 
            type="range" 
            min={10} 
            max={100} 
            value={brushSize}
            onChange={e => setBrushSize(Number(e.target.value))}
            className="mask-brush-slider"
            title="Brush Size"
          />
          <span className="mask-size-text">{brushSize}px</span>
        </div>

        <div className="mask-actions-group">
          <button 
            type="button" 
            className="mask-action-btn"
            onClick={handleUndo}
            disabled={strokes.length === 0}
            title="Undo Last Stroke"
          >
            <RotateCcw size={14} />
          </button>

          <button 
            type="button" 
            className="mask-action-btn danger"
            onClick={handleClear}
            disabled={strokes.length === 0}
            title="Clear All Strokes"
          >
            <Trash2 size={14} />
          </button>
        </div>

        <div className="mask-submit-group">
          <button type="button" className="mask-cancel-btn" onClick={onCancel} title="Cancel">
            <X size={15} />
          </button>
          <button 
            type="button" 
            className="mask-apply-btn" 
            onClick={handleConfirm}
            disabled={strokes.length === 0}
          >
            <Check size={16} />
            <span>{isArabic ? 'تطبيق الماسك' : 'Apply Mask'}</span>
          </button>
        </div>
      </div>

      {/* Architectural Inpaint Presets Bar */}
      <div className="mask-presets-bar">
        <div className="presets-label">
          <Sparkles size={13} className="text-rose-400" />
          <span>{isArabic ? 'البرومتات المعمارية الـ 62:' : 'Inpaint Presets:'}</span>
        </div>
        <div className="presets-chips">
          {ARCHITECTURAL_INPAINT_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className="inpaint-preset-chip"
              onClick={() => onSelectPreset && onSelectPreset(isArabic ? p.labelAr : p.label)}
            >
              {isArabic ? p.labelAr : p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Editor Surface */}
      <div className="mask-editor-surface">
        <img 
          ref={imageRef}
          src={imageUrl} 
          alt="Inpaint Base"
          className="mask-base-image"
          onLoad={handleImageLoad}
        />
        <canvas 
          ref={canvasRef}
          className="mask-drawing-canvas"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={handleCanvasClick}
        />
      </div>
    </div>
  );
};
