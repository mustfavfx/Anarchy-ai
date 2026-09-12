import React, { useState, useRef } from 'react';
import { 
  X, Eye, EyeOff, Lock, Plus, Trash2, Loader2, 
  Link2, Contrast, ChevronDown, ChevronRight, Paintbrush2,
  Layers, Sliders
} from 'lucide-react';
import { useResolvedImage } from '../../../hooks';
import { useTranslation } from '../../../services/i18n';
import { PhotoshopColorPanel } from './PhotoshopColorPanel';
import { PhotoshopAdjustmentsPanel } from './PhotoshopAdjustmentsPanel';

const LayerThumbnail: React.FC<{ rawSrc?: string | null; alt: string; className?: string }> = ({ rawSrc, alt, className }) => {
  const resolved = useResolvedImage(rawSrc);
  const safeSrc = resolved || (rawSrc && !rawSrc.startsWith('idb://') ? rawSrc : undefined);
  if (!safeSrc) {
    return (
      <div className="vizmaker-empty-thumb" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: '#111' }}>
        <Loader2 size={10} className="spin" style={{ color: '#ffffff' }} />
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

export interface InpaintLayer {
  id: string;
  name: string;
  prompt?: string;
  image: string;
  maskDataUrl?: string | null;
  maskPreviewUrl?: string | null;
  visible: boolean;
  opacity?: number;
  blendMode?: PhotoshopBlendMode;
  locked?: boolean;
  selectedTarget?: 'image' | 'mask';
  createdAt?: number;
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
  maskOpacity?: number;
  maskBlendMode?: PhotoshopBlendMode;
  onChangeMaskOpacity?: (opacity: number) => void;
  onChangeMaskBlendMode?: (mode: PhotoshopBlendMode) => void;
  isGenerating?: boolean;
  generatingPrompt?: string;
  activeMaskColor?: 'white' | 'black';
  onToggleMaskColor?: () => void;
  onExportPsd?: () => void;
  brushColor?: string;
  onChangeBrushColor?: (color: string) => void;
  onOpenColorRange?: () => void;
  onApplyAdjustment?: (key: string, name: string) => void;
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
  brushColor = '#e11d48',
  onChangeBrushColor,
  onOpenColorRange,
  onApplyAdjustment,
}) => {
  const { isAr } = useTranslation();
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Studio Dock Accordion Groups State
  const [isColorOpen, setIsColorOpen] = useState(true);
  const [isAdjustmentsOpen, setIsAdjustmentsOpen] = useState(true);
  const [isLayersOpen, setIsLayersOpen] = useState(true);



  const isMaskActive = activeLayerId === 'active-mask';
  const isBaseActive = activeLayerId === 'base';
  const activeLayer = layers.find(l => l.id === activeLayerId);

  // Active blend mode & opacity
  let currentBlendMode: PhotoshopBlendMode = 'normal';
  if (isMaskActive) {
    currentBlendMode = maskBlendMode || 'normal';
  } else if (activeLayer && activeLayer.blendMode) {
    currentBlendMode = activeLayer.blendMode;
  }

  let currentOpacity = 100;
  if (isMaskActive) {
    currentOpacity = maskOpacity !== undefined ? Math.round(maskOpacity * (maskOpacity <= 1 ? 100 : 1)) : 100;
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
    <div className="mask-layers-docked-panel ps-layers-panel">
      {/* Studio Dock Master Header */}
      <div className="ps-dock-master-bar">
        <div className="ps-dock-title-group">
          <Sliders size={13} style={{ color: '#38bdf8' }} />
          <span className="ps-dock-title-text">{isAr ? 'استوديو التحكم والطبقات' : 'Studio Canvas'}</span>
          <span className="ps-layer-count-badge" title={isAr ? `${totalLayerCount} طبقات نشطة` : `${totalLayerCount} Layers Active`}>
            {totalLayerCount}
          </span>
        </div>
        <button type="button" className="mask-layers-close-btn" onClick={onClose} title={isAr ? 'إغلاق لوحة الاستوديو' : 'Close Studio'}>
          <X size={13} />
        </button>
      </div>

      <div className="ps-dock-scrollable-body">
        {/* GROUP 1: Color */}
        <div className={`ps-dock-accordion-group ${isColorOpen ? 'open' : 'collapsed'}`}>
          <div 
            className="ps-dock-accordion-header" 
            onClick={() => setIsColorOpen(prev => !prev)}
            title={isAr ? 'طي / توسيع لوحة الألوان' : 'Toggle Color Panel'}
          >
            {isColorOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <span className="ps-accordion-title">{isAr ? 'اللون' : 'Color'}</span>
          </div>
          {isColorOpen && (
            <PhotoshopColorPanel
              activeColor={brushColor || (activeMaskColor === 'white' ? '#ffffff' : '#000000')}
              onChangeColor={(color) => {
                if (onChangeBrushColor) onChangeBrushColor(color);
              }}
              secondaryColor={activeMaskColor === 'white' ? '#000000' : '#ffffff'}
              onToggleMaskColor={onToggleMaskColor}
              activeMaskColor={activeMaskColor}
            />
          )}
        </div>

        {/* GROUP 2: Adjustments */}
        <div className={`ps-dock-accordion-group ${isAdjustmentsOpen ? 'open' : 'collapsed'}`}>
          <div 
            className="ps-dock-accordion-header" 
            onClick={() => setIsAdjustmentsOpen(prev => !prev)}
            title={isAr ? 'طي / توسيع لوحة التعديلات' : 'Toggle Adjustments Panel'}
          >
            {isAdjustmentsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <span className="ps-accordion-title">{isAr ? 'التعديلات والتأثيرات' : 'Adjustments'}</span>
          </div>
          {isAdjustmentsOpen && (
            <PhotoshopAdjustmentsPanel
              onInvertMask={onInvertMask ? () => onInvertMask(activeLayerId) : undefined}
              onOpenColorRange={onOpenColorRange}
              activeLayerId={activeLayerId}
              onApplyAdjustment={onApplyAdjustment}
            />
          )}
        </div>

        {/* GROUP 3: Layers / Channels / Paths */}
        <div className={`ps-dock-accordion-group ps-layers-accordion-group ${isLayersOpen ? 'open' : 'collapsed'}`}>
          <div 
            className="ps-dock-accordion-header" 
            onClick={() => setIsLayersOpen(prev => !prev)}
            title={isAr ? 'طي / توسيع لوحة الطبقات' : 'Toggle Layers Panel'}
          >
            {isLayersOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <span className="ps-accordion-title">{isAr ? 'الطبقات' : 'Layers'}</span>
          </div>

          {isLayersOpen && (
            <div className="ps-layers-section-container">

                  {/* Blend Mode & Opacity Row */}
                  <div className="ps-layers-top-controls">
                    <div className="ps-control-row">
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


                  </div>

                  {/* Layers Stack List */}
                  <div className="mask-layers-list ps-layers-list">
                    {/* Active Generating Layer Indicator */}
                    {isGenerating && (
                      <div className="mask-layer-item ps-layer-item generating active">
                        <div className="vizmaker-layer-eye-btn">
                          <Loader2 size={13} className="spin" style={{ color: '#ffffff' }} />
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
                            <Link2 size={11} style={{ color: 'rgba(255,255,255,0.5)' }} />
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
                        className={`mask-layer-item ps-layer-item active-mask-layer ${isMaskActive ? 'active' : ''}`}
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
                            <Eye size={13} className="vizmaker-layer-eye" />
                          ) : (
                            <EyeOff size={13} className="vizmaker-layer-eye off" />
                          )}
                        </button>

                        <div className="ps-thumb-group">
                          <div 
                            className={`ps-thumb ps-thumb-image ${isMaskActive && !isBaseActive ? '' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectLayer('active-mask', 'image');
                            }}
                            title="Base Image"
                          >
                            {baseImage ? (
                              <LayerThumbnail rawSrc={baseImage} alt="Base" />
                            ) : (
                              <div className="vizmaker-empty-thumb" />
                            )}
                          </div>
                          <div className="ps-thumb-link">
                            <Link2 size={11} style={{ color: 'rgba(255, 255, 255, 0.6)' }} />
                          </div>
                          <div 
                            className="ps-thumb ps-thumb-mask selected-target" 
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
                                <Paintbrush2 size={12} style={{ color: 'rgba(255,255,255,0.7)' }} />
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="ps-layer-info">
                          <span className="vizmaker-layer-title ps-layer-title">
                            {generatingPrompt ? (generatingPrompt.length > 18 ? generatingPrompt.slice(0, 18) + '...' : generatingPrompt) : (isAr ? 'قناع الطبقة' : 'Layer Mask')}
                          </span>
                          <span className="ps-layer-blend-badge">
                            {maskBlendMode && maskBlendMode !== 'normal' ? maskBlendMode : (isAr ? 'قناع نشط' : 'Active Stencil')}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Render Inpaint Generated Layers */}
                    {layers.map((layer) => {
                      const isSelected = activeLayerId === layer.id;
                      const isImageSelected = isSelected;
                      const isMaskSelected = false;
                      const isEditing = editingLayerId === layer.id;
                      const layerBlend = layer.blendMode || 'normal';
                      const layerOpacity = layer.opacity !== undefined ? layer.opacity : 100;

                      return (
                        <div
                          key={layer.id}
                          className={`mask-layer-item ps-layer-item ${isSelected ? 'active' : ''} ${layer.locked ? 'locked' : ''}`}
                          onClick={() => onSelectLayer(layer.id, 'image')}
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

                            <div className="ps-thumb-link" title="Layer and Mask Linked">
                              <Link2 size={11} />
                            </div>

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
                                  <Paintbrush2 size={12} style={{ color: 'rgba(255,255,255,0.5)' }} />
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
                      className={`mask-layer-item ps-layer-item ${isBaseActive ? 'active' : ''}`}
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
                            <LayerThumbnail rawSrc={baseImage} alt="Base" />
                          ) : (
                            <div className="vizmaker-empty-thumb" />
                          )}
                        </div>
                      </div>

                      <span className="vizmaker-layer-title ps-layer-title">{isAr ? 'الخلفية' : 'Background Base'}</span>
                      <Lock size={13} className="vizmaker-layer-lock-icon" />
                    </div>
                  </div>

              {/* Action Footer */}
              <div className="mask-layers-dock-footer ps-photoshop-footer">
                <button
                  type="button"
                  className="ps-dock-action-btn"
                  onClick={() => onSelectLayer(activeLayerId && activeLayerId !== 'base' ? activeLayerId : 'active-mask', 'mask')}
                  title={isAr ? 'تفعيل / إضافة قناع الطبقة (Add / Select Layer Mask)' : 'Add / Select layer mask'}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <circle cx="12" cy="12" r="5" fill="currentColor" />
                  </svg>
                </button>

                <button
                  type="button"
                  className="ps-dock-action-btn"
                  onClick={onOpenColorRange}
                  title={isAr ? 'إنشاء طبقة ضبط جديدة (New Adjustment Layer)' : 'Create new fill or adjustment layer'}
                >
                  <Contrast size={13} />
                </button>

                <button
                  type="button"
                  className="ps-dock-action-btn"
                  onClick={onAddLayer}
                  title={isAr ? 'إنشاء طبقة جديدة (Create New Layer)' : 'Create a new layer'}
                >
                  <Plus size={14} />
                </button>

                <button
                  type="button"
                  className="ps-dock-action-btn delete"
                  onClick={() => {
                    if (isDeleteEnabled) {
                      onDeleteLayer(activeLayerId);
                    }
                  }}
                  disabled={!isDeleteEnabled}
                  title={isAr ? 'حذف الطبقة (Delete Layer)' : 'Delete layer'}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
