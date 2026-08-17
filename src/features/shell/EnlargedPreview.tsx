import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X, Download, Maximize2, Minimize2 } from 'lucide-react';
import { useAIConfigStore } from '../../stores/aiConfigStore';
import { downloadImage } from '../../utils/imageExport';
import { useResolvedImage } from '../../hooks';
import { isVideoUrl } from '../builder/utils/builderHelpers';
import { MaskCanvas } from './MaskCanvas';
import { LayoutEditor } from '../builder/components/LayoutEditor';
import { ConnectedNodeInspectorPanel } from '../builder/inspector/ConnectedNodeInspectorPanel';
import './EnlargedPreview.css';
import './MaskCanvas.css';

// ─── EnlargedPreview ─────────────────────────────────────────────────────────
// Fills the main content area when isEnlargedView === true.
// Mirrors VizMaker's Enlarge mode: Preview / Compare / Mask / Layers tabs
// with real Zoom/Pan, ZoomPercent overlay, image dimensions, and FULL interactive layout editing.

export const EnlargedPreview: React.FC = () => {
  const config            = useAIConfigStore(s => s.config);
  const selectedNode    = useAIConfigStore(s => s.selectedNode);
  const setSelectedNode = useAIConfigStore(s => s.setSelectedNode);
  const nodeImageUpdateFn = useAIConfigStore(s => s.nodeImageUpdateFn);
  const compareImages   = useAIConfigStore(s => s.compareImages);
  const setCompareImages = useAIConfigStore(s => s.setCompareImages);
  const setCompareSlot  = useAIConfigStore(s => s.setCompareSlot);
  const setPreviewMode   = useAIConfigStore(s => s.setPreviewMode);
  const previewMode      = useAIConfigStore(s => s.previewMode);
  const setIsEnlargedView = useAIConfigStore(s => s.setIsEnlargedView);

  const image = (selectedNode as any)?.data?.image ?? selectedNode?.image ?? null;
  const resolvedImage = useResolvedImage(image);
  const resolvedCompareA = useResolvedImage(compareImages.A);
  const resolvedCompareB = useResolvedImage(compareImages.B);
  const resolvedCompareImages = { A: resolvedCompareA, B: resolvedCompareB };

  const getSafeSrc = (resolved: string | null | undefined, raw: string | null | undefined) => {
    if (resolved && !resolved.startsWith('idb://')) return resolved;
    if (raw && !raw.startsWith('idb://')) return raw;
    return undefined;
  };

  const [tab, setTab]         = useState<'preview' | 'compare' | 'draw' | 'enhance' | 'layout'>('preview');
  const [zoom, setZoom]         = useState(1);
  const [panX, setPanX]         = useState(0);
  const [panY, setPanY]         = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [compareSplit, setCompareSplit] = useState(50);
  const [imgMeta, setImgMeta]   = useState<{ w: number; h: number } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const panRef = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);

  useEffect(() => {
    if (config.selectedTool !== 'anarchy-creator' && tab === 'layout') {
      setTab('preview');
      setPreviewMode('preview');
    }
  }, [config.selectedTool, tab, setPreviewMode]);

  // Sync store previewMode into local tab state
  useEffect(() => {
    if (previewMode === 'draw' && tab !== 'draw') setTab('draw');
    else if (previewMode === 'preview' && tab !== 'preview') setTab('preview');
    else if (previewMode === 'compare' && tab !== 'compare') setTab('compare');
    else if (previewMode === 'layout' && tab !== 'layout' && config.selectedTool === 'anarchy-creator') setTab('layout');
    // 'enhance' tab has no previewMode counterpart — stays local only
  }, [previewMode, config.selectedTool]);

  // Tab change handler
  const handleTabChange = useCallback((t: 'preview' | 'compare' | 'draw' | 'layout') => {
    setTab(t);
    setPreviewMode(t as any);
  }, [setPreviewMode]);

  // Close enlarged view handler: resets mode to preview and hides enlarged view
  const handleCloseEnlargedView = useCallback(() => {
    setIsEnlargedView(false);
    setPreviewMode('preview');
    setTab('preview');
  }, [setIsEnlargedView, setPreviewMode]);

  // Reset zoom/pan when image changes
  useEffect(() => { setZoom(1); setPanX(0); setPanY(0); setImgMeta(null); }, [image]);

  // Reset tab to preview if video node is selected while on draw or layout tab
  useEffect(() => {
    const isVid = selectedNode?.isVideo || isVideoUrl(image) || isVideoUrl(resolvedImage);
    if (isVid && (tab === 'draw' || tab === 'layout')) {
      handleTabChange('preview');
    }
  }, [selectedNode, image, resolvedImage, tab, handleTabChange]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === 'Escape') {
        if (isFullscreen) setIsFullscreen(false);
        else handleCloseEnlargedView();
      }
      if (tab === 'preview') {
        if (e.key === '+' || e.key === '=') setZoom(z => Math.min(10, z * 1.2));
        if (e.key === '-') setZoom(z => Math.max(0.05, z / 1.2));
        if (e.key === 'f' || e.key === 'F') { setZoom(1); setPanX(0); setPanY(0); }
      }
    };
    globalThis.addEventListener('keydown', onKey);
    return () => globalThis.removeEventListener('keydown', onKey);
  }, [handleCloseEnlargedView, isFullscreen, tab]);

  useEffect(() => {
    const handleInPlaceGen = (e: Event) => {
      const customEv = e as CustomEvent<{ imageUrl: string; sourceNodeId?: string }>;
      if (customEv.detail?.imageUrl) {
        if (selectedNode?.id) {
          setSelectedNode(prev => prev ? { ...prev, image: customEv.detail.imageUrl } : null);
        }
      }
    };
    window.addEventListener('anarchy:mask-generated-in-place', handleInPlaceGen);
    return () => window.removeEventListener('anarchy:mask-generated-in-place', handleInPlaceGen);
  }, [selectedNode?.id]);

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

  return (
    <div className="enlarged-preview">
      {/* ── Top bar ── */}
      <div className="ep-topbar">
        <div className="ep-tabs">
          {(['preview', 'compare', 'draw', 'enhance', 'layout'] as const).map(t => {
            const isVid = selectedNode?.isVideo || isVideoUrl(image) || isVideoUrl(resolvedImage);
            if ((t === 'draw' || t === 'enhance' || t === 'layout') && isVid) return null;
            if (t === 'layout' && config.selectedTool !== 'anarchy-creator') return null;
            if ((t === 'draw' || t === 'enhance') && !image) return null;
            return (
              <button
                key={t}
                className={`ep-tab ${tab === t ? 'active' : ''}`}
                onClick={() => handleTabChange(t as any)}
              >
                {t === 'draw' ? 'Mask' : t === 'compare' ? 'Compare' : t === 'layout' ? 'Layers' : t === 'enhance' ? 'Enhance' : 'Preview'}
              </button>
            );
          })}
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
          <button className="ep-icon-btn ep-close-btn" onClick={handleCloseEnlargedView} title="Back to canvas (Esc)">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Fullscreen overlay */}
      {isFullscreen && image && (
        <div className="ep-fullscreen-overlay" onClick={() => setIsFullscreen(false)}>
          {(selectedNode?.isVideo || isVideoUrl(image) || isVideoUrl(resolvedImage)) ? (
            <video src={getSafeSrc(resolvedImage, image)} controls autoPlay loop muted playsInline className="ep-fullscreen-img" onClick={e => e.stopPropagation()} />
          ) : (
            <img src={getSafeSrc(resolvedImage, image)} alt="Fullscreen" className="ep-fullscreen-img" onClick={e => e.stopPropagation()} />
          )}
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
              (selectedNode?.isVideo || isVideoUrl(image) || isVideoUrl(resolvedImage)) ? (
                <video
                  src={getSafeSrc(resolvedImage, image)}
                  controls
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="ep-zoom-img"
                  draggable={false}
                  style={{ transform: `translate(${panX}px,${panY}px) scale(${zoom})`, pointerEvents: isPanning ? 'none' : 'auto' }}
                  onLoadedMetadata={e => setImgMeta({ w: e.currentTarget.videoWidth, h: e.currentTarget.videoHeight })}
                />
              ) : (
                <img
                  src={getSafeSrc(resolvedImage, image)}
                  alt="Preview"
                  className="ep-zoom-img"
                  draggable={false}
                  style={{ transform: `translate(${panX}px,${panY}px) scale(${zoom})` }}
                  onLoad={e => setImgMeta({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                />
              )
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
                {(isVideoUrl(compareImages.B) || isVideoUrl(resolvedCompareB)) ? (
                  <video src={getSafeSrc(resolvedCompareB, compareImages.B)} className="ep-compare-base" autoPlay loop muted playsInline />
                ) : (
                  <img src={getSafeSrc(resolvedCompareB, compareImages.B)} className="ep-compare-base" alt="B" />
                )}
                <div className="ep-compare-clip" style={{ clipPath: `inset(0 ${100 - compareSplit}% 0 0)` }}>
                  {(isVideoUrl(compareImages.A) || isVideoUrl(resolvedCompareA)) ? (
                    <video src={getSafeSrc(resolvedCompareA, compareImages.A)} autoPlay loop muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <img src={getSafeSrc(resolvedCompareA, compareImages.A)} alt="A" />
                  )}
                </div>
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
                {(['A', 'B'] as const).map(slot => {
                  const imgUrl = getSafeSrc(resolvedCompareImages[slot], compareImages[slot]) || '';
                  const isSlotVideo = isVideoUrl(compareImages[slot]) || isVideoUrl(resolvedCompareImages[slot]);
                  return (
                    <div key={slot} className={`ep-compare-slot ${compareImages[slot] ? 'filled' : ''}`} onClick={() => { if (!compareImages[slot] && image) setCompareSlot(slot, image); }}>
                      {compareImages[slot] ? (
                        <>
                          {isSlotVideo ? (
                            <video src={imgUrl} autoPlay loop muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <img src={imgUrl} alt={slot} />
                          )}
                          <button className="ep-slot-clear" onClick={e => { e.stopPropagation(); setCompareImages(p => ({ ...p, [slot]: null })); }}><X size={12} /></button>
                          <span className="ep-slot-label">{slot}</span>
                        </>
                      ) : (
                        <>
                          <span className="ep-slot-plus">+</span>
                          <span>Set as {slot}</span>
                          <small>{image ? 'Click to use selected node' : 'Select a node first'}</small>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* DRAW/Mask tab - INTEGRATED MASK CANVAS */}
        {tab === 'draw' && (
          <div className="ep-draw-stage" style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden' }}>
            {image ? (
              <MaskCanvas
                image={getSafeSrc(resolvedImage, image) || null}
                showGenerateButton={true}
                isGenerating={
                  selectedNode?.data?.state === 'generating' ||
                  selectedNode?.data?.state === 'processing' ||
                  selectedNode?.data?.state === 'connecting'
                }
                onGenerate={(composite, mask, prompt, refImages) => {
                  window.dispatchEvent(new CustomEvent('anarchy:mask-generate', {
                    detail: {
                      compositeImage: composite,
                      maskDataUrl: mask,
                      prompt: prompt,
                      refImages: refImages,
                      sourceNodeId: selectedNode?.id
                    }
                  }));
                }}
                onCrop={(croppedUrl) => {
                  if (selectedNode?.id && nodeImageUpdateFn) {
                    nodeImageUpdateFn(selectedNode.id, croppedUrl);
                  }
                }}
              />
            ) : (
              <div className="ep-empty">
                <span>No image selected</span>
                <small>Select an image to start masking</small>
              </div>
            )}
          </div>
        )}

        {/* ENHANCE tab — Smart Enlarge + Smart Mask Inspector */}
        {tab === 'enhance' && (
          <div className="ep-enhance-stage" style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'auto', padding: '16px', boxSizing: 'border-box' }}>
            {image && selectedNode?.id ? (
              <ConnectedNodeInspectorPanel
                nodeId={selectedNode.id}
                sourceImageUrl={getSafeSrc(resolvedImage, image) || image || ''}
                onImageCommitted={(url) => {
                  if (selectedNode?.id && nodeImageUpdateFn) {
                    nodeImageUpdateFn(selectedNode.id, url);
                  }
                  setSelectedNode({ ...selectedNode, image: url } as any);
                  setTab('preview');
                  setPreviewMode('preview');
                }}
              />
            ) : (
              <div className="ep-empty">
                <span>No image selected</span>
                <small>Select an image node on the canvas to use Enhance</small>
              </div>
            )}
          </div>
        )}

        {/* LAYOUT / LAYERS tab - LARGE INTERACTIVE OBJECTS & BOUNDING BOXES */}
        {tab === 'layout' && (
          <div className="ep-layout-stage" style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden', padding: '8px' }}>
            <LayoutEditor
              image={resolvedImage || selectedNode?.data?.image || image || null}
              initialLayout={selectedNode?.data?.extractedLayout || selectedNode?.data?.layout || (selectedNode as any)?.extractedLayout || (selectedNode as any)?.layout}
              isEnlargedView={true}
              onApplyResult={(newImg) => {
                if (selectedNode?.id && nodeImageUpdateFn) {
                  nodeImageUpdateFn(selectedNode.id, newImg);
                  const updatedData = { ...selectedNode.data, image: newImg };
                  setSelectedNode({ ...selectedNode, data: updatedData, image: newImg } as any);
                }
                handleCloseEnlargedView();
              }}
              onLayoutExtracted={(extractedLayout) => {
                if (selectedNode?.id && nodeImageUpdateFn) {
                  const updatedData = { ...selectedNode.data, extractedLayout: extractedLayout, layout: extractedLayout };
                  setSelectedNode({ ...selectedNode, data: updatedData, extractedLayout: extractedLayout, layout: extractedLayout } as any);
                  nodeImageUpdateFn(selectedNode.id, undefined, extractedLayout);
                }
              }}
            />
          </div>
        )}

      </div>
    </div>
  );
};
