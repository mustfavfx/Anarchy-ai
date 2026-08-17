import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  MousePointer2, LassoSelect, Paintbrush2, Eraser, Trash2, Wand2, Crop,
  RotateCcw, RotateCw, FileDown, Layers, CornerDownRight, Sparkles,
  SquareDashed, Square, Circle, FolderPlus, PenTool, Shapes, Plus, Minus,
} from 'lucide-react';
import { useResolvedImage } from '../../hooks';
import { useAIConfigStore } from '../../stores/aiConfigStore';
import { VizMakerArrowCard, type ArrowNodeItem } from './components/VizMakerArrowCard';
import { LayersPanel, type LayerId, type LayerVisibility } from './components/LayersPanel';
import { CropOverlay } from './components/CropOverlay';
import { useMaskHistory } from './hooks/useMaskHistory';
import { useMagicWand } from './hooks/useMagicWand';
import { useCropTool } from './hooks/useCropTool';
import './MaskCanvas.css';

export interface MaskCanvasProps {
  image: string | null;
  onMaskChange?: (maskDataUrl: string | null) => void;
  onGenerate?: (compositeDataUrl: string, maskDataUrl: string, prompt: string, refImages?: string[]) => void;
  onCrop?: (croppedDataUrl: string) => void;
  showGenerateButton?: boolean;
  className?: string;
  isGenerating?: boolean;
}

export const MaskCanvas: React.FC<MaskCanvasProps> = ({
  image,
  onMaskChange,
  onGenerate,
  onCrop,
  showGenerateButton = true,
  className = '',
  isGenerating = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [currentCanvasImage, setCurrentCanvasImage] = useState<string | null>(image);

  useEffect(() => {
    if (image) {
      setCurrentCanvasImage(image);
    }
  }, [image]);

  const activeImageSrc = currentCanvasImage || image;
  const resolvedImage = useResolvedImage(activeImageSrc);

  const [isDrawing, setIsDrawing] = useState(false);
  const [maskTool, setMaskTool] = useState<'select' | 'brush' | 'eraser' | 'lasso' | 'crop' | 'wand' | 'arrow'>('brush');
  const [shapeSubTool, setShapeSubTool] = useState<'polygon' | 'rectangle' | 'circle'>('rectangle');
  const [drawSubTool, setDrawSubTool] = useState<'brush' | 'arrow' | 'line' | 'rect' | 'circle'>('brush');
  const [openDropdown, setOpenDropdown] = useState<'lasso' | 'pen' | null>(null);
  const [arrowNodes, setArrowNodes] = useState<ArrowNodeItem[]>([]);

  const [brushSize, setBrushSize] = useState(34);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [showBrushCursor, setShowBrushCursor] = useState(false);
  const [brushColor, setBrushColor] = useState('#e11d48');
  const maskOpacity = 0.55;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.mask-dropdown-container')) {
        setOpenDropdown(null);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [zoomScale, setZoomScale] = useState(1);

  const [showLayerStack, setShowLayerStack] = useState(false);
  const [selectedLayerId, setSelectedLayerId] = useState<LayerId>('image');
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibility>({
    image: true,
    arrows: true,
    selection: true,
  });
  const [hasSelectionContent, setHasSelectionContent] = useState(false);
  const [maskPreviewUrl, setMaskPreviewUrl] = useState<string | null>(null);

  const { canUndo, canRedo, pushHistory, undo, redo, resetHistory, initHistory } = useMaskHistory(
    canvasRef,
    onMaskChange
  );
  const { floodFill } = useMagicWand(resolvedImage);

  const hexToRgba = useCallback((hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }, []);

  const aiConfig = useAIConfigStore((state) => state.config);
  const globalPrompt = useAIConfigStore((state) => state.workspacePrompt);
  const setGlobalPrompt = useAIConfigStore((state) => state.setWorkspacePrompt);
  const [maskPrompt, setMaskPrompt] = useState(globalPrompt);

  useEffect(() => {
    setMaskPrompt(globalPrompt);
  }, [globalPrompt]);

  const [imgMeta, setImgMeta] = useState<{ w: number; h: number } | null>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const lassoPointsRef = useRef<{ x: number; y: number }[]>([]);
  const [shapeStart, setShapeStart] = useState<{ x: number; y: number } | null>(null);
  const [shapeCurrent, setShapeCurrent] = useState<{ x: number; y: number } | null>(null);

  const updateMaskPreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      setMaskPreviewUrl(null);
      return;
    }
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = 120;
    maskCanvas.height = Math.round((canvas.height / (canvas.width || 1)) * 120) || 120;
    const mCtx = maskCanvas.getContext('2d');
    if (!mCtx) return;

    mCtx.fillStyle = '#000000';
    mCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
    mCtx.drawImage(canvas, 0, 0, maskCanvas.width, maskCanvas.height);

    const imgData = mCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    const data = imgData.data;
    let hasWhite = false;

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 5) {
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = 255;
        hasWhite = true;
      } else {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 255;
      }
    }
    mCtx.putImageData(imgData, 0, 0);

    setHasSelectionContent(hasWhite);
    setMaskPreviewUrl(hasWhite ? maskCanvas.toDataURL('image/png') : null);
  }, []);

  useEffect(() => {
    const handleInPlaceGen = (e: Event) => {
      const customEv = e as CustomEvent<{ imageUrl: string; sourceNodeId?: string }>;
      if (customEv.detail?.imageUrl) {
        setCurrentCanvasImage(customEv.detail.imageUrl);
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        setHasSelectionContent(false);
        setMaskPreviewUrl(null);
      }
    };
    window.addEventListener('anarchy:mask-generated-in-place', handleInPlaceGen);
    return () => window.removeEventListener('anarchy:mask-generated-in-place', handleInPlaceGen);
  }, []);

  const syncCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper || !imgMeta) return;

    const { w, h } = imgMeta;
    const ww = wrapper.clientWidth;
    const wh = wrapper.clientHeight;
    const scale = Math.min((ww * 0.95) / w, (wh * 0.95) / h);
    const cw = Math.round(w * scale);
    const ch = Math.round(h * scale);

    if (canvas.width !== cw || canvas.height !== ch) {
      let snapshot: HTMLCanvasElement | null = null;
      if (canvas.width > 0 && canvas.height > 0) {
        snapshot = document.createElement('canvas');
        snapshot.width = canvas.width;
        snapshot.height = canvas.height;
        snapshot.getContext('2d')?.drawImage(canvas, 0, 0);
      }

      canvas.width = cw;
      canvas.height = ch;
      canvas.style.width = `${cw}px`;
      canvas.style.height = `${ch}px`;

      if (snapshot) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(snapshot, 0, 0, snapshot.width, snapshot.height, 0, 0, cw, ch);
        }
      }

      initHistory();
      updateMaskPreview();
    }

    const stageLeft = Math.round((ww - cw) / 2);
    const stageTop = Math.round((wh - ch) / 2);
    canvas.style.left = '0px';
    canvas.style.top = '0px';

    const stage = wrapper.querySelector('.mask-canvas-stage') as HTMLElement;
    if (stage) {
      stage.style.left = `${stageLeft}px`;
      stage.style.top = `${stageTop}px`;
      stage.style.width = `${cw}px`;
      stage.style.height = `${ch}px`;
    }
  }, [imgMeta, initHistory, updateMaskPreview]);

  useEffect(() => {
    syncCanvasSize();
    window.addEventListener('resize', syncCanvasSize);
    return () => window.removeEventListener('resize', syncCanvasSize);
  }, [syncCanvasSize]);

  const crop = useCropTool({
    canvasRef,
    wrapperRef,
    resolvedImage,
    onCrop,
    onApplied: () => setMaskTool('brush'),
  });

  useEffect(() => {
    if (maskTool === 'crop') {
      crop.initCropRect();
    } else {
      crop.clearCropRect();
    }
  }, [maskTool]);

  const clearMask = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSelectionContent(false);
    setMaskPreviewUrl(null);
    pushHistory();
  }, [pushHistory]);

  const exportMask = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `mask_${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, []);

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
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
    return {
      x: Math.max(0, Math.min(canvas.width, rawX)),
      y: Math.max(0, Math.min(canvas.height, rawY)),
    };
  };

  const handleWandClick = useCallback(
    async (canvasX: number, canvasY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const filled = await floodFill(canvas, canvasX, canvasY, brushColor, maskOpacity);
      if (filled) {
        setHasSelectionContent(true);
        pushHistory();
        updateMaskPreview();
      }
    },
    [floodFill, brushColor, maskOpacity, pushHistory, updateMaskPreview]
  );

  const startDrawing = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      if (('button' in e && e.button !== 0) || maskTool === 'select' || maskTool === 'crop') return;
      const pt = getCanvasCoords(e);
      if (!pt) return;

      if (maskTool === 'wand') {
        void handleWandClick(pt.x, pt.y);
        return;
      }

      if (maskTool === 'lasso') {
        if (shapeSubTool === 'polygon') {
          lassoPointsRef.current = [pt];
        } else {
          setShapeStart(pt);
          setShapeCurrent(pt);
        }
        setIsDrawing(true);
        return;
      }

      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;
      ctx.globalCompositeOperation = maskTool === 'eraser' ? 'destination-out' : 'source-over';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, brushSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(brushColor, maskOpacity);
      ctx.fill();
      lastPointRef.current = pt;
      setIsDrawing(true);
      setHasSelectionContent(true);
    },
    [maskTool, shapeSubTool, brushSize, brushColor, maskOpacity, hexToRgba, handleWandClick]
  );

  const draw = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      const pt = getCanvasCoords(e);
      if (pt) setCursorPos(pt);

      if (!isDrawing || !pt || maskTool === 'select' || maskTool === 'crop') return;

      if (maskTool === 'lasso') {
        if (shapeSubTool === 'polygon') {
          lassoPointsRef.current.push(pt);
        } else {
          setShapeCurrent(pt);
        }
        return;
      }

      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;
      ctx.globalCompositeOperation = maskTool === 'eraser' ? 'destination-out' : 'source-over';
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = hexToRgba(brushColor, maskOpacity);

      ctx.beginPath();
      if (lastPointRef.current) {
        ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
      } else {
        ctx.moveTo(pt.x, pt.y);
      }
      ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
      lastPointRef.current = pt;
      setHasSelectionContent(true);
    },
    [isDrawing, maskTool, shapeSubTool, brushSize, brushColor, maskOpacity, hexToRgba]
  );

  const stopDrawing = useCallback(() => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');

    if (canvas && ctx && maskTool === 'lasso') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = hexToRgba(brushColor, maskOpacity);
      ctx.beginPath();

      if (shapeSubTool === 'polygon' && lassoPointsRef.current.length > 2) {
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
    } else if (canvas && isDrawing && (maskTool === 'brush' || maskTool === 'eraser')) {
      pushHistory();
    }
    lastPointRef.current = null;
    setIsDrawing(false);
    updateMaskPreview();
  }, [isDrawing, maskTool, shapeSubTool, shapeStart, shapeCurrent, maskOpacity, brushColor, hexToRgba, pushHistory, updateMaskPreview]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      if (e.key.toLowerCase() === 'x') {
        e.preventDefault();
        setBrushColor((prev) => (prev === '#e11d48' ? '#000000' : '#e11d48'));
        return;
      }
      if (e.key === 'b' || e.key === 'B') setMaskTool('brush');
      if (e.key === 'e' || e.key === 'E') setMaskTool('eraser');
      if (e.key === 'l' || e.key === 'L') setMaskTool('lasso');
      if (e.key === 'c' || e.key === 'C') setMaskTool('crop');
      if (e.key === 'v' || e.key === 'V') setMaskTool('select');
      if (e.key === 'Escape') {
        crop.clearCropRect();
        if (maskTool === 'crop') setMaskTool('brush');
      }
      if (e.key === 'Enter' && maskTool === 'crop' && crop.cropRect) crop.applyCrop();
      if ((e.key === 'z' || e.key === 'Z') && e.ctrlKey) {
        if (e.shiftKey) {
          redo();
          updateMaskPreview();
        } else {
          undo();
          updateMaskPreview();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, maskTool, crop, updateMaskPreview]);

  const getCompositeAndMask = (): Promise<{ composite: string; mask: string } | null> => {
    const canvas = canvasRef.current;
    const baseImgSrc = resolvedImage || image;
    if (!canvas || !baseImgSrc) return Promise.resolve(null);

    const targetW = imgMeta?.w ?? canvas.width;
    const targetH = imgMeta?.h ?? canvas.height;

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const compositeCanvas = document.createElement('canvas');
        compositeCanvas.width = targetW;
        compositeCanvas.height = targetH;
        const compositeCtx = compositeCanvas.getContext('2d');
        if (!compositeCtx) {
          resolve(null);
          return;
        }

        compositeCtx.imageSmoothingEnabled = true;
        compositeCtx.imageSmoothingQuality = 'high';

        if (layerVisibility.image !== false) {
          compositeCtx.drawImage(img, 0, 0, targetW, targetH);
        }

        if (layerVisibility.selection !== false) {
          compositeCtx.drawImage(canvas, 0, 0, targetW, targetH);
        }

        if (layerVisibility.arrows !== false && arrowNodes.length > 0) {
          const radius = Math.max(16, Math.min(targetW, targetH) * 0.02);
          const fontPx = Math.max(12, Math.round(radius * 0.9));
          compositeCtx.fillStyle = '#E63030';
          compositeCtx.strokeStyle = '#ffffff';
          compositeCtx.lineWidth = Math.max(2, Math.round(radius * 0.15));
          arrowNodes.forEach((a, index) => {
            const px = (a.targetPos.x / 100) * targetW;
            const py = (a.targetPos.y / 100) * targetH;

            compositeCtx.beginPath();
            compositeCtx.arc(px, py, radius, 0, Math.PI * 2);
            compositeCtx.fill();
            compositeCtx.stroke();

            compositeCtx.fillStyle = '#ffffff';
            compositeCtx.font = `bold ${fontPx}px sans-serif`;
            compositeCtx.textAlign = 'center';
            compositeCtx.textBaseline = 'middle';
            compositeCtx.fillText(`${index + 1}`, px, py);
          });
        }
        const compositeDataUrl = compositeCanvas.toDataURL('image/png');

        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = targetW;
        maskCanvas.height = targetH;
        const maskCtx = maskCanvas.getContext('2d');
        if (!maskCtx) {
          resolve(null);
          return;
        }

        maskCtx.clearRect(0, 0, targetW, targetH);

        if (layerVisibility.selection !== false) {
          maskCtx.drawImage(canvas, 0, 0, targetW, targetH);
        }

        if (layerVisibility.arrows !== false && arrowNodes.length > 0) {
          maskCtx.fillStyle = '#ffffff';
          arrowNodes.forEach((a) => {
            const px = (a.targetPos.x / 100) * targetW;
            const py = (a.targetPos.y / 100) * targetH;
            const radius = Math.max(30, Math.min(targetW, targetH) * 0.06);
            maskCtx.beginPath();
            maskCtx.arc(px, py, radius, 0, Math.PI * 2);
            maskCtx.fill();
          });
        }

        const imgData = maskCtx.getImageData(0, 0, targetW, targetH);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3];
          if (alpha > 5) {
            data[i] = 255;
            data[i + 1] = 255;
            data[i + 2] = 255;
            data[i + 3] = 255;
          } else {
            data[i] = 0;
            data[i + 1] = 0;
            data[i + 2] = 0;
            data[i + 3] = 255;
          }
        }
        maskCtx.putImageData(imgData, 0, 0);

        const featheredCanvas = document.createElement('canvas');
        featheredCanvas.width = targetW;
        featheredCanvas.height = targetH;
        const fCtx = featheredCanvas.getContext('2d');
        if (fCtx) {
          fCtx.filter = 'blur(4px)';
          fCtx.drawImage(maskCanvas, 0, 0);
          fCtx.filter = 'none';
        }

        const maskDataUrl = (fCtx ? featheredCanvas : maskCanvas).toDataURL('image/png');

        resolve({ composite: compositeDataUrl, mask: maskDataUrl });
      };
      img.onerror = () => resolve(null);
      img.src = baseImgSrc;
    });
  };

  const handleGenerate = useCallback(async () => {
    const finalPrompt = maskPrompt.trim();
    const refImages: string[] = [];

    const winPrompt = (window as any).__anarchyCurrentPrompt?.trim() || useAIConfigStore.getState().workspacePrompt?.trim() || '';

    const promptParts: string[] = [];
    if (winPrompt) promptParts.push(winPrompt);
    if (finalPrompt) promptParts.push(finalPrompt);

    if (arrowNodes.length > 0) {
      const arrowPrompts = arrowNodes.map((a) => a.text.trim()).filter(Boolean).join(', ');
      if (arrowPrompts) promptParts.push(arrowPrompts);
      arrowNodes.forEach((a) => {
        if (a.refImage) refImages.push(a.refImage);
      });
    }

    const combinedPrompt = promptParts.filter(Boolean).join(', ');
    const payloadPrompt = combinedPrompt || 'AI Mask Generation';

    const result = await getCompositeAndMask();
    if (!result) return;

    if (onGenerate) {
      onGenerate(result.composite, result.mask, payloadPrompt, refImages);
    } else {
      window.dispatchEvent(
        new CustomEvent('anarchy:mask-generate', {
          detail: {
            compositeImage: result.composite,
            maskDataUrl: result.mask,
            prompt: payloadPrompt,
            refImages,
          },
        })
      );
    }
  }, [maskPrompt, arrowNodes, onGenerate, resolvedImage, image]);

  useEffect(() => {
    const handleTrigger = () => {
      void handleGenerate();
    };
    window.addEventListener('anarchy:trigger-mask-generate', handleTrigger);
    return () => window.removeEventListener('anarchy:trigger-mask-generate', handleTrigger);
  }, [handleGenerate]);

  if (!image) {
    return (
      <div className={`mask-canvas-empty ${className}`}>
        <span>No image selected</span>
        <small>Select an image to start masking</small>
      </div>
    );
  }

  const cropCssRect = maskTool === 'crop' && crop.cropRect ? crop.getCropCssRect() : null;
  const activeModelName = aiConfig.model || 'Nano Banana 2';
  const activeResolution = aiConfig.resolution || '1K';

  return (
    <div className={`mask-canvas-container ${className}`}>
      <div className="mask-canvas-top-bar">
        <div className="mask-canvas-tools-toolbar">
          {/* 1. Precision Pointer */}
          <button
            type="button"
            className={`mask-toolbar-btn ${maskTool === 'select' ? 'active' : ''}`}
            onClick={() => setMaskTool('select')}
            title="Select / Move Pointer (V)"
          >
            <MousePointer2 size={17} style={{ color: maskTool === 'select' ? '#06b6d4' : undefined }} />
          </button>

          <div className="mask-canvas-divider-vertical" />

          {/* 2. Selection Region Dropdown (Lasso / Marquee) */}
          <div className="mask-dropdown-container">
            <button
              type="button"
              className={`mask-toolbar-btn ${maskTool === 'lasso' ? 'active' : ''}`}
              onClick={() => {
                setMaskTool('lasso');
                setOpenDropdown((prev) => (prev === 'lasso' ? null : 'lasso'));
              }}
              title="Region Selection Tools (L)"
            >
              {shapeSubTool === 'rectangle' ? (
                <SquareDashed size={17} style={{ color: maskTool === 'lasso' ? '#10b981' : undefined }} />
              ) : (
                <LassoSelect size={17} style={{ color: maskTool === 'lasso' ? '#10b981' : undefined }} />
              )}
              <span className="mask-dropdown-caret">
                <svg width="5" height="5" viewBox="0 0 6 6" fill="currentColor">
                  <path d="M6 6L6 0L0 6Z" />
                </svg>
              </span>
            </button>

            {openDropdown === 'lasso' && (
              <div className="mask-vertical-dropdown">
                <button
                  type="button"
                  className={`mask-dropdown-item ${shapeSubTool === 'rectangle' ? 'active' : ''}`}
                  onClick={() => {
                    setMaskTool('lasso');
                    setShapeSubTool('rectangle');
                    setOpenDropdown(null);
                  }}
                  title="Marquee Box Selection"
                >
                  <SquareDashed size={16} />
                  <span className="mask-dropdown-label">Marquee</span>
                </button>

                <button
                  type="button"
                  className={`mask-dropdown-item ${shapeSubTool === 'polygon' ? 'active' : ''}`}
                  onClick={() => {
                    setMaskTool('lasso');
                    setShapeSubTool('polygon');
                    setOpenDropdown(null);
                  }}
                  title="Polygon Lasso Region"
                >
                  <LassoSelect size={16} />
                  <span className="mask-dropdown-label">Polygon</span>
                </button>
              </div>
            )}
          </div>

          <div className="mask-canvas-divider-vertical" />

          {/* 3. Inpaint Painter & Shapes Dropdown */}
          <div className="mask-dropdown-container">
            <button
              type="button"
              className={`mask-toolbar-btn ${maskTool === 'brush' || maskTool === 'arrow' ? 'active' : ''}`}
              onClick={() => {
                if (maskTool !== 'brush' && maskTool !== 'arrow') setMaskTool('brush');
                setOpenDropdown((prev) => (prev === 'pen' ? null : 'pen'));
              }}
              title="Paint & Annotation Tools (B)"
            >
              {drawSubTool === 'arrow' ? (
                <CornerDownRight size={17} style={{ color: '#f43f5e' }} />
              ) : drawSubTool === 'line' ? (
                <PenTool size={17} style={{ color: '#f43f5e' }} />
              ) : drawSubTool === 'rect' ? (
                <Square size={17} style={{ color: '#f43f5e' }} />
              ) : drawSubTool === 'circle' ? (
                <Circle size={17} style={{ color: '#f43f5e' }} />
              ) : (
                <Paintbrush2 size={17} style={{ color: maskTool === 'brush' ? '#f43f5e' : undefined }} />
              )}
              <span className="mask-dropdown-caret">
                <svg width="5" height="5" viewBox="0 0 6 6" fill="currentColor">
                  <path d="M6 6L6 0L0 6Z" />
                </svg>
              </span>
            </button>

            {openDropdown === 'pen' && (
              <div className="mask-vertical-dropdown">
                <button
                  type="button"
                  className={`mask-dropdown-item ${drawSubTool === 'brush' ? 'active' : ''}`}
                  onClick={() => {
                    setMaskTool('brush');
                    setDrawSubTool('brush');
                    setOpenDropdown(null);
                  }}
                  title="Inpaint Paintbrush"
                >
                  <Paintbrush2 size={16} />
                  <span className="mask-dropdown-label">Brush</span>
                </button>

                <button
                  type="button"
                  className={`mask-dropdown-item ${drawSubTool === 'arrow' ? 'active' : ''}`}
                  onClick={() => {
                    setMaskTool('arrow');
                    setDrawSubTool('arrow');
                    setOpenDropdown(null);
                  }}
                  title="Arrow & Card Note"
                >
                  <CornerDownRight size={16} />
                  <span className="mask-dropdown-label">Arrow</span>
                </button>

                <button
                  type="button"
                  className={`mask-dropdown-item ${drawSubTool === 'line' ? 'active' : ''}`}
                  onClick={() => {
                    setMaskTool('brush');
                    setDrawSubTool('line');
                    setOpenDropdown(null);
                  }}
                  title="Straight Line"
                >
                  <PenTool size={16} />
                  <span className="mask-dropdown-label">Line</span>
                </button>

                <button
                  type="button"
                  className={`mask-dropdown-item ${drawSubTool === 'rect' ? 'active' : ''}`}
                  onClick={() => {
                    setMaskTool('brush');
                    setDrawSubTool('rect');
                    setOpenDropdown(null);
                  }}
                  title="Solid Rectangle"
                >
                  <Square size={16} />
                  <span className="mask-dropdown-label">Rectangle</span>
                </button>

                <button
                  type="button"
                  className={`mask-dropdown-item ${drawSubTool === 'circle' ? 'active' : ''}`}
                  onClick={() => {
                    setMaskTool('brush');
                    setDrawSubTool('circle');
                    setOpenDropdown(null);
                  }}
                  title="Solid Circle"
                >
                  <Circle size={16} />
                  <span className="mask-dropdown-label">Circle</span>
                </button>
              </div>
            )}
          </div>

          {/* Stepper Brush Size */}
          <div className="mask-brush-size-stepper" title="Brush Size">
            <button type="button" onClick={() => setBrushSize(Math.max(5, brushSize - 5))}><Minus size={12} /></button>
            <span className="mask-size-text">{brushSize} <small>px</small></span>
            <button type="button" onClick={() => setBrushSize(Math.min(100, brushSize + 5))}><Plus size={12} /></button>
          </div>

          <div className="mask-canvas-divider-vertical" />

          {/* 4. Eraser & Clear */}
          <button
            type="button"
            className={`mask-toolbar-btn ${maskTool === 'eraser' ? 'active' : ''}`}
            onClick={() => setMaskTool('eraser')}
            title="Eraser Tool (E)"
          >
            <Eraser size={17} style={{ color: maskTool === 'eraser' ? '#f59e0b' : undefined }} />
          </button>

          <button
            type="button"
            className="mask-toolbar-btn danger"
            onClick={clearMask}
            title="Clear Mask Selection"
          >
            <Trash2 size={17} />
          </button>

          <div className="mask-canvas-divider-vertical" />

          {/* 5. Add Card & Export */}
          <button
            type="button"
            className="mask-toolbar-btn"
            onClick={() => {
              const newArrow: ArrowNodeItem = {
                id: `arrow-${Date.now()}`,
                targetPos: { x: 50, y: 50 },
                cardPos: { x: 35, y: 30 },
                text: '',
                refImage: null,
              };
              setArrowNodes((prev) => [...prev, newArrow]);
            }}
            title="Add Reference Image / Card"
          >
            <FolderPlus size={17} style={{ color: '#a855f7' }} />
          </button>

          <button
            type="button"
            className="mask-toolbar-btn primary"
            onClick={exportMask}
            title="Export Mask PNG"
          >
            <FileDown size={17} />
          </button>
        </div>

        <div className="mask-canvas-top-actions">
          <button
            type="button"
            className={`mask-toolbar-btn ${showLayerStack ? 'active' : ''}`}
            onClick={() => setShowLayerStack((prev) => !prev)}
            title="Layers Panel"
          >
            <Layers size={16} />
          </button>

          <button
            type="button"
            className="mask-toolbar-btn"
            onClick={() => {
              undo();
              updateMaskPreview();
            }}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            style={{ opacity: canUndo ? 1 : 0.4 }}
          >
            <RotateCcw size={15} />
          </button>

          <button
            type="button"
            className="mask-toolbar-btn"
            onClick={() => {
              redo();
              updateMaskPreview();
            }}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
            style={{ opacity: canRedo ? 1 : 0.4 }}
          >
            <RotateCw size={15} />
          </button>
        </div>
      </div>

      {showLayerStack && (
        <LayersPanel
          onClose={() => setShowLayerStack(false)}
          showSelectionLayer={maskTool === 'lasso' || hasSelectionContent}
          arrowCount={arrowNodes.length}
          selectedLayerId={selectedLayerId}
          onSelectLayer={setSelectedLayerId}
          layerVisibility={layerVisibility}
          onToggleVisibility={(id) => setLayerVisibility((v) => ({ ...v, [id]: !v[id] }))}
          resolvedImage={resolvedImage}
          maskPreviewUrl={maskPreviewUrl}
          onAddArrowLayer={() => {
            const newArrow: ArrowNodeItem = {
              id: `arrow-${Date.now()}`,
              targetPos: { x: 50, y: 50 },
              cardPos: { x: 35, y: 30 },
              text: '',
              refImage: null,
            };
            setArrowNodes((prev) => [...prev, newArrow]);
            setSelectedLayerId('arrows');
          }}
          onDeleteSelectedLayer={() => {
            if (selectedLayerId === 'arrows') {
              setArrowNodes([]);
              setSelectedLayerId('image');
            } else if (selectedLayerId === 'selection') {
              clearMask();
              setSelectedLayerId('image');
            }
          }}
        />
      )}

      <div
        className="mask-canvas-wrapper"
        ref={wrapperRef}
        onWheel={(e) => {
          const delta = e.deltaY < 0 ? 1.15 : 0.86;
          setZoomScale((prev) => Math.max(1, Math.min(4.5, prev * delta)));
        }}
        onClick={(e) => {
          if (maskTool === 'arrow' && wrapperRef.current) {
            const rect = wrapperRef.current.getBoundingClientRect();
            const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
            const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
            const newArrow: ArrowNodeItem = {
              id: `arrow-${Date.now()}`,
              targetPos: { x, y },
              cardPos: { x: Math.max(12, Math.min(85, x - 15)), y: Math.max(12, Math.min(85, y - 20)) },
              text: '',
              refImage: null,
            };
            setArrowNodes((prev) => [...prev, newArrow]);
          }
        }}
        onMouseDown={maskTool === 'crop' ? crop.onCropWrapperDown : undefined}
        onMouseMove={maskTool === 'crop' ? crop.onCropWrapperMove : undefined}
        onMouseUp={maskTool === 'crop' ? crop.onCropWrapperUp : undefined}
        onMouseLeave={maskTool === 'crop' ? crop.onCropWrapperUp : undefined}
        style={{ cursor: maskTool === 'crop' ? 'crosshair' : maskTool === 'arrow' ? 'copy' : 'default' }}
      >
        <div
          className="mask-canvas-stage"
          style={{
            transform: `scale(${zoomScale})`,
            transformOrigin: 'center center',
          }}
        >
          <img
            src={resolvedImage || activeImageSrc || ''}
            alt="Base"
            className="mask-canvas-base-image"
            style={{
              opacity: layerVisibility.image ? 1 : 0,
              pointerEvents: layerVisibility.image ? 'auto' : 'none',
            }}
            onLoad={(e) => setImgMeta({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          />
          <canvas
            ref={canvasRef}
            className={`mask-canvas-draw ${isGenerating ? 'mask-pulsing' : ''}`}
            onMouseDown={maskTool !== 'crop' && maskTool !== 'arrow' ? startDrawing : undefined}
            onMouseMove={maskTool !== 'crop' && maskTool !== 'arrow' ? draw : undefined}
            onMouseUp={maskTool !== 'crop' && maskTool !== 'arrow' ? stopDrawing : undefined}
            onTouchStart={maskTool !== 'crop' && maskTool !== 'arrow' ? startDrawing : undefined}
            onTouchMove={maskTool !== 'crop' && maskTool !== 'arrow' ? draw : undefined}
            onTouchEnd={maskTool !== 'crop' && maskTool !== 'arrow' ? stopDrawing : undefined}
            onMouseLeave={
              maskTool !== 'crop' && maskTool !== 'arrow'
                ? () => {
                    stopDrawing();
                    setShowBrushCursor(false);
                  }
                : undefined
            }
            onMouseEnter={maskTool !== 'crop' && maskTool !== 'arrow' ? () => setShowBrushCursor(true) : undefined}
            style={{
              cursor: maskTool === 'select' ? 'default' : 'crosshair',
              pointerEvents: maskTool === 'crop' || maskTool === 'arrow' || maskTool === 'select' || !layerVisibility.selection ? 'none' : 'all',
              opacity: layerVisibility.selection ? 1 : 0,
            }}
          />

          {isDrawing && maskTool === 'lasso' && (
            <svg
              className={`mask-shape-preview-svg ${isGenerating ? 'mask-pulsing' : ''}`}
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
              {shapeSubTool === 'polygon' && lassoPointsRef.current.length > 1 && (
                <polygon
                  points={lassoPointsRef.current.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="rgba(225, 29, 72, 0.35)"
                  stroke="#e11d48"
                  strokeWidth="2"
                  strokeDasharray="5 5"
                />
              )}
              {shapeSubTool === 'rectangle' && shapeStart && shapeCurrent && (
                <rect
                  x={Math.min(shapeStart.x, shapeCurrent.x)}
                  y={Math.min(shapeStart.y, shapeCurrent.y)}
                  width={Math.abs(shapeCurrent.x - shapeStart.x)}
                  height={Math.abs(shapeCurrent.y - shapeStart.y)}
                  fill="rgba(225, 29, 72, 0.35)"
                  stroke="#e11d48"
                  strokeWidth="2"
                  strokeDasharray="5 5"
                />
              )}
              {shapeSubTool === 'circle' && shapeStart && shapeCurrent && (
                <ellipse
                  cx={(shapeStart.x + shapeCurrent.x) / 2}
                  cy={(shapeStart.y + shapeCurrent.y) / 2}
                  rx={Math.abs(shapeCurrent.x - shapeStart.x) / 2}
                  ry={Math.abs(shapeCurrent.y - shapeStart.y) / 2}
                  fill="rgba(225, 29, 72, 0.35)"
                  stroke="#e11d48"
                  strokeWidth="2"
                  strokeDasharray="5 5"
                />
              )}
            </svg>
          )}

          {showBrushCursor && (maskTool === 'brush' || maskTool === 'eraser') && cursorPos && (
            <div
              className="mask-canvas-cursor"
              style={{
                left: cursorPos.x,
                top: cursorPos.y,
                width: brushSize,
                height: brushSize,
                transform: 'translate(-50%, -50%)',
                position: 'absolute',
                pointerEvents: 'none',
                zIndex: 20,
              }}
            />
          )}
        </div>

        {layerVisibility.arrows &&
          arrowNodes.map((arrow) => (
            <VizMakerArrowCard
              key={arrow.id}
              arrow={arrow}
              containerRect={wrapperRef.current?.getBoundingClientRect()}
              onUpdate={(id, updates) => {
                setArrowNodes((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a)));
              }}
              onDelete={(id) => {
                setArrowNodes((prev) => prev.filter((a) => a.id !== id));
              }}
            />
          ))}

        {maskTool === 'crop' && cropCssRect && (
          <CropOverlay cropCssRect={cropCssRect} onApply={crop.applyCrop} onCancel={crop.clearCropRect} />
        )}
      </div>

      {showGenerateButton && (
        <div className="vizmaker-bottom-prompt-bar-container">
          <div className="vizmaker-bottom-prompt-bar">
            <div className="vizmaker-prompt-inner-wrapper">
              <div className="vizmaker-prompt-badge node-badge">
                <span className="vizmaker-badge-chain">🔗</span>
                <span>Node</span>
              </div>

              <textarea
                className="vizmaker-prompt-textarea"
                value={maskPrompt}
                onChange={(e) => {
                  setMaskPrompt(e.target.value);
                  setGlobalPrompt(e.target.value);
                }}
                placeholder="Enter your prompt in any language..."
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handleGenerate();
                  }
                }}
              />

              <button
                type="button"
                className="vizmaker-reset-prompt-btn"
                onClick={() => setMaskPrompt('')}
                title="Reset prompt"
              >
                <RotateCcw size={13} />
              </button>
            </div>

            <div className="vizmaker-make-btn-group">
              <button
                type="button"
                className="vizmaker-make-btn"
                onClick={() => void handleGenerate()}
                disabled={isGenerating}
                title="Generate AI Render (Make)"
              >
                <Wand2 size={15} className={isGenerating ? 'spin' : ''} />
                <span>{isGenerating ? 'Generating...' : 'Make'}</span>
                <span className="vizmaker-btn-cost">🪙 1.20</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaskCanvas;
