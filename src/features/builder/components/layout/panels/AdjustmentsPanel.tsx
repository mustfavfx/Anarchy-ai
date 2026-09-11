import React from 'react';
import { X, ChevronDown, Shuffle, RotateCcw } from 'lucide-react';
import type { ImageAdjustments } from '../types';

export interface AdjustmentsPanelProps {
  adjustments: ImageAdjustments;
  setAdjustments: React.Dispatch<React.SetStateAction<ImageAdjustments>>;
  onClose: () => void;
  onShuffle: () => void;
  onReset: () => void;
}

export const AdjustmentsPanel: React.FC<AdjustmentsPanelProps> = ({
  adjustments,
  setAdjustments,
  onClose,
  onShuffle,
  onReset,
}) => {
  return (
    <div className="layout-layers-panel reve-adjustments-panel dark-studio">
      <div className="reframe-tab-header">
        <span className="adjust-panel-title">Adjust</span>
        <button type="button" className="reframe-close-btn" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      <div className="reframe-tab-body">
        <div className="adjust-field-group">
          <div className="scale-label-row">
            <label className="field-label">Exposure</label>
            <span className="scale-val">{adjustments.exposure}</span>
          </div>
          <input
            type="range" min="-100" max="100" value={adjustments.exposure}
            onChange={(e) => setAdjustments(prev => ({ ...prev, exposure: parseInt(e.target.value) }))}
            className="reframe-scale-slider"
          />
        </div>

        <div className="adjust-field-group">
          <div className="scale-label-row">
            <label className="field-label">Contrast</label>
            <span className="scale-val">{adjustments.contrast}</span>
          </div>
          <input
            type="range" min="-100" max="100" value={adjustments.contrast}
            onChange={(e) => setAdjustments(prev => ({ ...prev, contrast: parseInt(e.target.value) }))}
            className="reframe-scale-slider"
          />
        </div>

        <div className="adjust-field-group">
          <div className="scale-label-row">
            <label className="field-label">Highlights</label>
            <span className="scale-val">{adjustments.highlights}</span>
          </div>
          <input
            type="range" min="-100" max="100" value={adjustments.highlights}
            onChange={(e) => setAdjustments(prev => ({ ...prev, highlights: parseInt(e.target.value) }))}
            className="reframe-scale-slider"
          />
        </div>

        <div className="adjust-field-group">
          <div className="scale-label-row">
            <label className="field-label">Shadows</label>
            <span className="scale-val">{adjustments.shadows}</span>
          </div>
          <input
            type="range" min="-100" max="100" value={adjustments.shadows}
            onChange={(e) => setAdjustments(prev => ({ ...prev, shadows: parseInt(e.target.value) }))}
            className="reframe-scale-slider"
          />
        </div>

        <div className="adjust-field-group">
          <div className="scale-label-row">
            <label className="field-label">Vibrance</label>
            <span className="scale-val">{adjustments.vibrance}</span>
          </div>
          <input
            type="range" min="-100" max="100" value={adjustments.vibrance}
            onChange={(e) => setAdjustments(prev => ({ ...prev, vibrance: parseInt(e.target.value) }))}
            className="reframe-scale-slider"
          />
        </div>

        <div className="adjust-field-group">
          <div className="scale-label-row">
            <label className="field-label">Temperature</label>
            <span className="scale-val">{adjustments.temperature}</span>
          </div>
          <input
            type="range" min="-100" max="100" value={adjustments.temperature}
            onChange={(e) => setAdjustments(prev => ({ ...prev, temperature: parseInt(e.target.value) }))}
            className="reframe-scale-slider"
          />
        </div>

        <div className="adjust-field-group">
          <div className="scale-label-row">
            <label className="field-label">Tint</label>
            <span className="scale-val">{adjustments.tint}</span>
          </div>
          <input
            type="range" min="-100" max="100" value={adjustments.tint}
            onChange={(e) => setAdjustments(prev => ({ ...prev, tint: parseInt(e.target.value) }))}
            className="reframe-scale-slider"
          />
        </div>

        <div className="reframe-field-group">
          <label className="field-label">Blend</label>
          <div className="reframe-select-wrapper">
            <select
              value={adjustments.blend}
              onChange={(e) => setAdjustments(prev => ({ ...prev, blend: e.target.value }))}
              className="reframe-custom-select"
            >
              <option value="normal">Normal</option>
              <option value="multiply">Multiply</option>
              <option value="screen">Screen</option>
              <option value="overlay">Overlay</option>
              <option value="soft-light">Soft Light</option>
            </select>
            <ChevronDown size={14} className="select-arrow" />
          </div>
        </div>
      </div>

      <div className="layout-panel-footer adjust-footer">
        <button type="button" className="shuffle-btn" onClick={onShuffle}>
          <Shuffle size={14} /> Shuffle
        </button>
        <button type="button" className="reset-adjust-btn" onClick={onReset}>
          <RotateCcw size={14} /> Reset
        </button>
      </div>
    </div>
  );
};
