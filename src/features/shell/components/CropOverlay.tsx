import React, { useEffect } from 'react';
import { Check, X } from 'lucide-react';
import type { CropRect } from '../hooks/useCropTool';

export interface CropOverlayProps {
  /** The crop rect already converted to CSS pixels relative to the wrapper. */
  cropCssRect: CropRect;
  /** The original unscaled crop rect in canvas coordinates (optional, for dimensions badge). */
  cropRect?: CropRect | null;
  onApply: () => void;
  onCancel: () => void;
}

export const CropOverlay: React.FC<CropOverlayProps> = ({
  cropCssRect: cr,
  cropRect,
  onApply,
  onCancel,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onApply();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onApply, onCancel]);

  const wrapper = typeof document !== 'undefined' ? document.querySelector('.mask-canvas-wrapper') : null;
  const wrapperW = wrapper?.clientWidth || 1000;
  const wrapperH = wrapper?.clientHeight || 800;

  // Safe clamping for Action Bar so it never clips offscreen
  const actionsLeft = Math.max(120, Math.min(cr.x + cr.w / 2, wrapperW - 120));
  const actionsTop =
    cr.y + cr.h + 54 <= wrapperH
      ? cr.y + cr.h + 14
      : cr.y >= 54
      ? cr.y - 46
      : Math.max(16, cr.y + cr.h - 50);

  return (
    <>
      {/* Dark overlay outside crop */}
      <div className="crop-overlay crop-overlay-top" style={{ top: 0, left: 0, right: 0, height: Math.max(0, cr.y) }} />
      <div className="crop-overlay crop-overlay-bottom" style={{ top: cr.y + cr.h, left: 0, right: 0, bottom: 0 }} />
      <div className="crop-overlay crop-overlay-left" style={{ top: cr.y, left: 0, width: Math.max(0, cr.x), height: cr.h }} />
      <div className="crop-overlay crop-overlay-right" style={{ top: cr.y, left: cr.x + cr.w, right: 0, height: cr.h }} />

      {/* Crop border */}
      <div className="crop-border" style={{ left: cr.x, top: cr.y, width: cr.w, height: cr.h }}>
        {/* Rule-of-thirds grid */}
        <div className="crop-grid-line crop-grid-h" style={{ top: '33.33%' }} />
        <div className="crop-grid-line crop-grid-h" style={{ top: '66.66%' }} />
        <div className="crop-grid-line crop-grid-v" style={{ left: '33.33%' }} />
        <div className="crop-grid-line crop-grid-v" style={{ left: '66.66%' }} />

        {/* Corner handles */}
        <div className="crop-handle crop-handle-tl" />
        <div className="crop-handle crop-handle-tr" />
        <div className="crop-handle crop-handle-bl" />
        <div className="crop-handle crop-handle-br" />

        {/* Edge handles */}
        <div className="crop-handle crop-handle-t" />
        <div className="crop-handle crop-handle-b" />
        <div className="crop-handle crop-handle-l" />
        <div className="crop-handle crop-handle-r" />
      </div>

      {/* Action buttons bar */}
      <div
        className="crop-actions-bar"
        style={{
          left: actionsLeft,
          top: actionsTop,
        }}
      >
        {cropRect && (
          <span className="crop-dimensions-badge">
            {Math.round(cropRect.w)} × {Math.round(cropRect.h)} px
          </span>
        )}

        <div className="crop-actions-divider" />

        <button
          type="button"
          className="crop-btn crop-btn-apply"
          onClick={onApply}
          title="Apply Crop (Enter)"
          aria-label="Apply Crop"
        >
          <Check size={14} />
          <span>Apply</span>
        </button>

        <button
          type="button"
          className="crop-btn crop-btn-cancel"
          onClick={onCancel}
          title="Cancel Crop (Esc)"
          aria-label="Cancel Crop"
        >
          <X size={14} />
          <span>Cancel</span>
        </button>
      </div>
    </>
  );
};

export default CropOverlay;
