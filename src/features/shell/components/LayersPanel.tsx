import React from 'react';
import { ChevronUp, Eye, EyeOff, CornerDownRight, Pin, ImagePlus, Lock, Plus, Trash2 } from 'lucide-react';

export type LayerId = 'image' | 'arrows' | 'selection';

export interface LayerVisibility {
  image: boolean;
  arrows: boolean;
  selection: boolean;
}

export interface LayersPanelProps {
  onClose: () => void;
  showSelectionLayer: boolean;
  arrowCount: number;
  selectedLayerId: LayerId;
  onSelectLayer: (id: LayerId) => void;
  layerVisibility: LayerVisibility;
  onToggleVisibility: (id: LayerId) => void;
  resolvedImage: string | null | undefined;
  maskPreviewUrl?: string | null;
  onAddArrowLayer: () => void;
  onDeleteSelectedLayer: () => void;
}

/**
 * The floating "Layers" overlay panel, extracted out of MaskCanvas.
 * Presentational component with Photoshop-style layer mask preview.
 */
export const LayersPanel: React.FC<LayersPanelProps> = ({
  onClose,
  showSelectionLayer,
  arrowCount,
  selectedLayerId,
  onSelectLayer,
  layerVisibility,
  onToggleVisibility,
  resolvedImage,
  maskPreviewUrl,
  onAddArrowLayer,
  onDeleteSelectedLayer,
}) => {
  return (
    <div className="vizmaker-layers-overlay-panel">
      <div className="vizmaker-layers-header">
        <span>Layers</span>
        <button type="button" onClick={onClose} title="Close">
          <ChevronUp size={14} />
        </button>
      </div>
      <div className="vizmaker-layers-list">
        {showSelectionLayer && (
          <div
            className={`vizmaker-layer-item ${selectedLayerId === 'selection' ? 'active' : ''}`}
            onClick={() => onSelectLayer('selection')}
          >
            <button
              type="button"
              className="vizmaker-layer-eye-btn"
              onClick={(e) => {
                e.stopPropagation();
                onToggleVisibility('selection');
              }}
            >
              {layerVisibility.selection ? (
                <Eye size={13} className="vizmaker-layer-eye" />
              ) : (
                <EyeOff size={13} className="vizmaker-layer-eye off" />
              )}
            </button>
            <div className="vizmaker-layer-thumb-box selected-area" style={{ background: '#000000', overflow: 'hidden' }}>
              {maskPreviewUrl ? (
                <img src={maskPreviewUrl} alt="Mask" className="vizmaker-layer-img-preview" style={{ filter: 'contrast(1.2)' }} />
              ) : (
                <div className="vizmaker-selected-area-icon" />
              )}
            </div>
            <span className="vizmaker-layer-title">Layer Mask</span>
          </div>
        )}

        {(arrowCount > 0 || selectedLayerId === 'arrows') && (
          <div
            className={`vizmaker-layer-item ${selectedLayerId === 'arrows' ? 'active' : ''}`}
            onClick={() => onSelectLayer('arrows')}
          >
            <button
              type="button"
              className="vizmaker-layer-eye-btn"
              onClick={(e) => {
                e.stopPropagation();
                onToggleVisibility('arrows');
              }}
            >
              {layerVisibility.arrows ? (
                <Eye size={13} className="vizmaker-layer-eye" />
              ) : (
                <EyeOff size={13} className="vizmaker-layer-eye off" />
              )}
            </button>
            <div className="vizmaker-layer-thumb-box arrows">
              <CornerDownRight size={13} style={{ color: '#06b6d4' }} />
            </div>
            <span className="vizmaker-layer-title">Arrow + Text Note</span>
            <Pin size={13} className="vizmaker-layer-pin-icon" />
          </div>
        )}

        <div
          className={`vizmaker-layer-item ${selectedLayerId === 'image' ? 'active' : ''}`}
          onClick={() => onSelectLayer('image')}
        >
          <button
            type="button"
            className="vizmaker-layer-eye-btn"
            onClick={(e) => {
              e.stopPropagation();
              onToggleVisibility('image');
            }}
          >
            {layerVisibility.image ? (
              <Eye size={13} className="vizmaker-layer-eye" />
            ) : (
              <EyeOff size={13} className="vizmaker-layer-eye off" />
            )}
          </button>
          <div className="vizmaker-layer-thumb-box-dual">
            <div className={`vizmaker-layer-thumb-main ${selectedLayerId === 'image' ? 'active' : ''}`}>
              {resolvedImage ? (
                <img src={resolvedImage} alt="Base" className="vizmaker-layer-img-preview" />
              ) : (
                <ImagePlus size={13} />
              )}
            </div>
            <div className="vizmaker-layer-thumb-mask" style={{ background: '#000000', overflow: 'hidden' }}>
              {maskPreviewUrl ? (
                <img src={maskPreviewUrl} alt="Mask Thumb" className="vizmaker-layer-img-preview" />
              ) : (
                <span className="vizmaker-mask-symbol">M</span>
              )}
            </div>
          </div>
          <span className="vizmaker-layer-title">{maskPreviewUrl ? 'Image (Mask)' : 'Image'}</span>
          <Lock size={13} className="vizmaker-layer-lock-icon" />
        </div>
      </div>

      <div className="vizmaker-layers-footer">
        <button
          type="button"
          className="vizmaker-layer-footer-btn"
          title="Add Arrow Layer"
          onClick={onAddArrowLayer}
        >
          <Plus size={14} />
        </button>
        <button
          type="button"
          className="vizmaker-layer-footer-btn"
          title="Delete Selected Layer"
          onClick={onDeleteSelectedLayer}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};

export default LayersPanel;
