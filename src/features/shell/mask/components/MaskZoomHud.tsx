import React from 'react';
import { Minus, Plus, Maximize2 } from 'lucide-react';

interface MaskZoomHudProps {
  zoomScale: number;
  setZoomScale: React.Dispatch<React.SetStateAction<number>>;
  setPanOffset: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
}

export const MaskZoomHud: React.FC<MaskZoomHudProps> = ({
  zoomScale,
  setZoomScale,
  setPanOffset,
}) => {
  return (
    <div className="mask-viewport-zoom-hud">
      <button
        type="button"
        className="mask-viewport-zoom-btn"
        onClick={() => setZoomScale((z) => Math.max(0.2, z * 0.85))}
        title="Zoom Out (-)"
      >
        <Minus size={13} />
      </button>
      <button
        type="button"
        className="mask-viewport-zoom-text"
        onClick={() => {
          setZoomScale(1);
          setPanOffset({ x: 0, y: 0 });
        }}
        title="Reset Zoom & Pan (Ctrl+0)"
      >
        {Math.round(zoomScale * 100)}%
      </button>
      <button
        type="button"
        className="mask-viewport-zoom-btn"
        onClick={() => setZoomScale((z) => Math.min(6, z * 1.18))}
        title="Zoom In (+)"
      >
        <Plus size={13} />
      </button>
      <button
        type="button"
        className="mask-viewport-zoom-btn"
        onClick={() => {
          setZoomScale(1);
          setPanOffset({ x: 0, y: 0 });
        }}
        title="Fit to Screen (1:1)"
        style={{ borderLeft: '1px solid rgba(255, 255, 255, 0.14)', marginLeft: '2px', paddingLeft: '6px' }}
      >
        <Maximize2 size={12} />
      </button>
    </div>
  );
};
