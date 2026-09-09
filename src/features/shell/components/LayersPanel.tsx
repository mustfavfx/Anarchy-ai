import React, { useState, useRef, useEffect } from 'react';
import { 
  ChevronUp, Eye, EyeOff, Lock, Unlock, Plus, Trash2, Loader2, Sparkles, 
  Link2, Copy, Contrast, ArrowUp, ArrowDown, Paintbrush2, ArrowLeftRight, FileCode
} from 'lucide-react';
import { useResolvedImage } from '../../../hooks';
import { useTranslation } from '../../../services/i18n';

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

export const BLEND_MODE_GROUPS: {
  groupName: string;
  modes: { value: PhotoshopBlendMode; label: string }[];
}[] = [
  {
    groupName: 'Normal',
    modes: [
      { value: 'normal', label: 'Normal' },
    ],
  },
  {
    groupName: 'Darken',
    modes: [
      { value: 'darken', label: 'Darken' },
      { value: 'multiply', label: 'Multiply' },
      { value: 'color-burn', label: 'Color Burn' },
    ],
  },
  {
    groupName: 'Lighten',
    modes: [
      { value: 'lighten', label: 'Lighten' },
      { value: 'screen', label: 'Screen' },
      { value: 'color-dodge', label: 'Color Dodge' },
    ],
  },
  {
    groupName: 'Contrast',
    modes: [
      { value: 'overlay', label: 'Overlay' },
      { value: 'soft-light', label: 'Soft Light' },
      { value: 'hard-light', label: 'Hard Light' },
    ],
  },
  {
    groupName: 'Inversion',
    modes: [
      { value: 'difference', label: 'Difference' },
      { value: 'exclusion', label: 'Exclusion' },
    ],
  },
  {
    groupName: 'Component',
    modes: [
      { value: 'hue', label: 'Hue' },
      { value: 'saturation', label: 'Saturation' },
      { value: 'color', label: 'Color' },
      { value: 'luminosity', label: 'Luminosity' },
    ],
  },
];

export const BLEND_MODES: { value: PhotoshopBlendMode; label: string }[] = BLEND_MODE_GROUPS.flatMap(g => g.modes);

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
  onRenameLayer?: (id: string, newName: string) => void;
  baseImage: string | null | undefined;
  baseImageVisible: boolean;
  onToggleBaseImageVisibility: () => void;
  baseImageOpacity?: number;
  onChangeBaseOpacity?: (opacity: number) => void;
  currentMaskPreviewUrl?: string | null;
  hasActiveMask?: boolean;
  maskVisible?: boolean;
  maskOpacity?: number; // 0 to 100 or 0 to 1
  maskBlendMode?: PhotoshopBlendMode;
  onChangeMaskOpacity?: (opacity: number) => void;
  onChangeMaskBlendMode?: (mode: PhotoshopBlendMode) => void;
  isGenerating?: boolean;
  generatingPrompt?: string;
  activeMaskColor?: 'white' | 'black';
  onToggleMaskColor?: () => void;
  onExportPsd?: () => void;
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
  onRenameLayer,
  baseImage,
  baseImageVisible,
  onToggleBaseImageVisibility,
  baseImageOpacity = 100,
  onChangeBaseOpacity,
  currentMaskPreviewUrl,
  hasActiveMask = false,
  maskVisible = true,
  maskOpacity = 100,
  maskBlendMode = 'normal',
  onChangeMaskOpacity,
  onChangeMaskBlendMode,
  isGenerating = false,
  generatingPrompt = '',
  activeMaskColor = 'white',
  onToggleMaskColor,
  onExportPsd,
}) => {
  const { isAr } = useTranslation();
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingLayerId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [editingLayerId]);

  const isMaskActive = activeLayerId === 'active-mask';
  const isBaseActive = activeLayerId === 'base';
  const activeLayer = layers.find(l => l.id === activeLayerId);

  // Compute active blend mode
  let currentBlendMode: PhotoshopBlendMode = 'normal';
  if (isMaskActive) {
    currentBlendMode = maskBlendMode || 'normal';
  } else if (activeLayer) {
    currentBlendMode = activeLayer.blendMode || 'normal';
  }

  // Compute active opacity (0-100)
  let currentOpacity = 100;
  if (isMaskActive) {
    currentOpacity = Math.round(maskOpacity <= 1 ? maskOpacity * 100 : maskOpacity);
  } else if (isBaseActive) {
    currentOpacity = baseImageOpacity !== undefined ? baseImageOpacity : 100;
  } else if (activeLayer) {
    currentOpacity = activeLayer.opacity !== undefined ? activeLayer.opacity : 100;
  }

  const isLayerLocked = Boolean(activeLayer?.locked);

  const activeIndex = layers.findIndex(l => l.id === activeLayerId);
  const canMoveUp = activeIndex > 0;
  const canMoveDown = activeIndex >= 0 && activeIndex < layers.length - 1;

  const showActiveMaskRow = Boolean(currentMaskPreviewUrl || hasActiveMask);
  const totalLayerCount = layers.length + (showActiveMaskRow ? 1 : 0) + 1;

  const handleStartRename = (id: string, currentName: string) => {
    setEditingLayerId(id);
    setEditingName(currentName);
  };

  const handleFinishRename = (id: string) => {
    const trimmed = editingName.trim();
    if (trimmed && onRenameLayer) {
      onRenameLayer(id, trimmed);
    }
    setEditingLayerId(null);
  };

  const isDeleteEnabled = Boolean(
    (isMaskActive && (currentMaskPreviewUrl || hasActiveMask)) ||
    (!isBaseActive && activeLayer && !isLayerLocked)
  );

  return (
    <div className="vizmaker-layers-overlay-panel ps-layers-panel">
      {/* Header */}
      <div className="vizmaker-layers-header">
        <div className="vizmaker-layers-title-row">
          <Sparkles size={13} style={{ color: '#e11d48' }} />
          <span>{isAr ? 'الطبقات' : 'Layers'}</span>
          <span className="ps-layer-count-badge" title={isAr ? `${totalLayerCount} طبقات نشطة` : `${totalLayerCount} Layers Active`}>
            {totalLayerCount}
          </span>
        </div>
        <button type="button" className="vizmaker-layers-close-btn" onClick={onClose} title={isAr ? 'إغلاق لوحة الطبقات' : 'Close Layers'}>
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
              const newMode = e.target.value as PhotoshopBlendMode;
              if (isMaskActive && onChangeMaskBlendMode) {
                onChangeMaskBlendMode(newMode);
              } else if (activeLayerId && !isBaseActive && onChangeBlendMode) {
                onChangeBlendMode(activeLayerId, newMode);
              }
            }}
            disabled={(!isMaskActive && (!activeLayerId || isBaseActive || isLayerLocked))}
            title={isAr ? 'وضع دمج الطبقة (Blend Mode)' : 'Layer Blend Mode'}
          >
            {BLEND_MODE_GROUPS.map(group => (
              <optgroup key={group.groupName} label={`── ${group.groupName} ──`}>
                {group.modes.map(mode => (
                  <option key={mode.value} value={mode.value}>
                    {mode.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>

          {/* Opacity Slider & Value */}
          <div className="ps-opacity-control" title={`${isAr ? 'الشفافية' : 'Opacity'}: ${currentOpacity}%`}>
            <span className="ps-opacity-label">{isAr ? 'الشفافية:' : 'Opacity:'}</span>
            <input
              type="range"
              min="5"
              max="100"
              value={currentOpacity}
              disabled={(!isMaskActive && !isBaseActive && (!activeLayerId || isLayerLocked))}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (isMaskActive && onChangeMaskOpacity) {
                  onChangeMaskOpacity(val);
                } else if (isBaseActive && onChangeBaseOpacity) {
                  onChangeBaseOpacity(val);
                } else if (activeLayerId && !isBaseActive && onChangeOpacity) {
                  onChangeOpacity(activeLayerId, val);
                }
              }}
              className="ps-opacity-slider"
            />
            <span className="ps-opacity-val">{currentOpacity}%</span>
          </div>
        </div>

        {/* Reorder and Lock Row */}
        {activeLayerId && !isBaseActive && !isMaskActive && (
          <div className="ps-layer-sub-controls">
            <div className="ps-reorder-buttons">
              <button
                type="button"
                className="ps-mini-btn"
                disabled={!canMoveUp}
                onClick={() => onReorderLayers && onReorderLayers(activeIndex, activeIndex - 1)}
                title={isAr ? 'تحريك الطبقة للأعلى' : 'Bring Forward'}
              >
                <ArrowUp size={11} />
              </button>
              <button
                type="button"
                className="ps-mini-btn"
                disabled={!canMoveDown}
                onClick={() => onReorderLayers && onReorderLayers(activeIndex, activeIndex + 1)}
                title={isAr ? 'تحريك الطبقة للأسفل' : 'Send Backward'}
              >
                <ArrowDown size={11} />
              </button>
            </div>

            <button
              type="button"
              className={`ps-mini-btn ${isLayerLocked ? 'active-lock' : ''}`}
              onClick={() => onToggleLock && onToggleLock(activeLayerId)}
              title={isLayerLocked ? (isAr ? 'إلغاء قفل الطبقة' : 'Unlock Layer') : (isAr ? 'قفل الطبقة' : 'Lock Layer')}
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
        {showActiveMaskRow && !isGenerating && (
          <div 
            className={`vizmaker-layer-item ps-layer-item ${isMaskActive ? 'active active-mask-layer' : ''}`}
            style={{ 
              borderColor: isMaskActive ? '#e11d48' : 'rgba(225, 29, 72, 0.4)',
              boxShadow: isMaskActive ? '0 0 10px rgba(225, 29, 72, 0.35)' : undefined,
              cursor: 'pointer'
            }}
            onClick={() => onSelectLayer('active-mask', 'mask')}
          >
            <button 
              type="button" 
              className="vizmaker-layer-eye-btn"
              onClick={(e) => {
                e.stopPropagation();
                onToggleLayerVisibility('active-mask');
              }}
              title={maskVisible !== false ? 'Hide Mask Overlay (👁️)' : 'Show Mask Overlay'}
            >
              {maskVisible !== false ? (
                <Eye size={13} className="vizmaker-layer-eye" style={{ color: '#e11d48' }} />
              ) : (
                <EyeOff size={13} className="vizmaker-layer-eye off" />
              )}
            </button>

            <div className="ps-thumb-group">
              <div 
                className="ps-thumb ps-thumb-image"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectLayer('active-mask', 'image');
                }}
                title="Base Image"
              >
                {baseImage ? (
                  <img src={baseImage} alt="Base" className="vizmaker-layer-img-preview" />
                ) : (
                  <div className="vizmaker-empty-thumb" />
                )}
              </div>
              <div className="ps-thumb-link">
                <Link2 size={11} style={{ color: '#e11d48' }} />
              </div>
              <div 
                className={`ps-thumb ps-thumb-mask selected-target`} 
                style={{ borderColor: '#e11d48', boxShadow: '0 0 6px rgba(225,29,72,0.6)' }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectLayer('active-mask', 'mask');
                }}
                title="Active Mask Stencil (Click to paint White/Black)"
              >
                {currentMaskPreviewUrl ? (
                  <img src={currentMaskPreviewUrl} alt="Live Mask Cutout" className="vizmaker-layer-img-preview" />
                ) : (
                  <div className="ps-mask-empty-thumb" title="Empty Mask Stencil - Click to paint">
                    <Paintbrush2 size={12} style={{ color: 'rgba(255,255,255,0.4)' }} />
                  </div>
                )}
              </div>
            </div>

            <div className="ps-layer-info">
              <span className="vizmaker-layer-title ps-layer-title" style={{ color: '#fecdd3', fontWeight: 600 }}>
                {generatingPrompt ? (generatingPrompt.length > 18 ? generatingPrompt.slice(0, 18) + '...' : generatingPrompt) : (isAr ? 'قناع الطبقة' : 'Layer Mask')}
              </span>
              <span className="ps-layer-blend-badge" style={{ background: 'rgba(225,29,72,0.2)', color: '#fda4af' }}>
                {maskBlendMode && maskBlendMode !== 'normal' ? maskBlendMode : (isAr ? 'قناع نشط' : 'Active Stencil')}
              </span>
            </div>
          </div>
        )}

        {/* Current Inpaint Layers Stack (Photoshop style) */}
        {layers.map((layer) => {
          const isLayerActive = activeLayerId === layer.id;
          const isMaskSelected = isLayerActive && layer.selectedTarget === 'mask';
          const isImageSelected = isLayerActive && layer.selectedTarget === 'image';
          const layerOpacity = layer.opacity !== undefined ? layer.opacity : 100;
          const layerBlend = layer.blendMode || 'normal';
          const isEditing = editingLayerId === layer.id;

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
                  title="Layer Image (Click to select image)"
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
                    <div className="ps-mask-empty-thumb" title="Empty Mask - Click to paint">
                      <Paintbrush2 size={12} style={{ color: 'rgba(255,255,255,0.4)' }} />
                    </div>
                  )}
                </div>
              </div>

              <div className="ps-layer-info">
                {isEditing ? (
                  <input
                    ref={renameInputRef}
                    type="text"
                    className="ps-layer-rename-input"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={() => handleFinishRename(layer.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleFinishRename(layer.id);
                      if (e.key === 'Escape') setEditingLayerId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span 
                    className="vizmaker-layer-title ps-layer-title" 
                    title={`${layer.name} (Double-click to rename)`}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      handleStartRename(layer.id, layer.name);
                    }}
                  >
                    {layer.name.length > 18 ? layer.name.slice(0, 18) + '...' : layer.name}
                  </span>
                )}
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
          className={`vizmaker-layer-item ps-layer-item ${isBaseActive ? 'active' : ''}`}
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
            <div className={`ps-thumb ps-thumb-image ${isBaseActive ? 'selected-target' : ''}`}>
              {baseImage ? (
                <img src={baseImage} alt="Base" className="vizmaker-layer-img-preview" />
              ) : (
                <div className="vizmaker-empty-thumb" />
              )}
            </div>
          </div>

          <span className="vizmaker-layer-title ps-layer-title">{isAr ? 'الخلفية' : 'Background'}</span>
          <Lock size={13} className="vizmaker-layer-lock-icon" />
        </div>
      </div>

      {/* Footer with Mask Color Quick Switcher and Actions */}
      <div className="vizmaker-layers-footer ps-layers-footer">
        {onToggleMaskColor && (
          <div
            className="ps-layer-color-switch"
            onClick={onToggleMaskColor}
            title={
              isAr
                ? `تبديل لون فرشة الماسك (اختصار: X)\nالحالي: ${activeMaskColor === 'white' ? 'رسم الماسك (أبيض)' : 'مسح الماسك (أسود)'}`
                : `Toggle Mask Brush (Shortcut: X)\nCurrent: ${activeMaskColor === 'white' ? 'Paint Mask (White)' : 'Erase Mask (Black)'}`
            }
          >
            <div className="ps-color-chips-wrap">
              <div 
                className={`ps-color-chip white ${activeMaskColor === 'white' ? 'active' : ''}`} 
                title={isAr ? 'أبيض: رسم الماسك' : 'White: Paint Mask'} 
              />
              <ArrowLeftRight size={10} className="ps-color-swap-icon" />
              <div 
                className={`ps-color-chip black ${activeMaskColor === 'black' ? 'active' : ''}`} 
                title={isAr ? 'أسود: مسح الماسك' : 'Black: Erase Mask'} 
              />
            </div>
            <span className="ps-color-label">
              {activeMaskColor === 'white' ? (isAr ? 'رسم' : 'Paint') : (isAr ? 'مسح' : 'Erase')}
            </span>
            <span className="ps-color-shortcut">X</span>
          </div>
        )}

        {onToggleMaskColor && <div className="ps-footer-divider" />}

        <div className="ps-footer-buttons">
          {/* Invert Mask Button (Ctrl+I) */}
          {onInvertMask && (
            <button
              type="button"
              className="vizmaker-layer-action-btn"
              onClick={() => onInvertMask(activeLayerId)}
              title={isAr ? 'عكس قناع الماسك (Ctrl+I)' : 'Invert Layer Mask (Ctrl+I)'}
              disabled={!activeLayerId || activeLayerId === 'base'}
            >
              <Contrast size={14} />
            </button>
          )}

          {/* Duplicate Layer (Ctrl+J) */}
          {onDuplicateLayer && (
            <button
              type="button"
              className="vizmaker-layer-action-btn"
              onClick={() => onDuplicateLayer(activeLayerId)}
              title={isAr ? 'مضاعفة الطبقة الحالية (Ctrl+J)' : 'Duplicate Layer (Ctrl+J)'}
              disabled={!activeLayerId}
            >
              <Copy size={13} />
            </button>
          )}

          {/* Export PSD (.psd) */}
          {onExportPsd && (
            <button
              type="button"
              className="vizmaker-layer-action-btn"
              onClick={onExportPsd}
              title={isAr ? 'تصدير كملف فوتوشوب (Export PSD)' : 'Export Layers as Photoshop PSD'}
              style={{ color: '#38bdf8' }}
            >
              <FileCode size={13} />
            </button>
          )}

          {/* Add New Layer (+) */}
          <button
            type="button"
            className="vizmaker-layer-action-btn"
            onClick={onAddLayer}
            title={isAr ? 'إضافة طبقة جديدة (+)' : 'Add New Layer (+)'}
          >
            <Plus size={14} />
          </button>

          {/* Delete Layer (Trash) */}
          <button
            type="button"
            className="vizmaker-layer-action-btn delete-btn"
            onClick={() => {
              if (isDeleteEnabled) {
                onDeleteLayer(activeLayerId);
              }
            }}
            disabled={!isDeleteEnabled}
            title={
              isDeleteEnabled
                ? (isAr ? 'حذف الطبقة / مسح الماسك (Delete)' : 'Delete Selected Layer / Clear Mask (Delete)')
                : (isAr ? 'لا يمكن حذف طبقة الخلفية' : 'Cannot delete background layer')
            }
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};
