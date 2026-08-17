import React, { useState, useRef, useCallback, useEffect } from 'react';
import { logger } from '../../utils/logger';
import { Image as ImageIcon, ChevronLeft, ChevronRight, Plus, SplitSquareHorizontal, X, Download } from 'lucide-react';
import { ExportModal } from '../../shared/components/ExportModal';
import { AIControlPanel } from '../builder/AIControlPanel';
import { LayoutEditor } from '../builder/components/LayoutEditor';
import { useAIConfigStore } from '../../stores/aiConfigStore';
import type { ReplicateImageModel, ReplicateUpscaleModel, ReplicateVideoModel } from '../../services/replicate';
import { useResolvedImage } from '../../hooks';
import { isVideoUrl } from '../builder/utils/builderHelpers';
import { downloadImage } from '../../utils/imageExport';
import './RightSidebar.css';

interface PreviewZoomStageProps {
  image?: string;
  resolvedImage?: string;
  imageType?: string | null;
  isVideo?: boolean;
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
  image, resolvedImage, imageType, isVideo, zoom, panX, panY, isPanning,
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
        (isVideo || isVideoUrl(image) || isVideoUrl(resolvedImage)) ? (
          <video
            key={image}
            src={
              resolvedImage && !resolvedImage.startsWith('idb://')
                ? resolvedImage
                : image && !image.startsWith('idb://')
                ? image
                : undefined
            }
            controls
            autoPlay
            loop
            muted
            playsInline
            className="preview-zoom-img"
            style={{ transform: `translate(${panX}px, ${panY}px) scale(${zoom})`, pointerEvents: isPanning ? 'none' : 'auto' }}
            draggable={false}
          />
        ) : (
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
        )
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
  const isVideoA = isVideoUrl(resolvedImages.A || compareImages.A);
  const isVideoB = isVideoUrl(resolvedImages.B || compareImages.B);

  if (compareImages.A && compareImages.B) {
    const srcA = resolvedImages.A ?? compareImages.A ?? '';
    const srcB = resolvedImages.B ?? compareImages.B ?? '';

    return (
      <div className="compare-container">
        {isVideoB ? (
          <video src={srcB} className="compare-base" autoPlay loop muted playsInline />
        ) : (
          <img src={srcB} className="compare-base" alt="B" />
        )}
        <div className="compare-clip" style={{ clipPath: `inset(0 ${100 - compareSplit}% 0 0)` }}>
          {isVideoA ? (
            <video src={srcA} autoPlay loop muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <img src={srcA} alt="A" />
          )}
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
        {(['A', 'B'] as const).map(slot => {
          const imgUrl = resolvedImages[slot] ?? compareImages[slot] ?? '';
          const isSlotVideo = isVideoUrl(imgUrl);
          return (
            <button
              key={slot}
              type="button"
              className={`compare-slot ${compareImages[slot] ? 'filled' : ''}`}
              onClick={() => onSetSlot(slot)}
            >
              {compareImages[slot] ? (
                <>
                  {isSlotVideo ? (
                    <video src={imgUrl} autoPlay loop muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <img src={imgUrl} alt={slot} />
                  )}
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
          );
        })}
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

  const rawSelectedImage = (selectedNode as any)?.data?.image ?? selectedNode?.image;
  const resolvedSelectedImage = useResolvedImage(rawSelectedImage);
  const resolvedCompareA = useResolvedImage(compareImages.A);
  const resolvedCompareB = useResolvedImage(compareImages.B);
  
  const previewMode = useAIConfigStore((state) => state.previewMode);
  const setPreviewMode = useAIConfigStore((state) => state.setPreviewMode);
  const selectedTool = config.selectedTool;

  useEffect(() => {
    if (selectedTool !== 'anarchy-creator' && previewMode === 'layout') {
      setPreviewMode('preview');
    }
  }, [selectedTool, previewMode, setPreviewMode]);

  const setIsRightSidebarCollapsed = useAIConfigStore((state) => state.setIsRightSidebarCollapsed);
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [showExportModal, setShowExportModal] = React.useState(false);

  const toggleCollapse = () => {
    const nextVal = !isCollapsed;
    setIsCollapsed(nextVal);
    setIsRightSidebarCollapsed(nextVal);
  };

  // Zoom/Pan state for Preview mode
  const [zoom, setZoom]         = useState(1);
  const [panX, setPanX]         = useState(0);
  const [panY, setPanY]         = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);
  const previewStageRef = useRef<HTMLButtonElement>(null);

  // Reset zoom/pan when image changes
  useEffect(() => { setZoom(1); setPanX(0); setPanY(0); }, [selectedNode?.image]);

  // Reset previewMode to preview if selected node is a video
  useEffect(() => {
    const isVid = selectedNode?.isVideo || isVideoUrl(selectedNode?.image) || isVideoUrl(resolvedSelectedImage);
    if (isVid && previewMode === 'draw') {
      setPreviewMode('preview');
    }
  }, [selectedNode, resolvedSelectedImage, previewMode]);



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

  const handleModelChange = useCallback((model: ReplicateImageModel | ReplicateUpscaleModel | ReplicateVideoModel) => {
    setConfig(prev => ({ ...prev, model }));
  }, [setConfig]);

  const handleParamsChange = useCallback((params: any) => {
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
      const tagName = (e.target as HTMLElement).tagName;
      if (tagName === 'INPUT' || tagName === 'TEXTAREA') return;
      if (e.key === '+' || e.key === '=') setZoom(z => Math.min(10, z * 1.25));
      if (e.key === '-') setZoom(z => Math.max(0.1, z / 1.25));
      if (e.key === 'f' || e.key === 'F') fitToStage();
      if (e.key === 'Enter') setIsEnlargedView(true);
    };
    globalThis.addEventListener('keydown', onKey);
    return () => globalThis.removeEventListener('keydown', onKey);
  }, [previewMode, fitToStage, setIsEnlargedView]);





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
              onClick={() => {
                setIsEnlargedView(false);
                setPreviewMode('preview');
              }}
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
                {!(selectedNode?.isVideo || isVideoUrl(selectedNode?.image) || isVideoUrl(resolvedSelectedImage)) && (
                  <>
                    <button
                      type="button"
                      className={`sidebar-tab ${previewMode === 'draw' ? 'active' : ''}`}
                      onClick={() => {
                        setPreviewMode('draw');
                        setIsEnlargedView(true);
                      }}
                    >
                      Mask
                    </button>
                    {selectedTool === 'anarchy-creator' && (
                      <button type="button" className={`sidebar-tab ${previewMode === 'layout' ? 'active' : ''}`} onClick={() => setPreviewMode('layout')}>Layers</button>
                    )}
                  </>
                )}
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
                    onClick={() => {
                      const mediaUrl = resolvedSelectedImage || selectedNode.image;
                      const isVid = selectedNode?.isVideo || isVideoUrl(mediaUrl);
                      if (isVid && mediaUrl) {
                        downloadImage(mediaUrl, selectedNode.type ?? 'video', { isVideo: true });
                      } else {
                        setShowExportModal(true);
                      }
                    }}
                    title={selectedNode?.isVideo || isVideoUrl(resolvedSelectedImage || selectedNode.image) ? "Download video (MP4)" : "Export image"}
                  ><Download size={13} /></button>
                )}
                <button
                  className={`sidebar-enlarge-btn ${isEnlargedView ? 'active' : ''}`}
                  onClick={() => {
                    if (isEnlargedView) {
                      setIsEnlargedView(false);
                      setPreviewMode('preview');
                    } else {
                      setIsEnlargedView(true);
                    }
                  }}
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
                  isVideo={selectedNode?.isVideo}
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
                  onExpand={() => setIsEnlargedView(true)}
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

              {/* LAYOUT/LAYERS MODE — Interactive Object & Bounding Box Editor */}
              {previewMode === 'layout' && (
                <div className="layout-mode-stage">
                  <LayoutEditor
                    image={resolvedSelectedImage || selectedNode?.data?.image || selectedNode?.image || null}
                    initialLayout={selectedNode?.data?.extractedLayout || selectedNode?.data?.layout || (selectedNode as any)?.extractedLayout || (selectedNode as any)?.layout}
                    onApplyResult={(newImg) => {
                      if (!selectedNode?.id) return;
                      const updatedData = { ...selectedNode.data, image: newImg };
                      setSelectedNode({ ...selectedNode, data: updatedData, image: newImg } as any);
                      nodeImageUpdateFn?.(selectedNode.id, newImg);
                      setPreviewMode('preview');
                    }}
                    onLayoutExtracted={(layoutData) => {
                      if (!selectedNode?.id) return;
                      const updatedData = { ...selectedNode.data, extractedLayout: layoutData, layout: layoutData };
                      setSelectedNode({ ...selectedNode, data: updatedData, extractedLayout: layoutData, layout: layoutData } as any);
                      nodeImageUpdateFn?.(selectedNode.id, undefined, layoutData);
                    }}
                  />
                </div>
              )}
              {previewMode === 'draw' && (
                <div className="sidebar-mask-launcher-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '20px', background: '#0a0d17', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', gap: '14px', textAlign: 'center' }}>
                  {resolvedSelectedImage || selectedNode?.image ? (
                    <>
                      <div style={{ position: 'relative', width: '100%', height: '160px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <img src={resolvedSelectedImage || selectedNode?.image || ''} alt="Node Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <button
                            type="button"
                            onClick={() => setIsEnlargedView(true)}
                            style={{ padding: '8px 16px', background: 'linear-gradient(135deg, #e11d48, #8b5cf6)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 14px rgba(225, 29, 72, 0.4)', display: 'flex', alignItems: 'center', gap: '6px' }}
                          >
                            🎨 Open Studio Mask Editor
                          </button>
                        </div>
                      </div>
                      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>Full-screen studio masking active for selected node</span>
                    </>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', color: 'rgba(255,255,255,0.4)' }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>No Image Selected</span>
                      <small style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>Click an image node on the canvas to open mask editor</small>
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
            // Seedream sequential settings
            sequentialImageGeneration: config.sequentialImageGeneration,
            maxImages: config.maxImages,
            // Custom size settings
            width: config.width,
            height: config.height,
            // Video settings
            videoDuration: config.videoDuration,
            videoQuality: config.videoQuality,
            motionStrength: config.motionStrength,
            videoFps: config.videoFps,
            // Seedance 2.0 settings
            seedanceLastFrameImage: config.seedanceLastFrameImage,
            seedanceGenerateAudio: config.seedanceGenerateAudio,
            // Kling settings
            klingStartImage: config.klingStartImage,
            klingEndImage: config.klingEndImage,
            klingReferenceImages: config.klingReferenceImages,
            klingReferenceVideo: config.klingReferenceVideo,
            klingVideoReferenceType: config.klingVideoReferenceType,
            klingKeepOriginalSound: config.klingKeepOriginalSound,
            klingGenerateAudio: config.klingGenerateAudio,
            klingMode: config.klingMode,
            // Pruna video settings
            prunaLastFrameImage: config.prunaLastFrameImage,
            prunaAudio: config.prunaAudio,
            prunaFps: config.prunaFps,
            // Google Veo settings
            veoLastFrame: config.veoLastFrame,
            veoGenerateAudio: config.veoGenerateAudio,
            // PixVerse v6 settings
            pixverseLastFrameImage: config.pixverseLastFrameImage,
            pixverseGenerateAudioSwitch: config.pixverseGenerateAudioSwitch,
            pixverseGenerateMultiClipSwitch: config.pixverseGenerateMultiClipSwitch,
            // OpenAI Sora settings
            soraInputReference: config.soraInputReference,
          }}
          onParamsChange={handleParamsChange}
        />
      </div>

    </aside>



    <button
      className="right-collapse-btn"
      onClick={toggleCollapse}
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
