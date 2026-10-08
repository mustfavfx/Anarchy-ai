import React from 'react';
import { Trash2, Sparkles, X } from 'lucide-react';
import type { CommentPin } from './types';

interface CommentOverlayProps {
  pins: CommentPin[];
  setPins: React.Dispatch<React.SetStateAction<CommentPin[]>>;
  activePinId: string | null;
  setActivePinId: (id: string | null) => void;
  commentInput: string;
  setCommentInput: (val: string) => void;
  onOverlayClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  onSendToAgent: (pin: CommentPin) => void;
}

export const CommentOverlay: React.FC<CommentOverlayProps> = ({
  pins,
  setPins,
  activePinId,
  setActivePinId,
  commentInput,
  setCommentInput,
  onOverlayClick,
  onSendToAgent,
}) => {
  const activePin = activePinId ? pins.find((p) => p.id === activePinId) : null;

  return (
    <div
      className="image-editor-canvas-layer cursor-comment"
      style={{ zIndex: 10003 }}
      onClick={onOverlayClick}
    >
      {pins.map((pin) => (
        <div
          key={pin.id}
          className="comment-pin-marker"
          style={{ left: `${pin.xPct}%`, top: `${pin.yPct}%` }}
          onClick={(e) => {
            e.stopPropagation();
            setActivePinId(pin.id);
            setCommentInput(pin.text);
          }}
          title={`Pin #${pin.num}: ${pin.text || 'Click to write instruction'}`}
        >
          {pin.num}
        </div>
      ))}

      {/* Active Pin Popover Card */}
      {activePin && (
        <div
          className="comment-card-popover"
          style={{
            left: `${Math.min(75, Math.max(10, activePin.xPct))}%`,
            top: `${Math.min(75, Math.max(10, activePin.yPct + 4))}%`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: '#ff2a6d' }}>
              Instruction Pin #{activePin.num}
            </span>
            <button
              type="button"
              className="subtool-icon-btn"
              style={{ width: 22, height: 22 }}
              onClick={() => {
                setPins((prev) => prev.filter((p) => p.id !== activePin.id));
                setActivePinId(null);
              }}
              title="Delete Pin"
            >
              <Trash2 size={12} />
            </button>
          </div>
          <textarea
            className="comment-card-textarea"
            placeholder="Type prompt or edit instruction for AI..."
            value={commentInput}
            onChange={(e) => {
              setCommentInput(e.target.value);
              setPins((prev) =>
                prev.map((p) => (p.id === activePin.id ? { ...p, text: e.target.value } : p))
              );
            }}
            autoFocus
          />
          <div className="comment-card-actions">
            <button
              type="button"
              className="subtool-action-btn apply"
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={() => onSendToAgent(activePin)}
              title="Send instruction to model & generate connected node"
            >
              <Sparkles size={12} />
              <span>Generate</span>
            </button>
            <button
              type="button"
              className="subtool-action-btn cancel"
              onClick={() => setActivePinId(null)}
              title="Close"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
