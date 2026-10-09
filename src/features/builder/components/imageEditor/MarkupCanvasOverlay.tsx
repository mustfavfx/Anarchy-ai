import React, { useState, useRef, useEffect, useCallback } from 'react';
import type {
  MarkupToolType,
  MarkupShapeType,
  MarkupElement,
  MarkupPoint,
} from './types';

interface MarkupCanvasOverlayProps {
  imageElementRef: React.RefObject<HTMLImageElement | null>;
  activeSubtool: MarkupToolType;
  activeShape: MarkupShapeType;
  activeColor: string;
  strokeWidth: number; // Controlled by left vertical slider
  elements: MarkupElement[];
  onElementsChange: (newElements: MarkupElement[]) => void;
  selectedElementId: string | null;
  onSelectElementId: (id: string | null) => void;
  overlaySvgRef: React.RefObject<SVGSVGElement | null>;
}

type ResizeHandleType = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export const MarkupCanvasOverlay: React.FC<MarkupCanvasOverlayProps> = ({
  imageElementRef,
  activeSubtool,
  activeShape,
  activeColor,
  strokeWidth,
  elements,
  onElementsChange,
  selectedElementId,
  onSelectElementId,
  overlaySvgRef,
}) => {
  // Dimensions synced to image
  const [dimensions, setDimensions] = useState<{ width: number; height: number; left: number; top: number }>({
    width: 0,
    height: 0,
    left: 0,
    top: 0,
  });

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<MarkupPoint | null>(null);
  const [currentPathPoints, setCurrentPathPoints] = useState<MarkupPoint[]>([]);
  const [previewShape, setPreviewShape] = useState<MarkupElement | null>(null);

  // Dragging / Resizing an existing selected element
  const [isMovingElement, setIsMovingElement] = useState(false);
  const [activeResizeHandle, setActiveResizeHandle] = useState<ResizeHandleType | null>(null);
  const dragStartPos = useRef<MarkupPoint>({ x: 0, y: 0 });
  const initialElementState = useRef<MarkupElement | null>(null);

  // Inline text editing
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingTextVal, setEditingTextVal] = useState<string>('');

  // Sync SVG overlay bounds with the HTMLImageElement
  const syncBounds = useCallback(() => {
    const img = imageElementRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    setDimensions({
      width: rect.width,
      height: rect.height,
      left: rect.left,
      top: rect.top,
    });
  }, [imageElementRef]);

  useEffect(() => {
    syncBounds();
    window.addEventListener('resize', syncBounds);
    return () => window.removeEventListener('resize', syncBounds);
  }, [syncBounds]);

  // Keep updating bounds periodically if image loads asynchronously
  useEffect(() => {
    const interval = setInterval(syncBounds, 300);
    return () => clearInterval(interval);
  }, [syncBounds]);

  // Delete element on keyboard Backspace / Delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElementId && !editingTextId) {
        onElementsChange(elements.filter((el) => el.id !== selectedElementId));
        onSelectElementId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementId, editingTextId, elements, onElementsChange, onSelectElementId]);

  // Convert mouse client coordinates to relative SVG coordinates
  const getSvgCoords = (e: React.MouseEvent): MarkupPoint => {
    const svg = overlaySvgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  // Helper: compute bounding box of points
  const computePointsBBox = (pts: MarkupPoint[]) => {
    if (pts.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    let minX = pts[0].x, maxX = pts[0].x, minY = pts[0].y, maxY = pts[0].y;
    pts.forEach((p) => {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    });
    return {
      x: minX,
      y: minY,
      width: Math.max(8, maxX - minX),
      height: Math.max(8, maxY - minY),
    };
  };

  // ── MOUSE DOWN ──
  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    const pt = getSvgCoords(e);

    // If editing text and clicked outside, commit text
    if (editingTextId) {
      if (editingTextVal.trim()) {
        onElementsChange(
          elements.map((el) => (el.id === editingTextId ? { ...el, text: editingTextVal } : el))
        );
      } else {
        onElementsChange(elements.filter((el) => el.id !== editingTextId));
      }
      setEditingTextId(null);
    }

    // 1. SELECT MODE
    if (activeSubtool === 'select') {
      // Check if clicking on an element handle (handled in handleResizeHandleMouseDown)
      // If clicking on empty canvas, deselect
      onSelectElementId(null);
      return;
    }

    // 2. ERASER MODE
    if (activeSubtool === 'eraser') {
      // Handled directly on element click/move
      return;
    }

    // 3. BRUSH MODE
    if (activeSubtool === 'brush') {
      setIsDrawing(true);
      setDrawStart(pt);
      setCurrentPathPoints([pt]);
      return;
    }

    // 4. SHAPE MODE
    if (activeSubtool === 'shape') {
      setIsDrawing(true);
      setDrawStart(pt);
      setPreviewShape({
        id: `shape_${Date.now()}`,
        type: 'shape',
        shapeType: activeShape,
        color: activeColor,
        strokeWidth: strokeWidth,
        x: pt.x,
        y: pt.y,
        width: 1,
        height: 1,
      });
      return;
    }

    // 5. TEXT MODE
    if (activeSubtool === 'text') {
      const newId = `text_${Date.now()}`;
      const newTextEl: MarkupElement = {
        id: newId,
        type: 'text',
        color: activeColor,
        strokeWidth: 2,
        x: pt.x,
        y: pt.y,
        width: 120,
        height: 36,
        text: 'Annotation',
        fontSize: Math.max(16, strokeWidth * 2),
      };
      onElementsChange([...elements, newTextEl]);
      onSelectElementId(newId);
      setEditingTextId(newId);
      setEditingTextVal('Annotation');
      return;
    }
  };

  // ── MOUSE MOVE ──
  const handleMouseMove = (e: React.MouseEvent) => {
    const pt = getSvgCoords(e);

    // 1. Moving an element
    if (isMovingElement && initialElementState.current && selectedElementId) {
      const deltaX = pt.x - dragStartPos.current.x;
      const deltaY = pt.y - dragStartPos.current.y;

      const init = initialElementState.current;
      const newX = init.x + deltaX;
      const newY = init.y + deltaY;

      onElementsChange(
        elements.map((el) => {
          if (el.id !== selectedElementId) return el;
          if (el.type === 'path' && el.points) {
            const shiftX = newX - init.x;
            const shiftY = newY - init.y;
            return {
              ...el,
              x: newX,
              y: newY,
              points: init.points?.map((p) => ({ x: p.x + shiftX, y: p.y + shiftY })),
            };
          }
          return { ...el, x: newX, y: newY };
        })
      );
      return;
    }

    // 2. Resizing an element via 8 handles
    if (activeResizeHandle && initialElementState.current && selectedElementId) {
      const init = initialElementState.current;
      const deltaX = pt.x - dragStartPos.current.x;
      const deltaY = pt.y - dragStartPos.current.y;

      let newX = init.x;
      let newY = init.y;
      let newW = init.width;
      let newH = init.height;

      switch (activeResizeHandle) {
        case 'se':
          newW = Math.max(10, init.width + deltaX);
          newH = Math.max(10, init.height + deltaY);
          break;
        case 'e':
          newW = Math.max(10, init.width + deltaX);
          break;
        case 's':
          newH = Math.max(10, init.height + deltaY);
          break;
        case 'sw':
          newX = init.x + deltaX;
          newW = Math.max(10, init.width - deltaX);
          newH = Math.max(10, init.height + deltaY);
          break;
        case 'w':
          newX = init.x + deltaX;
          newW = Math.max(10, init.width - deltaX);
          break;
        case 'ne':
          newY = init.y + deltaY;
          newW = Math.max(10, init.width + deltaX);
          newH = Math.max(10, init.height - deltaY);
          break;
        case 'n':
          newY = init.y + deltaY;
          newH = Math.max(10, init.height - deltaY);
          break;
        case 'nw':
          newX = init.x + deltaX;
          newY = init.y + deltaY;
          newW = Math.max(10, init.width - deltaX);
          newH = Math.max(10, init.height - deltaY);
          break;
      }

      onElementsChange(
        elements.map((el) => {
          if (el.id !== selectedElementId) return el;
          if (el.type === 'text') {
            const fontScale = newH / init.height;
            return {
              ...el,
              x: newX,
              y: newY,
              width: newW,
              height: newH,
              fontSize: Math.round(Math.max(12, (init.fontSize || 20) * fontScale)),
            };
          }
          if (el.type === 'path' && el.points && init.points) {
            const scaleX = newW / init.width;
            const scaleY = newH / init.height;
            return {
              ...el,
              x: newX,
              y: newY,
              width: newW,
              height: newH,
              points: init.points.map((p) => ({
                x: newX + (p.x - init.x) * scaleX,
                y: newY + (p.y - init.y) * scaleY,
              })),
            };
          }
          return {
            ...el,
            x: newX,
            y: newY,
            width: newW,
            height: newH,
          };
        })
      );
      return;
    }

    if (!isDrawing) return;

    // 3. Freehand brush move
    if (activeSubtool === 'brush') {
      setCurrentPathPoints((prev) => [...prev, pt]);
      return;
    }

    // 4. Shape preview move
    if (activeSubtool === 'shape' && drawStart) {
      const minX = Math.min(drawStart.x, pt.x);
      const minY = Math.min(drawStart.y, pt.y);
      const width = Math.max(4, Math.abs(pt.x - drawStart.x));
      const height = Math.max(4, Math.abs(pt.y - drawStart.y));

      setPreviewShape({
        id: `shape_${Date.now()}`,
        type: 'shape',
        shapeType: activeShape,
        color: activeColor,
        strokeWidth: strokeWidth,
        x: activeShape === 'line' || activeShape === 'arrow' ? drawStart.x : minX,
        y: activeShape === 'line' || activeShape === 'arrow' ? drawStart.y : minY,
        width: activeShape === 'line' || activeShape === 'arrow' ? pt.x - drawStart.x : width,
        height: activeShape === 'line' || activeShape === 'arrow' ? pt.y - drawStart.y : height,
      });
    }
  };

  // ── MOUSE UP ──
  const handleMouseUp = () => {
    if (isMovingElement) {
      setIsMovingElement(false);
      initialElementState.current = null;
    }

    if (activeResizeHandle) {
      setActiveResizeHandle(null);
      initialElementState.current = null;
    }

    if (!isDrawing) return;
    setIsDrawing(false);

    // Commit Freehand Brush stroke
    if (activeSubtool === 'brush' && currentPathPoints.length > 1) {
      const bbox = computePointsBBox(currentPathPoints);
      const newEl: MarkupElement = {
        id: `path_${Date.now()}`,
        type: 'path',
        color: activeColor,
        strokeWidth: strokeWidth,
        points: currentPathPoints,
        x: bbox.x,
        y: bbox.y,
        width: bbox.width,
        height: bbox.height,
      };
      onElementsChange([...elements, newEl]);
      setCurrentPathPoints([]);
    }

    // Commit Geometric Shape
    if (activeSubtool === 'shape' && previewShape) {
      onElementsChange([...elements, previewShape]);
      onSelectElementId(previewShape.id);
      setPreviewShape(null);
    }

    setDrawStart(null);
  };

  // ── Element Click / Selection Handler ──
  const handleElementMouseDown = (e: React.MouseEvent, el: MarkupElement) => {
    e.stopPropagation();

    // Eraser removes element on click
    if (activeSubtool === 'eraser') {
      onElementsChange(elements.filter((item) => item.id !== el.id));
      if (selectedElementId === el.id) onSelectElementId(null);
      return;
    }

    // Select mode allows moving the element
    if (activeSubtool === 'select') {
      onSelectElementId(el.id);
      setIsMovingElement(true);
      dragStartPos.current = getSvgCoords(e);
      initialElementState.current = { ...el };
    }
  };

  // ── 8 Resize Handles Mouse Down ──
  const handleResizeHandleMouseDown = (e: React.MouseEvent, handle: ResizeHandleType) => {
    e.stopPropagation();
    e.preventDefault();
    const selEl = elements.find((item) => item.id === selectedElementId);
    if (!selEl) return;

    setActiveResizeHandle(handle);
    dragStartPos.current = getSvgCoords(e);
    initialElementState.current = { ...selEl };
  };

  // ── Render Shape Path / Geometry ──
  const renderShapeElement = (el: MarkupElement) => {
    const { shapeType, color, strokeWidth: sw, x, y, width: w, height: h } = el;

    switch (shapeType) {
      case 'line':
        return (
          <line
            x1={x}
            y1={y}
            x2={x + w}
            y2={y + h}
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        );

      case 'arrow': {
        const x2 = x + w;
        const y2 = y + h;
        const angle = Math.atan2(y2 - y, x2 - x);
        const headLength = Math.max(12, sw * 2.5);
        const arrowP1X = x2 - headLength * Math.cos(angle - Math.PI / 6);
        const arrowP1Y = y2 - headLength * Math.sin(angle - Math.PI / 6);
        const arrowP2X = x2 - headLength * Math.cos(angle + Math.PI / 6);
        const arrowP2Y = y2 - headLength * Math.sin(angle + Math.PI / 6);

        return (
          <g>
            <line x1={x} y1={y} x2={x2} y2={y2} stroke={color} strokeWidth={sw} strokeLinecap="round" />
            <polygon
              points={`${x2},${y2} ${arrowP1X},${arrowP1Y} ${arrowP2X},${arrowP2Y}`}
              fill={color}
            />
          </g>
        );
      }

      case 'rect':
        return (
          <rect
            x={x}
            y={y}
            width={Math.max(1, w)}
            height={Math.max(1, h)}
            rx="6"
            stroke={color}
            strokeWidth={sw}
            fill="none"
          />
        );

      case 'circle':
        return (
          <ellipse
            cx={x + w / 2}
            cy={y + h / 2}
            rx={Math.max(1, w / 2)}
            ry={Math.max(1, h / 2)}
            stroke={color}
            strokeWidth={sw}
            fill="none"
          />
        );

      case 'triangle':
        return (
          <polygon
            points={`${x + w / 2},${y} ${x},${y + h} ${x + w},${y + h}`}
            stroke={color}
            strokeWidth={sw}
            fill="none"
            strokeLinejoin="round"
          />
        );

      case 'diamond':
        return (
          <polygon
            points={`${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${y + h} ${x},${y + h / 2}`}
            stroke={color}
            strokeWidth={sw}
            fill="none"
            strokeLinejoin="round"
          />
        );

      case 'star': {
        const cx = x + w / 2;
        const cy = y + h / 2;
        const outerR = Math.min(w, h) / 2;
        const innerR = outerR * 0.44;
        const pts: string[] = [];
        for (let i = 0; i < 10; i++) {
          const r = i % 2 === 0 ? outerR : innerR;
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
        }
        return (
          <polygon
            points={pts.join(' ')}
            stroke={color}
            strokeWidth={sw}
            fill="none"
            strokeLinejoin="round"
          />
        );
      }

      case 'heart': {
        const cx = x + w / 2;
        const cy = y + h / 2;
        const scale = Math.min(w, h) / 28;
        return (
          <path
            d="M 12 21.35 l -1.45 -1.32 C 5.4 15.36 2 12.28 2 8.5 C 2 5.42 4.42 3 7.5 3 c 1.74 0 3.41 0.81 4.5 2.09 C 13.09 3.81 14.76 3 16.5 3 C 19.58 3 22 5.42 22 8.5 c 0 3.78 -3.4 6.86 -8.55 11.54 L 12 21.35 z"
            transform={`translate(${cx - 12 * scale}, ${cy - 12 * scale}) scale(${scale})`}
            stroke={color}
            strokeWidth={Math.max(1, sw / scale)}
            fill="none"
            strokeLinejoin="round"
          />
        );
      }

      default:
        return null;
    }
  };

  const selectedEl = elements.find((item) => item.id === selectedElementId);

  return (
    <div
      className="markup-canvas-overlay-wrapper"
      style={{
        width: dimensions.width || '100%',
        height: dimensions.height || '100%',
      }}
    >
      <svg
        ref={overlaySvgRef}
        className={`markup-svg-layer ${
          activeSubtool === 'brush'
            ? 'cursor-brush'
            : activeSubtool === 'select'
            ? 'cursor-select'
            : activeSubtool === 'eraser'
            ? 'cursor-eraser'
            : activeSubtool === 'text'
            ? 'cursor-text'
            : 'cursor-crosshair'
        }`}
        width={dimensions.width || '100%'}
        height={dimensions.height || '100%'}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {/* Render Saved Elements */}
        {elements.map((el) => {
          if (el.type === 'path' && el.points) {
            const d = el.points.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '');
            return (
              <path
                key={el.id}
                d={d}
                stroke={el.color}
                strokeWidth={el.strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                style={{ cursor: activeSubtool === 'select' ? 'move' : activeSubtool === 'eraser' ? 'pointer' : 'default' }}
                onMouseDown={(e) => handleElementMouseDown(e, el)}
              />
            );
          }

          if (el.type === 'shape') {
            return (
              <g
                key={el.id}
                style={{ cursor: activeSubtool === 'select' ? 'move' : activeSubtool === 'eraser' ? 'pointer' : 'default' }}
                onMouseDown={(e) => handleElementMouseDown(e, el)}
              >
                {renderShapeElement(el)}
              </g>
            );
          }

          if (el.type === 'text') {
            return (
              <g
                key={el.id}
                style={{ cursor: activeSubtool === 'select' ? 'move' : activeSubtool === 'eraser' ? 'pointer' : 'default' }}
                onMouseDown={(e) => handleElementMouseDown(e, el)}
                onDoubleClick={() => {
                  setEditingTextId(el.id);
                  setEditingTextVal(el.text || '');
                }}
              >
                <text
                  x={el.x}
                  y={el.y + (el.fontSize || 20)}
                  fill={el.color}
                  fontSize={el.fontSize || 20}
                  fontWeight="700"
                  fontFamily="system-ui, -apple-system, sans-serif"
                >
                  {el.text}
                </text>
              </g>
            );
          }

          return null;
        })}

        {/* Live Freehand Brush Preview while drawing */}
        {isDrawing && activeSubtool === 'brush' && currentPathPoints.length > 1 && (
          <path
            d={currentPathPoints.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '')}
            stroke={activeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        )}

        {/* Live Shape Preview while dragging */}
        {isDrawing && activeSubtool === 'shape' && previewShape && renderShapeElement(previewShape)}

        {/* ── SELECTION BOUNDING BOX & 8 HANDLES (Screenshot 3) ── */}
        {activeSubtool === 'select' && selectedEl && (
          <g className="markup-selection-box-group">
            {/* Dashed Blue Outline */}
            <rect
              x={selectedEl.x - 4}
              y={selectedEl.y - 4}
              width={Math.max(12, selectedEl.width + 8)}
              height={Math.max(12, selectedEl.height + 8)}
              fill="none"
              stroke="#2563eb"
              strokeWidth="2"
              strokeDasharray="5,5"
              pointerEvents="none"
            />

            {/* 8 Square White Handles with Blue Border */}
            {(
              [
                { id: 'nw', x: selectedEl.x - 8, y: selectedEl.y - 8, cursor: 'nwse-resize' },
                { id: 'n', x: selectedEl.x + selectedEl.width / 2 - 4, y: selectedEl.y - 8, cursor: 'ns-resize' },
                { id: 'ne', x: selectedEl.x + selectedEl.width, y: selectedEl.y - 8, cursor: 'nesw-resize' },
                { id: 'e', x: selectedEl.x + selectedEl.width, y: selectedEl.y + selectedEl.height / 2 - 4, cursor: 'ew-resize' },
                { id: 'se', x: selectedEl.x + selectedEl.width, y: selectedEl.y + selectedEl.height, cursor: 'nwse-resize' },
                { id: 's', x: selectedEl.x + selectedEl.width / 2 - 4, y: selectedEl.y + selectedEl.height, cursor: 'ns-resize' },
                { id: 'sw', x: selectedEl.x - 8, y: selectedEl.y + selectedEl.height, cursor: 'nesw-resize' },
                { id: 'w', x: selectedEl.x - 8, y: selectedEl.y + selectedEl.height / 2 - 4, cursor: 'ew-resize' },
              ] as const
            ).map((h) => (
              <rect
                key={h.id}
                x={h.x}
                y={h.y}
                width="8"
                height="8"
                fill="#ffffff"
                stroke="#2563eb"
                strokeWidth="2"
                style={{ cursor: h.cursor }}
                onMouseDown={(e) => handleResizeHandleMouseDown(e, h.id)}
              />
            ))}
          </g>
        )}
      </svg>

      {/* Inline Text Editor Overlay when editing text */}
      {editingTextId && selectedEl && selectedEl.type === 'text' && (
        <input
          type="text"
          className="markup-inline-text-editor"
          style={{
            position: 'absolute',
            left: `${selectedEl.x}px`,
            top: `${selectedEl.y}px`,
            color: selectedEl.color,
            fontSize: `${selectedEl.fontSize || 20}px`,
          }}
          autoFocus
          value={editingTextVal}
          onChange={(e) => setEditingTextVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (editingTextVal.trim()) {
                onElementsChange(
                  elements.map((el) => (el.id === editingTextId ? { ...el, text: editingTextVal } : el))
                );
              }
              setEditingTextId(null);
            }
          }}
        />
      )}
    </div>
  );
};
