import React, { useState } from 'react';
import { 
  ChevronUp, Eye, EyeOff, Lock, Unlock, Plus, Trash2, Loader2, Sparkles, 
  Link2, Copy, Contrast, ArrowUp, ArrowDown
} from 'lucide-react';
import { useResolvedImage } from '../../../hooks';

const LayerThumbnail: React.FC<{ rawSrc?: string | null; alt: string; className?: string }> = ({ rawSrc, alt, className }) => {
  const resolved = useResolvedImage(rawSrc);
  const safeSrc = resolved || (rawSrc && !rawSrc.startsWith('idb://') ? rawSrc : undefined);
  if (!safeSrc) {
    return (
      <div className="vizmaker-empty-thumb" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: '#111' }}>
        <Loader2 size={10} className="spin" style={{ color: '#e11d48' }} />
      </div>
    );
  }
  return <img src={safeSrc} alt={alt} className={className || 'vizmaker-layer-img-preview'} />;
};

export type PhotoshopBlendMode = 
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity';

export const BLEND_MODES: { value: PhotoshopBlendMode; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'darken', label: 'Darken' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'color-burn', label: 'Color Burn' },
  { value: 'lighten', label: 'Lighten' },
  { value: 'screen', label: 'Screen' },
  { value: 'color-dodge', label: 'Color Dodge' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'soft-light', label: 'Soft Light' },
  { value: 'hard-light', label: 'Hard Light' },
  { value: 'difference', label: 'Difference' },
  { value: 'exclusion', label: 'Exclusion' },
  { value: 'hue', label: 'Hue' },
  { value: 'saturation', label: 'Saturation' },
  { value: 'color', label: 'Color' },
  { value: 'luminosity', label: 'Luminosity' },
];

export interface InpaintLayer {
  id: string;
  name: string;
  prompt: string;
  image: string;
  maskDataUrl?: string | null;
  maskPreviewUrl?: string | null;
  visible: boolean;
  opacity?: number; // 0 to 100
  blendMode?: PhotoshopBlendMode;
  locked?: boolean;
  selectedTarget: 'image' | 'mask';
  isGenerating?: boolean;
  createdAt: number;
}

export interface LayersPanelProps {
  onClose: () => void;
  layers: InpaintLayer[];
  activeLayerId: string;
  onSelectLayer: (id: string, target?: 'image' | 'mask') => void;
  onToggleLayerVisibility: (id: string) => void;
  onDeleteLayer: (id: string) => void;
  onAddLayer: () => void;
  onDuplicateLayer?: (id: string) => void;
  onInvertMask?: (id: string) => void;
  onChangeBlendMode?: (id: string, mode: PhotoshopBlendMode) => void;
  onChangeOpacity?: (id: string, opacity: number) => void;
  onToggleLock?: (id: string) => void;
  onReorderLayers?: (sourceIndex: number, targetIndex: number) => void;
  baseImage: string | null | undefined;
  baseImageVisible: boolean;
  onToggleBaseImageVisibility: () => void;
  currentMaskPreviewUrl?: string | null;
  isGenerating?: boolean;
  generatingPrompt?: string;
  activeMaskColor?: 'white' | 'black';
  onToggleMaskColor?: () => void;
}

export const LayersPanel: React.FC<LayersPanelProps> = ({
  onClose,
  layers,
  activeLayerId,
  onSelectLayer,
  onToggleLayerVisibility,
  onDeleteLayer,
  onAddLayer,
  onDuplicateLayer,
  onInvertMask,
  onChangeBlendMode,
  onChangeOpacity,
  onToggleLock,
  onReorderLayers,
  baseImage,
  baseImageVisible,
  onToggleBaseImageVisibility,
  currentMaskPreviewUrl,
  isGenerating = false,
  generatingPrompt = '',
  activeMaskColor = 'white',
  onToggleMaskColor,
}) => {
  const activeLayer = layers.find(l => l.id === activeLayerId);
  const currentBlendMode = activeLayer?.blendMode || 'normal';
  const currentOpacity = activeLayer?.opacity !== undefined ? activeLayer.opacity : 100;
  const isLayerLocked = Boolean(activeLayer?.locked);

  const activeIndex = layers.findIndex(l => l.id === activeLayerId);
  const canMoveUp = activeIndex > 0;
  const canMoveDown = activeIndex >= 0 && activeIndex < layers.length - 1;

  return (
    <div className="vizmaker-layers-overlay-panel ps-layers-panel">
      {/* Header */}
      <div className="vizmaker-layers-header">
        <div className="vizmaker-layers-title-row">
          <Sparkles size={13} style={{ color: '#e11d48' }} />
          <span>Layers</span>
          <span className="ps-layer-count-badge">{layers.length + 1}</span>
        </div>
        <button type="button" className="vizmaker-layers-close-btn" onClick={onClose} title="Close Layers">
          <ChevronUp size={14} />
        </button>
      </div>

      {/* Photoshop Top Controls: Blend Mode & Opacity */}
      <div className="ps-layers-top-controls">
        <div className="ps-control-row">
          {/* Blend Mode Dropdown */}
          <select
            className="ps-blend-mode-select"
            value={currentBlendMode}
            onChange={(e) => {
              if (activeLayerId && activeLayerId !== 'base' && onChangeBlendMode) {
                onChangeBlendMode(activeLayerId, e.target.value as PhotoshopBlendMode);
              }
            }}
            disabled={!activeLayerId || activeLayerId === 'base' || isLayerLocked}
            title="Layer Blend Mode"
          >
            {BLEND_MODES.map(mode => (
              <option key={mode.value} value={mode.value}>
                {mode.label}
              </option>
            ))}
          </select>

          {/* Opacity Slider & Value */}
          <div className="ps-opacity-control" title={`Opacity: ${currentOpacity}%`}>
            <span className="ps-opacity-label">Opacity:</span>
            <input
              type="range"
              min="0"
              max="100"
              value={currentOpacity}
              disabled={!activeLayerId || activeLayerId === 'base' || isLayerLocked}
              onChange={(e) => {
                if (activeLayerId && activeLayerId !== 'base' && onChangeOpacity) {
                  onChangeOpacity(activeLayerId, Number(e.target.value));
                }
              }}
              className="ps-opacity-slider"
            />
            <span className="ps-opacity-val">{currentOpacity}%</span>
          </div>
        </div>

        {/* Reorder and Lock Row */}
        {activeLayerId && activeLayerId !== 'base' && (
          <div className="ps-layer-sub-controls">
            <div className="ps-reorder-buttons">
              <button
                type="button"
                className="ps-mini-btn"
                disabled={!canMoveUp}
                onClick={() => onReorderLayers && onReorderLayers(activeIndex, activeIndex - 1)}
                title="Bring Forward"
              >
                <ArrowUp size={11} />
              </button>
              <button
                type="button"
                className="ps-mini-btn"
                disabled={!canMoveDown}
                onClick={() => onReorderLayers && onReorderLayers(activeIndex, activeIndex + 1)}
                title="Send Backward"
              >
                <ArrowDown size={11} />
              </button>
            </div>

            <button
              type="button"
              className={`ps-mini-btn ${isLayerLocked ? 'active-lock' : ''}`}
              onClick={() => onToggleLock && onToggleLock(activeLayerId)}
              title={isLayerLocked ? 'Unlock Layer' : 'Lock Layer'}
            >
              {isLayerLocked ? <Lock size={11} style={{ color: '#fbbf24' }} /> : <Unlock size={11} />}
            </button>
          </div>
        )}
      </div>

      {/* Layers Stack List */}
      <div className="vizmaker-layers-list ps-layers-list">
        {/* Active Generating Layer Indicator */}
        {isGenerating && (
          <div className="vizmaker-layer-item ps-layer-item generating active">
            <div className="vizmaker-layer-eye-btn">
              <Loader2 size={13} className="spin" style={{ color: '#e11d48' }} />
            </div>
            <div className="ps-thumb-group">
              <div className="ps-thumb ps-thumb-image">
                {baseImage ? (
                  <LayerThumbnail rawSrc={baseImage} alt="Base" />
                ) : (
                  <div className="vizmaker-empty-thumb" />
                )}
              </div>
              <div className="ps-thumb-link">
                <Link2 size={11} style={{ color: 'rgba(255,255,255,0.4)' }} />
              </div>
              <div className="ps-thumb ps-thumb-mask active-mask-target">
                {currentMaskPreviewUrl ? (
                  <img src={currentMaskPreviewUrl} alt="Mask Thumb" className="vizmaker-layer-img-preview" />
                ) : (
                  <div className="ps-mask-white-fill" />
                )}
              </div>
            </div>
            <span className="vizmaker-layer-title generating-title">
              {generatingPrompt ? (generatingPrompt.length > 18 ? generatingPrompt.slice(0, 18) + '...' : generatingPrompt) : 'Generating inpaint...'}
            </span>
          </div>
        )}

        {/* Live Active Drawing / Mask Selection Layer */}
        {currentMaskPreviewUrl && !isGenerating && (
          <div className="vizmaker-layer-item ps-layer-item active" style={{ borderColor: '#e11d48' }}>
            <button type="button" className="vizmaker-layer-eye-btn">
              <Eye size={13} className="vizmaker-layer-eye" style={{ color: '#e11d48' }} />
            </button>
            <div className="ps-thumb-group">
              <div className="ps-thumb ps-thumb-image">
                {baseImage ? (
                  <img src={baseImage} alt="Base" className="vizmaker-layer-img-preview" />
                ) : (
                  <div className="vizmaker-empty-thumb" />
                )}
              </div>
              <div className="ps-thumb-link">
                <Link2 size={11} style={{ color: '#e11d48' }} />
              </div>
              <div className="ps-thumb ps-thumb-mask selected-target" style={{ borderColor: '#e11d48', boxShadow: '0 0 6px rgba(225,29,72,0.6)' }}>
                <img src={currentMaskPreviewUrl} alt="Live Mask Cutout" className="vizmaker-layer-img-preview" />
              </div>
            </div>
            <span className="vizmaker-layer-title ps-layer-title" style={{ color: '#fecdd3', fontWeight: 600 }}>
              {generatingPrompt ? (generatingPrompt.length > 18 ? generatingPrompt.slice(0, 18) + '...' : generatingPrompt) : 'Layer Mask'}
            </span>
          </div>
        )}

        {/* Current Inpaint Layers Stack (Photoshop style) */}
        {layers.map((layer) => {
          const isLayerActive = activeLayerId === layer.id;
          const isMaskSelected = isLayerActive && layer.selectedTarget === 'mask';
          const isImageSelected = isLayerActive && layer.selectedTarget === 'image';
          const layerOpacity = layer.opacity !== undefined ? layer.opacity : 100;
          const layerBlend = layer.blendMode || 'normal';

          return (
            <div
              key={layer.id}
              className={`vizmaker-layer-item ps-layer-item ${isLayerActive ? 'active' : ''}`}
              onClick={() => onSelectLayer(layer.id, isMaskSelected ? 'mask' : 'image')}
            >
              <button
                type="button"
                className="vizmaker-layer-eye-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleLayerVisibility(layer.id);
                }}
                title={layer.visible ? 'Hide Layer (👁️)' : 'Show Layer'}
              >
                {layer.visible ? (
                  <Eye size={13} className="vizmaker-layer-eye" />
                ) : (
                  <EyeOff size={13} className="vizmaker-layer-eye off" />
                )}
              </button>

              {/* Photoshop Dual Thumbnails with Link Chain */}
              <div className="ps-thumb-group">
                {/* Image Thumbnail */}
                <div
                  className={`ps-thumb ps-thumb-image ${isImageSelected ? 'selected-target' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectLayer(layer.id, 'image');
                  }}
                  title="Layer Image (Click to paint on image)"
                >
                  <LayerThumbnail rawSrc={layer.image} alt={layer.name} />
                </div>

                {/* Photoshop Link Chain 🔗 */}
                <div className="ps-thumb-link" title="Layer and Mask Linked">
                  <Link2 size={11} />
                </div>

                {/* Layer Mask Thumbnail ⬜/⬛ */}
                <div
                  className={`ps-thumb ps-thumb-mask ${isMaskSelected ? 'selected-target' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectLayer(layer.id, 'mask');
                  }}
                  title="Layer Mask (Click to paint with White/Black)"
                >
                  {layer.maskPreviewUrl || layer.maskDataUrl ? (
                    <img src={layer.maskPreviewUrl || layer.maskDataUrl || ''} alt="Mask" className="vizmaker-layer-img-preview" />
                  ) : (
                    <div className="ps-mask-white-fill" />
                  )}
                </div>
              </div>

              <div className="ps-layer-info">
                <span className="vizmaker-layer-title ps-layer-title" title={layer.prompt || layer.name}>
                  {layer.name.length > 18 ? layer.name.slice(0, 18) + '...' : layer.name}
                </span>
                {(layerBlend !== 'normal' || layerOpacity < 100) && (
                  <span className="ps-layer-blend-badge">
                    {layerBlend !== 'normal' ? layerBlend : ''} {layerOpacity < 100 ? `${layerOpacity}%` : ''}
                  </span>
                )}
              </div>

              {layer.locked && (
                <Lock size={11} style={{ color: 'rgba(255,255,255,0.4)', marginLeft: 'auto' }} />
              )}
            </div>
          );
        })}

        {/* Base Image Layer (Locked background layer) */}
        <div
          className={`vizmaker-layer-item ps-layer-item ${activeLayerId === 'base' ? 'active' : ''}`}
          onClick={() => onSelectLayer('base', 'image')}
        >
          <button
            type="button"
            className="vizmaker-layer-eye-btn"
            onClick={(e) => {
              e.stopPropagation();
              onToggleBaseImageVisibility();
            }}
            title={baseImageVisible ? 'Hide Background' : 'Show Background'}
          >
            {baseImageVisible ? (
              <Eye size={13} className="vizmaker-layer-eye" />
            ) : (
              <EyeOff size={13} className="vizmaker-layer-eye off" />
            )}
          </button>

          <div className="ps-thumb-group">
            <div className={`ps-thumb ps-thumb-image ${activeLayerId === 'base' ? 'selected-target' : ''}`}>
              {baseImage ? (
                <img src={baseImage} alt="Base" className="vizmaker-layer-img-preview" />
              ) : (
                <div className="vizmaker-empty-thumb" />
              )}
            </div>
          </div>

          <span className="vizmaker-layer-title ps-layer-title">Background</span>
          <Lock size={13} className="vizmaker-layer-lock-icon" />
        </div>
      </div>

      {/* Footer with Mask Color Quick Switcher and Actions */}
      <div className="vizmaker-layers-footer ps-layers-footer">
        {activeLayerId !== 'base' && onToggleMaskColor && (
          <div
            className="ps-layer-color-switch"
            onClick={onToggleMaskColor}
            title={`Active Mask Color: ${activeMaskColor === 'white' ? '⬜ White (Reveal)' : '⬛ Black (Hide/Erase)'}. Click or press 'X' to swap.`}
          >
            <div className={`ps-color-chip white ${activeMaskColor === 'white' ? 'active' : ''}`} />
            <div className={`ps-color-chip black ${activeMaskColor === 'black' ? 'active' : ''}`} />
            <span className="ps-color-label">{activeMaskColor === 'white' ? 'Reveal (W)' : 'Hide (B)'}</span>
          </div>
        )}

        <div className="ps-footer-buttons">
          {/* Invert Mask Button (Ctrl+I) */}
          {activeLayerId && activeLayerId !== 'base' && onInvertMask && (
            <button
              type="button"
              className="vizmaker-layer-action-btn"
              onClick={() => onInvertMask(activeLayerId)}
              title="Invert Layer Mask (Ctrl+I)"
            >
              <Contrast size={13} />
            </button>
          )}

          {/* Duplicate Layer */}
          {activeLayerId && activeLayerId !== 'base' && onDuplicateLayer && (
            <button
              type="button"
              className="vizmaker-layer-action-btn"
              onClick={() => onDuplicateLayer(activeLayerId)}
              title="Duplicate Layer"
            >
              <Copy size={13} />
            </button>
          )}

          {/* Add New Layer */}
          <button
            type="button"
            className="vizmaker-layer-action-btn"
            onClick={onAddLayer}
            title="Add New Layer (+)"
          >
            <Plus size={14} />
          </button>

          {/* Delete Layer */}
          <button
            type="button"
            className="vizmaker-layer-action-btn delete-btn"
            onClick={() => {
              if (activeLayerId && activeLayerId !== 'base') {
                onDeleteLayer(activeLayerId);
              }
            }}
            disabled={!activeLayerId || activeLayerId === 'base'}
            title="Delete Selected Layer (🗑️)"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};
