import React from 'react';
import { Check, Cpu, Sparkles, X } from 'lucide-react';
import type { ResizeRatioOption } from './types';
import { getEngineDisplayName } from './types';

interface ResizeSubtoolbarProps {
  modelName?: string;
  aspectRatio: string;
  options: ResizeRatioOption[];
  creditCost?: number;
  onSelectAspectRatio: (option: ResizeRatioOption) => void;
  onConfirmResize: () => void;
  onCancel: () => void;
}

export const ResizeSubtoolbar: React.FC<ResizeSubtoolbarProps> = ({
  modelName,
  aspectRatio,
  options,
  creditCost,
  onSelectAspectRatio,
  onConfirmResize,
  onCancel,
}) => {
  const engineDisplayName = getEngineDisplayName(modelName);

  return (
    <div className="anarchy-resize-card" role="dialog" aria-label="Resize Framing & Dimensions">
      {/* ── Top Header with Active Engine Chip ── */}
      <div className="anarchy-resize-card-header">
        <div className="resize-header-left">
          <span className="resize-main-title">Aspect Ratio & Dimensions</span>
          <span className="resize-sub-hint">Non-destructive AI framing</span>
        </div>
        <div className="engine-active-pill" title={`Active generation engine: ${engineDisplayName}`}>
          <Cpu size={12} className="engine-cpu-icon" />
          <span className="engine-name-text">{engineDisplayName}</span>
        </div>
      </div>

      {/* ── Engine Supported Aspect Ratios List ── */}
      <div className="ratio-items-list custom-scrollbar">
        {options.map((opt) => {
          const isSelected = aspectRatio === opt.id;
          return (
            <div
              key={opt.id}
              className={`ratio-item-row ${isSelected ? 'active' : ''}`}
              onClick={() => onSelectAspectRatio(opt)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectAspectRatio(opt);
                }
              }}
            >
              <div className={`ratio-wireframe-box ${opt.wireframeClass}`} />
              <div className="ratio-text-column">
                <div className="ratio-name-row">
                  <span className="ratio-name">{opt.name}</span>
                  <span className="ratio-number">{opt.ratio}</span>
                </div>
                {opt.resolutionHint && (
                  <span className="ratio-res-hint">{opt.resolutionHint}</span>
                )}
              </div>
              {isSelected && <Check size={14} className="ratio-check-icon" />}
            </div>
          );
        })}
      </div>

      {/* ── Bottom Action Buttons ── */}
      <div className="resize-card-actions">
        <button
          type="button"
          className="subtool-action-btn apply"
          onClick={onConfirmResize}
          title={`Dispatch resize request to AI engine${creditCost != null ? ` (${creditCost} credits)` : ''}`}
        >
          <Check size={13} />
          <span>OK (Apply to Engine){creditCost != null ? ` • ${creditCost} pts` : ''}</span>
        </button>

        <button
          type="button"
          className="subtool-action-btn cancel"
          onClick={onCancel}
          title="Cancel"
        >
          <X size={13} />
          <span>Cancel</span>
        </button>
      </div>
    </div>
  );
};
