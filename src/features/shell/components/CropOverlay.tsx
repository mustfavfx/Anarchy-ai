import React from 'react';
import { Check, X } from 'lucide-react';
import type { CropRect } from '../hooks/useCropTool';

export interface CropOverlayProps {
  /** The crop rect already converted to CSS pixels relative to the wrapper. */
  cropCssRect: CropRect;
  onApply: () => void;
  onCancel: () => void;
}

export const CropOverlay: React.FC<CropOverlayProps> = ({ cropCssRect: cr, onApply, onCancel }) => {
  return (
    <>
      {/* Dark overlay outside crop */}
      <div className="crop-overlay crop-overlay-top" style={{ top: 0, left: 0, right: 0, height: cr.y }} />
      <div className="crop-overlay crop-overlay-bottom" style={{ top: cr.y + cr.h, left: 0, right: 0, bottom: 0 }} />
      <div className="crop-overlay crop-overlay-left" style={{ top: cr.y, left: 0, width: cr.x, height: cr.h }} />
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

      {/* Action buttons */}
      <div className="crop-actions" style={{ left: cr.x + cr.w, top: Math.max(cr.y - 40, 4) }}>
        <button className="crop-btn crop-btn-apply" onClick={onApply} title="تأكيد القص | Apply Crop">
          <Check size={13} /> تطبيق
        </button>
        <button className="crop-btn crop-btn-cancel" onClick={onCancel} title="إلغاء | Cancel Crop">
          <X size={13} /> إلغاء
        </button>
      </div>
    </>
  );
};

export default CropOverlay;
