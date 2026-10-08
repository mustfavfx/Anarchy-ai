import React, { useState } from 'react';
import { RotateCcw, X, Sparkles, Send } from 'lucide-react';

interface EraseControlsProps {
  eraseSize: number;
  hasEraseStrokes: boolean;
  historyLength: number;
  sliderTrackRef: React.RefObject<HTMLDivElement | null>;
  onSliderMouseDown: (e: React.MouseEvent) => void;
  onUndo: () => void;
  onApply: (prompt?: string) => void;
  onClose: () => void;
  cursorPos: { x: number; y: number } | null;
}

export const EraseControls: React.FC<EraseControlsProps> = ({
  eraseSize,
  hasEraseStrokes,
  historyLength,
  sliderTrackRef,
  onSliderMouseDown,
  onUndo,
  onApply,
  onClose,
  cursorPos,
}) => {
  const [erasePrompt, setErasePrompt] = useState('');

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!hasEraseStrokes && !erasePrompt.trim()) return;
    onApply(erasePrompt);
  };

  return (
    <>
      {/* ── Top Floating Erase Capsule (ChatGPT Style) ── */}
      <form
        className="anarchy-erase-top-bar"
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="anarchy-erase-text">
          Brush area to erase or inpaint
        </span>

        {/* Optional AI prompt for inpainting replacement (like ChatGPT) */}
        <div className="anarchy-erase-input-wrap">
          <Sparkles size={13} className="anarchy-erase-sparkle-icon" />
          <input
            type="text"
            className="anarchy-erase-prompt-input"
            placeholder="Describe replacement (optional) or leave blank for smart erase..."
            value={erasePrompt}
            onChange={(e) => setErasePrompt(e.target.value)}
          />
        </div>

        {historyLength > 0 && (
          <button
            type="button"
            className="anarchy-erase-undo-btn"
            onClick={onUndo}
            title="Undo (Ctrl+Z)"
          >
            <RotateCcw size={14} />
          </button>
        )}

        <button
          type="submit"
          className="anarchy-erase-send-btn"
          disabled={!hasEraseStrokes && !erasePrompt.trim()}
          title="Apply erase & create connected node"
        >
          <Send size={13} />
          <span>Confirm</span>
        </button>

        <button
          type="button"
          className="anarchy-erase-close-btn"
          onClick={onClose}
          title="Close (Esc)"
        >
          <X size={15} />
        </button>
      </form>

      {/* ── Left Vertical Brush Size Slider (ChatGPT Style) ── */}
      <div
        className="anarchy-erase-slider-pill"
        onMouseDown={onSliderMouseDown}
        onClick={(e) => e.stopPropagation()}
        title={`Brush Size: ${eraseSize}px`}
      >
        <div className="anarchy-erase-slider-track" ref={sliderTrackRef}>
          <div className="anarchy-erase-slider-line" />
          <div
            className="anarchy-erase-slider-thumb"
            style={{
              bottom: `${Math.max(0, Math.min(100, ((eraseSize - 10) / (100 - 10)) * 100))}%`,
            }}
          />
        </div>
      </div>

      {/* ── Dynamic Brush Cursor Ring ── */}
      {cursorPos && (
        <div
          className="anarchy-erase-cursor-circle"
          style={{
            left: cursorPos.x,
            top: cursorPos.y,
            width: eraseSize,
            height: eraseSize,
          }}
        />
      )}
    </>
  );
};
