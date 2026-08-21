import React from 'react';
import { ChevronUp, Eye, EyeOff, Lock, Plus, Trash2, Loader2, Sparkles, Link2 } from 'lucide-react';
import { useResolvedImage } from '../../../hooks';

const LayerThumbnail: React.FC<{ rawSrc?: string | null; alt: string; className?: string }> = ({ rawSrc, alt, className }) => {
  const resolved = useResolvedImage(rawSrc);
  const safeSrc = resolved || (rawSrc && !rawSrc.startsWith('idb://') ? rawSrc : undefined);
  if (!safeSrc) {
    return <div className="vizmaker-empty-thumb" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: '#111' }}><Loader2 size={10} className="spin" style={{ color: '#e11d48' }} /></div>;
  }
  return <img src={safeSrc} alt={alt} className={className || 'vizmaker-layer-img-preview'} />;
};


export interface InpaintLayer {
  id: string;
  name: string;
  prompt: string;
  image: string;
  maskDataUrl?: string | null;
  maskPreviewUrl?: string | null;
  visible: boolean;
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
  baseImage,
  baseImageVisible,
  onToggleBaseImageVisibility,
  currentMaskPreviewUrl,
  isGenerating = false,
  generatingPrompt = '',
  activeMaskColor = 'white',
  onToggleMaskColor,
}) => {
  return (
    <div className="vizmaker-layers-overlay-panel ps-layers-panel">
      <div className="vizmaker-layers-header">
        <div className="vizmaker-layers-title-row">
          <Sparkles size={13} style={{ color: '#e11d48' }} />
          <span>Layers</span>
        </div>
        <button type="button" className="vizmaker-layers-close-btn" onClick={onClose} title="Close Layers">
          <ChevronUp size={14} />
        </button>
      </div>

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

          return (
            <div
              key={layer.id}
              className={`vizmaker-layer-item ps-layer-item ${isLayerActive ? 'active' : ''}`}
              onClick={() => onSelectLayer(layer.id, 'mask')}
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
                  title="Layer Image Thumbnail"
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
                  title="Layer Mask Thumbnail (Click to paint mask with Black/White)"
                >
                  {layer.maskPreviewUrl ? (
                    <img src={layer.maskPreviewUrl} alt="Mask" className="vizmaker-layer-img-preview" />
                  ) : (
                    <div className="ps-mask-white-fill" />
                  )}
                </div>
              </div>

              <span className="vizmaker-layer-title ps-layer-title" title={layer.prompt || layer.name}>
                {layer.name.length > 20 ? layer.name.slice(0, 20) + '...' : layer.name}
              </span>
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
            <span className="ps-color-label">{activeMaskColor === 'white' ? 'Reveal (White)' : 'Hide (Black)'}</span>
          </div>
        )}

        <div className="ps-footer-buttons">
          <button
            type="button"
            className="vizmaker-layer-action-btn"
            onClick={onAddLayer}
            title="Add New Mask Selection (+)"
          >
            <Plus size={14} />
          </button>

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
