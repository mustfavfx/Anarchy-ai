import React, { useState } from 'react';
import { RotateCcw, Trash2, Check, Sparkles } from 'lucide-react';
import { PRESET_COLORS } from './types';

interface MarkupSubtoolbarProps {
  markupColor: string;
  setMarkupColor: (color: string) => void;
  markupType: 'pen' | 'highlighter';
  setMarkupType: (type: 'pen' | 'highlighter') => void;
  brushSize: number;
  setBrushSize: (size: number) => void;
  onUndo: () => void;
  onClear: () => void;
  onApply: (prompt?: string) => void;
  onCancel: () => void;
}

export const MarkupSubtoolbar: React.FC<MarkupSubtoolbarProps> = ({
  markupColor,
  setMarkupColor,
  markupType,
  setMarkupType,
  brushSize,
  setBrushSize,
  onUndo,
  onClear,
  onApply,
  onCancel,
}) => {
  const [markupPrompt, setMarkupPrompt] = useState('');

  return (
    <div className="chatgpt-subtoolbar-card">
      {/* Swatches */}
      <div className="subtool-colors-wrap">
        {PRESET_COLORS.map((col) => (
          <div
            key={col}
            className={`color-swatch-dot ${markupColor === col ? 'active' : ''}`}
            style={{ backgroundColor: col }}
            onClick={() => setMarkupColor(col)}
          />
        ))}
      </div>

      {/* Pen / Highlighter Toggle */}
      <button
        type="button"
        className={`ratio-pill-btn ${markupType === 'pen' ? 'active' : ''}`}
        onClick={() => setMarkupType('pen')}
      >
        Pen
      </button>
      <button
        type="button"
        className={`ratio-pill-btn ${markupType === 'highlighter' ? 'active' : ''}`}
        onClick={() => setMarkupType('highlighter')}
      >
        Marker
      </button>

      {/* Size Slider */}
      <input
        type="range"
        min={2}
        max={36}
        value={brushSize}
        onChange={(e) => setBrushSize(Number(e.target.value))}
        className="subtool-slider"
        title="Brush Size"
      />

      {/* Undo */}
      <button type="button" className="subtool-icon-btn" onClick={onUndo} title="Undo">
        <RotateCcw size={14} />
      </button>

      {/* Clear */}
      <button type="button" className="subtool-icon-btn" onClick={onClear} title="Clear All">
        <Trash2 size={14} />
      </button>

      {/* Optional Prompt Input for sketch-to-image */}
      <div className="subtool-inline-input-wrap">
        <Sparkles size={12} style={{ color: '#ff2a6d' }} />
        <input
          type="text"
          className="subtool-inline-input"
          placeholder="AI sketch prompt (optional)..."
          value={markupPrompt}
          onChange={(e) => setMarkupPrompt(e.target.value)}
        />
      </div>

      {/* Apply (OK) — Creates connected child branch automatically */}
      <button
        type="button"
        className="subtool-action-btn apply"
        onClick={() => onApply(markupPrompt)}
        title="Apply markup and create connected node"
      >
        <Check size={14} />
        <span>Confirm</span>
      </button>

      <button type="button" className="subtool-action-btn cancel" onClick={onCancel} title="Cancel">
        Cancel
      </button>
    </div>
  );
};
