import React from 'react';
import { Check } from 'lucide-react';
import type { ActiveToolType } from './types';

interface MainPillToolbarProps {
  activeTool: ActiveToolType;
  onToggleTool: (tool: ActiveToolType) => void;
  onDragHandleMouseDown?: (e: React.MouseEvent) => void;
  isDragging?: boolean;
  onApplyCurrentTool?: () => void;
}

export const MainPillToolbar: React.FC<MainPillToolbarProps> = ({
  activeTool,
  onToggleTool,
  onDragHandleMouseDown,
  isDragging = false,
  onApplyCurrentTool,
}) => {
  return (
    <div className="chatgpt-pill-toolbar" role="toolbar" aria-label="Image Studio Tools">
      {/* 0. 6-Dot Drag & Positioning Handle */}
      <div
        className={`chatgpt-drag-handle ${isDragging ? 'grabbing' : ''}`}
        title="Drag toolbar to reposition anywhere on screen"
        onMouseDown={onDragHandleMouseDown}
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
          <circle cx="8" cy="6" r="1.6" />
          <circle cx="16" cy="6" r="1.6" />
          <circle cx="8" cy="12" r="1.6" />
          <circle cx="16" cy="12" r="1.6" />
          <circle cx="8" cy="18" r="1.6" />
          <circle cx="16" cy="18" r="1.6" />
        </svg>
      </div>

      {/* 1. Markup (Squiggle icon) */}
      <button
        type="button"
        className={`chatgpt-tool-btn ${activeTool === 'markup' ? 'active' : ''}`}
        onClick={() => onToggleTool('markup')}
        title="Markup — Freehand drawing"
      >
        <span className="chatgpt-tool-icon">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 15c2-4 4-4 6-1s4 4 6 1 4-4 6-1" />
          </svg>
        </span>
        <span>Markup</span>
      </button>

      <div className="chatgpt-pill-separator" />

      {/* 2. Comment (Pin & Instruction Box) */}
      <button
        type="button"
        className={`chatgpt-tool-btn ${activeTool === 'comment' ? 'active' : ''}`}
        onClick={() => onToggleTool('comment')}
        title="Comment — Pin instruction for AI"
      >
        <span className="chatgpt-tool-icon">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 8V6a2 2 0 0 1 2-2h2M15 4h2a2 2 0 0 1 2 2v2M19 15v2a2 2 0 0 1-2 2h-2M9 19H7a2 2 0 0 1-2-2v-2" />
            <path d="m9 9 5.5 2.2-2.3.9-.9 2.4z" />
          </svg>
        </span>
        <span>Comment</span>
      </button>

      <div className="chatgpt-pill-separator" />

      {/* 3. Erase (Angled Eraser) */}
      <button
        type="button"
        className={`chatgpt-tool-btn ${activeTool === 'erase' ? 'active' : ''}`}
        onClick={() => onToggleTool('erase')}
        title="Erase — Smart inpaint & remove"
      >
        <span className="chatgpt-tool-icon">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
            <path d="M22 21H7" />
            <path d="m5 11 9 9" />
          </svg>
        </span>
        <span>Erase</span>
      </button>

      <div className="chatgpt-pill-separator" />

      {/* 4. Resize (Crop / Aspect Ratio) */}
      <button
        type="button"
        className={`chatgpt-tool-btn ${activeTool === 'resize' ? 'active' : ''}`}
        onClick={() => onToggleTool('resize')}
        title="Resize — Aspect ratio & framing"
      >
        <span className="chatgpt-tool-icon">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8V5a2 2 0 0 1 2-2h3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M21 16v3a2 2 0 0 1-2 2h-3" />
          </svg>
        </span>
        <span>Resize</span>
      </button>

      {/* 5. Prominent OK / Apply Button in Toolbar (For Resize & Tools) */}
      {(activeTool === 'resize' || activeTool === 'markup') && onApplyCurrentTool && (
        <>
          <div className="chatgpt-pill-separator" />
          <button
            type="button"
            className="chatgpt-tool-btn chatgpt-ok-btn"
            onClick={onApplyCurrentTool}
            title={activeTool === 'resize' ? 'OK — Send resize to selected AI engine & fork linked node' : 'OK — Apply markup & fork linked node'}
          >
            <Check size={14} className="ok-check-icon" />
            <span className="ok-text">OK</span>
          </button>
        </>
      )}
    </div>
  );
};
