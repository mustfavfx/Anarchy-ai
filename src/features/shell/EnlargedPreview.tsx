import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X, Download, Maximize2, Minimize2 } from 'lucide-react';
import { useAIConfigStore } from '../../stores/aiConfigStore';
import { downloadImage } from '../../utils/imageExport';
import './EnlargedPreview.css';

// ─── EnlargedPreview ─────────────────────────────────────────────────────────
// Fills the main content area when isEnlargedView === true.
// Mirrors VizMaker's Enlarge mode: Preview / Compare / Draw tabs
// with real Zoom/Pan, ZoomPercent overlay, and image dimensions.

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

  const panRef = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);
  const image  = selectedNode?.image ?? null;

  // Reset zoom/pan when image changes
  useEffect(() => { setZoom(1); setPanX(0); setPanY(0); setImgMeta(null); }, [image]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === 'Escape') { if (isFullscreen) setIsFullscreen(false); else setIsEnlargedView(false); }
      if (e.key === '+' || e.key === '=') setZoom(z => Math.min(10, z * 1.2));
      if (e.key === '-') setZoom(z => Math.max(0.05, z / 1.2));
      if (e.key === 'f' || e.key === 'F') { setZoom(1); setPanX(0); setPanY(0); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setIsEnlargedView, isFullscreen]);

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
      {/* ── Top bar — matches VizMaker layout ── */}
      <div className="ep-topbar">
        {/* Left: tabs */}
        <div className="ep-tabs">
          {(['preview', 'compare', 'draw'] as const).map(t => (
            <button
              key={t}
              className={`ep-tab ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'draw' ? 'Draw' : t === 'compare' ? 'Compare' : 'Preview'}
            </button>
          ))}
        </div>

        {/* Center: image info + zoom controls */}
        <div className="ep-topbar-center">
          {image && tab === 'preview' && imgMeta && (
            <span className="ep-img-dims">{imgMeta.w} × {imgMeta.h}</span>
          )}
          {image && tab === 'preview' && (
            <div className="ep-zoom-group">
              <button className="ep-icon-btn" onClick={() => setZoom(z => Math.min(10, z * 1.25))} title="Zoom In (+)">+</button>
              <span className="ep-zoom-pct">{Math.round(zoom * 100)}%</span>
              <button className="ep-icon-btn" onClick={() => setZoom(z => Math.max(0.05, z / 1.25))} title="Zoom Out (-)">−</button>
              <button className="ep-icon-btn" onClick={fit} title="Fit to screen (F)">⊡</button>
            </div>
          )}
        </div>

        {/* Right: actions */}
        <div className="ep-topbar-actions">
          {image && (
            <button
              className="ep-icon-btn"
              onClick={() => setIsFullscreen(f => !f)}
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
          )}
          {image && (
            <button
              className="ep-icon-btn"
              onClick={() => downloadImage(image, selectedNode?.type ?? 'image')}
              title="Download"
            >
              <Download size={13} />
            </button>
          )}
          <button
            className="ep-icon-btn ep-close-btn"
            onClick={() => setIsEnlargedView(false)}
            title="Back to canvas (Esc)"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Fullscreen overlay */}
      {isFullscreen && image && (
        <div
          className="ep-fullscreen-overlay"
          onClick={() => setIsFullscreen(false)}
        >
          <img
            src={image}
            alt="Fullscreen"
            className="ep-fullscreen-img"
            onClick={e => e.stopPropagation()}
          />
          <button className="ep-fullscreen-close" onClick={() => setIsFullscreen(false)} title="Close (Esc)">
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Stage ── */}
      <div className="ep-stage">

        {/* PREVIEW tab */}
        {tab === 'preview' && (
          <div
            className={`ep-zoom-stage ${isPanning ? 'panning' : ''}`}
            onWheel={handleWheel}
            onMouseDown={onPanStart}
            onMouseMove={onPanMove}
            onMouseUp={onPanEnd}
            onMouseLeave={onPanEnd}
          >
            {image ? (
              <img
                src={image}
                alt="Preview"
                className="ep-zoom-img"
                draggable={false}
                style={{ transform: `translate(${panX}px,${panY}px) scale(${zoom})` }}
                onLoad={e => {
                  const t = e.currentTarget;
                  setImgMeta({ w: t.naturalWidth, h: t.naturalHeight });
                }}
              />
            ) : (
              <div className="ep-empty">
                <span>No image selected</span>
                <small>Click a node on the canvas</small>
              </div>
            )}
          </div>
        )}

        {/* COMPARE tab */}
        {tab === 'compare' && (
          <div className="ep-compare">
            {compareImages.A && compareImages.B ? (
              <div className="ep-compare-active">
                <img src={compareImages.B} className="ep-compare-base" alt="B" />
                <div className="ep-compare-clip" style={{ clipPath: `inset(0 ${100 - compareSplit}% 0 0)` }}>
                  <img src={compareImages.A} alt="A" />
                </div>
                <div className="ep-compare-handle" style={{ left: `${compareSplit}%` }}>
                  <div className="ep-compare-line" />
                  <div className="ep-compare-knob">⇄</div>
                </div>
                <input
                  type="range" min={0} max={100} value={compareSplit}
                  onChange={e => setCompareSplit(Number(e.target.value))}
                  className="ep-compare-slider"
                />
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
                  <div
                    key={slot}
                    className={`ep-compare-slot ${compareImages[slot] ? 'filled' : ''}`}
                    onClick={() => { if (!compareImages[slot] && image) setCompareSlot(slot, image); }}
                  >
                    {compareImages[slot] ? (
                      <>
                        <img src={compareImages[slot]!} alt={slot} />
                        <button
                          className="ep-slot-clear"
                          onClick={e => { e.stopPropagation(); setCompareImages(p => ({ ...p, [slot]: null })); }}
                        ><X size={12} /></button>
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
                ))}
              </div>
            )}
          </div>
        )}

        {/* DRAW tab — simplified hint in enlarged view */}
        {tab === 'draw' && (
          <div className="ep-empty">
            <span>Use Mask tab in the right panel</span>
            <small>Switch back to canvas view for drawing tools</small>
          </div>
        )}

      </div>
    </div>
  );
};
