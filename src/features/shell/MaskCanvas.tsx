import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Minus, Plus, Maximize2, Layers, RotateCcw, RotateCw, X } from 'lucide-react';
import { useResolvedImage } from '../../hooks';
import { useTranslation } from '../../services/i18n';
import { useAIConfigStore } from '../../stores/aiConfigStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { logger } from '../../utils/logger';
import { VizMakerArrowCard, type ArrowNodeItem } from './components/VizMakerArrowCard';
import { LayersPanel, type InpaintLayer, type PhotoshopBlendMode } from './components/LayersPanel';
import { CropOverlay } from './components/CropOverlay';
import { useMaskHistory } from './hooks/useMaskHistory';
import { useMagicWand } from './hooks/useMagicWand';
import { useCropTool } from './hooks/useCropTool';
import { getUnifiedCost } from '../../services/credit/creditService';
import { exportToPsdWithDialog } from '../../services/export';
import { MaskPromptBar } from './mask/components/MaskPromptBar';
import { MaskTopToolbar } from './mask/components/MaskTopToolbar';
import { MaskStage } from './mask/components/MaskStage';
import { useMaskShortcuts } from './mask/hooks/useMaskShortcuts';
import { useMaskTransform } from './mask/hooks/useMaskTransform';
import { useInpaintLayers } from './mask/hooks/useInpaintLayers';
import { useMaskDrawing } from './mask/hooks/useMaskDrawing';
import { useMaskExportAndActions } from './mask/hooks/useMaskExportAndActions';
import { SmartSegmentationEngine } from '../../services/mask/SmartSegmentationEngine';
import { ColorRangeModal } from './components/ColorRangeModal';
import {
  generateMaskPreview,
  invertMask,
} from './mask/utils/maskBitmapUtils';
import type {
  LayerId,
  LayerVisibility,
  MaskCanvasProps,
  MaskTool,
  ShapeSubTool,
  DrawSubTool,
  WorkspaceMode,
} from './mask/types';
import { INPAINT_ENGINES } from './mask/types';
import './MaskCanvas.css';

export type { LayerId, LayerVisibility, MaskCanvasProps };
export { INPAINT_ENGINES };

export const MaskCanvas: React.FC<MaskCanvasProps> = ({
  image,
  originalImage,
  onMaskChange,
  onGenerate,
  onCrop,
  showGenerateButton = true,
  className = '',
  isGenerating = false,
  onClose,
}) => {
  const { isAr } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Dual-Engine Workspace Mode: 'mask' (Inpaint Stencil) vs 'draw' (Visual Ink & Sketch)
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('mask');
  const [inkColor, _setInkColor] = useState<string>('#3b82f6');

  const [baseOriginalImage, setBaseOriginalImage] = useState<string | null>(originalImage || image);
  useEffect(() => {
    setBaseOriginalImage(originalImage || image);
  }, [originalImage, image]);

  const [currentCanvasImage, setCurrentCanvasImage] = useState<string | null>(image);
  useEffect(() => {
    if (image) {
      setCurrentCanvasImage(image);
    }
  }, [image]);

  const [localIsGenerating, setLocalIsGenerating] = useState(false);
  const isGenActive = isGenerating || localIsGenerating;
  const [maskTool, setMaskTool] = useState<MaskTool>('brush');
  const [shapeSubTool, setShapeSubTool] = useState<ShapeSubTool>('rectangle');
  const [drawSubTool, setDrawSubTool] = useState<DrawSubTool>('brush');
  const [arrowNodes, setArrowNodes] = useState<ArrowNodeItem[]>([]);

  // Architectural Studio State: Ortho Angle Constraints
  const [isOrthoMode, setIsOrthoMode] = useState<boolean>(false);
  const [showColorRangeModal, setShowColorRangeModal] = useState<boolean>(false);

  // Smart Auto-Segmentation (SAM) State
  const baseImgDataRef = useRef<ImageData | null>(null);
  const [smartHoverContour, setSmartHoverContour] = useState<{ x: number; y: number }[] | null>(null);
  const [smartHoverMask, setSmartHoverMask] = useState<Uint8Array | null>(null);
  const [wandTolerance, setWandTolerance] = useState<number>(40);
  const hoverThrottlerRef = useRef<number | null>(null);

  const [brushSize, setBrushSize] = useState(34);
  const [brushColor, setBrushColor] = useState('#e11d48');

  // Spacebar Pan & Zoom Navigation (Photoshop-Grade)
  const {
    zoomScale,
    setZoomScale,
    panOffset,
    setPanOffset,
    isSpacebarDown,
    setIsSpacebarDown,
    isPanning,
    setIsPanning,
    handleWheel,
    startPan,
    onPanMove,
    endPan,
  } = useMaskTransform({ wrapperRef, maskTool });

  // Instant Before / After Comparison (Peek original image)
  const [isComparing, setIsComparing] = useState(false);

  // Interactive Split Curtain Mode (Before / After Wipe Slider)
  const [splitCompareMode, setSplitCompareMode] = useState<boolean>(false);
  const [splitPosition, setSplitPosition] = useState<number>(50);
  const [isDraggingSplit, setIsDraggingSplit] = useState<boolean>(false);

  // Brush Hardness / Softness (Airbrush vs Crisp Edge: 10% to 100%)
  const [brushHardness, setBrushHardness] = useState<number>(90);

  // Alt-Key Quick Erase State (Hold Alt to subtract / erase on the fly)
  const [isAltKeyDown, setIsAltKeyDown] = useState<boolean>(false);

  // Quick Mask Solo View (Q key: pure B&W alpha channel stencil inspection)
  const [isSoloAlphaMode, setIsSoloAlphaMode] = useState<boolean>(false);

  const [hasCopiedMask, setHasCopiedMask] = useState<boolean>(false);
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibility>({
    image: true,
    arrows: true,
    selection: true,
  });
  const [hasSelectionContent, setHasSelectionContent] = useState(false);
  const [maskPreviewUrl, setMaskPreviewUrl] = useState<string | null>(null);

  const { canUndo, canRedo, pushHistory, undo, redo, initHistory } = useMaskHistory(
    canvasRef,
    onMaskChange
  );

  const updateMaskPreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      setMaskPreviewUrl(null);
      return;
    }
    const { hasWhite, previewUrl } = generateMaskPreview(canvas);
    setHasSelectionContent(hasWhite);
    setMaskPreviewUrl(previewUrl);
  }, []);

  const clearMask = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSelectionContent(false);
    setMaskPreviewUrl(null);
    pushHistory();
  }, [pushHistory]);

  const invertCurrentMask = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const anyFilled = invertMask(canvas, brushColor, inpaintOps.maskOverlayOpacity);
    setHasSelectionContent(anyFilled);
    pushHistory();
    updateMaskPreview();
  }, [brushColor, pushHistory, updateMaskPreview]);

  // AI & Workflow configuration store hooks
  const aiConfig = useAIConfigStore((s) => s.config);
  const liveModel = aiConfig.model || 'google/nano-banana-2';
  const isTrial = useAIConfigStore((s) => s.isTrial) ?? true;
  const globalPrompt = useAIConfigStore((s) => s.workspacePrompt);
  const setGlobalPrompt = useAIConfigStore((s) => s.setWorkspacePrompt);
  const userCredits = useAIConfigStore((s) => s.userCredits) ?? null;
  const cost = getUnifiedCost(aiConfig, isTrial, liveModel);
  const [maskPrompt, setMaskPrompt] = useState(globalPrompt);

  useEffect(() => {
    setMaskPrompt(globalPrompt);
  }, [globalPrompt]);

  const [imgMeta, setImgMeta] = useState<{ w: number; h: number } | null>(null);

  // Inpaint Layers Hook
  const inpaintOps = useInpaintLayers({
    canvasRef,
    maskPrompt,
    getActiveImageSrc: () => activeImageSrc,
    baseOriginalImage,
    getResolvedBaseImage: () => resolvedBaseImage,
    maskPreviewUrl,
    clearMask,
    invertCurrentMask,
    updateMaskPreview,
    setLayerVisibility,
    setMaskTool,
    setDrawSubTool,
    setWorkspaceMode,
  });

  const {
    inpaintLayers,
    setInpaintLayers,
    activeLayerId,
    setActiveLayerId,
    baseImageVisible,
    setBaseImageVisible,
    showLayerStack,
    setShowLayerStack,
    maskOverlayBlendMode,
    setMaskOverlayBlendMode,
    maskOverlayOpacity,
    setMaskOverlayOpacity,
    baseImageOpacity,
    setBaseImageOpacity,
    psMaskColor,
    setPsMaskColor,
    handleChangeBlendMode,
    handleChangeOpacity,
    handleToggleLock,
    handleRenameLayer,
    handleToggleLayerVisibility,
    handleAddLayer,
    handleDeleteLayer,
    handleDuplicateLayer,
    handleInvertMask,
    handleReorderLayers,
    handleSelectLayer,
  } = inpaintOps;

  const activeVisibleLayer = inpaintLayers.find(l => l.visible);
  const activeImageSrc = activeVisibleLayer ? activeVisibleLayer.image : (baseImageVisible ? (currentCanvasImage || baseOriginalImage) : null);
  const resolvedImage = useResolvedImage(activeImageSrc);
  const resolvedBaseImage = useResolvedImage(baseOriginalImage);
  const { floodFill } = useMagicWand(resolvedImage);

  // Preload and cache ImageData for instantaneous Smart Auto-Segmentation (SAM)
  useEffect(() => {
    if (!resolvedImage) {
      baseImgDataRef.current = null;
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = resolvedImage;
    img.onload = () => {
      const offscreen = document.createElement('canvas');
      offscreen.width = img.naturalWidth || img.width;
      offscreen.height = img.naturalHeight || img.height;
      const ctx = offscreen.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        try {
          const idata = ctx.getImageData(0, 0, offscreen.width, offscreen.height);
          baseImgDataRef.current = idata;
          SmartSegmentationEngine.prepareImage(idata, resolvedImage);
        } catch (err) {
          logger.warn('Could not extract imageData for smart segmentation', err);
        }
      }
    };
  }, [resolvedImage]);

  // Real-time 60fps edge-guided hover segmentation
  const handleSmartHover = useCallback(
    (canvasX: number, canvasY: number) => {
      if (hoverThrottlerRef.current) return;
      hoverThrottlerRef.current = window.requestAnimationFrame(() => {
        hoverThrottlerRef.current = null;
        const imgData = baseImgDataRef.current;
        const canvas = canvasRef.current;
        if (!imgData || !resolvedImage || !canvas) return;

        const naturalScaleX = imgData.width / (canvas.width || imgData.width);
        const naturalScaleY = imgData.height / (canvas.height || imgData.height);
        const startX = canvasX * naturalScaleX;
        const startY = canvasY * naturalScaleY;

        const result = SmartSegmentationEngine.segment(
          imgData,
          resolvedImage,
          startX,
          startY,
          wandTolerance,
          45
        );

        if (result && result.contourPoints.length > 2) {
          const mappedContour = result.contourPoints.map((p: { x: number; y: number }) => ({
            x: p.x / naturalScaleX,
            y: p.y / naturalScaleY,
          }));
          setSmartHoverContour(mappedContour);
          setSmartHoverMask(result.mask);
        } else {
          setSmartHoverContour(null);
          setSmartHoverMask(null);
        }
      });
    },
    [resolvedImage, wandTolerance]
  );

  const drawingOps = useMaskDrawing({
    canvasRef,
    drawingCanvasRef,
    wrapperRef,
    resolvedImage: resolvedImage || null,
    baseImgDataRef,
    maskTool,
    shapeSubTool,
    drawSubTool,
    workspaceMode,
    inkColor,
    brushColor,
    brushSize,
    brushHardness,
    maskOpacity: maskOverlayOpacity,
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
  });

  const {
    polygonPoints,
    setPolygonPoints,
    polygonCursor,
    setPolygonCursor,
    cursorPos,
    showBrushCursor,
    setShowBrushCursor,
    shapeStart,
    shapeCurrent,
    lassoPointsRef,
    completePolygon,
    startDrawing,
    draw,
    stopDrawing,
  } = drawingOps;

  useEffect(() => {
    const handleInPlaceGen = (e: Event) => {
      setLocalIsGenerating(false);
      const customEv = e as CustomEvent<{ imageUrl: string; resolvedUrl?: string; originalImage?: string; maskDataUrl?: string; sourceNodeId?: string; prompt?: string }>;
      if (customEv.detail?.imageUrl) {
        const directImg = customEv.detail.resolvedUrl || customEv.detail.imageUrl;
        if (customEv.detail.originalImage) {
          setBaseOriginalImage(customEv.detail.originalImage);
        }
        const newLayer: InpaintLayer = {
          id: `layer-${Date.now()}`,
          name: customEv.detail.prompt || maskPrompt.trim() || 'Layer Edit',
          prompt: customEv.detail.prompt || maskPrompt.trim() || '',
          image: directImg,
          maskDataUrl: customEv.detail.maskDataUrl || maskPreviewUrl || null,
          maskPreviewUrl: maskPreviewUrl || customEv.detail.maskDataUrl || null,
          visible: true,
          selectedTarget: 'mask',
          createdAt: Date.now(),
        };

        setInpaintLayers(prev => [newLayer, ...prev]);
        setActiveLayerId(newLayer.id);

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        setHasSelectionContent(false);
        setMaskPreviewUrl(null);
      }
    };
    const handleGenErr = () => {
      setLocalIsGenerating(false);
    };
    window.addEventListener('anarchy:mask-generated-in-place', handleInPlaceGen);
    window.addEventListener('anarchy:mask-generation-error', handleGenErr);
    return () => {
      window.removeEventListener('anarchy:mask-generated-in-place', handleInPlaceGen);
      window.removeEventListener('anarchy:mask-generation-error', handleGenErr);
    };
  }, [maskPrompt, maskPreviewUrl, setActiveLayerId, setInpaintLayers]);

  // Sync stage and canvas dimensions
  const syncCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    const drawingCanvas = drawingCanvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const ww = wrapper.clientWidth;
    const wh = wrapper.clientHeight;
    if (!ww || !wh) return;

    let cw: number;
    let ch: number;

    if (imgMeta && imgMeta.w > 0 && imgMeta.h > 0) {
      const imgAspect = imgMeta.w / imgMeta.h;
      const wrapAspect = ww / wh;

      if (wrapAspect > imgAspect) {
        ch = Math.floor(wh * 0.94);
        cw = Math.floor(ch * imgAspect);
      } else {
        cw = Math.floor(ww * 0.94);
        ch = Math.floor(cw / imgAspect);
      }
    } else {
      cw = Math.floor(ww * 0.94);
      ch = Math.floor(wh * 0.94);
    }

    if (canvas.width !== cw || canvas.height !== ch) {
      const temp = document.createElement('canvas');
      temp.width = canvas.width;
      temp.height = canvas.height;
      const tCtx = temp.getContext('2d');
      if (tCtx && canvas.width > 0 && canvas.height > 0) {
        tCtx.drawImage(canvas, 0, 0);
      }

      canvas.width = cw;
      canvas.height = ch;

      if (drawingCanvas) {
        drawingCanvas.width = cw;
        drawingCanvas.height = ch;
      }

      const ctx = canvas.getContext('2d');
      if (ctx && temp.width > 0 && temp.height > 0) {
        ctx.drawImage(temp, 0, 0, cw, ch);
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

  const {
    getCompositeAndMask,
    exportBinaryMask,
    exportFullComposite,
    handleExportPsd,
    copyMaskToClipboard,
    sendToGraphAsNode,
    featherCurrentMask,
    expandMask,
    contractMask,
    fillEntireMask,
    handleGenerate,
  } = useMaskExportAndActions({
    canvasRef,
    drawingCanvasRef,
    wrapperRef,
    resolvedImage,
    image,
    imgMeta,
    layerVisibility,
    inpaintLayers,
    workspaceMode,
    arrowNodes,
    maskPreviewUrl,
    maskPrompt,
    liveModel,
    brushColor,
    maskOverlayOpacity,
    pushHistory,
    updateMaskPreview,
    setHasSelectionContent,
    setHasCopiedMask,
    setLocalIsGenerating,
    onGenerate,
  });

  // Unified Global & Photoshop-Grade Keyboard Shortcuts
  useMaskShortcuts({
    setIsSpacebarDown,
    setIsPanning,
    setZoomScale,
    setPanOffset,
    maskTool,
    setMaskTool,
    shapeSubTool,
    setShapeSubTool,
    setDrawSubTool,
    setBrushSize,
    setBrushHardness,
    setIsAltKeyDown,
    setIsOrthoMode,
    setIsSoloAlphaMode,
    setIsComparing,
    setSplitCompareMode,
    fillEntireMask,
    invertCurrentMask,
    expandMask,
    contractMask,
    clearMask,
    polygonPoints,
    setPolygonPoints,
    setPolygonCursor,
    completePolygon,
    crop,
    undo,
    redo,
    updateMaskPreview,
    activeLayerId,
    setPsMaskColor,
    handleInvertMask,
    handleDuplicateLayer,
    handleDeleteLayer,
  });

  // Real-time Canvas & Layer Adjustment Engine (All 16 adjustments active & undoable)
  const handleApplyAdjustment = useCallback(async (key: string, name: string) => {
    // 1. If active target is the active mask canvas
    if (activeLayerId === 'active-mask' || inpaintLayers.find(l => l.id === activeLayerId)?.selectedTarget === 'mask') {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
          const a = d[i + 3];
          if (key === 'invert') {
            if (a > 10) {
              d[i + 3] = 0;
            } else {
              d[i] = 225; d[i + 1] = 29; d[i + 2] = 72; d[i + 3] = Math.round(inpaintOps.maskOverlayOpacity * 255);
            }
          } else if (key === 'threshold' || key === 'levels') {
            d[i + 3] = a >= 90 ? Math.round(inpaintOps.maskOverlayOpacity * 255) : 0;
          } else if (key === 'black-white') {
            if (a > 10) {
              d[i] = 255; d[i + 1] = 255; d[i + 2] = 255; d[i + 3] = 255;
            }
          } else if (key === 'posterize') {
            d[i + 3] = Math.floor(a / 64) * 85;
          }
        }
        ctx.putImageData(imgData, 0, 0);
        pushHistory();
        updateMaskPreview();
        useNotificationStore.getState().addNotification({
          type: 'success',
          title: name,
          message: isAr ? `تم تطبيق ${name} على القناع.` : `Applied ${name} to mask.`,
          duration: 2200,
        });
        return;
      }
    }

    // 2. Pixel-by-pixel RGB adjustments on layer or base image
    const processImagePixels = (src: string): Promise<string> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const c = document.createElement('canvas');
          c.width = img.naturalWidth || img.width;
          c.height = img.naturalHeight || img.height;
          const ctx = c.getContext('2d');
          if (!ctx) {
            resolve(src);
            return;
          }
          ctx.drawImage(img, 0, 0);
          const imgData = ctx.getImageData(0, 0, c.width, c.height);
          const d = imgData.data;

          for (let i = 0; i < d.length; i += 4) {
            let r = d[i];
            let g = d[i + 1];
            let b = d[i + 2];
            const a = d[i + 3];
            if (a === 0) continue;

            switch (key) {
              case 'vibrance': {
                const max = Math.max(r, g, b);
                const avg = (r + g + b) / 3;
                const sat = max === 0 ? 0 : (max - avg) / max;
                const boost = (1 - sat) * 0.45;
                r = Math.min(255, Math.max(0, r + (r - avg) * boost));
                g = Math.min(255, Math.max(0, g + (g - avg) * boost));
                b = Math.min(255, Math.max(0, b + (b - avg) * boost));
                break;
              }
              case 'brightness-contrast': {
                const factor = 1.22;
                r = Math.min(255, Math.max(0, factor * (r - 128) + 128 + 20));
                g = Math.min(255, Math.max(0, factor * (g - 128) + 128 + 20));
                b = Math.min(255, Math.max(0, factor * (b - 128) + 128 + 20));
                break;
              }
              case 'levels': {
                const minIn = 15, maxIn = 240;
                r = Math.min(255, Math.max(0, ((r - minIn) / (maxIn - minIn)) * 255));
                g = Math.min(255, Math.max(0, ((g - minIn) / (maxIn - minIn)) * 255));
                b = Math.min(255, Math.max(0, ((b - minIn) / (maxIn - minIn)) * 255));
                break;
              }
              case 'curves': {
                const nr = r / 255, ng = g / 255, nb = b / 255;
                r = Math.min(255, Math.max(0, (nr * nr * (3 - 2 * nr)) * 255));
                g = Math.min(255, Math.max(0, (ng * ng * (3 - 2 * ng)) * 255));
                b = Math.min(255, Math.max(0, (nb * nb * (3 - 2 * nb)) * 255));
                break;
              }
              case 'exposure': {
                r = Math.min(255, r * 1.25);
                g = Math.min(255, g * 1.25);
                b = Math.min(255, b * 1.25);
                break;
              }
              case 'hue-saturation': {
                const avg = (r + g + b) / 3;
                r = Math.min(255, Math.max(0, avg + (r - avg) * 1.35));
                g = Math.min(255, Math.max(0, avg + (g - avg) * 1.35));
                b = Math.min(255, Math.max(0, avg + (b - avg) * 1.35));
                break;
              }
              case 'color-balance': {
                r = Math.min(255, r + 20);
                b = Math.max(0, b - 14);
                break;
              }
              case 'black-white': {
                const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
                r = lum; g = lum; b = lum;
                break;
              }
              case 'photo-filter': {
                r = Math.min(255, r * 1.14 + 14);
                g = Math.min(255, g * 1.04 + 4);
                b = Math.max(0, b * 0.88 - 8);
                break;
              }
              case 'channel-mixer': {
                const nr = Math.min(255, 0.7 * r + 0.4 * g);
                const ng = Math.min(255, 0.2 * r + 0.8 * g);
                const nb = Math.min(255, 0.2 * r + 0.8 * b);
                r = nr; g = ng; b = nb;
                break;
              }
              case 'color-lookup': {
                const lum = 0.299 * r + 0.587 * g + 0.114 * b;
                if (lum < 128) {
                  g = Math.min(255, g * 1.06 + 4);
                  b = Math.min(255, b * 1.16 + 12);
                } else {
                  r = Math.min(255, r * 1.14 + 14);
                  g = Math.min(255, g * 1.04 + 4);
                }
                break;
              }
              case 'invert': {
                r = 255 - r;
                g = 255 - g;
                b = 255 - b;
                break;
              }
              case 'posterize': {
                r = Math.floor(r / 64) * 85;
                g = Math.floor(g / 64) * 85;
                b = Math.floor(b / 64) * 85;
                break;
              }
              case 'threshold': {
                const lum = 0.299 * r + 0.587 * g + 0.114 * b;
                const val = lum >= 128 ? 255 : 0;
                r = val; g = val; b = val;
                break;
              }
              case 'gradient-map': {
                const t = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                r = Math.round(15 + t * (249 - 15));
                g = Math.round(23 + t * (115 - 23));
                b = Math.round(42 + t * (22 - 42));
                break;
              }
              case 'selective-color': {
                const max = Math.max(r, g, b);
                const min = Math.min(r, g, b);
                if (max - min > 28) {
                  r = Math.min(255, r * 1.22);
                  g = Math.min(255, g * 1.22);
                  b = Math.min(255, b * 1.22);
                }
                break;
              }
            }

            d[i] = r;
            d[i + 1] = g;
            d[i + 2] = b;
          }

          ctx.putImageData(imgData, 0, 0);
          resolve(c.toDataURL('image/png'));
        };
        img.onerror = () => resolve(src);
        img.src = src;
      });
    };

    // 3. If an inpaint layer is selected
    if (activeLayerId && activeLayerId !== 'base') {
      const layer = inpaintLayers.find(l => l.id === activeLayerId);
      if (layer?.image) {
        const adjustedImg = await processImagePixels(layer.image);
        setInpaintLayers(prev => prev.map(l => l.id === activeLayerId ? { ...l, image: adjustedImg } : l));
        pushHistory();
        useNotificationStore.getState().addNotification({
          type: 'success',
          title: name,
          message: isAr ? `تم تطبيق ${name} على الطبقة ${layer.name}.` : `Applied ${name} to layer ${layer.name}.`,
          duration: 2500,
        });
        return;
      }
    }

    // 4. Default: Apply to base image
    const baseSrc = resolvedBaseImage || baseOriginalImage || currentCanvasImage;
    if (baseSrc) {
      const adjustedImg = await processImagePixels(baseSrc);
      setBaseOriginalImage(adjustedImg);
      setCurrentCanvasImage(adjustedImg);
      pushHistory();
      useNotificationStore.getState().addNotification({
        type: 'success',
        title: name,
        message: isAr ? `تم تطبيق ${name} على صورة الخلفية.` : `Applied ${name} to background base.`,
        duration: 2500,
      });
    }
  }, [
    activeLayerId,
    inpaintLayers,
    setInpaintLayers,
    resolvedBaseImage,
    baseOriginalImage,
    currentCanvasImage,
    inpaintOps.maskOverlayOpacity,
    canvasRef,
    pushHistory,
    updateMaskPreview,
    isAr,
  ]);

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

  return (
    <div className={`mask-canvas-container ${className}`}>
      <MaskTopToolbar
        maskTool={maskTool}
        setMaskTool={setMaskTool}
        isSpacebarDown={isSpacebarDown}
        shapeSubTool={shapeSubTool}
        setShapeSubTool={setShapeSubTool}
        drawSubTool={drawSubTool}
        setDrawSubTool={setDrawSubTool}
        brushSize={brushSize}
        setBrushSize={setBrushSize}
        brushHardness={brushHardness}
        setBrushHardness={setBrushHardness}
        clearMask={clearMask}
        invertCurrentMask={invertCurrentMask}
        featherCurrentMask={featherCurrentMask}
        expandMask={expandMask}
        contractMask={contractMask}
        fillEntireMask={fillEntireMask}
        wandTolerance={wandTolerance}
        setWandTolerance={setWandTolerance}
        maskOverlayOpacity={maskOverlayOpacity}
        setMaskOverlayOpacity={setMaskOverlayOpacity}
        brushColor={brushColor}
        setBrushColor={setBrushColor}
        splitCompareMode={splitCompareMode}
        setSplitCompareMode={setSplitCompareMode}
        isComparing={isComparing}
        setIsComparing={setIsComparing}
        isSoloAlphaMode={isSoloAlphaMode}
        setIsSoloAlphaMode={setIsSoloAlphaMode}
        onAddArrowCard={() => {
          const newArrow: ArrowNodeItem = {
            id: `arrow-${Date.now()}`,
            targetPos: { x: 50, y: 50 },
            cardPos: { x: 35, y: 30 },
            text: '',
            refImage: null,
            radius: 80,
            collapsed: false,
          };
          setArrowNodes((prev) => [...prev, newArrow]);
        }}
        exportBinaryMask={exportBinaryMask}
        exportFullComposite={exportFullComposite}
        copyMaskToClipboard={copyMaskToClipboard}
        hasCopiedMask={hasCopiedMask}
        sendToGraphAsNode={sendToGraphAsNode}
        onExportPsd={handleExportPsd}
        zoomScale={zoomScale}
        setZoomScale={setZoomScale}
        setPanOffset={setPanOffset}
        showLayerStack={showLayerStack}
        setShowLayerStack={setShowLayerStack}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={() => {
          undo();
          updateMaskPreview();
        }}
        onRedo={() => {
          redo();
          updateMaskPreview();
        }}
        isOrthoMode={isOrthoMode}
        onToggleOrtho={() => setIsOrthoMode((prev) => !prev)}
        onOpenColorRange={() => setShowColorRangeModal(true)}
        onClose={onClose}
      />

      <div
        className="mask-canvas-wrapper"
        ref={wrapperRef}
        onWheel={handleWheel}
        onMouseDown={(e) => {
          if (startPan(e)) return;
          if (maskTool === 'crop') {
            crop.onCropWrapperDown(e);
          }
        }}
        onMouseMove={(e) => {
          if (isDraggingSplit && wrapperRef.current) {
            const stage = wrapperRef.current.querySelector('.mask-canvas-stage') as HTMLElement;
            if (stage) {
              const stageRect = stage.getBoundingClientRect();
              const pct = Math.max(0, Math.min(100, ((e.clientX - stageRect.left) / stageRect.width) * 100));
              setSplitPosition(pct);
            }
            return;
          }
          if (onPanMove(e)) return;
          if (maskTool === 'crop') {
            crop.onCropWrapperMove(e);
          }
        }}
        onMouseUp={() => {
          if (isDraggingSplit) {
            setIsDraggingSplit(false);
            return;
          }
          if (endPan()) return;
          if (maskTool === 'crop') {
            crop.onCropWrapperUp();
          }
        }}
        onMouseLeave={() => {
          if (isDraggingSplit) {
            setIsDraggingSplit(false);
          }
          if (endPan()) return;
          if (maskTool === 'crop') {
            crop.onCropWrapperUp();
          }
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
              radius: 80,
              collapsed: false,
            };
            setArrowNodes((prev) => [...prev, newArrow]);
          }
        }}
        style={{
          cursor: isDraggingSplit
            ? 'ew-resize'
            : isPanning
            ? 'grabbing'
            : isSpacebarDown || maskTool === 'hand'
            ? 'grab'
            : maskTool === 'crop'
            ? 'crosshair'
            : maskTool === 'arrow'
            ? 'copy'
            : maskTool === 'select'
            ? 'default'
            : 'crosshair',
        }}
      >
        {isComparing && (
          <div style={{
            position: 'absolute',
            top: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(56, 189, 248, 0.92)',
            color: '#090a0f',
            fontWeight: 700,
            fontSize: '11.5px',
            padding: '4px 14px',
            borderRadius: '20px',
            boxShadow: '0 4px 20px rgba(56, 189, 248, 0.45)',
            zIndex: 35,
            pointerEvents: 'none',
            letterSpacing: '0.3px',
          }}>
            BEFORE (ORIGINAL IMAGE) — Press \ or Eye icon to exit
          </div>
        )}

        {isSoloAlphaMode && (
          <div style={{
            position: 'absolute',
            top: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(250, 204, 21, 0.95)',
            color: '#090a0f',
            fontWeight: 700,
            fontSize: '11.5px',
            padding: '4px 14px',
            borderRadius: '20px',
            boxShadow: '0 4px 20px rgba(250, 204, 21, 0.45)',
            zIndex: 35,
            pointerEvents: 'none',
            letterSpacing: '0.3px',
          }}>
            SOLO ALPHA STENCIL (B&W) — Press Q to exit
          </div>
        )}

        <MaskStage
          panOffset={panOffset}
          zoomScale={zoomScale}
          isSoloAlphaMode={isSoloAlphaMode}
          resolvedImage={resolvedImage || null}
          isComparing={isComparing}
          resolvedBaseImage={resolvedBaseImage || null}
          baseOriginalImage={baseOriginalImage}
          layerVisibility={layerVisibility}
          baseImageOpacity={baseImageOpacity}
          setImgMeta={setImgMeta}
          inpaintLayers={inpaintLayers}
          splitCompareMode={splitCompareMode}
          splitPosition={splitPosition}
          setIsDraggingSplit={setIsDraggingSplit}
          drawingCanvasRef={drawingCanvasRef}
          canvasRef={canvasRef}
          isGenActive={isGenActive}
          maskTool={maskTool}
          isSpacebarDown={isSpacebarDown}
          isPanning={isPanning}
          shapeSubTool={shapeSubTool}
          drawSubTool={drawSubTool}
          polygonPoints={polygonPoints}
          polygonCursor={polygonCursor}
          completePolygon={completePolygon}
          startDrawing={startDrawing}
          draw={draw}
          stopDrawing={stopDrawing}
          setShowBrushCursor={setShowBrushCursor}
          maskOverlayOpacity={maskOverlayOpacity}
          maskOverlayBlendMode={maskOverlayBlendMode}
          smartHoverContour={smartHoverContour}
          lassoPointsRef={lassoPointsRef}
          shapeStart={shapeStart}
          shapeCurrent={shapeCurrent}
          brushColor={brushColor}
          maskOpacity={maskOverlayOpacity}
          brushSize={brushSize}
          showBrushCursor={showBrushCursor}
          cursorPos={cursorPos}
          brushHardness={brushHardness}
        />

        {layerVisibility.arrows &&
          arrowNodes.map((arrow, idx) => (
            <VizMakerArrowCard
              key={arrow.id}
              arrow={arrow}
              index={idx + 1}
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
          <CropOverlay
            cropCssRect={cropCssRect}
            cropRect={crop.cropRect}
            onApply={crop.applyCrop}
            onCancel={() => {
              crop.clearCropRect();
              setMaskTool('brush');
            }}
          />
        )}

        {showGenerateButton && (
          <MaskPromptBar
            prompt={maskPrompt}
            onPromptChange={(newPrompt) => {
              setMaskPrompt(newPrompt);
              setGlobalPrompt(newPrompt);
            }}
            onGenerate={() => void handleGenerate()}
            isGenerating={isGenActive}
            cost={cost}
            userCredits={userCredits}
            isArabicUI={false}
          />
        )}

        <div className="mask-viewport-zoom-hud">
          <button
            type="button"
            className="mask-viewport-zoom-btn"
            onClick={() => setZoomScale((z) => Math.max(0.2, z * 0.85))}
            title="Zoom Out (-)"
          >
            <Minus size={13} />
          </button>
          <button
            type="button"
            className="mask-viewport-zoom-text"
            onClick={() => {
              setZoomScale(1);
              setPanOffset({ x: 0, y: 0 });
            }}
            title="Reset Zoom & Pan (Ctrl+0)"
          >
            {Math.round(zoomScale * 100)}%
          </button>
          <button
            type="button"
            className="mask-viewport-zoom-btn"
            onClick={() => setZoomScale((z) => Math.min(6, z * 1.18))}
            title="Zoom In (+)"
          >
            <Plus size={13} />
          </button>
          <button
            type="button"
            className="mask-viewport-zoom-btn"
            onClick={() => {
              setZoomScale(1);
              setPanOffset({ x: 0, y: 0 });
            }}
            title="Fit to Screen (1:1)"
            style={{ borderLeft: '1px solid rgba(255, 255, 255, 0.14)', marginLeft: '2px', paddingLeft: '6px' }}
          >
            <Maximize2 size={12} />
          </button>
        </div>
      </div>

      {showLayerStack && (
        <LayersPanel
          onClose={() => setShowLayerStack(false)}
          layers={inpaintLayers}
          activeLayerId={activeLayerId}
          onSelectLayer={handleSelectLayer}
          onToggleLayerVisibility={handleToggleLayerVisibility}
          onDeleteLayer={handleDeleteLayer}
          onAddLayer={handleAddLayer}
          onDuplicateLayer={handleDuplicateLayer}
          onInvertMask={handleInvertMask}
          onChangeBlendMode={handleChangeBlendMode}
          onChangeOpacity={handleChangeOpacity}
          onToggleLock={handleToggleLock}
          onReorderLayers={handleReorderLayers}
          onRenameLayer={handleRenameLayer}
          baseImage={resolvedBaseImage || baseOriginalImage}
          baseImageVisible={baseImageVisible}
          onToggleBaseImageVisibility={() => setBaseImageVisible(v => !v)}
          baseImageOpacity={baseImageOpacity}
          onChangeBaseOpacity={setBaseImageOpacity}
          currentMaskPreviewUrl={maskPreviewUrl}
          hasActiveMask={hasSelectionContent || Boolean(maskPreviewUrl)}
          maskVisible={layerVisibility.selection}
          maskOpacity={maskOverlayOpacity}
          maskBlendMode={maskOverlayBlendMode}
          onChangeMaskBlendMode={setMaskOverlayBlendMode}
          onChangeMaskOpacity={(op) => setMaskOverlayOpacity(op / 100)}
          isGenerating={isGenActive}
          generatingPrompt={maskPrompt}
          activeMaskColor={psMaskColor}
          onToggleMaskColor={() => setPsMaskColor(c => c === 'white' ? 'black' : 'white')}
          onExportPsd={handleExportPsd}
          brushColor={brushColor}
          onChangeBrushColor={setBrushColor}
          onOpenColorRange={() => setShowColorRangeModal(true)}
          onApplyAdjustment={handleApplyAdjustment}
        />
      )}

      {/* Studio Vertical Right Rail (Layers, Undo, Redo, Close) */}
      <div className="mask-canvas-right-rail">
        <button
          type="button"
          className={`mask-toolbar-btn ${showLayerStack ? 'active' : ''}`}
          onClick={() => setShowLayerStack((prev) => !prev)}
          title={isAr ? (showLayerStack ? 'إخفاء لوحة الاستوديو' : 'إظهار لوحة الاستوديو') : (showLayerStack ? 'Hide Studio Panel' : 'Show Studio Panel')}
        >
          <Layers size={16} />
        </button>

        <div className="mask-canvas-rail-divider" />

        <button
          type="button"
          className="mask-toolbar-btn"
          onClick={() => {
            undo();
            updateMaskPreview();
          }}
          disabled={!canUndo}
          title={isAr ? 'تراجع (Ctrl+Z)' : 'Undo (Ctrl+Z)'}
          style={{ opacity: canUndo ? 1 : 0.35 }}
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
          title={isAr ? 'إعادة (Ctrl+Y)' : 'Redo (Ctrl+Y)'}
          style={{ opacity: canRedo ? 1 : 0.35 }}
        >
          <RotateCw size={15} />
        </button>

        {onClose && (
          <button
            type="button"
            className="mask-toolbar-btn mask-toolbar-close-btn"
            onClick={onClose}
            title={isAr ? 'رجوع إلى الكانفاز (Esc)' : 'Back to canvas (Esc)'}
            style={{ color: 'rgba(255,255,255,0.75)', marginTop: 'auto' }}
          >
            <X size={15} />
          </button>
        )}
      </div>

      <ColorRangeModal
        isOpen={showColorRangeModal}
        onClose={() => setShowColorRangeModal(false)}
        canvasRef={canvasRef}
        baseImageSrc={resolvedBaseImage || baseOriginalImage || resolvedImage || null}
        brushColor={brushColor}
        maskOpacity={maskOverlayOpacity}
        onMaskApplied={() => {
          setHasSelectionContent(true);
          pushHistory();
          updateMaskPreview();
          useNotificationStore.getState().addNotification({
            type: 'info',
            title: 'Color Range Mask Applied',
            message: 'Luma / color range isolated to inpaint mask.',
            duration: 2000,
          });
        }}
      />
    </div>
  );
};

export default MaskCanvas;
