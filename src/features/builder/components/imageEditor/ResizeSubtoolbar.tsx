import React from 'react';
import { Check, Sparkles } from 'lucide-react';
import { RESIZE_OPTIONS, type ResizeRatioOption } from './types';

interface ResizeSubtoolbarProps {
  aspectRatio: string;
  onSelectAspectRatio: (option: ResizeRatioOption) => void;
  onApplyCrop: () => void;
  onGenerateWithRatio: (option: ResizeRatioOption) => void;
  onCancel: () => void;
}

export const ResizeSubtoolbar: React.FC<ResizeSubtoolbarProps> = ({
  aspectRatio,
  onSelectAspectRatio,
  onApplyCrop,
  onGenerateWithRatio,
  onCancel,
}) => {
  return (
    <div className="anarchy-resize-card">
      <div className="anarchy-resize-title">
        Aspect Ratio & Framing
      </div>

      <div className="ratio-items-list">
        {RESIZE_OPTIONS.map((opt) => {
          const isSelected = aspectRatio === opt.id;
          return (
            <div
              key={opt.id}
              className={`ratio-item-row ${isSelected ? 'active' : ''}`}
              onClick={() => onSelectAspectRatio(opt)}
            >
              <div className={`ratio-wireframe-box ${opt.wireframeClass}`} />
              <span className="ratio-name">
                {opt.name} <span className="ratio-number">{opt.ratio}</span>
              </span>
              {isSelected && <Check size={14} className="ratio-check-icon" />}
            </div>
          );
        })}
      </div>

      <div className="resize-card-actions">
        <button
          type="button"
          className="subtool-action-btn apply"
          onClick={onApplyCrop}
          title="Apply crop and create connected node"
        >
          <Check size={13} />
          <span>Confirm Crop</span>
        </button>

        <button
          type="button"
          className="subtool-action-btn generate-ai"
          onClick={() => {
            const currentOpt = RESIZE_OPTIONS.find((o) => o.id === aspectRatio) || RESIZE_OPTIONS[0];
            onGenerateWithRatio(currentOpt);
          }}
          title="AI Outpainting & Expand ratio with active model"
        >
          <Sparkles size={13} style={{ color: '#ff2a6d' }} />
          <span>AI Expand</span>
        </button>

        <button
          type="button"
          className="subtool-action-btn cancel"
          onClick={onCancel}
          title="Cancel"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
