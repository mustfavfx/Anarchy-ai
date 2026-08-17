import React from 'react';
import { Eye, EyeOff, Move, Maximize2, Trash2, Layers as LayersIcon, Sliders, ChevronUp } from 'lucide-react';
import './LayerStackPanel.css';

export interface CanvasLayerItem {
  id: string;
  name: string;
  image: string;
  visible: boolean;
  opacity: number;
  blendMode: 'normal' | 'color' | 'multiply' | 'overlay';
  position: { x: number; y: number };
  scale: number;
}

interface LayerStackPanelProps {
  layers: CanvasLayerItem[];
  activeLayerId: string | null;
  onSelectLayer: (id: string) => void;
  onUpdateLayer: (id: string, updates: Partial<CanvasLayerItem>) => void;
  onDeleteLayer: (id: string) => void;
  onClose?: () => void;
}

export const LayerStackPanel: React.FC<LayerStackPanelProps> = ({
  layers,
  activeLayerId,
  onSelectLayer,
  onUpdateLayer,
  onDeleteLayer,
  onClose,
}) => {
  const activeLayer = layers.find((l) => l.id === activeLayerId);

  return (
    <div className="layer-stack-container">
      <div className="layer-stack-header">
        <div className="layer-stack-title">
          <LayersIcon size={14} className="icon-accent" />
          <span>Layers</span>
        </div>
        {onClose && (
          <button type="button" className="layer-close-btn" onClick={onClose} title="إغلاق | Close">
            <ChevronUp size={14} />
          </button>
        )}
      </div>

      <div className="layer-stack-list">
        {layers.map((layer) => (
          <div
            key={layer.id}
            className={`layer-item-card ${activeLayerId === layer.id ? 'active' : ''}`}
            onClick={() => onSelectLayer(layer.id)}
          >
            <button
              type="button"
              className="layer-vis-btn"
              onClick={(e) => {
                e.stopPropagation();
                onUpdateLayer(layer.id, { visible: !layer.visible });
              }}
            >
              {layer.visible ? <Eye size={13} /> : <EyeOff size={13} className="off" />}
            </button>

            <div className="layer-thumb">
              <img src={layer.image} alt={layer.name} />
            </div>

            <span className="layer-item-name">{layer.name}</span>

            {layer.id !== 'base' && (
              <button
                type="button"
                className="layer-del-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteLayer(layer.id);
                }}
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ))}
      </div>

      {activeLayer && activeLayer.id !== 'base' && (
        <div className="layer-transform-controls">
          <div className="transform-ctrl-row">
            <Sliders size={12} />
            <span>Opacity</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={activeLayer.opacity}
              onChange={(e) => onUpdateLayer(activeLayer.id, { opacity: parseFloat(e.target.value) })}
            />
            <span className="ctrl-badge">{Math.round(activeLayer.opacity * 100)}%</span>
          </div>

          <div className="transform-ctrl-row">
            <span>Blend Mode</span>
            <select
              value={activeLayer.blendMode}
              onChange={(e) =>
                onUpdateLayer(activeLayer.id, {
                  blendMode: e.target.value as CanvasLayerItem['blendMode'],
                })
              }
              className="blend-select"
            >
              <option value="normal">Normal</option>
              <option value="color">Color / Luminance (RAL)</option>
              <option value="multiply">Multiply</option>
              <option value="overlay">Overlay</option>
            </select>
          </div>

          <div className="transform-ctrl-row">
            <Move size={12} />
            <span>Position X/Y</span>
            <input
              type="number"
              className="num-input"
              value={activeLayer.position.x}
              onChange={(e) =>
                onUpdateLayer(activeLayer.id, {
                  position: { ...activeLayer.position, x: parseInt(e.target.value) || 0 },
                })
              }
            />
            <input
              type="number"
              className="num-input"
              value={activeLayer.position.y}
              onChange={(e) =>
                onUpdateLayer(activeLayer.id, {
                  position: { ...activeLayer.position, y: parseInt(e.target.value) || 0 },
                })
              }
            />
          </div>

          <div className="transform-ctrl-row">
            <Maximize2 size={12} />
            <span>Scale</span>
            <input
              type="range"
              min="0.2"
              max="3.0"
              step="0.05"
              value={activeLayer.scale}
              onChange={(e) => onUpdateLayer(activeLayer.id, { scale: parseFloat(e.target.value) })}
            />
            <span className="ctrl-badge">{activeLayer.scale.toFixed(2)}x</span>
          </div>
        </div>
      )}
    </div>
  );
};
