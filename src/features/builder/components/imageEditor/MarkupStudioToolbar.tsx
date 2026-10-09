import React, { useState } from 'react';
import {
  RotateCcw,
  RotateCw,
  X,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import type { MarkupToolType, MarkupShapeType } from './types';
import { ShapesPopover, ColorPopover } from './MarkupPopovers';

interface MarkupStudioToolbarProps {
  // Current active subtool
  activeSubtool: MarkupToolType;
  setActiveSubtool: (tool: MarkupToolType) => void;

  // Active shape
  activeShape: MarkupShapeType;
  setActiveShape: (shape: MarkupShapeType) => void;

  // Active color
  activeColor: string;
  setActiveColor: (color: string) => void;

  // Undo / Redo
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;

  // Dragging support for toolbar
  onDragHandleMouseDown?: (e: React.MouseEvent) => void;
  isDragging?: boolean;

  // Prompt & Node Forking
  engineDisplayName: string;
  onApply: (promptText: string) => void;
  onExit: () => void;
}

export const MarkupStudioToolbar: React.FC<MarkupStudioToolbarProps> = ({
  activeSubtool,
  setActiveSubtool,
  activeShape,
  setActiveShape,
  activeColor,
  setActiveColor,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onDragHandleMouseDown,
  isDragging = false,
  engineDisplayName,
  onApply,
  onExit,
}) => {
  const [showShapesPopover, setShowShapesPopover] = useState(false);
  const [showColorPopover, setShowColorPopover] = useState(false);
  const [markupPrompt, setMarkupPrompt] = useState('');

  const handleSelectSubtool = (tool: MarkupToolType) => {
    setActiveSubtool(tool);
    if (tool !== 'shape') setShowShapesPopover(false);
    setShowColorPopover(false);
  };

  const handleToggleShapes = () => {
    setShowColorPopover(false);
    setShowShapesPopover((prev) => !prev);
    setActiveSubtool('shape');
  };

  const handleToggleColor = () => {
    setShowShapesPopover(false);
    setShowColorPopover((prev) => !prev);
  };

  const handleSubmitPrompt = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onApply(markupPrompt);
  };

  return (
    <div className="markup-studio-wrapper" onClick={(e) => e.stopPropagation()}>
      {/* ── Prompt Bar (Visible from the start) ── */}
      <form className="markup-prompt-bar" onSubmit={handleSubmitPrompt}>
        <div className="markup-prompt-sparkle-icon">
          <Sparkles size={16} />
        </div>

        <input
          type="text"
          className="markup-prompt-input"
          placeholder="صف التعديل المطلوب حسب الرسم... / Describe modification from markup..."
          value={markupPrompt}
          onChange={(e) => setMarkupPrompt(e.target.value)}
        />

        <div className="markup-prompt-engine-tag" title="Target Engine">
          <span className="engine-dot" />
          <span>{engineDisplayName}</span>
        </div>

        <button
          type="submit"
          className="markup-prompt-submit-btn"
          title="Send to engine & generate linked child node"
        >
          <span>تطبيق وتوليد</span>
          <ArrowRight size={14} />
        </button>
      </form>

      {/* ── Popovers Floating Directly Above Corresponding Buttons ── */}
      {showShapesPopover && (
        <ShapesPopover
          activeShape={activeShape}
          onSelectShape={(shape) => {
            setActiveShape(shape);
            setActiveSubtool('shape');
            setShowShapesPopover(false);
          }}
          onClose={() => setShowShapesPopover(false)}
        />
      )}

      {showColorPopover && (
        <ColorPopover
          activeColor={activeColor}
          onSelectColor={(color) => {
            setActiveColor(color);
            setShowColorPopover(false);
          }}
          onClose={() => setShowColorPopover(false)}
        />
      )}

      {/* ── The 9-Tool Sleek Charcoal Pill Toolbar (Screenshot 2) ── */}
      <div className="markup-charcoal-pill-toolbar" role="toolbar" aria-label="Markup Studio Tools">
        {/* 1. Drag & Move Handle (Grip Dots :::) */}
        <div
          className={`markup-toolbar-btn markup-drag-handle ${isDragging ? 'grabbing' : ''}`}
          title="1. اسحب الشريط لتحريكه حسب الرغبة"
          onMouseDown={onDragHandleMouseDown}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <circle cx="7" cy="6" r="1.6" />
            <circle cx="15" cy="6" r="1.6" />
            <circle cx="7" cy="12" r="1.6" />
            <circle cx="15" cy="12" r="1.6" />
            <circle cx="7" cy="18" r="1.6" />
            <circle cx="15" cy="18" r="1.6" />
          </svg>
        </div>

        {/* 2. Select / Transform Arrow Cursor */}
        <button
          type="button"
          className={`markup-toolbar-btn ${activeSubtool === 'select' ? 'active' : ''}`}
          onClick={() => handleSelectSubtool('select')}
          title="2. سهم التحديد والتحكم بالرسومات (تحريك وتكبير/تصغير)"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4l7 17 2.8-6.2L20 12z" />
          </svg>
        </button>

        {/* 3. Brush (Freehand) */}
        <button
          type="button"
          className={`markup-toolbar-btn ${activeSubtool === 'brush' ? 'active' : ''}`}
          onClick={() => handleSelectSubtool('brush')}
          title="3. الفرشاة للرسم الحر"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 16c2-4 4-4 6-1s4 4 6 1 4-4 6-1" />
          </svg>
        </button>

        {/* 4. Text Tool (T) */}
        <button
          type="button"
          className={`markup-toolbar-btn ${activeSubtool === 'text' ? 'active' : ''}`}
          onClick={() => handleSelectSubtool('text')}
          title="4. الكتابة وإضافة نصوص لتحديد مكان التعديل"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 6h14" />
            <path d="M12 6v13" />
            <path d="M9 19h6" />
          </svg>
        </button>

        {/* 5. Geometric Shapes */}
        <button
          type="button"
          className={`markup-toolbar-btn ${activeSubtool === 'shape' ? 'active' : ''}`}
          onClick={handleToggleShapes}
          title="5. الأشكال الهندسية لتحديد أو إضافة عناصر"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="11" height="11" rx="2" />
            <circle cx="15.5" cy="15.5" r="5.5" />
          </svg>
        </button>

        {/* 6. Color Picker Swatch */}
        <button
          type="button"
          className={`markup-toolbar-btn markup-color-indicator-btn ${showColorPopover ? 'open' : ''}`}
          onClick={handleToggleColor}
          title="6. اختيار الألوان"
        >
          <div
            className="markup-active-color-circle"
            style={{ backgroundColor: activeColor }}
          />
        </button>

        {/* 7. Eraser */}
        <button
          type="button"
          className={`markup-toolbar-btn ${activeSubtool === 'eraser' ? 'active' : ''}`}
          onClick={() => handleSelectSubtool('eraser')}
          title="7. ممحاة احترافية لحذف الرسومات والأشكال والنصوص"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
            <path d="M22 21H7" />
            <path d="m5 11 9 9" />
          </svg>
        </button>

        {/* Separator */}
        <div className="markup-toolbar-separator" />

        {/* 8. Undo */}
        <button
          type="button"
          className={`markup-toolbar-btn ${!canUndo ? 'disabled' : ''}`}
          onClick={onUndo}
          disabled={!canUndo}
          title="8. تراجع (Undo)"
        >
          <RotateCcw size={18} />
        </button>

        {/* 8. Redo */}
        <button
          type="button"
          className={`markup-toolbar-btn ${!canRedo ? 'disabled' : ''}`}
          onClick={onRedo}
          disabled={!canRedo}
          title="8. إعادة (Redo)"
        >
          <RotateCw size={18} />
        </button>

        {/* Separator */}
        <div className="markup-toolbar-separator" />

        {/* 9. Exit Markup Mode */}
        <button
          type="button"
          className="markup-toolbar-btn markup-exit-btn"
          onClick={onExit}
          title="9. الخروج من وضع Markup"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
};
