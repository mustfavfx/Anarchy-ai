import React from 'react';

export const BuilderCanvasSvgDefs: React.FC = () => {
  return (
    <svg width="0" height="0" className="svg-defs">
      <defs>
        <linearGradient id="edge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.15)" />
          <stop offset="50%" stopColor="rgba(225,29,72,0.3)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.15)" />
        </linearGradient>
        <linearGradient id="edge-gradient-active" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(225,29,72,0.5)" />
          <stop offset="100%" stopColor="rgba(225,29,72,0.8)" />
        </linearGradient>
      </defs>
    </svg>
  );
};
