import React from 'react';

interface CropOverlayProps {
  cropRect: { x: number; y: number; w: number; h: number };
  setCropRect: React.Dispatch<React.SetStateAction<{ x: number; y: number; w: number; h: number } | null>>;
  isDraggingCrop: string | null;
  setIsDraggingCrop: (type: string | null) => void;
  dragStartRef: React.MutableRefObject<{
    mouseX: number;
    mouseY: number;
    rect: { x: number; y: number; w: number; h: number };
  }>;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export const CropOverlay: React.FC<CropOverlayProps> = ({
  cropRect,
  setCropRect,
  isDraggingCrop,
  setIsDraggingCrop,
  dragStartRef,
  containerRef,
}) => {
  return (
    <div
      className="crop-overlay-container"
      style={{ zIndex: 10003 }}
      onMouseMove={(e) => {
        if (!isDraggingCrop || !containerRef.current) return;
        const dx = e.clientX - dragStartRef.current.mouseX;
        const dy = e.clientY - dragStartRef.current.mouseY;
        const r = dragStartRef.current.rect;

        if (isDraggingCrop === 'move') {
          setCropRect({
            ...r,
            x: Math.max(0, r.x + dx),
            y: Math.max(0, r.y + dy),
          });
        } else if (isDraggingCrop === 'br') {
          setCropRect({
            ...r,
            w: Math.max(40, r.w + dx),
            h: Math.max(40, r.h + dy),
          });
        } else if (isDraggingCrop === 'r') {
          setCropRect({
            ...r,
            w: Math.max(40, r.w + dx),
          });
        } else if (isDraggingCrop === 'b') {
          setCropRect({
            ...r,
            h: Math.max(40, r.h + dy),
          });
        }
      }}
      onMouseUp={() => setIsDraggingCrop(null)}
    >
      {/* Crop Box with third lines & handles */}
      <div
        className="crop-box"
        style={{
          left: cropRect.x,
          top: cropRect.y,
          width: cropRect.w,
          height: cropRect.h,
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          dragStartRef.current = {
            mouseX: e.clientX,
            mouseY: e.clientY,
            rect: { ...cropRect },
          };
          setIsDraggingCrop('move');
        }}
      >
        <div className="crop-grid-line-h1" />
        <div className="crop-grid-line-h2" />
        <div className="crop-grid-line-v1" />
        <div className="crop-grid-line-v2" />

        {/* Corner & edge handles */}
        <div className="crop-handle tl" />
        <div className="crop-handle tr" />
        <div className="crop-handle bl" />
        <div
          className="crop-handle br"
          onMouseDown={(e) => {
            e.stopPropagation();
            dragStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, rect: { ...cropRect } };
            setIsDraggingCrop('br');
          }}
        />
        <div
          className="crop-handle r"
          onMouseDown={(e) => {
            e.stopPropagation();
            dragStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, rect: { ...cropRect } };
            setIsDraggingCrop('r');
          }}
        />
        <div
          className="crop-handle b"
          onMouseDown={(e) => {
            e.stopPropagation();
            dragStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, rect: { ...cropRect } };
            setIsDraggingCrop('b');
          }}
        />
      </div>
    </div>
  );
};
