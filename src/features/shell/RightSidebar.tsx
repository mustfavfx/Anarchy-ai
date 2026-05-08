import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Image, ChevronLeft, ChevronRight, Plus, SplitSquareHorizontal, X, Download } from 'lucide-react';
import { ExportModal } from '../../components/ExportModal';
import { AIControlPanel } from '../builder/AIControlPanel';
import { useAIConfigStore } from '../../stores/aiConfigStore';
import type { ReplicateImageModel, ReplicateUpscaleModel } from '../../services/replicate';
import { replicateService } from '../../services/replicate';
import { maskService } from '../../services/mask/MaskService';
import './RightSidebar.css';

interface RightSidebarProps {
  canvasChildren?: React.ReactNode;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({ canvasChildren }) => {
  const config = useAIConfigStore((state) => state.config);
  const setConfig = useAIConfigStore((state) => state.setConfig);
  const selectedNode = useAIConfigStore((state) => state.selectedNode);
  const compareImages = useAIConfigStore((state) => state.compareImages);
  const setCompareImages = useAIConfigStore((state) => state.setCompareImages);
  const setCompareSlot = useAIConfigStore((state) => state.setCompareSlot);
  const isEnlargedView = useAIConfigStore((state) => state.isEnlargedView);
  const setIsEnlargedView = useAIConfigStore((state) => state.setIsEnlargedView);
  
  const [previewMode, setPreviewMode] = React.useState<'preview' | 'compare' | 'draw'>('preview');
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [showExpandModal, setShowExpandModal] = React.useState(false);
  const [showExportModal, setShowExportModal] = React.useState(false);

  // Zoom/Pan state for Preview mode
  const [zoom, setZoom]         = useState(1);
  const [panX, setPanX]         = useState(0);
  const [panY, setPanY]         = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);
  const previewStageRef = useRef<HTMLDivElement>(null);

  // Reset zoom/pan when image changes
  useEffect(() => { setZoom(1); setPanX(0); setPanY(0); }, [selectedNode?.image]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    setZoom(z => Math.min(10, Math.max(0.1, z * delta)));
  }, []);

  const handlePanStart = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    panStartRef.current = { mx: e.clientX, my: e.clientY, px: panX, py: panY };
    setIsPanning(true);
  }, [panX, panY]);

  const handlePanMove = useCallback((e: React.MouseEvent) => {
    if (!panStartRef.current) return;
    setPanX(panStartRef.current.px + (e.clientX - panStartRef.current.mx));
    setPanY(panStartRef.current.py + (e.clientY - panStartRef.current.my));
  }, []);

  const handlePanEnd = useCallback(() => {
    panStartRef.current = null;
    setIsPanning(false);
  }, []);

  const fitToStage = useCallback(() => { setZoom(1); setPanX(0); setPanY(0); }, []);

  // Compare split slider state
  const [compareSplit, setCompareSplit] = useState(50); // 0-100%, 50 = middle
  
  // Mask/Draw mode state
  const canvasRef        = useRef<HTMLCanvasElement>(null);
  const wrapperRef       = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing]                 = useState(false);
  const [maskPrompt, setMaskPrompt]               = useState('');
  const [maskResult, setMaskResult]               = useState<string | null>(null);
  const [isProcessingMask, setIsProcessingMask]   = useState(false);
  const [maskTool, setMaskTool]                   = useState<'brush' | 'eraser' | 'lasso'>('brush');
  const [maskOpacity, setMaskOpacity]             = useState(0.55);
  const [cursorPos, setCursorPos]                 = useState<{ x: number; y: number } | null>(null);
  const lassoPointsRef = useRef<{ x: number; y: number }[]>([]);
  const [imgNaturalSize, setImgNaturalSize]        = useState<{ w: number; h: number } | null>(null);

  const handleModelChange = useCallback((model: ReplicateImageModel | ReplicateUpscaleModel) => {
    setConfig(prev => ({ ...prev, model }));
  }, [setConfig]);

  const handleParamsChange = useCallback((params: {
    steps: number;
    cfg: number;
    seed: number | null;
    strength: number;
    referenceStrength: number;
    results: number;
    negativePrompt: string;
    disableSafetyChecker: boolean;
    upscaleFactor?: number;
    resolution?: string;
    aspectRatio?: string;
    // Topaz Labs settings
    enhanceModel?: string;
    faceEnhancement?: boolean;
    faceEnhancementCreativity?: number;
    faceEnhancementStrength?: number;
    // Clarity Upscaler settings
    clarityScale?: number;
    clarityDynamic?: number;
    clarityCreativity?: number;
    clarityTilingWidth?: number;
    clarityTilingHeight?: number;
    claritySdModel?: string;
    clarityScheduler?: string;
    claritySteps?: number;
    claritySeed?: number | null;
    clarityDownscaling?: boolean;
    clarityDownscalingRes?: number;
    claritySharpen?: number;
    clarityHandfix?: string;
    clarityPattern?: boolean;
    // Pruna AI settings
    prunaMode?: 'target' | 'factor';
    prunaTarget?: number;
    prunaFactor?: number;
    prunaEnhanceDetails?: boolean;
    prunaEnhanceRealism?: boolean;
    prunaQuality?: number;
  }) => {
    setConfig(prev => ({
      ...prev,
      ...params,
      resolution: params.resolution ?? prev.resolution,
      aspectRatio: params.aspectRatio ?? prev.aspectRatio,
    }));
  }, [setConfig]);

  // Local wrapper that uses current selectedNode
  const handleSetCompareSlot = (slot: 'A' | 'B') => {
    if (selectedNode?.image) {
      setCompareSlot(slot, selectedNode.image);
    }
  };

  // Mask drawing state
  const [brushSize, setBrushSize] = useState(30);
  const historyRef      = useRef<ImageData[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const [, forceUpdate] = useState<number>(0);
  const lastPointRef    = useRef<{ x: number; y: number } | null>(null);

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  // Resize canvas to match displayed image bounds (letter-box aware)
  const syncCanvasSize = useCallback(() => {
    const canvas  = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper || !imgNaturalSize) return;
    const { w, h } = imgNaturalSize;
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
      canvas.style.left   = `${(ww - cw) / 2}px`;
      canvas.style.top    = `${(wh - ch) / 2}px`;
    }
  }, [imgNaturalSize]);

  useEffect(() => {
    syncCanvasSize();
    const obs = new ResizeObserver(syncCanvasSize);
    if (wrapperRef.current) obs.observe(wrapperRef.current);
    return () => obs.disconnect();
  }, [syncCanvasSize]);

  // Use state for undo/redo buttons instead of ref
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [, setHistoryTrigger] = useState<number>(0);
  
  // Call this whenever history changes
  const triggerHistoryUpdate = useCallback(() => {
    setHistoryTrigger(t => t + 1);
  }, []);
  
  // Update canUndo/canRedo when history changes
  useEffect(() => {
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  }, [setHistoryTrigger]);

  const pushHistory = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    // Remove future states if we're in middle of history
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    }
    historyRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    historyIndexRef.current = historyRef.current.length - 1;
    triggerHistoryUpdate();
  }, [triggerHistoryUpdate]);

  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
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
    if (!isDrawing) return;
    const pt = getCanvasCoords(e);
    if (!pt) return;

    // Update cursor position for custom circle cursor
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }

    if (maskTool === 'lasso') {
      lassoPointsRef.current.push(pt);
      // Draw lasso preview
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        const pts = lassoPointsRef.current;
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = 'rgba(225,29,72,0.9)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        pts.forEach(p => ctx.lineTo(p.x, p.y));
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
    ctx.beginPath();
    if (lastPointRef.current) {
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
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = `rgba(225,29,72,${maskOpacity})`;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        pts.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.closePath();
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
    setCursorPos(null);
  }, [isDrawing, maskTool, maskOpacity, pushHistory]);

  const clearMask = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pushHistory();
    setMaskResult(null);
  }, [pushHistory]);

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current--;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const state = historyRef.current[historyIndexRef.current];
    if (state) ctx.putImageData(state, 0, 0);
    forceUpdate(n => n + 1);
    triggerHistoryUpdate();
  }, [triggerHistoryUpdate]);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current++;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const state = historyRef.current[historyIndexRef.current];
    if (state) ctx.putImageData(state, 0, 0);
    forceUpdate(n => n + 1);
    triggerHistoryUpdate();
  }, [triggerHistoryUpdate]);

  // Keyboard shortcuts for preview zoom (only active in preview mode)
  useEffect(() => {
    if (previewMode !== 'preview') return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === '+' || e.key === '=') setZoom(z => Math.min(10, z * 1.25));
      if (e.key === '-') setZoom(z => Math.max(0.1, z / 1.25));
      if (e.key === 'f' || e.key === 'F') fitToStage();
      if (e.key === 'Enter') setShowExpandModal(true);
      if (e.key === 'Escape') setShowExpandModal(false);
    };
    globalThis.addEventListener('keydown', onKey);
    return () => globalThis.removeEventListener('keydown', onKey);
  }, [previewMode, fitToStage]);

  // Keyboard shortcuts for mask tools (only active in draw mode)
  useEffect(() => {
    if (previewMode !== 'draw') return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === 'b' || e.key === 'B') setMaskTool('brush');
      if (e.key === 'l' || e.key === 'L') setMaskTool('lasso');
      if (e.key === 'e' || e.key === 'E') setMaskTool('eraser');
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo(); }
    };
    globalThis.addEventListener('keydown', onKey);
    return () => globalThis.removeEventListener('keydown', onKey);
  }, [previewMode, undo, redo]);

  // Initialize canvas on mount / image change
  const onCanvasReady = useCallback((canvas: HTMLCanvasElement | null) => {
    canvasRef.current = canvas;
    if (canvas && historyRef.current.length === 0) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        historyRef.current = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
        historyIndexRef.current = 0;
      }
    }
  }, []);

  // Select All
  const selectAll = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(225,29,72,${maskOpacity})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    pushHistory();
  }, [maskOpacity, pushHistory]);

  // Invert selection
  const invertMask = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imgData.data;
    for (let i = 3; i < d.length; i += 4) {
      d[i] = 255 - d[i];
    }
    ctx.putImageData(imgData, 0, 0);
    pushHistory();
  }, [pushHistory]);

  // Build a black/white mask from the current painted canvas (alpha → white)
  const buildBlackWhiteMask = async (): Promise<string | null> => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    try {
      const result = await maskService.buildMask(canvas, {
        threshold: 10,
        blur: 2,
        feather: 3,
        detectEdges: true,
        detectShapes: true,
      });
      
      return result.maskData;
    } catch {
      return null;
    }
  };

  const processMask = async () => {
    if (!selectedNode?.image || !maskPrompt.trim()) return;

    setIsProcessingMask(true);
    try {
      // Build a black/white mask (debug/log for now)
      await buildBlackWhiteMask();
      // Note: True inpainting requires a KIE endpoint that accepts a mask.
      // For now we use img2img with the prompt; future work: pass mask separately.
      const result = await replicateService.generateImg2Img({
        prompt: maskPrompt,
        model: 'black-forest-labs/flux-kontext-pro' as ReplicateImageModel,
        strength: 0.85,
        resolution: 'Auto',
        aspectRatio: 'Auto',
      }, selectedNode.image);

      if (result.imageUrl) {
        setMaskResult(result.imageUrl);
      }
    } catch (error) {
    } finally {
      setIsProcessingMask(false);
    }
  };

  return (
    <div className={`right-sidebar-wrapper ${isCollapsed ? 'collapsed' : ''}`}>
    <aside className="right-sidebar">
      {/* ── Enlarged mode: Mini Canvas + Canvas return button ── */}
      {isEnlargedView && (
        <>
          <div className="sidebar-mini-canvas">
            {canvasChildren}
          </div>
          <div className="sidebar-canvas-return">
            <button
              className="sidebar-canvas-return-btn"
              onClick={() => setIsEnlargedView(false)}
              title="Back to canvas view"
            >
              ◧ Canvas
            </button>
          </div>
        </>
      )}

      {/* Section 1: Image Preview — hidden in enlarged mode */}
      {!isEnlargedView && <div className="sidebar-section image-preview-section">
        <div className="section-content">
          <div className="preview-panel-v2">

            {/* ── Row 1: Enlarge btn (right) + Save (icon) ── */}
            <div className="sidebar-preview-toprow">
              <div className="sidebar-preview-tabs" role="tablist">
                <button type="button" className={`sidebar-tab ${previewMode === 'preview' ? 'active' : ''}`} onClick={() => setPreviewMode('preview')}>Preview</button>
                <button type="button" className={`sidebar-tab ${previewMode === 'compare' ? 'active' : ''}`} onClick={() => setPreviewMode('compare')}>Compare</button>
                <button type="button" className={`sidebar-tab ${previewMode === 'draw' ? 'active' : ''}`} onClick={() => setPreviewMode('draw')}>Mask</button>
              </div>
              <div className="sidebar-preview-actions">
                {selectedNode?.image && (
                  <button
                    className="sidebar-icon-btn"
                    onClick={() => setShowExportModal(true)}
                    title="Export image"
                  ><Download size={13} /></button>
                )}
                <button
                  className={`sidebar-enlarge-btn ${isEnlargedView ? 'active' : ''}`}
                  onClick={() => setIsEnlargedView(!isEnlargedView)}
                  title={isEnlargedView ? 'Back to canvas (Esc)' : 'Expand preview'}
                >
                  {isEnlargedView ? 'Canvas' : 'Expand'}
                </button>
              </div>
            </div>

            {/* ── Row 2: Large image thumbnail — like VizMaker ── */}

                <div className={`preview-stage mode-${previewMode}`}>
              {/* PREVIEW MODE — Zoom/Pan/Fit */}
              {previewMode === 'preview' && (
                <div
                  className={`preview-zoom-stage ${isPanning ? 'panning' : ''}`}
                  ref={previewStageRef}
                  role="img"
                  aria-label="Image preview"
                  tabIndex={0}
                  onWheel={handleWheel}
                  onMouseDown={handlePanStart}
                  onMouseMove={handlePanMove}
                  onMouseUp={handlePanEnd}
                  onMouseLeave={handlePanEnd}
                  onKeyDown={e => {
                    if (e.key === '+' || e.key === '=') setZoom(z => Math.min(10, z * 1.25));
                    if (e.key === '-') setZoom(z => Math.max(0.1, z / 1.25));
                    if (e.key === 'f' || e.key === 'F') fitToStage();
                  }}
                >
                  {selectedNode?.image ? (
                    <>
                      <img
                        src={selectedNode.image}
                        alt={selectedNode.type || 'Node'}
                        className="preview-zoom-img"
                        style={{ transform: `translate(${panX}px, ${panY}px) scale(${zoom})` }}
                        onError={e => { (e.currentTarget).style.display = 'none'; }}
                        draggable={false}
                      />
                      {/* Zoom controls overlay */}
                      <div className="preview-zoom-controls">
                        <button className="pz-btn" onClick={() => setZoom(z => Math.min(10, z * 1.25))} title="Zoom In (+)">+</button>
                        <span className="pz-label">{Math.round(zoom * 100)}%</span>
                        <button className="pz-btn" onClick={() => setZoom(z => Math.max(0.1, z / 1.25))} title="Zoom Out (-)">−</button>
                        <button className="pz-btn" onClick={fitToStage} title="Fit (F)">⊡</button>
                        <button className="pz-btn" onClick={() => setShowExpandModal(true)} title="Fullscreen">⛶</button>
                      </div>
                      {/* Zoom hint */}
                      {zoom === 1 && panX === 0 && panY === 0 && (
                        <span className="preview-zoom-hint">Scroll to zoom · Drag to pan</span>
                      )}
                    </>
                  ) : (
                    <div className="preview-stage-content">
                      <Image size={26} />
                      <span>No image selected</span>
                      <small>Click a node to view its image</small>
                    </div>
                  )}
                </div>
              )}

              {/* COMPARE MODE */}
              {previewMode === 'compare' && (
                <div className="compare-container">
                  {compareImages.A && compareImages.B ? (
                    <>
                      {/* Image B as base layer */}
                      <img src={compareImages.B} className="compare-base" alt="B" />
                      {/* Image A clipped by slider */}
                      <div 
                        className="compare-clip"
                        style={{ clipPath: `inset(0 ${100 - compareSplit}% 0 0)` }}
                      >
                        <img src={compareImages.A} alt="A" />
                      </div>
                      {/* Draggable divider line */}
                      <div 
                        className="compare-handle"
                        style={{ left: `${compareSplit}%` }}
                      >
                        <div className="compare-handle-line" />
                        <div className="compare-handle-circle">
                          <SplitSquareHorizontal size={12} />
                        </div>
                      </div>
                      {/* Labels */}
                      <span className="compare-label compare-label-a">A</span>
                      <span className="compare-label compare-label-b">B</span>
                      {/* Slider input (invisible but covers area) */}
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={compareSplit}
                        onChange={(e) => setCompareSplit(Number(e.target.value))}
                        className="compare-slider-input"
                      />
                      {/* Toolbar */}
                      <div className="compare-toolbar">
                        <button 
                          className="compare-tool-btn"
                          onClick={() => setCompareImages({ A: compareImages.B, B: compareImages.A })}
                          title="Swap A ↔ B"
                        >
                          ⇄
                        </button>
                        <button 
                          className="compare-tool-btn"
                          onClick={() => setCompareImages({ A: null, B: null })}
                          title="Clear both"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="compare-empty">
                      <button
                        type="button"
                        className={`compare-slot ${compareImages.A ? 'filled' : ''}`}
                        onClick={() => !compareImages.A && handleSetCompareSlot('A')}
                      >
                        {compareImages.A ? (
                          <>
                            <img src={compareImages.A} alt="A" />
                            <button 
                              className="compare-slot-clear"
                              onClick={(e) => { e.stopPropagation(); setCompareImages(prev => ({ ...prev, A: null })); }}
                            >
                              <X size={12} />
                            </button>
                            <span className="compare-slot-label">A</span>
                          </>
                        ) : (
                          <>
                            <Plus size={20} />
                            <span>Select Image A</span>
                            <small>Click or right-click node</small>
                          </>
                        )}
                      </button>
                      
                      <button
                        type="button"
                        className={`compare-slot ${compareImages.B ? 'filled' : ''}`}
                        onClick={() => !compareImages.B && handleSetCompareSlot('B')}
                      >
                        {compareImages.B ? (
                          <>
                            <img src={compareImages.B} alt="B" />
                            <button 
                              className="compare-slot-clear"
                              onClick={(e) => { e.stopPropagation(); setCompareImages(prev => ({ ...prev, B: null })); }}
                            >
                              <X size={12} />
                            </button>
                            <span className="compare-slot-label">B</span>
                          </>
                        ) : (
                          <>
                            <Plus size={20} />
                            <span>Select Image B</span>
                            <small>Click or right-click node</small>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* MASK/DRAW MODE — Freepik style */}
              {previewMode === 'draw' && (
                <div className="mask-container">
                  {selectedNode?.image ? (
                    <>
                      {/* ── Row 1: Tool selector ── */}
                      <div className="mask-toolbar">
                        <button
                          className={`mask-tool ${maskTool === 'brush' ? 'active' : ''}`}
                          onClick={() => setMaskTool('brush')}
                          title="Brush (B)"
                        >✎</button>
                        <button
                          className={`mask-tool ${maskTool === 'lasso' ? 'active' : ''}`}
                          onClick={() => setMaskTool('lasso')}
                          title="Lasso (L)"
                        >⬡</button>
                        <button
                          className={`mask-tool ${maskTool === 'eraser' ? 'active' : ''}`}
                          onClick={() => setMaskTool('eraser')}
                          title="Eraser (E)"
                        >⌫</button>

                        <div className="mask-tool-divider" />

                        <button className="mask-tool" onClick={selectAll}   title="Select All">▣</button>
                        <button className="mask-tool" onClick={invertMask}  title="Invert">◪</button>

                        <div className="mask-tool-divider" />

                        <button className="mask-tool" onClick={undo} disabled={!canUndo} title="Undo">↶</button>
                        <button className="mask-tool" onClick={redo} disabled={!canRedo} title="Redo">↷</button>
                        <button className="mask-tool" onClick={clearMask} title="Clear">✕</button>
                      </div>

                      {/* ── Row 2: Size + Opacity (only for brush/eraser) ── */}
                      {maskTool !== 'lasso' && (
                        <div className="mask-toolbar mask-toolbar-slim">
                          <span className="mask-brush-label">Size</span>
                          <input
                            type="range" min="4" max="120" value={brushSize}
                            onChange={e => setBrushSize(Number(e.target.value))}
                            className="mask-brush-slider"
                          />
                          <span className="mask-brush-label">{brushSize}</span>
                          <div className="mask-tool-divider" />
                          <span className="mask-brush-label">Opacity</span>
                          <input
                            type="range" min="10" max="100" value={Math.round(maskOpacity * 100)}
                            onChange={e => setMaskOpacity(Number(e.target.value) / 100)}
                            className="mask-brush-slider"
                          />
                          <span className="mask-brush-label">{Math.round(maskOpacity * 100)}%</span>
                        </div>
                      )}

                      {/* ── Canvas area ── */}
                      <div className="mask-canvas-wrapper" ref={wrapperRef}>
                        <img
                          src={selectedNode.image}
                          alt="Base"
                          className="mask-base-image"
                          onLoad={e => {
                            const t = e.currentTarget;
                            setImgNaturalSize({ w: t.naturalWidth, h: t.naturalHeight });
                          }}
                        />
                        <canvas
                          ref={onCanvasReady}
                          className="mask-canvas mask-canvas-absolute"
                          style={{ cursor: maskTool === 'lasso' ? 'crosshair' : 'none' }}
                          onMouseDown={startDrawing}
                          onMouseMove={(e) => {
                            const canvas = canvasRef.current;
                            if (canvas) {
                              const rect = canvas.getBoundingClientRect();
                              setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                            }
                            draw(e);
                          }}
                          onMouseUp={stopDrawing}
                          onMouseLeave={() => { stopDrawing(); setCursorPos(null); }}
                        />
                        {/* Custom circle cursor */}
                        {cursorPos && maskTool !== 'lasso' && (
                          <div
                            className="mask-cursor-circle"
                            style={{
                              left: cursorPos.x,
                              top:  cursorPos.y,
                              width:  brushSize,
                              height: brushSize,
                              borderColor: maskTool === 'eraser' ? 'rgba(255,255,255,0.9)' : 'rgba(225,29,72,0.9)',
                            }}
                          />
                        )}
                        {maskResult && (
                          <img src={maskResult} alt="Result" className="mask-result-image" />
                        )}
                      </div>

                      {/* ── Prompt + Generate ── */}
                      <div className="mask-controls">
                        <input
                          type="text"
                          placeholder="Describe what to paint in the selected area…"
                          value={maskPrompt}
                          onChange={e => setMaskPrompt(e.target.value)}
                          className="mask-prompt-input"
                          onKeyDown={e => { if (e.key === 'Enter' && !isProcessingMask && maskPrompt.trim()) processMask(); }}
                        />
                        <button
                          className="mask-generate-btn"
                          onClick={processMask}
                          disabled={isProcessingMask || !maskPrompt.trim()}
                        >
                          {isProcessingMask ? 'Processing…' : 'Generate'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="preview-stage-content">
                      <Image size={26} />
                      <span>No image selected</span>
                      <small>Select a node with an image to start painting</small>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>}

      {/* Section 2: AI Control */}
      <div className="sidebar-section ai-control-section">
        <AIControlPanel
          selectedModel={config.model}
          onModelChange={handleModelChange}
          params={{
            steps: config.steps,
            cfg: config.cfg,
            seed: config.seed,
            strength: config.strength,
            referenceStrength: config.referenceStrength,
            results: config.results,
            negativePrompt: config.negativePrompt,
            disableSafetyChecker: config.disableSafetyChecker,
            upscaleFactor: config.upscaleFactor,
            resolution: config.resolution,
            aspectRatio: config.aspectRatio,
            // Watermark settings
            enableWatermark: config.enableWatermark,
            watermarkText: config.watermarkText,
            watermarkPosition: config.watermarkPosition,
            watermarkOpacity: config.watermarkOpacity,
            watermarkFontSize: config.watermarkFontSize,
            // Topaz Labs settings
            enhanceModel: config.enhanceModel,
            faceEnhancement: config.faceEnhancement,
            faceEnhancementCreativity: config.faceEnhancementCreativity,
            faceEnhancementStrength: config.faceEnhancementStrength,
            // Clarity Upscaler settings
            clarityScale: config.clarityScale,
            clarityDynamic: config.clarityDynamic,
            clarityCreativity: config.clarityCreativity,
            clarityTilingWidth: config.clarityTilingWidth,
            clarityTilingHeight: config.clarityTilingHeight,
            claritySdModel: config.claritySdModel,
            clarityScheduler: config.clarityScheduler,
            claritySteps: config.claritySteps,
            claritySeed: config.claritySeed,
            clarityDownscaling: config.clarityDownscaling,
            clarityDownscalingRes: config.clarityDownscalingRes,
            claritySharpen: config.claritySharpen,
            clarityHandfix: config.clarityHandfix,
            clarityPattern: config.clarityPattern,
            // Pruna AI settings
            prunaMode: config.prunaMode,
            prunaTarget: config.prunaTarget,
            prunaFactor: config.prunaFactor,
            prunaEnhanceDetails: config.prunaEnhanceDetails,
            prunaEnhanceRealism: config.prunaEnhanceRealism,
            prunaQuality: config.prunaQuality
          }}
          onParamsChange={handleParamsChange}
        />
      </div>

    </aside>

      {/* Fullscreen Modal */}
      {showExpandModal && selectedNode?.image && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Fullscreen image preview"
          className="preview-expand-modal"
          onClick={e => { e.stopPropagation(); setShowExpandModal(false); }}
          onKeyDown={e => { if (e.key === 'Escape' || e.key === 'f' || e.key === 'F') setShowExpandModal(false); }}
          tabIndex={-1}
          style={{ outline: 'none' }}
          ref={el => el?.focus()}
        >
          <div className="preview-expand-content" onClick={e => e.stopPropagation()} role="document">
            {/* Top bar */}
            <div className="preview-expand-topbar">
              <span className="preview-expand-title">
                {selectedNode.type ?? 'Image'}
                {imgNaturalSize && (
                  <span className="preview-expand-dims"> · {imgNaturalSize.w}×{imgNaturalSize.h}</span>
                )}
              </span>
              <div className="preview-expand-actions">
                <button
                  className="preview-expand-close"
                  onClick={() => { setShowExpandModal(false); setShowExportModal(true); }}
                  title="Export image"
                >
                  <Download size={15} />
                </button>
                <button
                  className="preview-expand-close"
                  onClick={() => setShowExpandModal(false)}
                  title="Close (Esc)"
                >
                  <X size={15} />
                </button>
              </div>
            </div>
            <img
              src={selectedNode.image}
              alt={selectedNode.type || 'Node'}
              className="preview-expand-image"
              onLoad={e => {
                const t = e.currentTarget;
                setImgNaturalSize({ w: t.naturalWidth, h: t.naturalHeight });
              }}
              onError={e => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
        </div>
      )}

    <button
      className="right-collapse-btn"
      onClick={() => setIsCollapsed(!isCollapsed)}
      title={isCollapsed ? 'Expand' : 'Collapse'}
    >
      {isCollapsed ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
    </button>

    {showExportModal && selectedNode?.image && (
      <ExportModal
        imageUrl={selectedNode.image}
        imageName={selectedNode.type ?? 'anarchy-image'}
        onClose={() => setShowExportModal(false)}
      />
    )}
    </div>
  );
};
