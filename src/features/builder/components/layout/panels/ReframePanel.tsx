import React from 'react';
import { X, ChevronDown, Check, Loader2 } from 'lucide-react';
import { ASPECT_RATIO_OPTIONS, RELAYOUT_CATEGORIES } from '../types';
import { AspectRatioIcon } from '../../../../../shared/components/AspectRatioIcon';

export interface ReframePanelProps {
  reframeTab: 'reshoot' | 'relayout';
  setReframeTab: (tab: 'reshoot' | 'relayout') => void;
  setIsReframeActive: (active: boolean) => void;
  referenceImageMode: string;
  setReferenceImageMode: (mode: string) => void;
  showAspectDropdown: boolean;
  setShowAspectDropdown: (show: boolean) => void;
  selectedAspectRatio: string;
  applyAspectRatioToCrop: (ratio: string) => void;
  reframeScale: number;
  setReframeScale: (scale: number) => void;
  relayoutSelections: Record<string, boolean>;
  toggleRelayoutSelection: (label: string) => void;
  handleApplyReframe: () => void;
  isRendering: boolean;
}

export const ReframePanel: React.FC<ReframePanelProps> = ({
  reframeTab,
  setReframeTab,
  setIsReframeActive,
  referenceImageMode,
  setReferenceImageMode,
  showAspectDropdown,
  setShowAspectDropdown,
  selectedAspectRatio,
  applyAspectRatioToCrop,
  reframeScale,
  setReframeScale,
  relayoutSelections,
  toggleRelayoutSelection,
  handleApplyReframe,
  isRendering,
}) => {
  return (
    <div className="layout-layers-panel reve-reframe-side-panel dark-studio">
      <div className="reframe-tab-header">
        <div className="reframe-tabs">
          <button
            type="button"
            className={`reframe-tab-btn ${reframeTab === 'reshoot' ? 'active' : ''}`}
            onClick={() => setReframeTab('reshoot')}
          >
            Reshoot
          </button>
          <button
            type="button"
            className={`reframe-tab-btn ${reframeTab === 'relayout' ? 'active' : ''}`}
            onClick={() => setReframeTab('relayout')}
          >
            Relayout
          </button>
        </div>
        <button
          type="button"
          className="reframe-close-btn"
          onClick={() => setIsReframeActive(false)}
          title="Close reframe"
        >
          <X size={16} />
        </button>
      </div>

      {reframeTab === 'reshoot' ? (
        <div className="reframe-tab-body">
          <div className="reframe-field-group">
            <label className="field-label">Reference image</label>
            <div className="reframe-select-wrapper">
              <select
                value={referenceImageMode}
                onChange={(e) => setReferenceImageMode(e.target.value)}
                className="reframe-custom-select"
              >
                <option value="As inspiration">As inspiration</option>
                <option value="Literal">Literal</option>
                <option value="Style transfer">Style transfer</option>
              </select>
              <ChevronDown size={14} className="select-arrow" />
            </div>
          </div>

          <div className="reframe-field-group" style={{ position: 'relative' }}>
            <label className="field-label">Aspect ratio</label>
            <button
              type="button"
              className="reframe-ratio-trigger-btn"
              onClick={() => setShowAspectDropdown(!showAspectDropdown)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <AspectRatioIcon 
                  ratio={ASPECT_RATIO_OPTIONS.find(o => o.label === selectedAspectRatio)?.ratio || selectedAspectRatio} 
                  size={15} 
                />
                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {selectedAspectRatio}
                </span>
              </div>
              <ChevronDown size={14} />
            </button>

            {showAspectDropdown && (
              <div className="reframe-ratio-dropdown-menu">
                {ASPECT_RATIO_OPTIONS.map((opt) => (
                  <div
                    key={opt.label}
                    className={`ratio-menu-item ${selectedAspectRatio === opt.label ? 'selected' : ''}`}
                    onClick={() => {
                      applyAspectRatioToCrop(opt.label);
                      setShowAspectDropdown(false);
                    }}
                  >
                    <div className="ratio-item-left" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <AspectRatioIcon ratio={opt.ratio} size={15} active={selectedAspectRatio === opt.label} />
                      <span className="ratio-label">{opt.label}</span>
                      {opt.sub && <span className="ratio-sub">· {opt.sub}</span>}
                    </div>
                    {selectedAspectRatio === opt.label && <Check size={14} className="check-icon" />}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="reframe-field-group">
            <div className="scale-label-row">
              <label className="field-label">Scale</label>
              <span className="scale-val">{reframeScale.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.05"
              value={reframeScale}
              onChange={(e) => setReframeScale(parseFloat(e.target.value))}
              className="reframe-scale-slider"
            />
          </div>
        </div>
      ) : (
        <div className="reframe-tab-body relayout-body">
          <div className="relayout-custom-link">
            <span className="relayout-custom-title">Custom</span>
            <button type="button" className="add-new-btn">+ Add new</button>
          </div>

          {RELAYOUT_CATEGORIES.map((cat) => (
            <div key={cat.category} className="relayout-category-section">
              <span className="category-title">{cat.category}</span>
              <div className="category-items-list">
                {cat.items.map((item) => {
                  const isChecked = !!relayoutSelections[item.label];
                  return (
                    <div
                      key={item.label}
                      className={`relayout-item-row ${isChecked ? 'active' : ''}`}
                      onClick={() => toggleRelayoutSelection(item.label)}
                    >
                      <div className="item-left" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AspectRatioIcon ratio={item.ratio} size={15} active={isChecked} />
                        <span className="relayout-label">{item.label}</span>
                        <span className="relayout-sub">· ({item.ratio})</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="relayout-checkbox"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="layout-panel-footer reframe-footer">
        <button
          type="button"
          className="reframe-cancel-btn"
          onClick={() => setIsReframeActive(false)}
        >
          Cancel
        </button>
        <button
          type="button"
          className="reframe-apply-btn"
          onClick={handleApplyReframe}
          disabled={isRendering}
        >
          {isRendering ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              <span>Processing...</span>
            </>
          ) : (
            <span>{reframeTab === 'reshoot' ? 'Done' : 'Apply'}</span>
          )}
        </button>
      </div>
    </div>
  );
};
