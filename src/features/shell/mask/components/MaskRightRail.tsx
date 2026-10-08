import React from 'react';
import { Layers, RotateCcw, RotateCw, X } from 'lucide-react';

interface MaskRightRailProps {
  showLayerStack: boolean;
  setShowLayerStack: React.Dispatch<React.SetStateAction<boolean>>;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClose?: () => void;
  isAr?: boolean;
}

export const MaskRightRail: React.FC<MaskRightRailProps> = ({
  showLayerStack,
  setShowLayerStack,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClose,
  isAr: _isAr,
}) => {
  return (
    <div className="mask-canvas-right-rail">
      <button
        type="button"
        className={`mask-toolbar-btn ${showLayerStack ? 'active' : ''}`}
        onClick={() => setShowLayerStack((prev) => !prev)}
        title={showLayerStack ? 'Hide Studio Panel' : 'Show Studio Panel'}
      >
        <Layers size={16} />
      </button>

      <div className="mask-canvas-rail-divider" />

      <button
        type="button"
        className="mask-toolbar-btn"
        onClick={onUndo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
        style={{ opacity: canUndo ? 1 : 0.35 }}
      >
        <RotateCcw size={15} />
      </button>

      <button
        type="button"
        className="mask-toolbar-btn"
        onClick={onRedo}
        disabled={!canRedo}
        title="Redo (Ctrl+Y)"
        style={{ opacity: canRedo ? 1 : 0.35 }}
      >
        <RotateCw size={15} />
      </button>

      {onClose && (
        <button
          type="button"
          className="mask-toolbar-btn mask-toolbar-close-btn"
          onClick={onClose}
          title="Back to canvas (Esc)"
          style={{ color: 'rgba(255,255,255,0.75)', marginTop: 'auto' }}
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
};
