import React from 'react';
import {
  ZoomIn, ZoomOut, Maximize, Loader2, AlertCircle, Trash2, X, Plus,
  Sparkles, Layers, Tag, Eye, Paperclip, AtSign, Check, Sliders
} from 'lucide-react';
import {
  type LayoutData, type LayoutRegion, type TextOverlay, type StickyNote,
  type CropBounds, REGION_COLORS
} from './types';

export interface LayoutStageProps {
  isEnlargedView?: boolean;
  imageHistory: string[];
  activeStageImage: string | null;
  setActiveStageImage: (url: string) => void;
  zoomLevel: number;
  setZoomLevel: React.Dispatch<React.SetStateAction<number>>;
  reframeScale: number;
  setReframeScale: React.Dispatch<React.SetStateAction<number>>;
  totalScaleFactor: number;
  isExtracting: boolean;
  isRendering: boolean;
  extractError: string | null;
  handleExtractLayout: (force: boolean) => void;
  isReframeActive: boolean;
  stageRef: React.RefObject<HTMLDivElement | null>;
  imageContainerRef: React.RefObject<HTMLDivElement | null>;
  handleStageMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleStageMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleStageMouseUp: () => void;
  resolvedUrl?: string | null;
  displayImage?: string | null;
  rawImage?: string | null;
  filterStyle: string;
  activeToolbarTool: string;
  maskCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  vanishingPoint: { x: number; y: number };
  setVanishingPoint: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  setIsDragging3DVanishingPoint: (dragging: boolean) => void;
  textOverlays: TextOverlay[];
  setTextOverlays: React.Dispatch<React.SetStateAction<TextOverlay[]>>;
  activeTextId: string | null;
  setActiveTextId: (id: string | null) => void;
  setDraggingTextId: (id: string | null) => void;
  setTextDragStartPos: (pos: { x: number; y: number } | null) => void;
  setInitialTextPos: (pos: { x: number; y: number } | null) => void;
  stickyNotes: StickyNote[];
  setStickyNotes: React.Dispatch<React.SetStateAction<StickyNote[]>>;
  setDraggingNoteId: (id: string | null) => void;
  setNoteDragStartPos: (pos: { x: number; y: number } | null) => void;
  setInitialNotePos: (pos: { x: number; y: number } | null) => void;
  isDrawingBbox: boolean;
  drawStart: { x: number; y: number } | null;
  drawCurrent: { x: number; y: number } | null;
  layout: LayoutData | null;
  selectedRegionIdx: number | null;
  selectedRegion: LayoutRegion | null;
  handleSelectRegion: (idx: number) => void;
  setSelectedRegionIdx: (idx: number | null) => void;
  searchQuery?: string;
  regionPrompts: Record<number, string>;
  updateRegionPrompt: (idx: number, prompt: string) => void;
  activeEditingIdx: number | null;
  setActiveEditingIdx: (idx: number | null) => void;
  handleApplyEdits: () => void;
  maskPrompt: string;
  setMaskPrompt: React.Dispatch<React.SetStateAction<string>>;
  handleApplyMaskEdit: () => void;
  cropBounds: CropBounds;
  activeCropHandle: string | null;
  hoveredRegionIdx: number | null;
  setHoveredRegionIdx: (idx: number | null) => void;
  activeRegionHandle: string | null;
  handleRegionHandleMouseDown: (handle: string, idx: number, e: React.MouseEvent) => void;
  handleCropHandleMouseDown: (handle: string, e: React.MouseEvent) => void;
  brushSize: number;
  setBrushSize: (size: number) => void;
  brushColor: string;
  setBrushColor: (color: string) => void;
  clearMaskCanvas: () => void;
  fileInputRef?: React.RefObject<HTMLInputElement | null>;
}

export const LayoutStage: React.FC<LayoutStageProps> = ({
  isEnlargedView,
  imageHistory,
  activeStageImage,
  setActiveStageImage,
  zoomLevel,
  setZoomLevel,
  reframeScale,
  setReframeScale,
  totalScaleFactor,
  isExtracting,
  isRendering,
  extractError,
  handleExtractLayout,
  isReframeActive,
  stageRef,
  imageContainerRef,
  handleStageMouseDown,
  handleStageMouseMove,
  handleStageMouseUp,
  resolvedUrl,
  displayImage,
  rawImage,
  filterStyle,
  activeToolbarTool,
  maskCanvasRef,
  vanishingPoint,
  setVanishingPoint,
  setIsDragging3DVanishingPoint,
  textOverlays,
  setTextOverlays,
  activeTextId,
  setActiveTextId,
  setDraggingTextId,
  setTextDragStartPos,
  setInitialTextPos,
  stickyNotes,
  setStickyNotes,
  setDraggingNoteId,
  setNoteDragStartPos,
  setInitialNotePos,
  isDrawingBbox,
  drawStart,
  drawCurrent,
  layout,
  selectedRegionIdx,
  selectedRegion,
  handleSelectRegion,
  setSelectedRegionIdx,
  searchQuery,
  regionPrompts,
  updateRegionPrompt,
  activeEditingIdx,
  setActiveEditingIdx,
  handleApplyEdits,
  maskPrompt,
  setMaskPrompt,
  handleApplyMaskEdit,
  cropBounds,
  activeCropHandle,
  hoveredRegionIdx,
  setHoveredRegionIdx,
  activeRegionHandle,
  handleRegionHandleMouseDown,
  handleCropHandleMouseDown,
  brushSize,
  setBrushSize,
  brushColor,
  setBrushColor,
  clearMaskCanvas,
  fileInputRef,
}) => {
  return (
        <div className="layout-canvas-wrapper" ref={imageContainerRef}>
          {/* Far-Left Thumbnail History Strip (Only rendered in Enlarged Expand Mode) */}
          {isEnlargedView && imageHistory.filter(url => Boolean(url && url.length > 10)).length > 0 && (
            <div className="reve-left-history-strip">
              <span className="strip-title">Generations</span>
              <div className="strip-thumbs-list">
                {imageHistory.filter(url => Boolean(url && url.length > 10)).map((imgUrl, i) => (
                  <div
                    key={`${imgUrl.substring(0, 30)}-${i}`}
                    className={`history-thumb-item ${activeStageImage === imgUrl ? 'active' : ''}`}
                    onClick={() => setActiveStageImage(imgUrl)}
                    title={`Variation ${i + 1}`}
                  >
                    <img
                      src={imgUrl}
                      alt={`Var ${i + 1}`}
                      className="thumb-img"
                      onError={(e) => {
                        const parent = (e.currentTarget as HTMLElement).parentElement;
                        if (parent) parent.style.display = 'none';
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Floating Stage Zoom Controls (Only rendered in Enlarged Expand Mode) */}
          {isEnlargedView && (
            <div className="stage-zoom-controls-pill">
              <button
                type="button"
                className="zoom-btn"
                onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.15))}
                title="Zoom Out"
              >
                <ZoomOut size={13} />
              </button>
              <span className="zoom-badge">{Math.round(totalScaleFactor * 100)}%</span>
              <button
                type="button"
                className="zoom-btn"
                onClick={() => setZoomLevel(prev => Math.min(3.0, prev + 0.15))}
                title="Zoom In"
              >
                <ZoomIn size={13} />
              </button>
              <button
                type="button"
                className="zoom-btn reset"
                onClick={() => { setZoomLevel(1.0); setReframeScale(1.0); }}
                title="Reset Zoom & Scale"
              >
                <Maximize size={12} />
              </button>
            </div>
          )}

          {/* Animated Cyberpunk Glass Creating/Rendering Tile Grid Overlay */}
          {(isExtracting || isRendering) && (
            <div className="layout-loading-overlay reve-creating-tiles-overlay">
              <div className="creating-grid-glow-bg" />
              <div className="creating-tiles-grid">
                <div className="scanning-laser-line" />
                {Array.from({ length: 16 }).map((_, i) => (
                  <div
                    key={i}
                    className="creating-tile"
                    style={{
                      animationDelay: `${(i % 4) * 0.15 + Math.floor(i / 4) * 0.1}s`
                    }}
                  >
                    <div className="tile-inner-shimmer" />
                  </div>
                ))}
              </div>
              <div className="creating-status-pill">
                <div className="pill-pulse-ring" />
                <Loader2 size={16} className="animate-spin text-red" />
                <span>{isExtracting ? 'Anarchy Analysis in progress...' : 'Anarchy Render & Synthesis...'}</span>
              </div>
            </div>
          )}
          
          {extractError && !isExtracting && (
            <div className="layout-error-overlay">
              <AlertCircle size={28} className="text-red" />
              <p style={{ maxWidth: '80%', textAlign: 'center', wordBreak: 'break-word', margin: 0 }}>{extractError}</p>
              <button type="button" onClick={() => handleExtractLayout(true)} disabled={isExtracting} className="retry-btn">
                {isExtracting ? <Loader2 size={13} className="animate-spin" /> : null}
                <span>{isExtracting ? 'Retrying...' : 'Retry Scan'}</span>
              </button>
            </div>
          )}

          {/* Image Stage Inner Container */}
          <div
            className={`image-stage-inner ${isReframeActive ? 'reframe-mode-active' : ''}`}
            ref={stageRef}
            onMouseDown={handleStageMouseDown}
            onMouseMove={handleStageMouseMove}
            onMouseUp={handleStageMouseUp}
            style={{ transform: `scale(${totalScaleFactor})`, transformOrigin: 'center center', transition: 'transform 0.15s ease-out' }}
          >
            <img
              src={resolvedUrl || activeStageImage || displayImage || rawImage || ''}
              alt="Base Scene"
              className="base-scene-image"
              style={{ filter: filterStyle }}
              onError={() => {
                if (activeStageImage && activeStageImage.startsWith('blob:') && rawImage && rawImage !== activeStageImage) {
                  setActiveStageImage(rawImage);
                }
              }}
            />

            {/* Tool 3: Mask Brush Canvas Overlay */}
            {activeToolbarTool === 'brush' && (
              <canvas ref={maskCanvasRef} className="interactive-mask-canvas" />
            )}

            {/* Tool 4: 3D Perspective Grid Overlay — draggable vanishing point */}
            {activeToolbarTool === '3d' && (
              <div className="interactive-3d-grid-overlay">
                {/* Perspective lines from corners to vanishing point */}
                <svg className="perspective-svg" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                  <line x1="0%" y1="0%" x2={`${vanishingPoint.x * 100}%`} y2={`${vanishingPoint.y * 100}%`} stroke="rgba(255,200,60,0.55)" strokeWidth="1" />
                  <line x1="100%" y1="0%" x2={`${vanishingPoint.x * 100}%`} y2={`${vanishingPoint.y * 100}%`} stroke="rgba(255,200,60,0.55)" strokeWidth="1" />
                  <line x1="0%" y1="100%" x2={`${vanishingPoint.x * 100}%`} y2={`${vanishingPoint.y * 100}%`} stroke="rgba(255,200,60,0.55)" strokeWidth="1" />
                  <line x1="100%" y1="100%" x2={`${vanishingPoint.x * 100}%`} y2={`${vanishingPoint.y * 100}%`} stroke="rgba(255,200,60,0.55)" strokeWidth="1" />
                  <line x1="50%" y1="0%" x2={`${vanishingPoint.x * 100}%`} y2={`${vanishingPoint.y * 100}%`} stroke="rgba(255,200,60,0.3)" strokeWidth="1" strokeDasharray="4 4" />
                  <line x1="0%" y1="50%" x2={`${vanishingPoint.x * 100}%`} y2={`${vanishingPoint.y * 100}%`} stroke="rgba(255,200,60,0.3)" strokeWidth="1" strokeDasharray="4 4" />
                  <line x1="100%" y1="50%" x2={`${vanishingPoint.x * 100}%`} y2={`${vanishingPoint.y * 100}%`} stroke="rgba(255,200,60,0.3)" strokeWidth="1" strokeDasharray="4 4" />
                  <line x1="50%" y1="100%" x2={`${vanishingPoint.x * 100}%`} y2={`${vanishingPoint.y * 100}%`} stroke="rgba(255,200,60,0.3)" strokeWidth="1" strokeDasharray="4 4" />
                </svg>
                {/* Draggable Vanishing Point */}
                <div
                  className="perspective-vanishing-point"
                  style={{ left: `${vanishingPoint.x * 100}%`, top: `${vanishingPoint.y * 100}%`, transform: 'translate(-50%, -50%)', cursor: 'crosshair' }}
                  onMouseDown={(e) => { e.stopPropagation(); setIsDragging3DVanishingPoint(true); }}
                  title="Drag to move vanishing point"
                />
              </div>
            )}

            {/* Tool 5: Interactive Text Overlays — draggable */}
            {textOverlays.map((txt) => (
              <div
                key={txt.id}
                className={`interactive-text-overlay ${activeTextId === txt.id ? 'active' : ''}`}
                style={{ left: `${txt.x * 100}%`, top: `${txt.y * 100}%`, opacity: txt.opacity }}
                onClick={(e) => { e.stopPropagation(); setActiveTextId(txt.id); }}
              >
                {/* Drag grip */}
                <div
                  className="overlay-drag-grip"
                  title="Drag to move"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setActiveTextId(txt.id);
                    setDraggingTextId(txt.id);
                    setTextDragStartPos({ x: e.clientX, y: e.clientY });
                    setInitialTextPos({ x: txt.x, y: txt.y });
                  }}
                >
                  ⠿
                </div>
                <input
                  type="text"
                  value={txt.text}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTextOverlays(prev => prev.map(t => t.id === txt.id ? { ...t, text: val } : t));
                  }}
                  className="text-overlay-input"
                  style={{ color: txt.color, fontSize: `${txt.size / 2}px` }}
                />
                <button
                  type="button"
                  className="delete-overlay-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTextOverlays(prev => prev.filter(t => t.id !== txt.id));
                  }}
                >
                  <X size={10} />
                </button>
              </div>
            ))}

            {/* Tool 6: Interactive Sticky Notes — draggable */}
            {stickyNotes.map((note) => (
              <div
                key={note.id}
                className="interactive-sticky-note"
                style={{ left: `${note.x * 100}%`, top: `${note.y * 100}%` }}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  className="note-header"
                  style={{ cursor: 'grab' }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setDraggingNoteId(note.id);
                    setNoteDragStartPos({ x: e.clientX, y: e.clientY });
                    setInitialNotePos({ x: note.x, y: note.y });
                  }}
                >
                  <span>📌 Pin Note</span>
                  <button
                    type="button"
                    className="delete-overlay-btn"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); setStickyNotes(prev => prev.filter(n => n.id !== note.id)); }}
                  >
                    <X size={10} />
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={note.text}
                  onChange={(e) => {
                    const val = e.target.value;
                    setStickyNotes(prev => prev.map(n => n.id === note.id ? { ...n, text: val } : n));
                  }}
                  className="note-textarea"
                />
              </div>
            ))}

            {/* Tool 2: Active Drawing Bbox Marquee */}
            {isDrawingBbox && drawStart && drawCurrent && (
              <div
                className="drawing-bbox-marquee"
                style={{
                  left: `${Math.min(drawStart.x, drawCurrent.x) * 100}%`,
                  top: `${Math.min(drawStart.y, drawCurrent.y) * 100}%`,
                  width: `${Math.abs(drawCurrent.x - drawStart.x) * 100}%`,
                  height: `${Math.abs(drawCurrent.y - drawStart.y) * 100}%`
                }}
              />
            )}

            {/* Reve Floating Prompt Card anchored to Selected Bbox (Screenshots 2 & 4) */}
            {selectedRegionIdx !== null && selectedRegion && !isReframeActive && (() => {
              const bbox = selectedRegion.bbox;
              let leftPct = bbox.x1 > 0.60 ? Math.max(2, bbox.x0 * 100 - 32) : bbox.x1 * 100 + 2;
              let topPct = bbox.y1 > 0.55 ? Math.max(2, bbox.y0 * 100 - 35) : bbox.y0 * 100;
              leftPct = Math.max(2, Math.min(62, leftPct));
              topPct = Math.max(2, Math.min(52, topPct));

              return (
                <div
                  className="reve-floating-edit-card"
                  style={{
                    left: `${leftPct}%`,
                    top: `${topPct}%`
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="reve-card-input-row">
                    <input
                      type="text"
                      className="reve-card-text-input"
                      placeholder="Describe edits..."
                      value={regionPrompts[selectedRegionIdx] ?? ''}
                      onChange={(e) => updateRegionPrompt(selectedRegionIdx, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleApplyEdits();
                        }
                      }}
                      autoFocus
                    />
                  </div>
                  <div className="reve-card-actions-row">
                    <div className="card-actions-left">
                      <button type="button" className="card-action-icon" title="Attach asset" onClick={() => fileInputRef?.current?.click()}>
                        <Paperclip size={13} />
                      </button>
                      <button type="button" className="card-action-icon" title="Mention object (@)" onClick={() => updateRegionPrompt(selectedRegionIdx, (regionPrompts[selectedRegionIdx] || '') + ' @')}>
                        <AtSign size={13} />
                      </button>
                      <button type="button" className="card-action-icon rainbow-icon" title="AI Style Preset">
                        <Sparkles size={13} className="text-purple-grad" />
                      </button>
                    </div>
                    <div className="card-actions-right">
                      <button type="button" className="card-trash-btn" title="Delete region" onClick={() => setSelectedRegionIdx(null)}>
                        <Trash2 size={13} />
                      </button>
                      <button
                        type="button"
                        className="card-submit-btn"
                        title="Apply edits (2.1 credits)"
                        onClick={handleApplyEdits}
                        disabled={isRendering}
                      >
                        {isRendering ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Reve Floating Prompt Card anchored to Active Mask Brush (Screenshot 4) */}
            {activeToolbarTool === 'brush' && !isReframeActive && (
              <div
                className="reve-floating-edit-card mask-anchored-card"
                style={{
                  top: '25%',
                  right: '25px'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="reve-card-input-row">
                  <input
                    type="text"
                    className="reve-card-text-input"
                    placeholder="Describe edits..."
                    value={maskPrompt}
                    onChange={(e) => setMaskPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleApplyMaskEdit();
                      }
                    }}
                    autoFocus
                  />
                </div>
                <div className="reve-card-actions-row">
                  <div className="card-actions-left">
                    <button type="button" className="card-action-icon" title="Attach asset" onClick={() => fileInputRef?.current?.click()}>
                      <Paperclip size={13} />
                    </button>
                    <button type="button" className="card-action-icon" title="Mention object (@)" onClick={() => setMaskPrompt(prev => prev + ' @')}>
                      <AtSign size={13} />
                    </button>
                    <button type="button" className="card-action-icon rainbow-icon" title="AI Style Preset">
                      <Sparkles size={13} className="text-purple-grad" />
                    </button>
                  </div>
                  <div className="card-actions-right">
                    <button type="button" className="card-trash-btn" title="Clear mask" onClick={clearMaskCanvas}>
                      <Trash2 size={13} />
                    </button>
                    <button
                      type="button"
                      className="card-submit-btn"
                      title="Apply mask inpaint (0.4 credits)"
                      onClick={handleApplyMaskEdit}
                      disabled={isRendering}
                    >
                      {isRendering ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Reframe Interactive Draggable Crop Overlay & Corner Brackets */}
            {isReframeActive && (
              <div
                className="reframe-crop-overlay-box interactive-crop"
                style={{
                  left: `${cropBounds.x0 * 100}%`,
                  top: `${cropBounds.y0 * 100}%`,
                  width: `${(cropBounds.x1 - cropBounds.x0) * 100}%`,
                  height: `${(cropBounds.y1 - cropBounds.y0) * 100}%`
                }}
              >
                {/* Central move/drag handle */}
                <div
                  className="crop-move-handle"
                  title="Drag to move crop area"
                  onMouseDown={(e) => handleCropHandleMouseDown('move', e)}
                />
                {/* Draggable Corner Bracket Handles */}
                <div className="crop-bracket corner-tl" onMouseDown={(e) => handleCropHandleMouseDown('top-left', e)} />
                <div className="crop-bracket corner-tr" onMouseDown={(e) => handleCropHandleMouseDown('top-right', e)} />
                <div className="crop-bracket corner-bl" onMouseDown={(e) => handleCropHandleMouseDown('bottom-left', e)} />
                <div className="crop-bracket corner-br" onMouseDown={(e) => handleCropHandleMouseDown('bottom-right', e)} />

                {/* Draggable Midpoint Handles */}
                <div className="crop-handle handle-top" onMouseDown={(e) => handleCropHandleMouseDown('top', e)} />
                <div className="crop-handle handle-bottom" onMouseDown={(e) => handleCropHandleMouseDown('bottom', e)} />
                <div className="crop-handle handle-left" onMouseDown={(e) => handleCropHandleMouseDown('left', e)} />
                <div className="crop-handle handle-right" onMouseDown={(e) => handleCropHandleMouseDown('right', e)} />
              </div>
            )}

            {/* Bounding Boxes Overlay */}
            {!isReframeActive && layout && Array.isArray(layout.regions) && (
              <div className="svg-overlay-container">
                {layout.regions.map((reg, idx) => {
                  const matchesSearch = !searchQuery || reg.label.toLowerCase().includes(searchQuery.toLowerCase());
                  if (!matchesSearch) return null;

                  const color = REGION_COLORS[idx % REGION_COLORS.length];
                  const isSelected = selectedRegionIdx === idx;
                  const isHovered = hoveredRegionIdx === idx;
                  const isHighlighted = isSelected || isHovered;

                  const left = `${reg.bbox.x0 * 100}%`;
                  const top = `${reg.bbox.y0 * 100}%`;
                  const width = `${(reg.bbox.x1 - reg.bbox.x0) * 100}%`;
                  const height = `${(reg.bbox.y1 - reg.bbox.y0) * 100}%`;

                  return (
                    <div
                      key={idx}
                      className={`interactive-bbox ${isHighlighted ? 'active' : 'hidden-default'} ${isSelected ? 'selected-resizable' : ''}`}
                      style={{
                        left,
                        top,
                        width,
                        height,
                        borderColor: isHighlighted ? color : 'transparent',
                        borderWidth: isHighlighted ? '2px' : '0px',
                        backgroundColor: isSelected ? `${color}35` : isHovered ? `${color}20` : 'transparent',
                        opacity: isHighlighted ? 1 : 0,
                        pointerEvents: 'auto',
                        cursor: isSelected ? 'move' : 'pointer',
                        zIndex: isSelected ? 30 : isHovered ? 20 : 1
                      }}
                      onMouseDown={(e) => {
                        handleSelectRegion(idx);
                        handleRegionHandleMouseDown('move', idx, e);
                      }}
                      onMouseEnter={() => setHoveredRegionIdx(idx)}
                      onMouseLeave={() => setHoveredRegionIdx(null)}
                    >
                      {isHighlighted && (
                        <div className="bbox-label-tag" style={{ backgroundColor: color }}>
                          <Tag size={9} />
                          <span>{reg.label}</span>
                        </div>
                      )}

                      {isSelected && (
                        <>
                          <span className="corner-dot tl interactive-handle" style={{ backgroundColor: '#ffffff', borderColor: color }} onMouseDown={(e) => handleRegionHandleMouseDown('left-top', idx, e)} />
                          <span className="corner-dot tr interactive-handle" style={{ backgroundColor: '#ffffff', borderColor: color }} onMouseDown={(e) => handleRegionHandleMouseDown('right-top', idx, e)} />
                          <span className="corner-dot bl interactive-handle" style={{ backgroundColor: '#ffffff', borderColor: color }} onMouseDown={(e) => handleRegionHandleMouseDown('left-bottom', idx, e)} />
                          <span className="corner-dot br interactive-handle" style={{ backgroundColor: '#ffffff', borderColor: color }} onMouseDown={(e) => handleRegionHandleMouseDown('right-bottom', idx, e)} />
                          
                          <span className="edge-handle handle-top" onMouseDown={(e) => handleRegionHandleMouseDown('top', idx, e)} />
                          <span className="edge-handle handle-bottom" onMouseDown={(e) => handleRegionHandleMouseDown('bottom', idx, e)} />
                          <span className="edge-handle handle-left" onMouseDown={(e) => handleRegionHandleMouseDown('left', idx, e)} />
                          <span className="edge-handle handle-right" onMouseDown={(e) => handleRegionHandleMouseDown('right', idx, e)} />
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sub-toolbar for Mask Brush Tool Controls */}
          {activeToolbarTool === 'brush' && (
            <div className="brush-sub-toolbar">
              <input
                type="color"
                value={brushColor}
                onChange={(e) => setBrushColor(e.target.value)}
                className="brush-color-swatch"
                title="Brush color"
              />
              <Sliders size={13} />
              <span>Size: {brushSize}px</span>
              <input
                type="range"
                min="5"
                max="80"
                value={brushSize}
                onChange={(e) => setBrushSize(parseInt(e.target.value))}
                className="brush-size-range"
              />
              <input
                type="text"
                placeholder="Describe edits (e.g. add red rose)..."
                value={maskPrompt}
                onChange={(e) => setMaskPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleApplyMaskEdit();
                }}
                className="brush-mask-prompt-input"
              />
              <button
                type="button"
                className="brush-generate-btn"
                onClick={handleApplyMaskEdit}
                disabled={isRendering}
                title="Generate brush edit via Anarchy AI API"
              >
                {isRendering ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                <span>Generate (0.4 cr)</span>
              </button>
              <button type="button" className="brush-clear-btn" onClick={clearMaskCanvas}>
                <Trash2 size={12} /> Clear
              </button>
            </div>
          )}
        </div>
  );
};
