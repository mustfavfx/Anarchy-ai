import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Image, ChevronLeft, ChevronRight, Plus, SplitSquareHorizontal, X, Download } from 'lucide-react';
import { ExportModal } from '../../components/ExportModal';
import { AIControlPanel } from '../builder/AIControlPanel';
import { MaskCanvas } from './MaskCanvas';
import { useAIConfigStore } from '../../stores/aiConfigStore';
import type { ReplicateImageModel, ReplicateUpscaleModel } from '../../services/replicate';
import { replicateService } from '../../services/replicate';
import './RightSidebar.css';

export const RightSidebar: React.FC = () => {
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
  
  // Mask/Draw mode state - now handled by MaskCanvas component
  const [maskResult, setMaskResult] = useState<string | null>(null);
  const [imgNaturalSize, setImgNaturalSize] = useState<{ w: number; h: number } | null>(null);

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
    prunaOutputFormat?: string;
  }) => {
    setConfig(prev => ({
      ...prev,
      ...params,
      resolution: params.resolution ?? prev.resolution,
      aspectRatio: params.aspectRatio ?? prev.aspectRatio,
    }));
  }, [setConfig]);


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

  // Handle mask generation
  const handleMaskGenerate = useCallback(async (_maskDataUrl: string, prompt: string) => {
    if (!selectedNode?.image || !prompt.trim()) return;

    try {
      const result = await replicateService.generateImg2Img({
        prompt,
        model: 'black-forest-labs/flux-kontext-pro' as ReplicateImageModel,
        strength: 0.85,
        resolution: 'Auto',
        aspectRatio: 'Auto',
      }, selectedNode.image);

      if (result.imageUrl) {
        setMaskResult(result.imageUrl);
      }
    } catch (error) {
      console.error('Mask generation failed:', error);
    }
  }, [selectedNode?.image]);

  return (
    <div className={`right-sidebar-wrapper ${isCollapsed ? 'collapsed' : ''}`}>
    <aside className="right-sidebar">
      {/* ── Enlarged mode: Mini Canvas spacer + Canvas return button ── */}
      {isEnlargedView && (
        <>
          <div className="sidebar-mini-canvas">
            {/* BuilderPage is rendered here via CSS fixed positioning (AppShell) */}
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
                        onClick={() => {
                          console.log('[Compare] Clicked A, selectedNode.id:', selectedNode?.id, 'image:', selectedNode?.image?.slice(0, 50));
                          if (!compareImages.A && selectedNode?.image) {
                            console.log('[Compare] Setting slot A with image:', selectedNode.image.slice(0, 50));
                            setCompareSlot('A', selectedNode.image);
                          } else {
                            console.log('[Compare] Cannot set A - compareImages.A:', compareImages.A, 'selectedNode.image:', !!selectedNode?.image);
                          }
                        }}
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
                        onClick={() => {
                          console.log('[Compare] Clicked B, selectedNode.id:', selectedNode?.id, 'image:', selectedNode?.image?.slice(0, 50));
                          if (!compareImages.B && selectedNode?.image) {
                            console.log('[Compare] Setting slot B with image:', selectedNode.image.slice(0, 50));
                            setCompareSlot('B', selectedNode.image);
                          } else {
                            console.log('[Compare] Cannot set B - compareImages.B:', compareImages.B, 'selectedNode.image:', !!selectedNode?.image);
                          }
                        }}
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

              {/* MASK/DRAW MODE — Using MaskCanvas Component */}
              {previewMode === 'draw' && (
                <div className="mask-container-v2">
                  <MaskCanvas
                    image={selectedNode?.image || null}
                    onGenerate={handleMaskGenerate}
                    showGenerateButton={true}
                    className="sidebar-mask-canvas"
                  />
                  {maskResult && (
                    <div className="mask-result-overlay">
                      <img src={maskResult} alt="Generated Result" />
                      <button
                        className="mask-result-close"
                        onClick={() => setMaskResult(null)}
                      >
                        <X size={16} />
                      </button>
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
            prunaQuality: config.prunaQuality,
            prunaOutputFormat: config.prunaOutputFormat,
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
