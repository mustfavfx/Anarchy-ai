import React from 'react';
import { ChevronUp, Eye, EyeOff, Lock, Plus, Trash2, Loader2, Sparkles } from 'lucide-react';

export interface InpaintLayer {
  id: string;
  name: string;
  prompt: string;
  image: string;
  maskPreviewUrl?: string | null;
  visible: boolean;
  isGenerating?: boolean;
  createdAt: number;
}

export interface LayersPanelProps {
  onClose: () => void;
  layers: InpaintLayer[];
  activeLayerId: string;
  onSelectLayer: (id: string) => void;
  onToggleLayerVisibility: (id: string) => void;
  onDeleteLayer: (id: string) => void;
  onAddLayer: () => void;
  baseImage: string | null | undefined;
  baseImageVisible: boolean;
  onToggleBaseImageVisibility: () => void;
  currentMaskPreviewUrl?: string | null;
  isGenerating?: boolean;
  generatingPrompt?: string;
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
}) => {
  return (
    <div className="vizmaker-layers-overlay-panel">
      <div className="vizmaker-layers-header">
        <div className="vizmaker-layers-title-row">
          <Sparkles size={13} style={{ color: '#e11d48' }} />
          <span>Layers</span>
        </div>
        <button type="button" className="vizmaker-layers-close-btn" onClick={onClose} title="Close Layers">
          <ChevronUp size={14} />
        </button>
      </div>

      <div className="vizmaker-layers-list">
        {/* Active Generating Layer Indicator */}
        {isGenerating && (
          <div className="vizmaker-layer-item generating active">
            <div className="vizmaker-layer-eye-btn">
              <Loader2 size={13} className="spin" style={{ color: '#e11d48' }} />
            </div>
            <div className="vizmaker-layer-thumb-box-dual">
              <div className="vizmaker-layer-thumb-main">
                {baseImage ? (
                  <img src={baseImage} alt="Base" className="vizmaker-layer-img-preview" />
                ) : (
                  <div className="vizmaker-empty-thumb" />
                )}
              </div>
              <div className="vizmaker-layer-thumb-mask" style={{ background: '#000000', overflow: 'hidden' }}>
                {currentMaskPreviewUrl ? (
                  <img src={currentMaskPreviewUrl} alt="Mask Thumb" className="vizmaker-layer-img-preview" />
                ) : (
                  <span className="vizmaker-mask-symbol">M</span>
                )}
              </div>
            </div>
            <span className="vizmaker-layer-title generating-title">
              {generatingPrompt ? (generatingPrompt.length > 20 ? generatingPrompt.slice(0, 20) + '...' : generatingPrompt) : 'Generating inpaint...'}
            </span>
          </div>
        )}

        {/* Current Inpaint Layers Stack */}
        {layers.map((layer) => (
          <div
            key={layer.id}
            className={`vizmaker-layer-item ${activeLayerId === layer.id ? 'active' : ''}`}
            onClick={() => onSelectLayer(layer.id)}
          >
            <button
              type="button"
              className="vizmaker-layer-eye-btn"
              onClick={(e) => {
                e.stopPropagation();
                onToggleLayerVisibility(layer.id);
              }}
              title={layer.visible ? 'Hide Layer' : 'Show Layer'}
            >
              {layer.visible ? (
                <Eye size={13} className="vizmaker-layer-eye" />
              ) : (
                <EyeOff size={13} className="vizmaker-layer-eye off" />
              )}
            </button>

            <div className="vizmaker-layer-thumb-box-dual">
              <div className="vizmaker-layer-thumb-main">
                <img src={layer.image} alt={layer.name} className="vizmaker-layer-img-preview" />
              </div>
              <div className="vizmaker-layer-thumb-mask" style={{ background: '#000000', overflow: 'hidden' }}>
                {layer.maskPreviewUrl ? (
                  <img src={layer.maskPreviewUrl} alt="Mask Cutout" className="vizmaker-layer-img-preview" />
                ) : (
                  <span className="vizmaker-mask-symbol">M</span>
                )}
              </div>
            </div>

            <span className="vizmaker-layer-title" title={layer.prompt || layer.name}>
              {layer.name.length > 22 ? layer.name.slice(0, 22) + '...' : layer.name}
            </span>
          </div>
        ))}

        {/* Base Image Layer (Always at bottom) */}
        <div
          className={`vizmaker-layer-item ${activeLayerId === 'base' ? 'active' : ''}`}
          onClick={() => onSelectLayer('base')}
        >
          <button
            type="button"
            className="vizmaker-layer-eye-btn"
            onClick={(e) => {
              e.stopPropagation();
              onToggleBaseImageVisibility();
            }}
            title={baseImageVisible ? 'Hide Base Image' : 'Show Base Image'}
          >
            {baseImageVisible ? (
              <Eye size={13} className="vizmaker-layer-eye" />
            ) : (
              <EyeOff size={13} className="vizmaker-layer-eye off" />
            )}
          </button>

          <div className="vizmaker-layer-thumb-box-dual">
            <div className="vizmaker-layer-thumb-main">
              {baseImage ? (
                <img src={baseImage} alt="Base" className="vizmaker-layer-img-preview" />
              ) : (
                <div className="vizmaker-empty-thumb" />
              )}
            </div>
            <div className="vizmaker-layer-thumb-mask" style={{ background: '#000000', overflow: 'hidden' }}>
              <span className="vizmaker-mask-symbol">B</span>
            </div>
          </div>

          <span className="vizmaker-layer-title">Image (Base)</span>
          <Lock size={13} className="vizmaker-layer-lock-icon" />
        </div>
      </div>

      <div className="vizmaker-layers-footer">
        <button
          type="button"
          className="vizmaker-layer-action-btn"
          onClick={onAddLayer}
          title="Add New Drawing Layer (+)"
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
          title="Delete Selected Layer"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
};
