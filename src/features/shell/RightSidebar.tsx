import React, { useState, useRef, useCallback, useEffect } from 'react';
import { logger } from '../../utils/logger';
import { Image as ImageIcon, ChevronLeft, ChevronRight, Plus, SplitSquareHorizontal, X, Download } from 'lucide-react';
import { ExportModal } from '../../shared/components/ExportModal';
import { AIControlPanel } from '../builder/AIControlPanel';
import { MaskCanvas } from './MaskCanvas';
import { useAIConfigStore } from '../../stores/aiConfigStore';
import type { ReplicateImageModel, ReplicateUpscaleModel } from '../../services/replicate';
import { replicateService } from '../../services/replicate';
import { useResolvedImage } from '../../hooks';
import './RightSidebar.css';

interface PreviewZoomStageProps {
  image?: string;
  resolvedImage?: string;
  imageType?: string | null;
  zoom: number;
  panX: number;
  panY: number;
  isPanning: boolean;
  stageRef: React.RefObject<HTMLButtonElement | null>;
  onWheel: (e: React.WheelEvent) => void;
  onPanStart: (e: React.MouseEvent) => void;
  onPanMove: (e: React.MouseEvent) => void;
  onPanEnd: () => void;
  onFit: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onExpand: () => void;
}

const PreviewZoomStage: React.FC<PreviewZoomStageProps> = ({
  image, resolvedImage, imageType, zoom, panX, panY, isPanning,
  stageRef, onWheel, onPanStart, onPanMove, onPanEnd,
  onFit, onZoomIn, onZoomOut, onExpand,
}) => (
  <div className="preview-zoom-container" style={{ position: 'relative', width: '100%', height: '100%' }}>
    <button
      type="button"
      className={`preview-zoom-stage ${isPanning ? 'panning' : ''}`}
      ref={stageRef}
      onWheel={onWheel}
      onMouseDown={onPanStart}
      onMouseMove={onPanMove}
      onMouseUp={onPanEnd}
      onMouseLeave={onPanEnd}
      aria-label="Image preview area. Scroll to zoom, drag to pan."
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        margin: 0,
        width: '100%',
        height: '100%',
        display: 'block',
        cursor: isPanning ? 'grabbing' : 'grab',
        outline: 'none',
        position: 'relative'
      }}
    >
      {image ? (
        <img
          key={image}
          src={
            resolvedImage && !resolvedImage.startsWith('idb://')
              ? resolvedImage
              : image && !image.startsWith('idb://')
              ? image
              : undefined
          }
          alt={imageType || 'Node'}
          className="preview-zoom-img"
          style={{ transform: `translate(${panX}px, ${panY}px) scale(${zoom})` }}
          onError={e => { e.currentTarget.style.display = 'none'; }}
          onLoad={e => { e.currentTarget.style.display = ''; }}
          draggable={false}
        />
      ) : (
        <div className="preview-stage-content">
          <ImageIcon size={26} />
          <span>No image selected</span>
          <small>Click a node to view its image</small>
        </div>
      )}
    </button>

    {image && (
      <>
        <div className="preview-zoom-controls">
          <button className="pz-btn" onClick={onZoomIn} title="Zoom In (+)">+</button>
          <span className="pz-label">{Math.round(zoom * 100)}%</span>
          <button className="pz-btn" onClick={onZoomOut} title="Zoom Out (-)">−</button>
          <button className="pz-btn" onClick={onFit} title="Fit (F)">⊡</button>
          <button className="pz-btn" onClick={onExpand} title="Fullscreen">⛶</button>
        </div>
        {zoom === 1 && panX === 0 && panY === 0 && (
          <span className="preview-zoom-hint" style={{ pointerEvents: 'none' }}>
            Scroll to zoom · Drag to pan
          </span>
        )}
      </>
    )}
  </div>
);

interface CompareSectionProps {
  compareImages: { A: string | null; B: string | null };
  resolvedImages: { A: string | null; B: string | null };
  compareSplit: number;
  onSplitChange: (val: number) => void;
  onSwap: () => void;
  onClear: () => void;
  onSetSlot: (slot: 'A' | 'B') => void;
  onClearSlot: (slot: 'A' | 'B') => void;
}

const CompareSection: React.FC<CompareSectionProps> = ({
  compareImages, resolvedImages, compareSplit, onSplitChange, onSwap, onClear, onSetSlot, onClearSlot,
}) => {
  if (compareImages.A && compareImages.B) {
    return (
      <div className="compare-container">
        <img src={resolvedImages.B ?? compareImages.B ?? ''} className="compare-base" alt="B" />
        <div className="compare-clip" style={{ clipPath: `inset(0 ${100 - compareSplit}% 0 0)` }}>
          <img src={resolvedImages.A ?? compareImages.A ?? ''} alt="A" />
        </div>
        <div className="compare-handle" style={{ left: `${compareSplit}%` }}>
          <div className="compare-handle-line" />
          <div className="compare-handle-circle"><SplitSquareHorizontal size={12} /></div>
        </div>
        <span className="compare-label compare-label-a">A</span>
        <span className="compare-label compare-label-b">B</span>
        <input type="range" min="0" max="100" value={compareSplit}
          onChange={e => onSplitChange(Number(e.target.value))}
          className="compare-slider-input" />
        <div className="compare-toolbar">
          <button className="compare-tool-btn" onClick={onSwap} title="Swap A ↔ B">⇄</button>
          <button className="compare-tool-btn" onClick={onClear} title="Clear both"><X size={12} /></button>
        </div>
      </div>
    );
  }
  return (
    <div className="compare-container">
      <div className="compare-empty">
        {(['A', 'B'] as const).map(slot => (
          <button
            key={slot}
            type="button"
            className={`compare-slot ${compareImages[slot] ? 'filled' : ''}`}
            onClick={() => onSetSlot(slot)}
          >
            {compareImages[slot] ? (
              <>
                <img src={resolvedImages[slot] ?? compareImages[slot] ?? ''} alt={slot} />
                <button className="compare-slot-clear"
                  onClick={e => { e.stopPropagation(); onClearSlot(slot); }}>
                  <X size={12} />
                </button>
                <span className="compare-slot-label">{slot}</span>
              </>
            ) : (
              <>
                <Plus size={20} />
                <span>Select Image {slot}</span>
                <small>Click or right-click node</small>
              </>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export const RightSidebar: React.FC = () => {
  const config = useAIConfigStore((state) => state.config);
  const setConfig = useAIConfigStore((state) => state.setConfig);
  const selectedNode = useAIConfigStore((state) => state.selectedNode);
  const compareImages = useAIConfigStore((state) => state.compareImages);
  const setCompareImages = useAIConfigStore((state) => state.setCompareImages);
  const setCompareSlot = useAIConfigStore((state) => state.setCompareSlot);
  const isEnlargedView = useAIConfigStore((state) => state.isEnlargedView);
  const setIsEnlargedView = useAIConfigStore((state) => state.setIsEnlargedView);
  const setSelectedNode = useAIConfigStore((state) => state.setSelectedNode);
  const nodeImageUpdateFn = useAIConfigStore((state) => state.nodeImageUpdateFn);

  const resolvedSelectedImage = useResolvedImage(selectedNode?.image);
  const resolvedCompareA = useResolvedImage(compareImages.A);
  const resolvedCompareB = useResolvedImage(compareImages.B);
  
  const [previewMode, setPreviewMode] = React.useState<'preview' | 'compare' | 'draw'>('preview');
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [showExpandModal, setShowExpandModal] = React.useState(false);
  const [showExportModal, setShowExportModal] = React.useState(false);
  const [expandModalTab, setExpandModalTab] = React.useState<'preview' | 'draw'>('preview');

  // Zoom/Pan state for Preview mode
  const [zoom, setZoom]         = useState(1);
  const [panX, setPanX]         = useState(0);
  const [panY, setPanY]         = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);
  const previewStageRef = useRef<HTMLButtonElement>(null);

  // Reset zoom/pan when image changes
  useEffect(() => { setZoom(1); setPanX(0); setPanY(0); }, [selectedNode?.image]);

  // Handle escape key to close fullscreen preview modal
  useEffect(() => {
    if (!showExpandModal) return;
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowExpandModal(false);
    };
    globalThis.addEventListener('keydown', handleGlobalKeyDown);
    return () => globalThis.removeEventListener('keydown', handleGlobalKeyDown);
  }, [showExpandModal]);

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
  const [compareSplit, setCompareSplit] = useState(50);

  // Mask/Draw mode state
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
    topazUpscaleFactor?: string;
    topazSubjectDetection?: string;
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
    clarityPattern?: string;
    clarityResemblance?: number;
    clarityOutputFormat?: string;
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

  // Handle crop — update selectedNode store AND the actual ReactFlow node data
  const handleCrop = useCallback((croppedDataUrl: string) => {
    if (!selectedNode?.id) return;
    setSelectedNode({ ...selectedNode, image: croppedDataUrl });
    nodeImageUpdateFn?.(selectedNode.id, croppedDataUrl);
    setPreviewMode('preview');
  }, [selectedNode, setSelectedNode, nodeImageUpdateFn]);

  // Handle mask generation
  const handleMaskGenerate = useCallback(async (_maskDataUrl: string, prompt: string) => {
    if (!selectedNode?.image || !prompt.trim()) return;

    try {
      const result = await replicateService.generateImg2Img({
        prompt,
        model: 'black-forest-labs/flux-kontext-pro',
        strength: 0.85,
        resolution: 'Auto',
        aspectRatio: 'Auto',
      }, selectedNode.image);

      if (result.imageUrl) {
        setMaskResult(result.imageUrl);
      }
    } catch (error) {
      logger.error('Mask generation failed:', error);
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
                {selectedNode?.image && selectedNode?.originalImage && selectedNode.image !== selectedNode.originalImage && (
                  <button
                    className="sidebar-enlarge-btn revert-btn"
                    onClick={() => {
                      if (selectedNode.id && selectedNode.originalImage) {
                        nodeImageUpdateFn?.(selectedNode.id, selectedNode.originalImage);
                        setSelectedNode({ ...selectedNode, image: selectedNode.originalImage });
                      }
                    }}
                    title="Revert to original uncropped image"
                    style={{ marginRight: '6px', background: 'rgba(225,29,72,0.15)', borderColor: 'rgba(225,29,72,0.3)', color: '#fecdd3' }}
                  >
                    Revert
                  </button>
                )}
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
                <PreviewZoomStage
                  image={selectedNode?.image}
                  resolvedImage={resolvedSelectedImage}
                  imageType={selectedNode?.type}
                  zoom={zoom}
                  panX={panX}
                  panY={panY}
                  isPanning={isPanning}
                  stageRef={previewStageRef}
                  onWheel={handleWheel}
                  onPanStart={handlePanStart}
                  onPanMove={handlePanMove}
                  onPanEnd={handlePanEnd}
                  onFit={fitToStage}
                  onZoomIn={() => setZoom(z => Math.min(10, z * 1.25))}
                  onZoomOut={() => setZoom(z => Math.max(0.1, z / 1.25))}
                  onExpand={() => setShowExpandModal(true)}
                />
              )}

              {/* COMPARE MODE */}
              {previewMode === 'compare' && (
                <CompareSection
                  compareImages={compareImages}
                  resolvedImages={{ A: resolvedCompareA ?? null, B: resolvedCompareB ?? null }}
                  compareSplit={compareSplit}
                  onSplitChange={setCompareSplit}
                  onSwap={() => setCompareImages({ A: compareImages.B, B: compareImages.A })}
                  onClear={() => setCompareImages({ A: null, B: null })}
                  onSetSlot={slot => {
                    if (!compareImages[slot] && selectedNode?.image) {
                      logger.log(`[Compare] Setting slot ${slot}:`, selectedNode.image.slice(0, 50));
                      setCompareSlot(slot, selectedNode.image);
                    }
                  }}
                  onClearSlot={slot => setCompareImages(prev => ({ ...prev, [slot]: null }))}
                />
              )}

              {/* MASK/DRAW MODE — Using MaskCanvas Component */}
              {previewMode === 'draw' && (
                <div className="mask-container-v2">
                  <MaskCanvas
                    image={resolvedSelectedImage || null}
                    onGenerate={handleMaskGenerate}
                    onCrop={handleCrop}
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
            topazUpscaleFactor: config.topazUpscaleFactor,
            topazSubjectDetection: config.topazSubjectDetection,
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
            clarityResemblance: config.clarityResemblance,
            clarityOutputFormat: config.clarityOutputFormat,
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
        <dialog
          aria-label="Fullscreen image preview"
          className="preview-expand-modal"
          open
          style={{ outline: 'none' }}
        >
          <button type="button" className="preview-expand-backdrop" onClick={() => setShowExpandModal(false)} aria-label="Close preview" />
          <div className="preview-expand-content">
            {/* Top bar */}
            <div className="preview-expand-topbar">
              <span className="preview-expand-title">
                {selectedNode.type ?? 'Image'}
                {imgNaturalSize && (
                  <span className="preview-expand-dims"> · {imgNaturalSize.w}×{imgNaturalSize.h}</span>
                )}
              </span>
              {/* Tab switcher */}
              <div className="preview-expand-tabs">
                <button
                  className={`preview-expand-tab ${expandModalTab === 'preview' ? 'active' : ''}`}
                  onClick={() => setExpandModalTab('preview')}
                  title="Preview"
                >
                  Preview
                </button>
                <button
                  className={`preview-expand-tab ${expandModalTab === 'draw' ? 'active' : ''}`}
                  onClick={() => setExpandModalTab('draw')}
                  title="Mask / Crop"
                >
                  Mask &amp; Crop
                </button>
              </div>
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
            {expandModalTab === 'preview' ? (
              <img
                key={selectedNode.image}
                src={
                  resolvedSelectedImage && !resolvedSelectedImage.startsWith('idb://')
                    ? resolvedSelectedImage
                    : selectedNode.image && !selectedNode.image.startsWith('idb://')
                    ? selectedNode.image
                    : undefined
                }
                alt={selectedNode.type || 'Node'}
                className="preview-expand-image"
                onLoad={e => {
                  const t = e.currentTarget;
                  t.style.display = '';
                  setImgNaturalSize({ w: t.naturalWidth, h: t.naturalHeight });
                }}
                onError={e => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <div className="preview-expand-mask-wrap">
                <MaskCanvas
                  image={resolvedSelectedImage || null}
                  onGenerate={handleMaskGenerate}
                  onCrop={(cropped) => {
                    setSelectedNode({ ...selectedNode, image: cropped });
                    if (selectedNode?.id) {
                      nodeImageUpdateFn?.(selectedNode.id, cropped);
                    }
                    setExpandModalTab('preview');
                  }}
                  showGenerateButton={true}
                  className="expand-modal-mask-canvas"
                />
              </div>
            )}
          </div>
        </dialog>
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
        imageUrl={resolvedSelectedImage || selectedNode.image}
        imageName={selectedNode.type ?? 'anarchy-image'}
        onClose={() => setShowExportModal(false)}
      />
    )}
    </div>
  );
};
