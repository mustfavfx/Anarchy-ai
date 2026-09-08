import React, { useRef, useEffect, useState, useCallback } from 'react';
import './RulerGuidesOverlay.css';

export interface Guide {
  id: string;
  orientation: 'horizontal' | 'vertical';
  pos: number; // in canvas image space
}

export interface RulerGuidesOverlayProps {
  visible: boolean;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  zoomScale: number;
  panOffset: { x: number; y: number };
  guides: Guide[];
  onGuidesChange: (guides: Guide[]) => void;
  cursorPos: { x: number; y: number } | null; // in canvas coords
  onClearGuides?: () => void;
}

/**
 * Snaps a 2D point to the nearest magnetic guide line within the threshold (in canvas coordinates).
 */
export function snapToGuides(
  x: number,
  y: number,
  guides: Guide[],
  threshold = 10
): { x: number; y: number; snappedX: boolean; snappedY: boolean } {
  let snappedX = false;
  let snappedY = false;
  let resX = x;
  let resY = y;

  for (const guide of guides) {
    if (guide.orientation === 'vertical') {
      if (Math.abs(x - guide.pos) <= threshold) {
        resX = guide.pos;
        snappedX = true;
      }
    } else if (guide.orientation === 'horizontal') {
      if (Math.abs(y - guide.pos) <= threshold) {
        resY = guide.pos;
        snappedY = true;
      }
    }
  }

  return { x: resX, y: resY, snappedX, snappedY };
}

/**
 * Snaps a vector (startX, startY) -> (currX, currY) to nearest orthogonal angle (e.g. 45° or 90°).
 */
export function snapToOrthoAngle(
  startX: number,
  startY: number,
  currX: number,
  currY: number,
  stepDeg = 45
): { x: number; y: number; angleDeg: number } {
  const dx = currX - startX;
  const dy = currY - startY;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return { x: currX, y: currY, angleDeg: 0 };

  const angleRad = Math.atan2(dy, dx);
  const angleDeg = (angleRad * 180) / Math.PI;
  const snappedDeg = Math.round(angleDeg / stepDeg) * stepDeg;
  const snappedRad = (snappedDeg * Math.PI) / 180;

  return {
    x: Math.round(startX + dist * Math.cos(snappedRad)),
    y: Math.round(startY + dist * Math.sin(snappedRad)),
    angleDeg: (snappedDeg + 360) % 360,
  };
}

export const RulerGuidesOverlay: React.FC<RulerGuidesOverlayProps> = ({
  visible,
  canvasRef,
  wrapperRef,
  zoomScale,
  panOffset,
  guides,
  onGuidesChange,
  cursorPos,
  onClearGuides,
}) => {
  const topRulerRef = useRef<HTMLCanvasElement>(null);
  const leftRulerRef = useRef<HTMLCanvasElement>(null);

  const [draggingGuide, setDraggingGuide] = useState<{
    id: string;
    orientation: 'horizontal' | 'vertical';
    pos: number;
    isNew: boolean;
  } | null>(null);

  // Helper to get bounding rect of canvas relative to wrapper
  const getCanvasOffsetInWrapper = useCallback(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return null;

    const canvasRect = canvas.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();

    return {
      left: canvasRect.left - wrapperRect.left,
      top: canvasRect.top - wrapperRect.top,
      width: canvasRect.width,
      height: canvasRect.height,
      imgWidth: canvas.width,
      imgHeight: canvas.height,
      scaleX: canvasRect.width / (canvas.width || 1),
      scaleY: canvasRect.height / (canvas.height || 1),
    };
  }, [canvasRef, wrapperRef]);

  // Redraw rulers whenever zoom, pan, or cursor changes
  useEffect(() => {
    if (!visible) return;

    const topCanvas = topRulerRef.current;
    const leftCanvas = leftRulerRef.current;
    if (!topCanvas || !leftCanvas) return;

    const info = getCanvasOffsetInWrapper();
    if (!info) return;

    const topCtx = topCanvas.getContext('2d');
    const leftCtx = leftCanvas.getContext('2d');
    if (!topCtx || !leftCtx) return;

    const dpr = window.devicePixelRatio || 1;
    const topW = topCanvas.clientWidth;
    const topH = 22;
    topCanvas.width = topW * dpr;
    topCanvas.height = topH * dpr;
    topCtx.scale(dpr, dpr);

    const leftW = 22;
    const leftH = leftCanvas.clientHeight;
    leftCanvas.width = leftW * dpr;
    leftCanvas.height = leftH * dpr;
    leftCtx.scale(dpr, dpr);

    // --- Render Top Ruler ---
    topCtx.fillStyle = '#0f172a';
    topCtx.fillRect(0, 0, topW, topH);
    topCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    topCtx.fillStyle = '#94a3b8';
    topCtx.font = '9px monospace';
    topCtx.textAlign = 'left';
    topCtx.textBaseline = 'top';

    // Step calculation based on zoom
    let step = 100;
    if (info.scaleX > 3) step = 10;
    else if (info.scaleX > 1.5) step = 25;
    else if (info.scaleX > 0.6) step = 50;
    else if (info.scaleX < 0.3) step = 200;
    else if (info.scaleX < 0.15) step = 500;

    const startX = -info.left / info.scaleX;
    const endX = (topW - info.left) / info.scaleX;
    const firstTick = Math.floor(startX / step) * step;

    for (let x = firstTick; x <= endX; x += step) {
      const screenX = info.left + x * info.scaleX - 22; // offset by 22px left ruler
      if (screenX < 0 || screenX > topW) continue;

      // Major tick
      topCtx.beginPath();
      topCtx.moveTo(screenX, topH - 9);
      topCtx.lineTo(screenX, topH);
      topCtx.stroke();

      topCtx.fillText(`${Math.round(x)}`, screenX + 2, 2);

      // Minor ticks
      const subStep = step / 5;
      for (let s = 1; s < 5; s++) {
        const subX = screenX + s * subStep * info.scaleX;
        if (subX >= 0 && subX <= topW) {
          topCtx.beginPath();
          topCtx.moveTo(subX, topH - 4);
          topCtx.lineTo(subX, topH);
          topCtx.stroke();
        }
      }
    }

    // Hairline cursor tracker on top ruler
    if (cursorPos) {
      const cursorScreenX = info.left + cursorPos.x * info.scaleX - 22;
      if (cursorScreenX >= 0 && cursorScreenX <= topW) {
        topCtx.strokeStyle = '#38bdf8';
        topCtx.lineWidth = 1.5;
        topCtx.beginPath();
        topCtx.moveTo(cursorScreenX, 0);
        topCtx.lineTo(cursorScreenX, topH);
        topCtx.stroke();
      }
    }

    // --- Render Left Ruler ---
    leftCtx.fillStyle = '#0f172a';
    leftCtx.fillRect(0, 0, leftW, leftH);
    leftCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    leftCtx.fillStyle = '#94a3b8';
    leftCtx.font = '8px monospace';
    leftCtx.textAlign = 'right';
    leftCtx.textBaseline = 'middle';

    const startY = -info.top / info.scaleY;
    const endY = (leftH - info.top) / info.scaleY;
    const firstTickY = Math.floor(startY / step) * step;

    for (let y = firstTickY; y <= endY; y += step) {
      const screenY = info.top + y * info.scaleY - 22; // offset by 22px top ruler
      if (screenY < 0 || screenY > leftH) continue;

      leftCtx.beginPath();
      leftCtx.moveTo(leftW - 9, screenY);
      leftCtx.lineTo(leftW, screenY);
      leftCtx.stroke();

      // Rotated text or compact number
      leftCtx.fillText(`${Math.round(y)}`, leftW - 10, screenY);

      const subStep = step / 5;
      for (let s = 1; s < 5; s++) {
        const subY = screenY + s * subStep * info.scaleY;
        if (subY >= 0 && subY <= leftH) {
          leftCtx.beginPath();
          leftCtx.moveTo(leftW - 4, subY);
          leftCtx.lineTo(leftW, subY);
          leftCtx.stroke();
        }
      }
    }

    // Hairline cursor tracker on left ruler
    if (cursorPos) {
      const cursorScreenY = info.top + cursorPos.y * info.scaleY - 22;
      if (cursorScreenY >= 0 && cursorScreenY <= leftH) {
        leftCtx.strokeStyle = '#38bdf8';
        leftCtx.lineWidth = 1.5;
        leftCtx.beginPath();
        leftCtx.moveTo(0, cursorScreenY);
        leftCtx.lineTo(leftW, cursorScreenY);
        leftCtx.stroke();
      }
    }
  }, [visible, zoomScale, panOffset, cursorPos, getCanvasOffsetInWrapper]);

  // Start dragging a new guide from horizontal ruler
  const handleTopRulerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const info = getCanvasOffsetInWrapper();
    if (!info) return;

    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const wrapperRect = wrapper.getBoundingClientRect();
    const clientY = e.clientY - wrapperRect.top;
    const canvasY = (clientY - info.top) / info.scaleY;

    setDraggingGuide({
      id: `guide-h-${Date.now()}`,
      orientation: 'horizontal',
      pos: Math.round(canvasY),
      isNew: true,
    });
  };

  // Start dragging a new guide from vertical ruler
  const handleLeftRulerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const info = getCanvasOffsetInWrapper();
    if (!info) return;

    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const wrapperRect = wrapper.getBoundingClientRect();
    const clientX = e.clientX - wrapperRect.left;
    const canvasX = (clientX - info.left) / info.scaleX;

    setDraggingGuide({
      id: `guide-v-${Date.now()}`,
      orientation: 'vertical',
      pos: Math.round(canvasX),
      isNew: true,
    });
  };

  // Dragging event handlers for guides
  useEffect(() => {
    if (!draggingGuide) return;

    const handleMouseMove = (e: MouseEvent) => {
      const info = getCanvasOffsetInWrapper();
      const wrapper = wrapperRef.current;
      if (!info || !wrapper) return;

      const wrapperRect = wrapper.getBoundingClientRect();
      if (draggingGuide.orientation === 'horizontal') {
        const clientY = e.clientY - wrapperRect.top;
        const canvasY = Math.round((clientY - info.top) / info.scaleY);
        setDraggingGuide((prev) => (prev ? { ...prev, pos: canvasY } : null));
      } else {
        const clientX = e.clientX - wrapperRect.left;
        const canvasX = Math.round((clientX - info.left) / info.scaleX);
        setDraggingGuide((prev) => (prev ? { ...prev, pos: canvasX } : null));
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      const info = getCanvasOffsetInWrapper();
      const wrapper = wrapperRef.current;
      if (!info || !wrapper) {
        setDraggingGuide(null);
        return;
      }

      const wrapperRect = wrapper.getBoundingClientRect();
      const clientX = e.clientX - wrapperRect.left;
      const clientY = e.clientY - wrapperRect.top;

      // If dragged out of canvas or back into rulers, remove it
      const isDroppedInRuler =
        (draggingGuide.orientation === 'horizontal' && clientY <= 22) ||
        (draggingGuide.orientation === 'vertical' && clientX <= 22);

      if (isDroppedInRuler) {
        if (!draggingGuide.isNew) {
          onGuidesChange(guides.filter((g) => g.id !== draggingGuide.id));
        }
      } else {
        if (draggingGuide.isNew) {
          onGuidesChange([...guides, { id: draggingGuide.id, orientation: draggingGuide.orientation, pos: draggingGuide.pos }]);
        } else {
          onGuidesChange(
            guides.map((g) => (g.id === draggingGuide.id ? { ...g, pos: draggingGuide.pos } : g))
          );
        }
      }

      setDraggingGuide(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingGuide, guides, onGuidesChange, getCanvasOffsetInWrapper, wrapperRef]);

  if (!visible) return null;

  const info = getCanvasOffsetInWrapper();

  return (
    <div className="ruler-guides-container">
      {/* Corner origin junction */}
      <div
        className="ruler-corner"
        title="Guides & Rulers (Click to Clear All Guides)"
        onClick={() => {
          if (guides.length > 0 && onClearGuides) {
            onClearGuides();
          }
        }}
      >
        px
      </div>

      {/* Top Horizontal Ruler */}
      <div className="ruler-horizontal" onMouseDown={handleTopRulerMouseDown}>
        <canvas ref={topRulerRef} className="ruler-canvas" />
      </div>

      {/* Left Vertical Ruler */}
      <div className="ruler-vertical" onMouseDown={handleLeftRulerMouseDown}>
        <canvas ref={leftRulerRef} className="ruler-canvas" />
      </div>

      {/* Existing Guides */}
      {info &&
        guides.map((guide) => {
          if (guide.orientation === 'horizontal') {
            const screenY = info.top + guide.pos * info.scaleY;
            return (
              <div
                key={guide.id}
                className="guide-line guide-line-h"
                style={{ top: `${screenY}px` }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setDraggingGuide({ ...guide, isNew: false });
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onGuidesChange(guides.filter((g) => g.id !== guide.id));
                }}
                title={`Horizontal Guide: ${guide.pos}px (Drag to move, Double-click to remove)`}
              >
                <span className="guide-badge">{guide.pos}px</span>
              </div>
            );
          } else {
            const screenX = info.left + guide.pos * info.scaleX;
            return (
              <div
                key={guide.id}
                className="guide-line guide-line-v"
                style={{ left: `${screenX}px` }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setDraggingGuide({ ...guide, isNew: false });
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onGuidesChange(guides.filter((g) => g.id !== guide.id));
                }}
                title={`Vertical Guide: ${guide.pos}px (Drag to move, Double-click to remove)`}
              >
                <span className="guide-badge">{guide.pos}px</span>
              </div>
            );
          }
        })}

      {/* Active Dragging Guide Preview */}
      {info && draggingGuide && (
        draggingGuide.orientation === 'horizontal' ? (
          <div
            className="guide-line guide-line-h dragging"
            style={{ top: `${info.top + draggingGuide.pos * info.scaleY}px` }}
          >
            <span className="guide-badge">{draggingGuide.pos}px</span>
          </div>
        ) : (
          <div
            className="guide-line guide-line-v dragging"
            style={{ left: `${info.left + draggingGuide.pos * info.scaleX}px` }}
          >
            <span className="guide-badge">{draggingGuide.pos}px</span>
          </div>
        )
      )}
    </div>
  );
};

export default RulerGuidesOverlay;
