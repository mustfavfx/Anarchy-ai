import React, { useRef } from 'react';
import { ImagePlus, X, Trash2, Sparkles, GripHorizontal } from 'lucide-react';
import './VizMakerArrowCard.css';

export interface ArrowNodeItem {
  id: string;
  targetPos: { x: number; y: number }; // Percentage 0-100 on image
  cardPos: { x: number; y: number };   // Percentage 0-100 on image
  text: string;                        // e.g. "change this chair", "change the sofa"
  refImage: string | null;             // Reference photo
}

interface VizMakerArrowCardProps {
  arrow: ArrowNodeItem;
  onUpdate: (id: string, updates: Partial<ArrowNodeItem>) => void;
  onDelete: (id: string) => void;
  containerRect?: DOMRect | null;
}

export const VizMakerArrowCard: React.FC<VizMakerArrowCardProps> = ({
  arrow,
  onUpdate,
  onDelete,
  containerRect,
}) => {
  const isDraggingCard = useRef(false);
  const isDraggingPin = useRef(false);

  const containerW = containerRect?.width || 800;
  const containerH = containerRect?.height || 600;

  // Calculate pixel displacement from card center to target pin
  const dx = ((arrow.targetPos.x - arrow.cardPos.x) / 100) * containerW;
  const dy = ((arrow.targetPos.y - arrow.cardPos.y) / 100) * containerH;

  const dist = Math.hypot(dx, dy) || 1;
  const curvature = Math.min(35, dist * 0.18);
  const cx = dx * 0.5 - (dy / dist) * curvature;
  const cy = dy * 0.5 + (dx / dist) * curvature;

  const svgPadX = Math.max(Math.abs(dx) + 120, 240);
  const svgPadY = Math.max(Math.abs(dy) + 120, 240);

  // Dragging the Target Pin Dot
  const handlePinMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    isDraggingPin.current = true;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingPin.current || !containerRect) return;
      const x = Math.max(2, Math.min(98, ((moveEvent.clientX - containerRect.left) / containerRect.width) * 100));
      const y = Math.max(2, Math.min(98, ((moveEvent.clientY - containerRect.top) / containerRect.height) * 100));
      onUpdate(arrow.id, { targetPos: { x: Math.round(x), y: Math.round(y) } });
    };

    const handleMouseUp = () => {
      isDraggingPin.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Dragging the Floating Card Header
  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    isDraggingCard.current = true;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingCard.current || !containerRect) return;
      const x = Math.max(5, Math.min(95, ((moveEvent.clientX - containerRect.left) / containerRect.width) * 100));
      const y = Math.max(5, Math.min(95, ((moveEvent.clientY - containerRect.top) / containerRect.height) * 100));
      onUpdate(arrow.id, { cardPos: { x: Math.round(x), y: Math.round(y) } });
    };

    const handleMouseUp = () => {
      isDraggingCard.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleContainerMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <>
      {/* Target Pin Marker on Image (Draggable) */}
      <div
        className="vizmaker-target-pin"
        style={{
          left: `${arrow.targetPos.x}%`,
          top: `${arrow.targetPos.y}%`,
        }}
        onMouseDown={handlePinMouseDown}
        title="انقر واسحب لتحريك نقطة التعديل"
      >
        <span className="vizmaker-target-pin-pulse" />
        <span className="vizmaker-target-pin-dot" />
      </div>

      {/* Floating Card & Connector Arrow */}
      <div
        className="vizmaker-arrow-card-wrapper"
        style={{
          left: `${arrow.cardPos.x}%`,
          top: `${arrow.cardPos.y}%`,
        }}
        onClick={handleContainerClick}
        onMouseDown={handleContainerMouseDown}
      >
        {/* SVG Connecting Curved Arrow */}
        <svg
          className="vizmaker-arrow-svg"
          style={{
            width: svgPadX * 2,
            height: svgPadY * 2,
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <defs>
            <linearGradient id={`arrowGrad-${arrow.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#e11d48" />
              <stop offset="100%" stopColor="#fb7185" />
            </linearGradient>
            <marker
              id={`arrowhead-${arrow.id}`}
              markerWidth="9"
              markerHeight="9"
              refX="7"
              refY="4.5"
              orient="auto"
            >
              <path d="M 0 1.5 L 8 4.5 L 0 7.5 z" fill={`url(#arrowGrad-${arrow.id})`} />
            </marker>
          </defs>
          <g transform={`translate(${svgPadX}, ${svgPadY})`}>
            <path
              d={`M 0 0 Q ${cx} ${cy} ${dx} ${dy}`}
              stroke={`url(#arrowGrad-${arrow.id})`}
              strokeWidth="2.2"
              fill="none"
              strokeDasharray="5 3"
              markerEnd={`url(#arrowhead-${arrow.id})`}
            />
          </g>
        </svg>

        {/* Floating Card UI */}
        <div className="vizmaker-arrow-card">
          {/* Header (Draggable Handle) */}
          <div
            className="vizmaker-arrow-card-header draggable"
            onMouseDown={handleHeaderMouseDown}
            title="Click and drag to move card"
          >
            <div className="vizmaker-arrow-card-title">
              <GripHorizontal size={13} className="vizmaker-grip-icon" />
              <Sparkles size={13} className="vizmaker-header-icon" />
              <span>Mask Note</span>
            </div>
            <button
              type="button"
              className="vizmaker-arrow-close"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onDelete(arrow.id);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              title="Delete Note"
            >
              <X size={13} />
            </button>
          </div>

          {/* Reference Image Container */}
          {arrow.refImage ? (
            <div className="vizmaker-ref-container">
              <img src={arrow.refImage} alt="Ref" className="vizmaker-ref-img" />
              <button
                type="button"
                className="vizmaker-ref-remove"
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdate(arrow.id, { refImage: null });
                }}
                onMouseDown={(e) => e.stopPropagation()}
                title="Remove Reference Image"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ) : (
            <label className="vizmaker-ref-upload-btn" title="Add reference photo for guided edit">
              <ImagePlus size={18} />
              <span>Add Reference Image</span>
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      if (ev.target?.result) {
                        onUpdate(arrow.id, { refImage: ev.target.result as string });
                      }
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
            </label>
          )}

          {/* Prompt Input */}
          <div className="vizmaker-input-wrapper">
            <input
              type="text"
              className="vizmaker-arrow-text-input"
              value={arrow.text}
              onChange={(e) => onUpdate(arrow.id, { text: e.target.value })}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              placeholder="e.g. Change armchair style..."
            />
          </div>
        </div>
      </div>
    </>
  );
};



