import React from 'react';
import { Sparkles, Check, Download } from 'lucide-react';

interface RemoveBgSubtoolbarProps {
  isRemovingBg: boolean;
  bgTolerance: number;
  setBgTolerance: (t: number) => void;
  onProcessTolerance: (tolerance: number) => void;
  removeBgPreviewUrl: string | null;
  onApply: () => void;
  onCancel: () => void;
}

export const RemoveBgSubtoolbar: React.FC<RemoveBgSubtoolbarProps> = ({
  isRemovingBg,
  bgTolerance,
  setBgTolerance,
  onProcessTolerance,
  removeBgPreviewUrl,
  onApply,
  onCancel,
}) => {
  return (
    <div className="chatgpt-subtoolbar-card">
      {isRemovingBg ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ff2a6d' }}>
          <Sparkles size={14} className="spin-slow" />
          Removing background...
        </span>
      ) : (
        <>
          <span style={{ fontSize: 12, color: '#a1a1aa' }}>Tolerance:</span>
          <input
            type="range"
            min={15}
            max={80}
            value={bgTolerance}
            onChange={(e) => {
              const v = Number(e.target.value);
              setBgTolerance(v);
              onProcessTolerance(v);
            }}
            className="subtool-slider"
            title={`Tolerance: ${bgTolerance}`}
          />

          <button
            type="button"
            className="subtool-action-btn apply"
            onClick={onApply}
            title="Apply cutout and create connected node"
          >
            <Check size={14} />
            <span>Confirm</span>
          </button>

          {removeBgPreviewUrl && (
            <a
              href={removeBgPreviewUrl}
              download="cutout_transparent.png"
              className="subtool-action-btn cancel"
              style={{ textDecoration: 'none' }}
              title="Download transparent PNG"
            >
              <Download size={13} />
              <span>Download PNG</span>
            </a>
          )}

          <button type="button" className="subtool-action-btn cancel" onClick={onCancel} title="Cancel">
            Cancel
          </button>
        </>
      )}
    </div>
  );
};
