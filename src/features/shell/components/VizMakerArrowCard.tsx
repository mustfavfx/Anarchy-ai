import React, { useRef } from 'react';
import { ImagePlus, X, Trash2, Sparkles, GripHorizontal, Minimize2, Maximize2 } from 'lucide-react';
import './VizMakerArrowCard.css';

export interface ArrowNodeItem {
  id: string;
  targetPos: { x: number; y: number }; // Percentage 0-100 on image
  cardPos: { x: number; y: number };   // Percentage 0-100 on image
  text: string;                        // e.g. "change this chair", "change the sofa"
  refImage: string | null;             // Reference photo
  radius?: number;                     // Target edit radius in pixels (default: 80)
  collapsed?: boolean;                 // Whether card is minimized to clean floating pill
}

interface VizMakerArrowCardProps {
  arrow: ArrowNodeItem;
  index?: number;
  onUpdate: (id: string, updates: Partial<ArrowNodeItem>) => void;
  onDelete: (id: string) => void;
  containerRect?: DOMRect | null;
}

export const VizMakerArrowCard: React.FC<VizMakerArrowCardProps> = ({
  arrow,
  index = 1,
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
  const curvature = Math.min(30, dist * 0.15);
  const cx = dx * 0.5 - (dy / dist) * curvature;
  const cy = dy * 0.5 + (dx / dist) * curvature;

  const svgPadX = Math.max(Math.abs(dx) + 100, 200);
  const svgPadY = Math.max(Math.abs(dy) + 100, 200);

  const currentRadius = arrow.radius || 80;

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
      {/* Target Pin Marker & Live Edit Zone on Canvas Image (Draggable) */}
      <div
        className="vizmaker-target-pin-group"
        style={{
          left: `${arrow.targetPos.x}%`,
          top: `${arrow.targetPos.y}%`,
        }}
        onMouseDown={handlePinMouseDown}
        title="Drag pin to reposition edit point"
      >
        {/* Soft Glowing Mask Edit Zone (Shows exact region AI will inpaint) */}
        <div
          className="vizmaker-target-aura"
          style={{
            width: currentRadius * 2,
            height: currentRadius * 2,
          }}
        />

        {/* Modern Glass Pin Badge */}
        <div className="vizmaker-target-pin-badge">
          <span className="vizmaker-pin-sparkle">✨</span>
          <span className="vizmaker-pin-num">{index}</span>
        </div>
      </div>

      {/* Floating Card & Connector Thread */}
      <div
        className="vizmaker-arrow-card-wrapper"
        style={{
          left: `${arrow.cardPos.x}%`,
          top: `${arrow.cardPos.y}%`,
        }}
        onClick={handleContainerClick}
        onMouseDown={handleContainerMouseDown}
      >
        {/* SVG Connecting Curved Glowing Thread */}
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
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0.9" />
            </linearGradient>
            <filter id={`glow-${arrow.id}`} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#f43f5e" floodOpacity="0.5" />
            </filter>
          </defs>
          <g transform={`translate(${svgPadX}, ${svgPadY})`}>
            <path
              d={`M 0 0 Q ${cx} ${cy} ${dx} ${dy}`}
              stroke={`url(#arrowGrad-${arrow.id})`}
              strokeWidth="2.2"
              fill="none"
              strokeDasharray="5 3"
              filter={`url(#glow-${arrow.id})`}
            />
            {/* Soft glowing bead at pin connection */}
            <circle cx={dx} cy={dy} r="3.5" fill="#f43f5e" />
          </g>
        </svg>

        {/* Floating Card UI - Collapsible & Minimalist */}
        {arrow.collapsed ? (
          <div
            className="vizmaker-arrow-card-pill"
            onClick={(e) => {
              e.stopPropagation();
              onUpdate(arrow.id, { collapsed: false });
            }}
            title="Click to expand details"
          >
            <span className="vizmaker-pill-badge">✨ {index}</span>
            <span className="vizmaker-pill-text">{arrow.text || 'AI Edit Area'}</span>
            <button
              type="button"
              className="vizmaker-pill-delete"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(arrow.id);
              }}
              title="Delete Pin"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <div className="vizmaker-arrow-card">
            {/* Header (Draggable Handle) */}
            <div
              className="vizmaker-arrow-card-header draggable"
              onMouseDown={handleHeaderMouseDown}
              title="Click and drag to move card"
            >
              <div className="vizmaker-arrow-card-title">
                <GripHorizontal size={13} className="vizmaker-grip-icon" />
                <span className="vizmaker-pin-chip">✨ AI Pin {index}</span>
              </div>
              <div className="vizmaker-header-actions">
                <button
                  type="button"
                  className="vizmaker-arrow-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdate(arrow.id, { collapsed: true });
                  }}
                  title="Minimize Pin"
                >
                  <Minimize2 size={12} />
                </button>
                <button
                  type="button"
                  className="vizmaker-arrow-btn danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onDelete(arrow.id);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  title="Delete Pin"
                >
                  <X size={12} />
                </button>
              </div>
            </div>

            {/* Prompt Input */}
            <div className="vizmaker-input-wrapper">
              <input
                type="text"
                className="vizmaker-arrow-text-input"
                value={arrow.text}
                onChange={(e) => onUpdate(arrow.id, { text: e.target.value })}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                placeholder="What should AI generate here? (e.g., Red leather armchair)"
              />
            </div>

            {/* Target Edit Zone Radius Selector */}
            <div className="vizmaker-radius-row" onClick={(e) => e.stopPropagation()}>
              <span className="vizmaker-radius-label">Target Area:</span>
              <div className="vizmaker-radius-pills">
                {[
                  { label: 'S (40px)', val: 40 },
                  { label: 'M (80px)', val: 80 },
                  { label: 'L (140px)', val: 140 },
                  { label: 'XL (220px)', val: 220 },
                ].map((preset) => (
                  <button
                    key={preset.val}
                    type="button"
                    className={`vizmaker-radius-pill ${currentRadius === preset.val ? 'active' : ''}`}
                    onClick={() => onUpdate(arrow.id, { radius: preset.val })}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Reference Image Container or Compact Upload Button */}
            {arrow.refImage ? (
              <div className="vizmaker-ref-container" onClick={(e) => e.stopPropagation()}>
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
              <label
                className="vizmaker-ref-compact-btn"
                title="Add reference photo for guided edit"
                onClick={(e) => e.stopPropagation()}
              >
                <ImagePlus size={13} />
                <span>Attach Reference Image (Optional)</span>
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
          </div>
        )}
      </div>
    </>
  );
};
