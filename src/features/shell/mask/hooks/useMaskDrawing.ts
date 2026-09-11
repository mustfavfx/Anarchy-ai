import React, { useState, useRef, useCallback, type RefObject, type Dispatch, type SetStateAction } from 'react';
import { SmartSegmentationEngine } from '../../../../services/mask/SmartSegmentationEngine';
import { snapToOrthoAngle } from '../../components/RulerGuidesOverlay';
import { useNotificationStore } from '../../../../stores/notificationStore';
import { hexToRgba } from '../utils/maskBitmapUtils';
import type { MaskTool, ShapeSubTool, DrawSubTool, WorkspaceMode, Point } from '../types';
import type { InpaintLayer } from '../../components/LayersPanel';

export interface UseMaskDrawingParams {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  drawingCanvasRef: RefObject<HTMLCanvasElement | null>;
  wrapperRef: RefObject<HTMLDivElement | null>;
  resolvedImage: string | null;
  baseImgDataRef: React.MutableRefObject<ImageData | null>;
  maskTool: MaskTool;
  shapeSubTool: ShapeSubTool;
  drawSubTool: DrawSubTool;
  workspaceMode: WorkspaceMode;
  inkColor: string;
  brushColor: string;
  brushSize: number;
  brushHardness: number;
  maskOpacity: number;
  isAltKeyDown: boolean;
  isOrthoMode: boolean;
  isSpacebarDown: boolean;
  isPanning: boolean;
  activeLayerId: string;
  psMaskColor: 'white' | 'black';
  wandTolerance: number;
  smartHoverMask: Uint8Array | null;
  handleSmartHover: (x: number, y: number) => void;
  floodFill: (canvas: HTMLCanvasElement, x: number, y: number, color: string, opacity: number, tol: number) => Promise<boolean>;
  pushHistory: () => void;
  updateMaskPreview: () => void;
  setHasSelectionContent: Dispatch<SetStateAction<boolean>>;
  setActiveLayerId: Dispatch<SetStateAction<string>>;
  setInpaintLayers: Dispatch<SetStateAction<InpaintLayer[]>>;
}

export function useMaskDrawing(params: UseMaskDrawingParams) {
  const {
    canvasRef,
    drawingCanvasRef,
    resolvedImage,
    baseImgDataRef,
    maskTool,
    shapeSubTool,
    drawSubTool,
    workspaceMode,
    inkColor,
    brushColor,
    brushSize,
    brushHardness,
    maskOpacity,
    isAltKeyDown,
    isOrthoMode,
    isSpacebarDown,
    isPanning,
    activeLayerId,
    psMaskColor,
    wandTolerance,
    smartHoverMask,
    handleSmartHover,
    floodFill,
    pushHistory,
    updateMaskPreview,
    setHasSelectionContent,
    setActiveLayerId,
    setInpaintLayers,
  } = params;

  const [isDrawing, setIsDrawing] = useState(false);
  const [polygonPoints, setPolygonPoints] = useState<Point[]>([]);
  const [polygonCursor, setPolygonCursor] = useState<Point | null>(null);
  const [cursorPos, setCursorPos] = useState<Point | null>(null);
  const [showBrushCursor, setShowBrushCursor] = useState(false);
  const [shapeStart, setShapeStart] = useState<Point | null>(null);
  const [shapeCurrent, setShapeCurrent] = useState<Point | null>(null);

  const lastPointRef = useRef<Point | null>(null);
  const lassoPointsRef = useRef<Point[]>([]);

  const completePolygon = useCallback(() => {
    if (polygonPoints.length < 3) {
      setPolygonPoints([]);
      setPolygonCursor(null);
      return;
    }
    const targetCanvas = workspaceMode === 'draw' ? drawingCanvasRef.current : canvasRef.current;
    const ctx = targetCanvas?.getContext('2d');
    if (ctx) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = workspaceMode === 'draw' ? inkColor : hexToRgba(brushColor, maskOpacity);
      ctx.beginPath();
      ctx.moveTo(polygonPoints[0].x, polygonPoints[0].y);
      for (let i = 1; i < polygonPoints.length; i++) {
        ctx.lineTo(polygonPoints[i].x, polygonPoints[i].y);
      }
      ctx.closePath();
      ctx.fill();
      pushHistory();
      if (workspaceMode === 'mask') {
        setHasSelectionContent(true);
      }
      updateMaskPreview();
    }
    setPolygonPoints([]);
    setPolygonCursor(null);
  }, [polygonPoints, workspaceMode, inkColor, brushColor, maskOpacity, pushHistory, updateMaskPreview, drawingCanvasRef, canvasRef, setHasSelectionContent]);

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if (e.changedTouches && e.changedTouches.length > 0) {
        clientX = e.changedTouches[0].clientX;
        clientY = e.changedTouches[0].clientY;
      } else {
        return null;
      }
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const rawX = (clientX - rect.left) * scaleX;
    const rawY = (clientY - rect.top) * scaleY;
    const finalX = Math.max(0, Math.min(canvas.width, rawX));
    const finalY = Math.max(0, Math.min(canvas.height, rawY));

    return {
      x: finalX,
      y: finalY,
    };
  };

  const handleWandClick = useCallback(
    async (canvasX: number, canvasY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const filled = await floodFill(canvas, canvasX, canvasY, brushColor, maskOpacity, wandTolerance);
      if (filled) {
        setHasSelectionContent(true);
        pushHistory();
        updateMaskPreview();
      }
    },
    [floodFill, brushColor, maskOpacity, wandTolerance, pushHistory, updateMaskPreview, canvasRef, setHasSelectionContent]
  );

  const startDrawing = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      if (isSpacebarDown || isPanning || maskTool === 'hand') return;
      if (('button' in e && e.button !== 0) || maskTool === 'select' || maskTool === 'crop') return;
      const pt = getCanvasCoords(e);
      if (!pt) return;

      if (maskTool === 'wand') {
        void handleWandClick(pt.x, pt.y);
        return;
      }

      if (maskTool === 'smart_select') {
        const canvas = canvasRef.current;
        const imgData = baseImgDataRef.current;
        if (!canvas || !imgData || !resolvedImage) return;

        const isErase = isAltKeyDown || ('altKey' in e && e.altKey);

        let maskToApply = smartHoverMask;
        if (!maskToApply) {
          const naturalScaleX = imgData.width / (canvas.width || imgData.width);
          const naturalScaleY = imgData.height / (canvas.height || imgData.height);
          const res = SmartSegmentationEngine.segment(
            imgData,
            resolvedImage,
            pt.x * naturalScaleX,
            pt.y * naturalScaleY,
            wandTolerance,
            45
          );
          if (res) maskToApply = res.mask;
        }

        if (maskToApply) {
          if (canvas.width === imgData.width && canvas.height === imgData.height) {
            SmartSegmentationEngine.applyMaskToCanvas(
              canvas,
              maskToApply,
              brushColor,
              maskOpacity,
              isErase ? 'subtract' : 'add'
            );
          } else {
            const off = document.createElement('canvas');
            off.width = imgData.width;
            off.height = imgData.height;
            SmartSegmentationEngine.applyMaskToCanvas(off, maskToApply, brushColor, maskOpacity, 'replace');
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.globalCompositeOperation = isErase ? 'destination-out' : 'source-over';
              ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
            }
          }

          setHasSelectionContent(true);
          pushHistory();
          updateMaskPreview();
          useNotificationStore.getState().addNotification({
            type: 'info',
            title: 'Object Segmented',
            message: `Isolated object via SAM auto-segmentation (${isErase ? 'subtracted' : 'added'}).`,
            duration: 2000,
          });
        }
        return;
      }

      if (maskTool === 'lasso' && shapeSubTool === 'polygon') {
        if (polygonPoints.length === 0) {
          setPolygonPoints([pt]);
          setPolygonCursor(pt);
          return;
        }

        let vertexPt = pt;
        if (isOrthoMode || ('shiftKey' in e && e.shiftKey)) {
          const lastPt = polygonPoints[polygonPoints.length - 1];
          const ortho = snapToOrthoAngle(lastPt.x, lastPt.y, pt.x, pt.y, 45);
          vertexPt = { x: ortho.x, y: ortho.y };
        }

        const startPt = polygonPoints[0];
        const dist = Math.hypot(vertexPt.x - startPt.x, vertexPt.y - startPt.y);
        if (polygonPoints.length >= 3 && dist < 18) {
          completePolygon();
          return;
        }

        setPolygonPoints(prev => [...prev, vertexPt]);
        setPolygonCursor(vertexPt);
        return;
      }

      if (maskTool === 'lasso') {
        if (shapeSubTool === 'freehand') {
          lassoPointsRef.current = [pt];
        } else {
          setShapeStart(pt);
          setShapeCurrent(pt);
        }
        setIsDrawing(true);
        return;
      }

      if (maskTool === 'brush' && (drawSubTool === 'rect' || drawSubTool === 'circle' || drawSubTool === 'line')) {
        setShapeStart(pt);
        setShapeCurrent(pt);
        setIsDrawing(true);
        return;
      }

      const isErase = maskTool === 'eraser' || isAltKeyDown || ('altKey' in e && e.altKey) || (activeLayerId !== 'base' && psMaskColor === 'black');

      if ((('shiftKey' in e && e.shiftKey) || isOrthoMode) && lastPointRef.current && (maskTool === 'brush' || maskTool === 'eraser')) {
        let lineTarget = pt;
        if (isOrthoMode || ('shiftKey' in e && e.shiftKey)) {
          const ortho = snapToOrthoAngle(lastPointRef.current.x, lastPointRef.current.y, pt.x, pt.y, 45);
          lineTarget = { x: ortho.x, y: ortho.y };
        }
        const targetCanvas = workspaceMode === 'draw' ? drawingCanvasRef.current : canvasRef.current;
        const ctx = targetCanvas?.getContext('2d');
        if (ctx) {
          ctx.globalCompositeOperation = isErase ? 'destination-out' : 'source-over';
          ctx.lineWidth = brushSize;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.strokeStyle = workspaceMode === 'draw' ? inkColor : hexToRgba(brushColor, maskOpacity);

          if (brushHardness < 100) {
            ctx.shadowBlur = ((100 - brushHardness) / 100) * (brushSize * 0.45);
            ctx.shadowColor = workspaceMode === 'draw' ? inkColor : hexToRgba(brushColor, maskOpacity);
          } else {
            ctx.shadowBlur = 0;
          }

          ctx.beginPath();
          ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
          ctx.lineTo(lineTarget.x, lineTarget.y);
          ctx.stroke();
          lastPointRef.current = lineTarget;
          if (workspaceMode === 'mask') {
            setHasSelectionContent(true);
          }
          pushHistory();
          updateMaskPreview();
          return;
        }
      }

      const targetCanvas = workspaceMode === 'draw' ? drawingCanvasRef.current : canvasRef.current;
      const ctx = targetCanvas?.getContext('2d');
      if (!ctx) return;
      ctx.globalCompositeOperation = isErase ? 'destination-out' : 'source-over';

      if (brushHardness < 100) {
        ctx.shadowBlur = ((100 - brushHardness) / 100) * (brushSize * 0.45);
        ctx.shadowColor = workspaceMode === 'draw' ? inkColor : hexToRgba(brushColor, maskOpacity);
      } else {
        ctx.shadowBlur = 0;
      }

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, brushSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = workspaceMode === 'draw' ? inkColor : hexToRgba(brushColor, maskOpacity);
      ctx.fill();
      lastPointRef.current = pt;
      setIsDrawing(true);
      if (workspaceMode === 'mask') {
        setHasSelectionContent(true);
      }
    },
    [isSpacebarDown, isPanning, maskTool, shapeSubTool, drawSubTool, polygonPoints, completePolygon, brushSize, brushColor, maskOpacity, handleWandClick, workspaceMode, inkColor, isAltKeyDown, brushHardness, pushHistory, updateMaskPreview, activeLayerId, psMaskColor, canvasRef, drawingCanvasRef, baseImgDataRef, resolvedImage, smartHoverMask, wandTolerance, isOrthoMode, setHasSelectionContent]
  );

  const draw = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      const pt = getCanvasCoords(e);
      if (pt) {
        setCursorPos(pt);
        if (maskTool === 'lasso' && shapeSubTool === 'polygon' && polygonPoints.length > 0) {
          if (isOrthoMode || ('shiftKey' in e && (e as any).shiftKey)) {
            const lastPt = polygonPoints[polygonPoints.length - 1];
            const ortho = snapToOrthoAngle(lastPt.x, lastPt.y, pt.x, pt.y, 45);
            setPolygonCursor({ x: ortho.x, y: ortho.y });
          } else {
            setPolygonCursor(pt);
          }
        }
      }

      if (maskTool === 'smart_select') {
        if (pt) {
          handleSmartHover(pt.x, pt.y);
        }
        return;
      }

      if (isSpacebarDown || isPanning || maskTool === 'hand') return;
      if (maskTool === 'lasso' && shapeSubTool === 'polygon') return;
      if (!isDrawing || !pt || maskTool === 'select' || maskTool === 'crop') return;

      if (maskTool === 'lasso') {
        if (shapeSubTool === 'freehand') {
          lassoPointsRef.current.push(pt);
        } else {
          setShapeCurrent(pt);
        }
        return;
      }

      if (maskTool === 'brush' && (drawSubTool === 'rect' || drawSubTool === 'circle' || drawSubTool === 'line')) {
        let currentPt = pt;
        if (shapeStart && (isOrthoMode || ('shiftKey' in e && (e as any).shiftKey))) {
          if (drawSubTool === 'line') {
            const ortho = snapToOrthoAngle(shapeStart.x, shapeStart.y, pt.x, pt.y, 45);
            currentPt = { x: ortho.x, y: ortho.y };
          } else {
            const side = Math.max(Math.abs(pt.x - shapeStart.x), Math.abs(pt.y - shapeStart.y));
            currentPt = {
              x: shapeStart.x + Math.sign(pt.x - shapeStart.x || 1) * side,
              y: shapeStart.y + Math.sign(pt.y - shapeStart.y || 1) * side,
            };
          }
        }
        setShapeCurrent(currentPt);
        return;
      }

      const isErase = maskTool === 'eraser' || isAltKeyDown || ('altKey' in e && e.altKey) || (activeLayerId !== 'base' && psMaskColor === 'black');
      const targetCanvas = workspaceMode === 'draw' ? drawingCanvasRef.current : canvasRef.current;
      const ctx = targetCanvas?.getContext('2d');
      if (!ctx) return;
      ctx.globalCompositeOperation = isErase ? 'destination-out' : 'source-over';
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = workspaceMode === 'draw' ? inkColor : hexToRgba(brushColor, maskOpacity);

      if (brushHardness < 100) {
        ctx.shadowBlur = ((100 - brushHardness) / 100) * (brushSize * 0.45);
        ctx.shadowColor = workspaceMode === 'draw' ? inkColor : hexToRgba(brushColor, maskOpacity);
      } else {
        ctx.shadowBlur = 0;
      }

      ctx.beginPath();
      if (lastPointRef.current) {
        const midX = (lastPointRef.current.x + pt.x) / 2;
        const midY = (lastPointRef.current.y + pt.y) / 2;
        ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
        ctx.quadraticCurveTo(lastPointRef.current.x, lastPointRef.current.y, midX, midY);
        ctx.lineTo(pt.x, pt.y);
      } else {
        ctx.moveTo(pt.x, pt.y);
      }
      ctx.stroke();
      lastPointRef.current = pt;
      if (workspaceMode === 'mask') {
        setHasSelectionContent(true);
      }
    },
    [isSpacebarDown, isPanning, isDrawing, maskTool, shapeSubTool, drawSubTool, polygonPoints, brushSize, brushColor, maskOpacity, workspaceMode, inkColor, isAltKeyDown, brushHardness, activeLayerId, psMaskColor, isOrthoMode, handleSmartHover, shapeStart, drawingCanvasRef, canvasRef, setHasSelectionContent]
  );

  const stopDrawing = useCallback(() => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');

    if (canvas && ctx && maskTool === 'lasso') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = hexToRgba(brushColor, maskOpacity);
      ctx.beginPath();

      if (shapeSubTool === 'freehand' && lassoPointsRef.current.length > 2) {
        const pts = lassoPointsRef.current;
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.closePath();
        ctx.fill();
        pushHistory();
        setHasSelectionContent(true);
      } else if (shapeSubTool === 'rectangle' && shapeStart && shapeCurrent) {
        const x = Math.min(shapeStart.x, shapeCurrent.x);
        const y = Math.min(shapeStart.y, shapeCurrent.y);
        const w = Math.abs(shapeCurrent.x - shapeStart.x);
        const h = Math.abs(shapeCurrent.y - shapeStart.y);
        if (w > 2 && h > 2) {
          ctx.fillRect(x, y, w, h);
          pushHistory();
          setHasSelectionContent(true);
        }
      } else if (shapeSubTool === 'circle' && shapeStart && shapeCurrent) {
        const cx = (shapeStart.x + shapeCurrent.x) / 2;
        const cy = (shapeStart.y + shapeCurrent.y) / 2;
        const rx = Math.abs(shapeCurrent.x - shapeStart.x) / 2;
        const ry = Math.abs(shapeCurrent.y - shapeStart.y) / 2;
        if (rx > 2 && ry > 2) {
          ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
          ctx.fill();
          pushHistory();
          setHasSelectionContent(true);
        }
      }
      lassoPointsRef.current = [];
      setShapeStart(null);
      setShapeCurrent(null);
    } else if (canvas && ctx && maskTool === 'brush' && (drawSubTool === 'rect' || drawSubTool === 'circle' || drawSubTool === 'line') && shapeStart && shapeCurrent) {
      const isErase = isAltKeyDown;
      ctx.globalCompositeOperation = isErase ? 'destination-out' : 'source-over';
      ctx.fillStyle = hexToRgba(brushColor, maskOpacity);
      ctx.strokeStyle = hexToRgba(brushColor, maskOpacity);

      if (drawSubTool === 'rect') {
        const x = Math.min(shapeStart.x, shapeCurrent.x);
        const y = Math.min(shapeStart.y, shapeCurrent.y);
        const w = Math.abs(shapeCurrent.x - shapeStart.x);
        const h = Math.abs(shapeCurrent.y - shapeStart.y);
        if (w > 1 && h > 1) {
          ctx.fillRect(x, y, w, h);
          pushHistory();
          setHasSelectionContent(true);
        }
      } else if (drawSubTool === 'circle') {
        const cx = (shapeStart.x + shapeCurrent.x) / 2;
        const cy = (shapeStart.y + shapeCurrent.y) / 2;
        const rx = Math.abs(shapeCurrent.x - shapeStart.x) / 2;
        const ry = Math.abs(shapeCurrent.y - shapeStart.y) / 2;
        if (rx > 1 && ry > 1) {
          ctx.beginPath();
          ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
          ctx.fill();
          pushHistory();
          setHasSelectionContent(true);
        }
      } else if (drawSubTool === 'line') {
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (brushHardness < 100) {
          ctx.shadowBlur = ((100 - brushHardness) / 100) * (brushSize * 0.45);
          ctx.shadowColor = hexToRgba(brushColor, maskOpacity);
        } else {
          ctx.shadowBlur = 0;
        }
        ctx.beginPath();
        ctx.moveTo(shapeStart.x, shapeStart.y);
        ctx.lineTo(shapeCurrent.x, shapeCurrent.y);
        ctx.stroke();
        pushHistory();
        setHasSelectionContent(true);
      }
      setShapeStart(null);
      setShapeCurrent(null);
    } else if (canvas && isDrawing && (maskTool === 'brush' || maskTool === 'eraser')) {
      pushHistory();
    }
    lastPointRef.current = null;
    setIsDrawing(false);
    updateMaskPreview();
    if (activeLayerId === 'base') {
      setActiveLayerId('active-mask');
    } else if (activeLayerId && activeLayerId !== 'active-mask') {
      const cvs = canvasRef.current;
      if (cvs) {
        const maskData = cvs.toDataURL('image/png');
        setInpaintLayers(prev => prev.map(l => l.id === activeLayerId ? { ...l, maskDataUrl: maskData, maskPreviewUrl: maskData } : l));
      }
    }
  }, [isDrawing, maskTool, shapeSubTool, drawSubTool, shapeStart, shapeCurrent, maskOpacity, brushColor, pushHistory, updateMaskPreview, activeLayerId, isAltKeyDown, brushSize, brushHardness, canvasRef, setHasSelectionContent, setActiveLayerId, setInpaintLayers]);

  return {
    isDrawing,
    setIsDrawing,
    polygonPoints,
    setPolygonPoints,
    polygonCursor,
    setPolygonCursor,
    cursorPos,
    setCursorPos,
    showBrushCursor,
    setShowBrushCursor,
    shapeStart,
    shapeCurrent,
    lastPointRef,
    lassoPointsRef,
    completePolygon,
    startDrawing,
    draw,
    stopDrawing,
  };
}
