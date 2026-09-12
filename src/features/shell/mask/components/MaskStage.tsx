import React, { type RefObject } from 'react';
import { Loader2 } from 'lucide-react';
import type { InpaintLayer, PhotoshopBlendMode } from '../../components/LayersPanel';
import type { LayerVisibility, MaskTool, ShapeSubTool, DrawSubTool } from '../types';
import { MaskCompareView } from './MaskCompareView';
import { hexToRgba } from '../utils/maskBitmapUtils';

export interface MaskStageProps {
  panOffset: { x: number; y: number };
  zoomScale: number;
  isSoloAlphaMode: boolean;
  resolvedImage: string | null;
  isComparing: boolean;
  resolvedBaseImage: string | null;
  baseOriginalImage: string | null;
  layerVisibility: LayerVisibility;
  baseImageOpacity: number;
  setImgMeta: (meta: { w: number; h: number }) => void;
  inpaintLayers: InpaintLayer[];
  splitCompareMode: boolean;
  splitPosition: number;
  setIsDraggingSplit: (dragging: boolean) => void;
  drawingCanvasRef: RefObject<HTMLCanvasElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  isGenActive: boolean;
  maskTool: MaskTool;
  isSpacebarDown: boolean;
  isPanning: boolean;
  shapeSubTool: ShapeSubTool;
  drawSubTool: DrawSubTool;
  polygonPoints: { x: number; y: number }[];
  polygonCursor: { x: number; y: number } | null;
  completePolygon: () => void;
  startDrawing: (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => void;
  draw: (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => void;
  stopDrawing: () => void;
  setShowBrushCursor: (show: boolean) => void;
  maskOverlayOpacity: number;
  maskOverlayBlendMode: PhotoshopBlendMode;
  smartHoverContour: { x: number; y: number }[] | null;
  lassoPointsRef: React.MutableRefObject<{ x: number; y: number }[]>;
  shapeStart: { x: number; y: number } | null;
  shapeCurrent: { x: number; y: number } | null;
  brushColor: string;
  maskOpacity: number;
  brushSize: number;
  showBrushCursor: boolean;
  cursorPos: { x: number; y: number } | null;
  brushHardness: number;
}

export const MaskStage: React.FC<MaskStageProps> = ({
  panOffset,
  zoomScale,
  isSoloAlphaMode,
  resolvedImage,
  isComparing,
  resolvedBaseImage,
  baseOriginalImage,
  layerVisibility,
  baseImageOpacity,
  setImgMeta,
  inpaintLayers,
  splitCompareMode,
  splitPosition,
  setIsDraggingSplit,
  drawingCanvasRef,
  canvasRef,
  isGenActive,
  maskTool,
  isSpacebarDown,
  isPanning,
  shapeSubTool,
  drawSubTool,
  polygonPoints,
  polygonCursor,
  completePolygon,
  startDrawing,
  draw,
  stopDrawing,
  setShowBrushCursor,
  maskOverlayOpacity,
  maskOverlayBlendMode,
  smartHoverContour,
  lassoPointsRef,
  shapeStart,
  shapeCurrent,
  brushColor,
  maskOpacity,
  brushSize,
  showBrushCursor,
  cursorPos,
  brushHardness,
}) => {
  const isDrawingInteractionActive = maskTool !== 'crop' && maskTool !== 'arrow' && !isSpacebarDown && maskTool !== 'hand';

  return (
    <div
      className="mask-canvas-stage"
      style={{
        transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`,
        transformOrigin: 'center center',
        backgroundColor: isSoloAlphaMode ? '#000000' : undefined,
        isolation: 'isolate',
      }}
    >
      {/* 1. Base Original Image */}
      {resolvedImage ? (
        <img
          src={isComparing ? (resolvedBaseImage || baseOriginalImage || resolvedImage) : resolvedImage}
          alt="Base"
          className="mask-canvas-base-image"
          style={{
            opacity: isSoloAlphaMode ? 0.06 : (layerVisibility.image ? (baseImageOpacity / 100) : 0),
            pointerEvents: 'none',
          }}
          onLoad={(e) => setImgMeta({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
        />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', minHeight: 280, color: 'rgba(255,255,255,0.4)' }}>
          <Loader2 size={28} className="spin" style={{ color: '#e11d48' }} />
        </div>
      )}

      {/* 2. Photoshop Multi-layer Stack with Real CSS Blend Modes & Opacity */}
      {!isComparing && !isSoloAlphaMode && inpaintLayers.slice().reverse().map((layer) => (
        layer.visible && layer.image && (
          <img
            key={layer.id}
            data-layer-id={layer.id}
            src={layer.image}
            alt={layer.name}
            className="mask-canvas-inpaint-layer"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              pointerEvents: 'none',
              opacity: (layer.opacity ?? 100) / 100,
              mixBlendMode: (layer.blendMode as any) || 'normal',
              maskImage: layer.maskDataUrl ? `url(${layer.maskDataUrl})` : undefined,
              WebkitMaskImage: layer.maskDataUrl ? `url(${layer.maskDataUrl})` : undefined,
              maskSize: 'contain',
              WebkitMaskSize: 'contain',
              maskRepeat: 'no-repeat',
              WebkitMaskRepeat: 'no-repeat',
              zIndex: 2,
              clipPath: splitCompareMode ? `polygon(${splitPosition}% 0, 100% 0, 100% 100%, ${splitPosition}% 100%)` : undefined,
            }}
          />
        )
      ))}

      {/* 3. Visual Ink / Drawing Layer Canvas */}
      <canvas
        ref={drawingCanvasRef}
        className="mask-canvas-drawing-layer"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          zIndex: 3,
          opacity: isComparing || isSoloAlphaMode ? 0 : 1,
          clipPath: splitCompareMode ? `polygon(${splitPosition}% 0, 100% 0, 100% 100%, ${splitPosition}% 100%)` : undefined,
        }}
      />

      {/* 4. Inpaint Mask Canvas */}
      <canvas
        ref={canvasRef}
        className={`mask-canvas-draw ${isGenActive ? 'mask-pulsing' : ''}`}
        onMouseDown={isDrawingInteractionActive ? startDrawing : undefined}
        onMouseMove={isDrawingInteractionActive ? draw : undefined}
        onMouseUp={maskTool !== 'crop' && maskTool !== 'arrow' ? stopDrawing : undefined}
        onTouchStart={isDrawingInteractionActive ? startDrawing : undefined}
        onTouchMove={isDrawingInteractionActive ? draw : undefined}
        onTouchEnd={maskTool !== 'crop' && maskTool !== 'arrow' ? stopDrawing : undefined}
        onDoubleClick={maskTool === 'lasso' && shapeSubTool === 'polygon' && polygonPoints.length >= 3 ? completePolygon : undefined}
        onMouseLeave={
          maskTool !== 'crop' && maskTool !== 'arrow'
            ? () => {
                stopDrawing();
                setShowBrushCursor(false);
              }
            : undefined
        }
        onMouseEnter={isDrawingInteractionActive ? () => setShowBrushCursor(true) : undefined}
        style={{
          cursor: isSpacebarDown || isPanning || maskTool === 'hand' ? 'grab' : (maskTool === 'select' ? 'default' : 'crosshair'),
          pointerEvents: isSpacebarDown || isPanning || maskTool === 'hand' || maskTool === 'crop' || maskTool === 'arrow' || maskTool === 'select' || !layerVisibility.selection || isComparing ? 'none' : 'all',
          opacity: isComparing ? 0 : (layerVisibility.selection ? maskOverlayOpacity : 0),
          mixBlendMode: (maskOverlayBlendMode as any) || 'normal',
          filter: isSoloAlphaMode ? 'grayscale(100%) brightness(300%) contrast(500%)' : undefined,
          zIndex: isSoloAlphaMode ? 12 : 10,
          clipPath: splitCompareMode ? `polygon(${splitPosition}% 0, 100% 0, 100% 100%, ${splitPosition}% 100%)` : undefined,
        }}
      />

      {/* Interactive Split Screen Curtain Divider & Badges */}
      {splitCompareMode && (
        <MaskCompareView
          splitPosition={splitPosition}
          onStartDrag={(e) => {
            e.stopPropagation();
            setIsDraggingSplit(true);
          }}
        />
      )}

      {/* Smart Auto-Segmentation (SAM) Hover Contour Laser Outline */}
      {maskTool === 'smart_select' && smartHoverContour && smartHoverContour.length > 2 && (
        <svg
          className="mask-smart-contour-overlay"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 23,
          }}
          viewBox={`0 0 ${canvasRef.current?.width ?? 100} ${canvasRef.current?.height ?? 100}`}
        >
          <polygon
            points={smartHoverContour.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="rgba(16, 185, 129, 0.22)"
            stroke="#10b981"
            strokeWidth="2"
            strokeDasharray="4 3"
            style={{
              filter: 'drop-shadow(0 0 6px #10b981)',
              animation: 'dashMove 1s linear infinite',
            }}
          />
        </svg>
      )}

      {/* Active Polygonal Lasso Laser Drafting Preview Overlay */}
      {maskTool === 'lasso' && shapeSubTool === 'polygon' && polygonPoints.length > 0 && (
        <svg
          className="mask-polygon-preview-svg"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 22,
          }}
          viewBox={`0 0 ${canvasRef.current?.width ?? 100} ${canvasRef.current?.height ?? 100}`}
        >
          <polygon
            points={[
              ...polygonPoints.map(p => `${p.x},${p.y}`),
              ...(polygonCursor ? [`${polygonCursor.x},${polygonCursor.y}`] : [])
            ].join(' ')}
            fill="rgba(225, 29, 72, 0.22)"
            stroke="#e11d48"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />

          {polygonCursor && polygonPoints.length > 0 && (
            <line
              x1={polygonPoints[polygonPoints.length - 1].x}
              y1={polygonPoints[polygonPoints.length - 1].y}
              x2={polygonCursor.x}
              y2={polygonCursor.y}
              stroke="#38bdf8"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
          )}

          {polygonPoints.map((pt, idx) => (
            <g key={idx}>
              {idx === 0 ? (
                <g>
                  <circle cx={pt.x} cy={pt.y} r={7} fill="#10b981" stroke="#ffffff" strokeWidth="2" />
                  <circle cx={pt.x} cy={pt.y} r={14} fill="none" stroke="#10b981" strokeWidth="1.5" strokeDasharray="3 2" opacity="0.8" />
                  <text x={pt.x + 14} y={pt.y + 4} fill="#10b981" fontSize="10.5" fontWeight="bold" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
                    Click or Enter to Close
                  </text>
                </g>
              ) : (
                <circle cx={pt.x} cy={pt.y} r={4.5} fill="#e11d48" stroke="#ffffff" strokeWidth="1.5" />
              )}
            </g>
          ))}
        </svg>
      )}

      {/* Shape Preview SVG */}
      {((maskTool === 'lasso' && shapeSubTool !== 'polygon') || (maskTool === 'brush' && (drawSubTool === 'rect' || drawSubTool === 'circle' || drawSubTool === 'line'))) && (
        <svg
          className={`mask-shape-preview-svg ${isGenActive ? 'mask-pulsing' : ''}`}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 15,
          }}
          viewBox={`0 0 ${canvasRef.current?.width ?? 100} ${canvasRef.current?.height ?? 100}`}
        >
          {maskTool === 'lasso' && shapeSubTool === 'freehand' && lassoPointsRef.current.length > 1 && (
            <polygon
              points={lassoPointsRef.current.map((p) => `${p.x},${p.y}`).join(' ')}
              fill={hexToRgba(brushColor, Math.min(0.45, maskOpacity))}
              stroke={brushColor}
              strokeWidth="2"
              strokeDasharray="5 5"
            />
          )}
          {((maskTool === 'lasso' && shapeSubTool === 'rectangle') || (maskTool === 'brush' && drawSubTool === 'rect')) && shapeStart && shapeCurrent && (
            <rect
              x={Math.min(shapeStart.x, shapeCurrent.x)}
              y={Math.min(shapeStart.y, shapeCurrent.y)}
              width={Math.abs(shapeCurrent.x - shapeStart.x)}
              height={Math.abs(shapeCurrent.y - shapeStart.y)}
              fill={hexToRgba(brushColor, Math.min(0.45, maskOpacity))}
              stroke={brushColor}
              strokeWidth="2"
              strokeDasharray="5 5"
            />
          )}
          {((maskTool === 'lasso' && shapeSubTool === 'circle') || (maskTool === 'brush' && drawSubTool === 'circle')) && shapeStart && shapeCurrent && (
            <ellipse
              cx={(shapeStart.x + shapeCurrent.x) / 2}
              cy={(shapeStart.y + shapeCurrent.y) / 2}
              rx={Math.abs(shapeCurrent.x - shapeStart.x) / 2}
              ry={Math.abs(shapeCurrent.y - shapeStart.y) / 2}
              fill={hexToRgba(brushColor, Math.min(0.45, maskOpacity))}
              stroke={brushColor}
              strokeWidth="2"
              strokeDasharray="5 5"
            />
          )}
          {maskTool === 'brush' && drawSubTool === 'line' && shapeStart && shapeCurrent && (
            <line
              x1={shapeStart.x}
              y1={shapeStart.y}
              x2={shapeCurrent.x}
              y2={shapeCurrent.y}
              stroke={brushColor}
              strokeWidth={brushSize}
              strokeLinecap="round"
              opacity={maskOpacity}
            />
          )}
        </svg>
      )}

      {/* 5. Precision Dynamic Feather & Softness Circular Brush Cursor */}
      {showBrushCursor && !isSpacebarDown && !isPanning && maskTool !== 'hand' && ((maskTool === 'brush' && (drawSubTool === 'brush' || drawSubTool === 'line')) || maskTool === 'eraser') && cursorPos && (() => {
        const isEraser = maskTool === 'eraser';
        const innerRatio = Math.max(0.06, brushHardness / 100);
        const innerCoreDiameter = Math.max(4, Math.round(brushSize * innerRatio));
        const primaryColor = isEraser ? 'rgba(245, 158, 11, 0.45)' : hexToRgba(brushColor, 0.48);
        const midColor = isEraser ? 'rgba(245, 158, 11, 0.28)' : hexToRgba(brushColor, 0.32);
        const transparentEdge = isEraser ? 'rgba(245, 158, 11, 0)' : hexToRgba(brushColor, 0);

        const dynamicBackground = brushHardness < 98
          ? `radial-gradient(circle at center, ${primaryColor} 0%, ${midColor} ${Math.round(brushHardness * 0.85)}%, ${transparentEdge} 100%)`
          : (isEraser ? 'rgba(245, 158, 11, 0.22)' : hexToRgba(brushColor, 0.26));

        return (
          <div
            className={`mask-canvas-cursor ${isEraser ? 'mask-eraser-cursor' : ''}`}
            style={{
              left: cursorPos.x,
              top: cursorPos.y,
              width: brushSize,
              height: brushSize,
              transform: 'translate(-50%, -50%)',
              position: 'absolute',
              pointerEvents: 'none',
              zIndex: 25,
              borderColor: isEraser ? '#f59e0b' : '#ffffff',
              background: dynamicBackground,
            }}
          >
            {brushHardness < 98 && (
              <div
                className="mask-cursor-inner-core"
                style={{
                  width: innerCoreDiameter,
                  height: innerCoreDiameter,
                  borderColor: isEraser ? 'rgba(245, 158, 11, 0.8)' : 'rgba(255, 255, 255, 0.75)',
                }}
              />
            )}
            <div className="mask-cursor-center-dot" />
            <div className="mask-cursor-hud-badge">
              <span>Ø {Math.round(brushSize)}px • {brushHardness}%</span>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
