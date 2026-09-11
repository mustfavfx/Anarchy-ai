import React from 'react';
import { X, ChevronDown } from 'lucide-react';

export interface TextPropertiesPanelProps {
  onClose: () => void;
}

export const TextPropertiesPanel: React.FC<TextPropertiesPanelProps> = ({ onClose }) => {
  return (
    <div className="layout-layers-panel reve-text-panel dark-studio">
      <div className="reframe-tab-header">
        <span className="adjust-panel-title">Text Properties</span>
        <button type="button" className="reframe-close-btn" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      <div className="reframe-tab-body">
        <div className="reframe-field-group">
          <label className="field-label">Font</label>
          <div className="reframe-select-wrapper">
            <select className="reframe-custom-select">
              <option>Anarchy Sans Display</option>
              <option>Inter</option>
              <option>Roboto</option>
              <option>Outfit</option>
            </select>
            <ChevronDown size={14} className="select-arrow" />
          </div>
        </div>

        <div className="reframe-field-group">
          <label className="field-label">Style</label>
          <div className="reframe-select-wrapper">
            <select className="reframe-custom-select">
              <option>Regular</option>
              <option>Bold</option>
              <option>Italic</option>
            </select>
            <ChevronDown size={14} className="select-arrow" />
          </div>
        </div>

        <div className="reframe-field-group">
          <label className="field-label">Color</label>
          <input type="color" defaultValue="#ffffff" className="text-color-picker" />
        </div>
      </div>
    </div>
  );
};
