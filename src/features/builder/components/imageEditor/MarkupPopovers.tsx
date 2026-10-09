import React, { useRef } from 'react';
import { MARKUP_PALETTE_COLORS, type MarkupShapeType } from './types';

interface ShapesPopoverProps {
  activeShape: MarkupShapeType;
  onSelectShape: (shape: MarkupShapeType) => void;
  onClose: () => void;
}

export const ShapesPopover: React.FC<ShapesPopoverProps> = ({
  activeShape,
  onSelectShape,
}) => {
  const shapes: { id: MarkupShapeType; label: string; icon: React.ReactNode }[] = [
    // Row 1
    {
      id: 'line',
      label: 'Line',
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <line x1="5" y1="19" x2="19" y2="5" />
        </svg>
      ),
    },
    {
      id: 'arrow',
      label: 'Arrow',
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="6" y1="18" x2="18" y2="6" />
          <polyline points="9 6 18 6 18 15" />
        </svg>
      ),
    },
    {
      id: 'rect',
      label: 'Rectangle',
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="4" width="16" height="16" rx="3" />
        </svg>
      ),
    },
    {
      id: 'circle',
      label: 'Circle',
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2">
          <circle cx="12" cy="12" r="8.5" />
        </svg>
      ),
    },
    // Row 2
    {
      id: 'triangle',
      label: 'Triangle',
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 4 4 20 20 20" />
        </svg>
      ),
    },
    {
      id: 'diamond',
      label: 'Diamond',
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 3 21 12 12 21 3 12" />
        </svg>
      ),
    },
    {
      id: 'star',
      label: 'Star',
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ),
    },
    {
      id: 'heart',
      label: 'Heart',
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="markup-shapes-popover" onClick={(e) => e.stopPropagation()}>
      <div className="markup-shapes-grid">
        {shapes.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`markup-shape-option-btn ${activeShape === s.id ? 'active' : ''}`}
            onClick={() => onSelectShape(s.id)}
            title={s.label}
          >
            {s.icon}
          </button>
        ))}
      </div>
    </div>
  );
};

interface ColorPopoverProps {
  activeColor: string;
  onSelectColor: (color: string) => void;
  onClose: () => void;
}

export const ColorPopover: React.FC<ColorPopoverProps> = ({
  activeColor,
  onSelectColor,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const row1Colors = MARKUP_PALETTE_COLORS.slice(0, 6); // 6 presets
  const row2Colors = MARKUP_PALETTE_COLORS.slice(6); // 7 presets

  const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSelectColor(e.target.value);
  };

  return (
    <div className="markup-color-popover" onClick={(e) => e.stopPropagation()}>
      {/* Hidden native color picker */}
      <input
        ref={fileInputRef}
        type="color"
        value={activeColor.startsWith('#') && activeColor.length === 7 ? activeColor : '#e52b2b'}
        onChange={handleCustomColorChange}
        style={{ display: 'none' }}
      />

      {/* Row 1: Rainbow Wheel + 6 Swatches */}
      <div className="markup-color-row">
        {/* Rainbow spectrum circle */}
        <button
          type="button"
          className="markup-color-swatch-rainbow"
          title="Custom Color Spectrum"
          onClick={() => fileInputRef.current?.click()}
        />

        {row1Colors.map((color) => {
          const isSelected = activeColor.toLowerCase() === color.toLowerCase();
          return (
            <button
              key={color}
              type="button"
              className={`markup-color-swatch-btn ${isSelected ? 'selected' : ''}`}
              style={{ backgroundColor: color }}
              onClick={() => onSelectColor(color)}
              title={color}
            >
              {isSelected && <span className="selection-inner-ring" />}
            </button>
          );
        })}
      </div>

      {/* Row 2: 7 Swatches */}
      <div className="markup-color-row">
        {row2Colors.map((color) => {
          const isSelected = activeColor.toLowerCase() === color.toLowerCase();
          return (
            <button
              key={color}
              type="button"
              className={`markup-color-swatch-btn ${isSelected ? 'selected' : ''}`}
              style={{ backgroundColor: color }}
              onClick={() => onSelectColor(color)}
              title={color}
            >
              {isSelected && <span className="selection-inner-ring" />}
            </button>
          );
        })}
      </div>
    </div>
  );
};
