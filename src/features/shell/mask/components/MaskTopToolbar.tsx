import React, { useState, useEffect } from 'react';
import {
  Hand, Wand2, MousePointer2, PenTool, Circle, LassoSelect, SquareDashed,
  Crop, CornerDownRight, Paintbrush2, Eraser, Trash2, SlidersHorizontal,
  Contrast, Sparkles, Maximize2, Minimize2, PaintBucket, Columns, Eye,
  FolderPlus, FileDown, Download, Check, Copy, Share2, Minus, Plus,
  Layers, RotateCcw, RotateCw, FileCode, Ruler, Compass, SunMedium,
} from 'lucide-react';

export const MASK_COLOR_PRESETS = [
  { label: 'Ruby Red', color: '#e11d48' },
  { label: 'Emerald Green', color: '#10b981' },
  { label: 'Sapphire Blue', color: '#3b82f6' },
  { label: 'Amber Gold', color: '#f59e0b' },
  { label: 'Electric Violet', color: '#8b5cf6' },
  { label: 'Neon Cyan', color: '#06b6d4' },
];

export interface MaskTopToolbarProps {
  maskTool: 'select' | 'brush' | 'eraser' | 'lasso' | 'crop' | 'wand' | 'arrow' | 'hand' | 'smart_select';
  setMaskTool: React.Dispatch<React.SetStateAction<'select' | 'brush' | 'eraser' | 'lasso' | 'crop' | 'wand' | 'arrow' | 'hand' | 'smart_select'>>;
  isSpacebarDown: boolean;
  shapeSubTool: 'polygon' | 'rectangle' | 'circle' | 'freehand';
  setShapeSubTool: React.Dispatch<React.SetStateAction<'polygon' | 'rectangle' | 'circle' | 'freehand'>>;
  drawSubTool: 'brush' | 'arrow' | 'line' | 'rect' | 'circle';
  setDrawSubTool: React.Dispatch<React.SetStateAction<'brush' | 'arrow' | 'line' | 'rect' | 'circle'>>;
  brushSize: number;
  setBrushSize: (size: number) => void;
  brushHardness: number;
  setBrushHardness: (hardness: number) => void;
  clearMask: () => void;
  invertCurrentMask: () => void;
  featherCurrentMask: () => void;
  expandMask: (px: number) => void;
  contractMask: (px: number) => void;
  fillEntireMask: () => void;
  wandTolerance: number;
  setWandTolerance: (tolerance: number) => void;
  maskOverlayOpacity: number;
  setMaskOverlayOpacity: (opacity: number) => void;
  brushColor: string;
  setBrushColor: (color: string) => void;
  splitCompareMode: boolean;
  setSplitCompareMode: React.Dispatch<React.SetStateAction<boolean>>;
  isComparing: boolean;
  setIsComparing: React.Dispatch<React.SetStateAction<boolean>>;
  isSoloAlphaMode: boolean;
  setIsSoloAlphaMode: React.Dispatch<React.SetStateAction<boolean>>;
  onAddArrowCard: () => void;
  exportBinaryMask: () => void;
  exportFullComposite: () => void;
  copyMaskToClipboard: () => void;
  hasCopiedMask: boolean;
  sendToGraphAsNode: () => void;
  onExportPsd?: () => void;
  zoomScale: number;
  setZoomScale: React.Dispatch<React.SetStateAction<number>>;
  setPanOffset: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  showLayerStack: boolean;
  setShowLayerStack: React.Dispatch<React.SetStateAction<boolean>>;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  isOrthoMode?: boolean;
  onToggleOrtho?: () => void;
  showRulers?: boolean;
  onToggleRulers?: () => void;
  onOpenColorRange?: () => void;
  onClearGuides?: () => void;
}

export const MaskTopToolbar: React.FC<MaskTopToolbarProps> = ({
  maskTool,
  setMaskTool,
  isSpacebarDown,
  shapeSubTool,
  setShapeSubTool,
  drawSubTool,
  setDrawSubTool,
  brushSize,
  setBrushSize,
  brushHardness,
  setBrushHardness,
  clearMask,
  invertCurrentMask,
  featherCurrentMask,
  expandMask,
  contractMask,
  fillEntireMask,
  wandTolerance,
  setWandTolerance,
  maskOverlayOpacity,
  setMaskOverlayOpacity,
  brushColor,
  setBrushColor,
  splitCompareMode,
  setSplitCompareMode,
  isComparing,
  setIsComparing,
  isSoloAlphaMode,
  setIsSoloAlphaMode,
  onAddArrowCard,
  exportBinaryMask,
  exportFullComposite,
  copyMaskToClipboard,
  hasCopiedMask,
  sendToGraphAsNode,
  onExportPsd,
  zoomScale,
  setZoomScale,
  setPanOffset,
  showLayerStack,
  setShowLayerStack,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  isOrthoMode = false,
  onToggleOrtho,
  showRulers = true,
  onToggleRulers,
  onOpenColorRange,
  onClearGuides,
}) => {
  const [openDropdown, setOpenDropdown] = useState<'lasso' | 'pen' | 'size' | null>(null);
  const [showMaskSettings, setShowMaskSettings] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest('.mask-dropdown-container') &&
        !target.closest('.mask-settings-popover') &&
        !target.closest('.mask-export-popover')
      ) {
        setOpenDropdown(null);
        setShowMaskSettings(false);
        setShowExportMenu(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="mask-canvas-top-bar">
      <div className="mask-canvas-top-left" />

      <div className="mask-canvas-tools-toolbar">
        {/* ── Cluster 1: Navigation & Selection ── */}
        <button
          type="button"
          className={`mask-toolbar-btn ${maskTool === 'hand' || isSpacebarDown ? 'active' : ''}`}
          onClick={() => setMaskTool((prev) => (prev === 'hand' ? 'brush' : 'hand'))}
          title="Hand Pan Tool (H or hold Spacebar + Drag)"
        >
          <Hand size={16} />
        </button>

        {/* Unified Selection Tools Dropdown (Marquee, Polygon, Freehand, Circle, Wand, Select) */}
        <div className="mask-dropdown-container">
          <button
            type="button"
            className={`mask-toolbar-btn ${maskTool === 'lasso' || maskTool === 'wand' || maskTool === 'select' ? 'active' : ''}`}
            onClick={() => {
              if (maskTool !== 'lasso' && maskTool !== 'wand' && maskTool !== 'select') {
                setMaskTool('lasso');
              }
              setOpenDropdown((prev) => (prev === 'lasso' ? null : 'lasso'));
            }}
            title="Selection Tools - Marquee (M), Polygon (P), Freehand (L), Wand (W), Pointer (V)"
          >
            {maskTool === 'wand' ? (
              <Wand2 size={16} />
            ) : maskTool === 'select' ? (
              <MousePointer2 size={16} />
            ) : shapeSubTool === 'polygon' ? (
              <PenTool size={16} />
            ) : shapeSubTool === 'circle' ? (
              <Circle size={16} />
            ) : shapeSubTool === 'freehand' ? (
              <LassoSelect size={16} />
            ) : (
              <SquareDashed size={16} />
            )}
            <span className="mask-dropdown-caret">
              <svg width="5" height="5" viewBox="0 0 6 6" fill="currentColor">
                <path d="M6 6L6 0L0 6Z" />
              </svg>
            </span>
          </button>

          {openDropdown === 'lasso' && (
            <div className="mask-vertical-dropdown">
              <button
                type="button"
                className={`mask-dropdown-item ${maskTool === 'lasso' && shapeSubTool === 'rectangle' ? 'active' : ''}`}
                onClick={() => {
                  setMaskTool('lasso');
                  setShapeSubTool('rectangle');
                  setOpenDropdown(null);
                }}
                title="Marquee Box Selection (M)"
              >
                <SquareDashed size={15} />
                <span className="mask-dropdown-label">Marquee Box (M)</span>
              </button>

              <button
                type="button"
                className={`mask-dropdown-item ${maskTool === 'lasso' && shapeSubTool === 'polygon' ? 'active' : ''}`}
                onClick={() => {
                  setMaskTool('lasso');
                  setShapeSubTool('polygon');
                  setOpenDropdown(null);
                }}
                title="Polygonal Lasso (P)"
              >
                <PenTool size={15} />
                <span className="mask-dropdown-label">Polygon Lasso (P)</span>
              </button>

              <button
                type="button"
                className={`mask-dropdown-item ${maskTool === 'lasso' && shapeSubTool === 'freehand' ? 'active' : ''}`}
                onClick={() => {
                  setMaskTool('lasso');
                  setShapeSubTool('freehand');
                  setOpenDropdown(null);
                }}
                title="Freehand Lasso Contour (L)"
              >
                <LassoSelect size={15} />
                <span className="mask-dropdown-label">Freehand Lasso (L)</span>
              </button>

              <button
                type="button"
                className={`mask-dropdown-item ${maskTool === 'lasso' && shapeSubTool === 'circle' ? 'active' : ''}`}
                onClick={() => {
                  setMaskTool('lasso');
                  setShapeSubTool('circle');
                  setOpenDropdown(null);
                }}
                title="Circle / Elliptical Selection"
              >
                <Circle size={15} />
                <span className="mask-dropdown-label">Circle Selection</span>
              </button>

              <button
                type="button"
                className={`mask-dropdown-item ${maskTool === 'wand' ? 'active' : ''}`}
                onClick={() => {
                  setMaskTool('wand');
                  setOpenDropdown(null);
                }}
                title="Magic Wand Tool (W)"
              >
                <Wand2 size={15} />
                <span className="mask-dropdown-label">Magic Wand (W)</span>
              </button>

              <button
                type="button"
                className={`mask-dropdown-item ${maskTool === 'select' ? 'active' : ''}`}
                onClick={() => {
                  setMaskTool('select');
                  setOpenDropdown(null);
                }}
                title="Select / Move Pointer (V)"
              >
                <MousePointer2 size={15} />
                <span className="mask-dropdown-label">Pointer / Move (V)</span>
              </button>

              <button
                type="button"
                className={`mask-dropdown-item ${maskTool === 'smart_select' ? 'active' : ''}`}
                onClick={() => {
                  setMaskTool('smart_select');
                  setOpenDropdown(null);
                }}
                title="Smart Auto-Segmentation (SAM) — Hover & Click to Select (S)"
              >
                <Sparkles size={15} />
                <span className="mask-dropdown-label">Smart Auto-Select (SAM)</span>
              </button>
            </div>
          )}
        </div>

        {/* Smart Auto-Select (SAM 2 - Hover & Click to Select) */}
        <button
          type="button"
          className={`mask-toolbar-btn ${maskTool === 'smart_select' ? 'active' : ''}`}
          onClick={() => setMaskTool((prev) => (prev === 'smart_select' ? 'brush' : 'smart_select'))}
          title="Smart Auto-Select / SAM (Hover & Click to Select Object) — Shortcut: S or Shift+W"
        >
          <Sparkles size={16} />
        </button>

        {/* Crop Tool (C) */}
        <button
          type="button"
          className={`mask-toolbar-btn ${maskTool === 'crop' ? 'active' : ''}`}
          onClick={() => setMaskTool((prev) => (prev === 'crop' ? 'brush' : 'crop'))}
          title="Crop Image (C)"
        >
          <Crop size={16} />
        </button>

        <div className="mask-canvas-divider-vertical" />

        {/* ── Cluster 2: Drawing, Sizing & Erasing ── */}
        <div className="mask-dropdown-container">
          <button
            type="button"
            className={`mask-toolbar-btn ${maskTool === 'brush' || maskTool === 'arrow' ? 'active' : ''}`}
            onClick={() => {
              if (maskTool !== 'brush' && maskTool !== 'arrow') {
                if (drawSubTool === 'arrow') setMaskTool('arrow');
                else setMaskTool('brush');
              }
              setOpenDropdown((prev) => (prev === 'pen' ? null : 'pen'));
            }}
            title={
              drawSubTool === 'arrow' || maskTool === 'arrow'
                ? 'Arrow Note Tool'
                : 'Paintbrush Tool (B)'
            }
          >
            {drawSubTool === 'arrow' || maskTool === 'arrow' ? (
              <CornerDownRight size={16} />
            ) : (
              <Paintbrush2 size={16} />
            )}
            <span className="mask-dropdown-caret">
              <svg width="5" height="5" viewBox="0 0 6 6" fill="currentColor">
                <path d="M6 6L6 0L0 6Z" />
              </svg>
            </span>
          </button>

          {openDropdown === 'pen' && (
            <div className="mask-vertical-dropdown">
              <button
                type="button"
                className={`mask-dropdown-item ${maskTool === 'brush' ? 'active' : ''}`}
                onClick={() => {
                  setMaskTool('brush');
                  setDrawSubTool('brush');
                  setOpenDropdown(null);
                }}
                title="Inpaint Paintbrush (B)"
              >
                <Paintbrush2 size={15} />
                <span className="mask-dropdown-label">Brush (B)</span>
              </button>

              <button
                type="button"
                className={`mask-dropdown-item ${maskTool === 'arrow' ? 'active' : ''}`}
                onClick={() => {
                  setMaskTool('arrow');
                  setDrawSubTool('arrow');
                  setOpenDropdown(null);
                }}
                title="Arrow Note & Card"
              >
                <CornerDownRight size={15} />
                <span className="mask-dropdown-label">Arrow Note</span>
              </button>
            </div>
          )}
        </div>

        {/* Compact Brush Size Badge Pill & Quick Popover */}
        <div className="mask-dropdown-container">
          <button
            type="button"
            className={`mask-size-badge-pill ${openDropdown === 'size' ? 'active' : ''}`}
            onClick={() => setOpenDropdown((prev) => (prev === 'size' ? null : 'size'))}
            title="Brush Size & Hardness ([ to shrink, ] to enlarge)"
          >
            <span className="mask-size-num">{brushSize}</span>
            <span className="mask-size-unit">px</span>
            <span className="mask-dropdown-caret" style={{ marginLeft: '1px' }}>
              <svg width="4" height="4" viewBox="0 0 6 6" fill="currentColor">
                <path d="M6 6L6 0L0 6Z" />
              </svg>
            </span>
          </button>

          {openDropdown === 'size' && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                marginTop: '8px',
                background: '#181920',
                border: '1px solid rgba(255, 255, 255, 0.16)',
                borderRadius: '8px',
                padding: '10px 12px',
                boxShadow: '0 12px 36px rgba(0,0,0,0.85)',
                zIndex: 65,
                minWidth: '190px',
                display: 'flex',
                flexDirection: 'column',
                gap: '9px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>Brush Size</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#ffffff' }}>{brushSize} px</span>
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[8, 16, 34, 64, 100].map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setBrushSize(sz)}
                    style={{
                      flex: 1,
                      padding: '3px 0',
                      fontSize: '10px',
                      fontWeight: brushSize === sz ? 700 : 500,
                      background: brushSize === sz ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.06)',
                      color: '#ffffff',
                      border: brushSize === sz ? '1px solid rgba(255,255,255,0.45)' : '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    {sz}
                  </button>
                ))}
              </div>
              <input
                type="range"
                min="2"
                max="200"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#ffffff', cursor: 'pointer' }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>Hardness</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#ffffff' }}>{brushHardness}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={brushHardness}
                onChange={(e) => setBrushHardness(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#ffffff', cursor: 'pointer' }}
              />
            </div>
          )}
        </div>

        {/* Eraser Tool */}
        <button
          type="button"
          className={`mask-toolbar-btn ${maskTool === 'eraser' ? 'active' : ''}`}
          onClick={() => setMaskTool('eraser')}
          title="Eraser Tool (E) - Hold Alt to quick-erase"
        >
          <Eraser size={16} />
        </button>

        {/* Clear Mask Quick Button */}
        <button
          type="button"
          className="mask-toolbar-btn danger"
          onClick={clearMask}
          title="Clear Mask Selection (Ctrl+D)"
        >
          <Trash2 size={16} />
        </button>

        <div className="mask-canvas-divider-vertical" />

        {/* ── Cluster 3: Mask Actions & Architectural Studio ── */}
        <div className="mask-dropdown-container">
          <button
            type="button"
            className={`mask-toolbar-btn ${showMaskSettings ? 'active' : ''}`}
            onClick={() => setShowMaskSettings((prev) => !prev)}
            title="Mask Actions & Adjustments (Invert, Feather, Grow, Shrink, Fill, Tint)"
          >
            <SlidersHorizontal size={16} />
          </button>

          {showMaskSettings && (
            <div
              className="mask-settings-popover"
              style={{
                position: 'absolute',
                top: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                marginTop: '8px',
                background: '#181920',
                border: '1px solid rgba(255, 255, 255, 0.16)',
                borderRadius: '8px',
                padding: '10px 12px',
                boxShadow: '0 12px 36px rgba(0,0,0,0.85)',
                zIndex: 60,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                minWidth: '230px',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#ffffff', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '4px' }}>
                Mask & Selection Controls
              </div>

              {/* Geometry Operations Grid (Invert, Feather, Grow, Shrink) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
                <button
                  type="button"
                  className="mask-hud-btn"
                  onClick={() => {
                    invertCurrentMask();
                    setShowMaskSettings(false);
                  }}
                  title="Invert Selection (Ctrl+Shift+I)"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '5px',
                    padding: '4px 6px',
                    color: '#ffffff',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  <Contrast size={12} />
                  Invert
                </button>

                <button
                  type="button"
                  className="mask-hud-btn"
                  onClick={() => {
                    featherCurrentMask();
                    setShowMaskSettings(false);
                  }}
                  title="Feather / Soften Mask Edges"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '5px',
                    padding: '4px 6px',
                    color: '#ffffff',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  <Sparkles size={12} />
                  Feather
                </button>

                <button
                  type="button"
                  className="mask-hud-btn"
                  onClick={() => expandMask(4)}
                  title="Expand Mask Boundary +4px (Ctrl+Shift+E)"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '5px',
                    padding: '4px 6px',
                    color: '#ffffff',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  <Maximize2 size={12} />
                  Grow (+4px)
                </button>

                <button
                  type="button"
                  className="mask-hud-btn"
                  onClick={() => contractMask(4)}
                  title="Contract Mask Boundary -4px (Ctrl+Shift+C)"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '5px',
                    padding: '4px 6px',
                    color: '#ffffff',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  <Minimize2 size={12} />
                  Shrink (-4px)
                </button>
              </div>

              {/* Fill Canvas into Mask */}
              <button
                type="button"
                className="mask-hud-btn"
                onClick={() => {
                  fillEntireMask();
                  setShowMaskSettings(false);
                }}
                title="Fill Entire Canvas with Mask (G)"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '5px',
                  padding: '5px 8px',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <PaintBucket size={13} />
                Fill Entire Canvas (G)
              </button>

              {/* Wand Tolerance Slider */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: 'rgba(255,255,255,0.7)' }}>
                  <span>Wand Tolerance</span>
                  <span style={{ fontWeight: 600, color: '#ffffff' }}>{wandTolerance}</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="100"
                  step="5"
                  value={wandTolerance}
                  onChange={(e) => setWandTolerance(parseInt(e.target.value, 10))}
                  style={{ width: '100%', accentColor: '#ffffff', cursor: 'pointer' }}
                />
              </div>

              {/* Opacity Slider */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: 'rgba(255,255,255,0.7)' }}>
                  <span>Overlay Opacity</span>
                  <span style={{ fontWeight: 600, color: '#ffffff' }}>{Math.round(maskOverlayOpacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.15"
                  max="0.95"
                  step="0.05"
                  value={maskOverlayOpacity}
                  onChange={(e) => setMaskOverlayOpacity(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: '#ffffff', cursor: 'pointer' }}
                />
              </div>

              {/* Mask Tint Color Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.7)' }}>Mask Tint & Swatches</div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {MASK_COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.color}
                      type="button"
                      onClick={() => setBrushColor(preset.color)}
                      title={preset.label}
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: preset.color,
                        border: brushColor === preset.color ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.3)',
                        cursor: 'pointer',
                        boxShadow: brushColor === preset.color ? `0 0 8px ${preset.color}` : 'none',
                        transform: brushColor === preset.color ? 'scale(1.15)' : 'scale(1)',
                      }}
                    />
                  ))}
                  <input
                    type="color"
                    value={brushColor}
                    onChange={(e) => setBrushColor(e.target.value)}
                    title="Custom Tint Picker"
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '4px',
                      border: '1px solid rgba(255,255,255,0.3)',
                      cursor: 'pointer',
                      padding: 0,
                      background: 'none',
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Architectural Rulers & Snap Guides */}
        <button
          type="button"
          className={`mask-toolbar-btn ${showRulers ? 'active' : ''}`}
          onClick={onToggleRulers}
          title="Architectural Rulers & Snap Guides (Ctrl+R)"
        >
          <Ruler size={16} />
        </button>

        {/* Ortho Angle Snap Mode (45° / 90°) */}
        <button
          type="button"
          className={`mask-toolbar-btn mask-ortho-btn ${isOrthoMode ? 'active' : ''}`}
          onClick={onToggleOrtho}
          title="Ortho Mode: Constrain lines & polygons to 90° and 45° angles (O)"
        >
          <Compass size={15} />
          <span className="mask-ortho-badge">45°</span>
        </button>

        {/* Smart Color Range & Luma Mask Modal Launcher */}
        <button
          type="button"
          className="mask-toolbar-btn"
          onClick={onOpenColorRange}
          title="Smart Color Range & Luma Mask (Highlights / Midtones / Shadows / Eyedropper)"
        >
          <SunMedium size={16} />
        </button>

        <div className="mask-canvas-divider-vertical" />

        {/* ── Cluster 4: Connected Segmented Inspection & Comparison ── */}
        <div className="mask-segmented-cluster" title="Inspection & View Comparison Modes">
          <button
            type="button"
            className={`mask-segmented-btn ${splitCompareMode ? 'active' : ''}`}
            onClick={() => {
              setSplitCompareMode((prev) => !prev);
              setIsComparing(false);
            }}
            title="Split Screen Curtain Wipe"
          >
            <Columns size={15} />
          </button>

          <button
            type="button"
            className={`mask-segmented-btn ${isComparing ? 'active' : ''}`}
            onClick={() => {
              setIsComparing((prev) => !prev);
              setSplitCompareMode(false);
            }}
            title="Instant Peek Original (\)"
          >
            <Eye size={15} />
          </button>

          <button
            type="button"
            className={`mask-segmented-btn ${isSoloAlphaMode ? 'active' : ''}`}
            onClick={() => setIsSoloAlphaMode((prev) => !prev)}
            title="Quick Mask Solo Alpha Stencil View (Q)"
          >
            <Contrast size={15} />
          </button>
        </div>

        <div className="mask-canvas-divider-vertical" />

        {/* ── Cluster 5: Reference Card & Export ── */}
        {/* Add Card */}
        <button
          type="button"
          className="mask-toolbar-btn"
          onClick={onAddArrowCard}
          title="Add Reference Image / Card"
        >
          <FolderPlus size={16} />
        </button>

        {/* Export Dropdown Popover */}
        <div className="mask-dropdown-container">
          <button
            type="button"
            className={`mask-toolbar-btn primary ${showExportMenu ? 'active' : ''}`}
            onClick={() => setShowExportMenu((prev) => !prev)}
            title="Export & Share Options"
          >
            <FileDown size={16} />
          </button>

          {showExportMenu && (
            <div
              className="mask-export-popover"
              style={{
                position: 'absolute',
                top: '100%',
                right: '0',
                marginTop: '8px',
                background: '#181920',
                border: '1px solid rgba(255, 255, 255, 0.16)',
                borderRadius: '8px',
                padding: '6px',
                boxShadow: '0 12px 36px rgba(0,0,0,0.85)',
                zIndex: 60,
                display: 'flex',
                flexDirection: 'column',
                gap: '3px',
                minWidth: '200px',
              }}
            >
              <button
                type="button"
                className="mask-dropdown-item"
                onClick={() => {
                  exportBinaryMask();
                  setShowExportMenu(false);
                }}
                title="Export 1:1 Black & White Binary PNG mask"
              >
                <Download size={14} />
                <span>Download Binary Mask (PNG)</span>
              </button>

              <button
                type="button"
                className="mask-dropdown-item"
                onClick={() => {
                  exportFullComposite();
                  setShowExportMenu(false);
                }}
                title="Download complete high-res composite image"
              >
                <Download size={14} />
                <span>Download Full Composite (PNG)</span>
              </button>

              <button
                type="button"
                className="mask-dropdown-item"
                onClick={() => {
                  copyMaskToClipboard();
                  setShowExportMenu(false);
                }}
                title="Copy binary mask PNG to clipboard"
              >
                {hasCopiedMask ? <Check size={14} /> : <Copy size={14} />}
                <span>{hasCopiedMask ? 'Copied to Clipboard!' : 'Copy Mask to Clipboard'}</span>
              </button>

              {onExportPsd && (
                <button
                  type="button"
                  className="mask-dropdown-item"
                  onClick={() => {
                    onExportPsd();
                    setShowExportMenu(false);
                  }}
                  title="Export layered Photoshop PSD with inpaint masks, blend modes, and opacity"
                >
                  <FileCode size={14} />
                  <span>Export Photoshop (.PSD)</span>
                </button>
              )}

              <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '2px 0' }} />

              <button
                type="button"
                className="mask-dropdown-item"
                onClick={() => {
                  sendToGraphAsNode();
                  setShowExportMenu(false);
                }}
                title="Create output node directly in the workflow canvas"
              >
                <Share2 size={14} />
                <span>Send As New Node to Graph</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right Section: Zoom & Undo/Redo & Layers */}
      <div className="mask-canvas-top-actions">
        {/* Zoom HUD */}
        <div className="mask-zoom-hud">
          <button
            type="button"
            className="mask-zoom-btn"
            onClick={() => setZoomScale((z) => Math.max(0.2, z * 0.85))}
            title="Zoom Out"
          >
            <Minus size={12} />
          </button>
          <button
            type="button"
            className="mask-zoom-text"
            onClick={() => {
              setZoomScale(1);
              setPanOffset({ x: 0, y: 0 });
            }}
            title="Reset Zoom & Pan (Ctrl+0)"
          >
            {Math.round(zoomScale * 100)}%
          </button>
          <button
            type="button"
            className="mask-zoom-btn"
            onClick={() => setZoomScale((z) => Math.min(6, z * 1.18))}
            title="Zoom In"
          >
            <Plus size={12} />
          </button>
        </div>

        <button
          type="button"
          className={`mask-toolbar-btn ${showLayerStack ? 'active' : ''}`}
          onClick={() => setShowLayerStack((prev) => !prev)}
          title="Photoshop Layers Panel"
        >
          <Layers size={16} />
        </button>

        <button
          type="button"
          className="mask-toolbar-btn"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          style={{ opacity: canUndo ? 1 : 0.35 }}
        >
          <RotateCcw size={15} />
        </button>

        <button
          type="button"
          className="mask-toolbar-btn"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
          style={{ opacity: canRedo ? 1 : 0.35 }}
        >
          <RotateCw size={15} />
        </button>
      </div>
    </div>
  );
};
