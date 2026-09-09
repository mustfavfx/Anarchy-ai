import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Loader2, Minus, Plus, Maximize2 } from 'lucide-react';
import { useResolvedImage } from '../../hooks';
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
import { MaskCompareView } from './mask/components/MaskCompareView';
import { useMaskShortcuts } from './mask/hooks/useMaskShortcuts';
import { useMaskTransform } from './mask/hooks/useMaskTransform';
import { SmartSegmentationEngine } from '../../services/mask/SmartSegmentationEngine';
import { RulerGuidesOverlay, type Guide, snapToGuides, snapToOrthoAngle } from './components/RulerGuidesOverlay';
import { ColorRangeModal } from './components/ColorRangeModal';
import './MaskCanvas.css';

export type LayerId = 'image' | 'arrows' | 'selection';
export interface LayerVisibility {
  image?: boolean;
  arrows?: boolean;
  selection?: boolean;
}

export const INPAINT_ENGINES = [
  { id: 'black-forest-labs/flux-fill-pro', name: 'Flux Fill Pro (Architectural Photorealism)' },
  { id: 'black-forest-labs/flux-fill-dev', name: 'Flux Fill Dev (Fast Fill)' },
  { id: 'stabilityai/stable-diffusion-xl-inpaint', name: 'SDXL Inpaint (Classic Stable Diffusion)' },
  { id: 'reve/edit-fast', name: 'Reve Edit Fast' },
  { id: 'google/nano-banana-2', name: 'Nano Banana 2 (Gemini Fast)' },
  { id: 'google/nano-banana-pro', name: 'Nano Banana Pro' },
];

export interface MaskCanvasProps {
  image: string | null;
  originalImage?: string | null;
  onMaskChange?: (maskDataUrl: string | null) => void;
  onGenerate?: (compositeDataUrl: string, maskDataUrl: string, prompt: string, refImages?: string[], model?: string) => void;
  onCrop?: (croppedDataUrl: string) => void;
  showGenerateButton?: boolean;
  className?: string;
  isGenerating?: boolean;
}

export const MaskCanvas: React.FC<MaskCanvasProps> = ({
  image,
  originalImage,
  onMaskChange,
  onGenerate,
  onCrop,
  showGenerateButton = true,
  className = '',
  isGenerating = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Dual-Engine Workspace Mode: 'mask' (Inpaint Stencil) vs 'draw' (Visual Ink & Sketch)
  const [workspaceMode, setWorkspaceMode] = useState<'mask' | 'draw'>('mask');
  const [inkColor, setInkColor] = useState<string>('#3b82f6');

  const [baseOriginalImage, setBaseOriginalImage] = useState<string | null>(originalImage || image);
  useEffect(() => {
    setBaseOriginalImage(originalImage || image);
  }, [originalImage, image]);
  const [currentCanvasImage, setCurrentCanvasImage] = useState<string | null>(image);
  const [inpaintLayers, setInpaintLayers] = useState<InpaintLayer[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<string>('base');
  const [baseImageVisible, setBaseImageVisible] = useState(true);
  const [showLayerStack, setShowLayerStack] = useState(true);

  useEffect(() => {
    if (image) {
      setCurrentCanvasImage(image);
    }
  }, [image]);

  const activeVisibleLayer = inpaintLayers.find(l => l.visible);
  const activeImageSrc = activeVisibleLayer ? activeVisibleLayer.image : (baseImageVisible ? (currentCanvasImage || baseOriginalImage) : null);
  const resolvedImage = useResolvedImage(activeImageSrc);
  const resolvedBaseImage = useResolvedImage(baseOriginalImage);

  const [localIsGenerating, setLocalIsGenerating] = useState(false);
  const isGenActive = isGenerating || localIsGenerating;
  const [isDrawing, setIsDrawing] = useState(false);
  const [maskTool, setMaskTool] = useState<'select' | 'brush' | 'eraser' | 'lasso' | 'crop' | 'wand' | 'arrow' | 'hand' | 'smart_select'>('brush');
  const [shapeSubTool, setShapeSubTool] = useState<'polygon' | 'rectangle' | 'circle' | 'freehand'>('rectangle');
  const [drawSubTool, setDrawSubTool] = useState<'brush' | 'arrow' | 'line' | 'rect' | 'circle'>('brush');
  const [arrowNodes, setArrowNodes] = useState<ArrowNodeItem[]>([]);

  // Architectural Studio State: Ortho Angle Constraints & Snap Guides
  const [isOrthoMode, setIsOrthoMode] = useState<boolean>(false);
  const [showRulers, setShowRulers] = useState<boolean>(true);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [showColorRangeModal, setShowColorRangeModal] = useState<boolean>(false);

  // Smart Auto-Segmentation (SAM) State
  const baseImgDataRef = useRef<ImageData | null>(null);
  const [smartHoverContour, setSmartHoverContour] = useState<{ x: number; y: number }[] | null>(null);
  const [smartHoverMask, setSmartHoverMask] = useState<Uint8Array | null>(null);
  const [wandTolerance, setWandTolerance] = useState<number>(40);
  const hoverThrottlerRef = useRef<number | null>(null);

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
          const mappedContour = result.contourPoints.map((p) => ({
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

  // Polygonal Click-by-Click Drafting State
  const [polygonPoints, setPolygonPoints] = useState<{ x: number; y: number }[]>([]);
  const [polygonCursor, setPolygonCursor] = useState<{ x: number; y: number } | null>(null);

  // Keyboard Shortcuts HUD Toggle
  const [showShortcutHelp, setShowShortcutHelp] = useState<boolean>(false);

  const [brushSize, setBrushSize] = useState(34);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [showBrushCursor, setShowBrushCursor] = useState(false);
  const [brushColor, setBrushColor] = useState('#e11d48');
  const [psMaskColor, setPsMaskColor] = useState<'white' | 'black'>('white');
  const [maskOverlayBlendMode, setMaskOverlayBlendMode] = useState<PhotoshopBlendMode>('normal');
  const [baseImageOpacity, setBaseImageOpacity] = useState<number>(100);

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
  const [maskOverlayOpacity, setMaskOverlayOpacity] = useState<number>(0.55);
  const maskOpacity = maskOverlayOpacity;
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
  const userCredits = useAIConfigStore((s) => s.userCredits) ?? null;
  const liveModel = aiConfig.model || 'google/nano-banana-2';
  const isTrial = useAIConfigStore((s) => s.isTrial) ?? true;
  const cost = getUnifiedCost(aiConfig, isTrial, liveModel);
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

      const drawCanvas = drawingCanvasRef.current;
      if (drawCanvas) {
        drawCanvas.width = cw;
        drawCanvas.height = ch;
        drawCanvas.style.width = `${cw}px`;
        drawCanvas.style.height = `${ch}px`;
      }

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

  const exportBinaryMask = useCallback(async () => {
    const res = await getCompositeAndMask();
    if (!res) return;
    const link = document.createElement('a');
    link.download = `binary_mask_${Date.now()}.png`;
    link.href = res.mask;
    link.click();
  }, []);

  const exportFullComposite = useCallback(async () => {
    const res = await getCompositeAndMask();
    if (!res) return;
    const link = document.createElement('a');
    link.download = `composite_${Date.now()}.png`;
    link.href = res.composite;
    link.click();
  }, []);

  const handleExportPsd = useCallback(async () => {
    const baseImg = resolvedImage || image;
    if (!baseImg) return;
    try {
      const res = await getCompositeAndMask();
      const activeMask = res?.mask || maskPreviewUrl || undefined;
      const defaultFilename = `Anarchy_${Date.now()}`;
      const savedPath = await exportToPsdWithDialog({
        fileName: defaultFilename,
        baseImage: baseImg,
        baseImageVisible: layerVisibility.image !== false,
        layers: inpaintLayers,
        activeMaskDataUrl: activeMask,
        canvasWidth: imgMeta?.w || canvasRef.current?.width,
        canvasHeight: imgMeta?.h || canvasRef.current?.height,
      });
      if (savedPath) {
        useNotificationStore.getState().addNotification({
          type: 'success',
          title: 'PSD Exported',
          message: `Saved: ${savedPath.split(/[\\/]/).pop()}`,
          duration: 3000,
        });
      }
    } catch (err: any) {
      logger.error('[MaskCanvas] Failed to export PSD:', err);
      useNotificationStore.getState().addNotification({
        type: 'error',
        title: 'Export Failed',
        message: err?.message || 'Could not export PSD file.',
        duration: 4000,
      });
    }
  }, [resolvedImage, image, maskPreviewUrl, inpaintLayers, layerVisibility.image, imgMeta]);

  const copyMaskToClipboard = useCallback(async () => {
    try {
      const res = await getCompositeAndMask();
      if (!res) return;
      const resp = await fetch(res.mask);
      const blob = await resp.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      setHasCopiedMask(true);
      setTimeout(() => setHasCopiedMask(false), 2500);
      useNotificationStore.getState().addNotification({
        type: 'success',
        title: 'Mask Copied',
        message: 'Binary mask PNG copied to clipboard.',
        duration: 3000
      });
    } catch (err) {
      logger.warn('[MaskCanvas] Clipboard copy failed:', err);
    }
  }, []);

  const sendToGraphAsNode = useCallback(async () => {
    const res = await getCompositeAndMask();
    if (!res) return;
    window.dispatchEvent(new CustomEvent('anarchy:mask-generate-node', {
      detail: {
        compositeImage: res.composite,
        maskDataUrl: res.mask,
        prompt: maskPrompt.trim() || 'Masked Inpaint Edit',
        model: liveModel,
        sourceNodeId: useAIConfigStore.getState().selectedNode?.id
      }
    }));
    useNotificationStore.getState().addNotification({
      type: 'success',
      title: 'Sent to Canvas',
      message: 'New node created in workflow graph.',
      duration: 3000
    });
  }, [liveModel, maskPrompt]);

  const exportMask = exportBinaryMask;

  const invertCurrentMask = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !ctx) return;
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    let anyFilled = false;
    const r = parseInt(brushColor.slice(1, 3), 16) || 225;
    const g = parseInt(brushColor.slice(3, 5), 16) || 29;
    const b = parseInt(brushColor.slice(5, 7), 16) || 72;
    const alphaVal = Math.round(maskOpacity * 255);

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 8) {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 0;
      } else {
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = alphaVal;
        anyFilled = true;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    setHasSelectionContent(anyFilled);
    pushHistory();
    updateMaskPreview();
  }, [brushColor, maskOpacity, pushHistory, updateMaskPreview]);

  const featherCurrentMask = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !ctx) return;
    const temp = document.createElement('canvas');
    temp.width = canvas.width;
    temp.height = canvas.height;
    const tCtx = temp.getContext('2d');
    if (!tCtx) return;
    tCtx.drawImage(canvas, 0, 0);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.filter = 'blur(6px)';
    ctx.drawImage(temp, 0, 0);
    ctx.filter = 'none';

    pushHistory();
    updateMaskPreview();
  }, [pushHistory, updateMaskPreview]);

  const expandMask = useCallback((px = 4) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !ctx) return;

    const temp = document.createElement('canvas');
    temp.width = canvas.width;
    temp.height = canvas.height;
    const tCtx = temp.getContext('2d');
    if (!tCtx) return;
    tCtx.drawImage(canvas, 0, 0);

    ctx.save();
    for (let dx = -px; dx <= px; dx += 2) {
      for (let dy = -px; dy <= px; dy += 2) {
        if (dx * dx + dy * dy <= px * px) {
          ctx.drawImage(temp, dx, dy);
        }
      }
    }
    ctx.restore();
    setHasSelectionContent(true);
    pushHistory();
    updateMaskPreview();
    useNotificationStore.getState().addNotification({
      type: 'info',
      title: 'Mask Expanded',
      message: `Expanded selection boundary by +${px}px.`,
      duration: 2000
    });
  }, [pushHistory, updateMaskPreview]);

  const contractMask = useCallback((px = 4) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !ctx) return;

    const inv = document.createElement('canvas');
    inv.width = canvas.width;
    inv.height = canvas.height;
    const iCtx = inv.getContext('2d');
    if (!iCtx) return;
    iCtx.fillStyle = '#ffffff';
    iCtx.fillRect(0, 0, inv.width, inv.height);
    iCtx.globalCompositeOperation = 'destination-out';
    iCtx.drawImage(canvas, 0, 0);

    const expInv = document.createElement('canvas');
    expInv.width = canvas.width;
    expInv.height = canvas.height;
    const eCtx = expInv.getContext('2d');
    if (!eCtx) return;
    for (let dx = -px; dx <= px; dx += 2) {
      for (let dy = -px; dy <= px; dy += 2) {
        if (dx * dx + dy * dy <= px * px) {
          eCtx.drawImage(inv, dx, dy);
        }
      }
    }

    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(expInv, 0, 0);
    ctx.restore();

    pushHistory();
    updateMaskPreview();
    useNotificationStore.getState().addNotification({
      type: 'info',
      title: 'Mask Contracted',
      message: `Contracted selection boundary by -${px}px.`,
      duration: 2000
    });
  }, [pushHistory, updateMaskPreview]);

  const fillEntireMask = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = hexToRgba(brushColor, maskOpacity);
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSelectionContent(true);
    pushHistory();
    updateMaskPreview();
    useNotificationStore.getState().addNotification({
      type: 'info',
      title: 'Mask Filled',
      message: 'Filled entire canvas into inpaint mask.',
      duration: 2000
    });
  }, [brushColor, maskOpacity, hexToRgba, pushHistory, updateMaskPreview]);

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
  }, [polygonPoints, workspaceMode, inkColor, brushColor, maskOpacity, hexToRgba, pushHistory, updateMaskPreview]);

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
    let finalX = Math.max(0, Math.min(canvas.width, rawX));
    let finalY = Math.max(0, Math.min(canvas.height, rawY));

    if (guides.length > 0) {
      const snapped = snapToGuides(finalX, finalY, guides, 8);
      finalX = snapped.x;
      finalY = snapped.y;
    }

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
    [floodFill, brushColor, maskOpacity, wandTolerance, pushHistory, updateMaskPreview]
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

      // Smart Auto-Segmentation (SAM) Click-to-Select
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

      // Polygonal Click-by-Click Vertex Drafting (with Ortho Snapping)
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

        // If clicked close to the first point, close and fill polygon!
        const startPt = polygonPoints[0];
        const dist = Math.hypot(vertexPt.x - startPt.x, vertexPt.y - startPt.y);
        if (polygonPoints.length >= 3 && dist < 18) {
          completePolygon();
          return;
        }

        // Otherwise append point to polygon
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

      // Dedicated Shape Draw Sub-Tools: Line, Rectangle, Circle
      if (maskTool === 'brush' && (drawSubTool === 'rect' || drawSubTool === 'circle' || drawSubTool === 'line')) {
        setShapeStart(pt);
        setShapeCurrent(pt);
        setIsDrawing(true);
        return;
      }

      const isErase = maskTool === 'eraser' || isAltKeyDown || ('altKey' in e && e.altKey) || (activeLayerId !== 'base' && psMaskColor === 'black');

      // Shift + Click or Ortho straight line connection (Architectural precision drafting)
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
    [isSpacebarDown, isPanning, maskTool, shapeSubTool, drawSubTool, polygonPoints, completePolygon, brushSize, brushColor, maskOpacity, hexToRgba, handleWandClick, workspaceMode, inkColor, isAltKeyDown, brushHardness, pushHistory, updateMaskPreview, activeLayerId, psMaskColor]
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

      // Dedicated Shape Draw Sub-Tools: Line, Rectangle, Circle (with Ortho Angle Snapping)
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
        // Fluid quadratic midpoint stroke smoothing
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
    [isSpacebarDown, isPanning, isDrawing, maskTool, shapeSubTool, drawSubTool, polygonPoints, brushSize, brushColor, maskOpacity, hexToRgba, workspaceMode, inkColor, isAltKeyDown, brushHardness, activeLayerId, psMaskColor]
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
  }, [isDrawing, maskTool, shapeSubTool, drawSubTool, shapeStart, shapeCurrent, maskOpacity, brushColor, hexToRgba, pushHistory, updateMaskPreview, activeLayerId, isAltKeyDown, brushSize, brushHardness]);



  const getCompositeAndMask = async (): Promise<{ composite: string; mask: string } | null> => {
    const canvas = canvasRef.current;
    const baseImgSrc = resolvedImage || image;
    if (!canvas || !baseImgSrc) {
      logger.warn('[MaskCanvas] getCompositeAndMask: missing canvas or baseImgSrc');
      return null;
    }

    const targetW = imgMeta?.w ?? canvas.width;
    const targetH = imgMeta?.h ?? canvas.height;

    // Helper to render composite and mask once image is ready
    const renderWithImage = (img: HTMLImageElement | HTMLCanvasElement): { composite: string; mask: string } | null => {
      // 1. Clean Composite Canvas: Draw original image and ink annotations only (NEVER bake red mask into source!)
      const compositeCanvas = document.createElement('canvas');
      compositeCanvas.width = targetW;
      compositeCanvas.height = targetH;
      const compositeCtx = compositeCanvas.getContext('2d');
      if (!compositeCtx) return null;

      compositeCtx.imageSmoothingEnabled = true;
      compositeCtx.imageSmoothingQuality = 'high';

      if (layerVisibility.image !== false) {
        compositeCtx.drawImage(img, 0, 0, targetW, targetH);
      }

      // Composite all visible inpaint layers in bottom-to-top order
      if (inpaintLayers.length > 0) {
        for (const layer of inpaintLayers.slice().reverse()) {
          if (!layer.visible || !layer.image) continue;
          const layerDomImg = wrapperRef.current?.querySelector(`img[data-layer-id="${layer.id}"]`) as HTMLImageElement | null;
          if (layerDomImg && layerDomImg.complete && layerDomImg.naturalWidth > 0) {
            compositeCtx.save();
            compositeCtx.globalAlpha = (layer.opacity ?? 100) / 100;
            compositeCtx.globalCompositeOperation = (layer.blendMode && layer.blendMode !== 'normal')
              ? (layer.blendMode as GlobalCompositeOperation)
              : 'source-over';
            compositeCtx.drawImage(layerDomImg, 0, 0, targetW, targetH);
            compositeCtx.restore();
          }
        }
      }

      // Draw manual ink / visual annotations if user intentionally sketched in 'draw' mode
      const drawCanvas = drawingCanvasRef.current;
      if (drawCanvas && workspaceMode === 'draw') {
        compositeCtx.drawImage(drawCanvas, 0, 0, targetW, targetH);
      }

      const compositeDataUrl = compositeCanvas.toDataURL('image/png');

      // 2. Pure Binary Mask: White (255,255,255) inpaint zone, Black (0,0,0) preserved zone
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = targetW;
      maskCanvas.height = targetH;
      const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
      if (!maskCtx) return null;

      maskCtx.clearRect(0, 0, targetW, targetH);

      if (layerVisibility.selection !== false) {
        maskCtx.drawImage(canvas, 0, 0, targetW, targetH);
      }

      if (layerVisibility.arrows !== false && arrowNodes.length > 0) {
        maskCtx.fillStyle = '#ffffff';
        arrowNodes.forEach((a) => {
          const px = (a.targetPos.x / 100) * targetW;
          const py = (a.targetPos.y / 100) * targetH;
          const userRadius = a.radius || 80;
          const scaleFactor = Math.min(targetW, targetH) / 800;
          const finalRadius = Math.max(25, userRadius * scaleFactor);
          maskCtx.beginPath();
          maskCtx.arc(px, py, finalRadius, 0, Math.PI * 2);
          maskCtx.fill();
        });
      }

      // Fast multi-pass 2D canvas dilation (eliminates 84M synchronous loops, runs in <10ms)
      const dilateCanvas = document.createElement('canvas');
      dilateCanvas.width = targetW;
      dilateCanvas.height = targetH;
      const dCtx = dilateCanvas.getContext('2d', { willReadFrequently: true });
      if (dCtx) {
        dCtx.drawImage(maskCanvas, 0, 0);
        const d = 4;
        dCtx.drawImage(maskCanvas, -d, 0);
        dCtx.drawImage(maskCanvas, d, 0);
        dCtx.drawImage(maskCanvas, 0, -d);
        dCtx.drawImage(maskCanvas, 0, d);
        dCtx.drawImage(maskCanvas, -d, -d);
        dCtx.drawImage(maskCanvas, d, d);
        dCtx.drawImage(maskCanvas, -d, d);
        dCtx.drawImage(maskCanvas, d, -d);
      }

      const activeMaskCanvas = dCtx ? dilateCanvas : maskCanvas;
      const actCtx = activeMaskCanvas.getContext('2d', { willReadFrequently: true });
      if (!actCtx) return null;

      const imgData = actCtx.getImageData(0, 0, targetW, targetH);
      const data = imgData.data;

      // Threshold into clean 1:1 binary mask: White (255,255,255) for inpaint, Black (0,0,0) for preserve
      for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3];
        const val = alpha > 8 ? 255 : 0;
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
        data[i + 3] = 255;
      }
      actCtx.putImageData(imgData, 0, 0);

      // Smooth feathering on boundary
      const featheredCanvas = document.createElement('canvas');
      featheredCanvas.width = targetW;
      featheredCanvas.height = targetH;
      const fCtx = featheredCanvas.getContext('2d');
      if (fCtx) {
        fCtx.filter = 'blur(2px)';
        fCtx.drawImage(activeMaskCanvas, 0, 0);
        fCtx.filter = 'none';
      }

      const maskDataUrl = (fCtx ? featheredCanvas : activeMaskCanvas).toDataURL('image/png');
      return { composite: compositeDataUrl, mask: maskDataUrl };
    };

    // 1. Try using the already rendered DOM image if available
    const domImg = wrapperRef.current?.querySelector<HTMLImageElement>('.mask-canvas-base-image');
    if (domImg && domImg.complete && domImg.naturalWidth > 0) {
      try {
        const res = renderWithImage(domImg);
        if (res) return res;
      } catch (err) {
        logger.warn('[MaskCanvas] DOM image canvas export failed, falling back to new Image():', err);
      }
    }

    // 2. Fallback: Load image dynamically with proper CORS handling
    return new Promise((resolve) => {
      const img = new Image();
      if (baseImgSrc.startsWith('http://') || baseImgSrc.startsWith('https://')) {
        if (!baseImgSrc.startsWith('http://localhost')) {
          img.crossOrigin = 'anonymous';
        }
      }
      img.onload = () => {
        resolve(renderWithImage(img));
      };
      img.onerror = (e) => {
        logger.error('[MaskCanvas] Failed to load image for composite export:', e);
        resolve(null);
      };
      img.src = baseImgSrc;
    });
  };

  const handleChangeBlendMode = useCallback((id: string, mode: PhotoshopBlendMode) => {
    if (id === 'active-mask') {
      setMaskOverlayBlendMode(mode);
      return;
    }
    setInpaintLayers(prev => prev.map(l => l.id === id ? { ...l, blendMode: mode } : l));
  }, []);

  const handleChangeOpacity = useCallback((id: string, opacity: number) => {
    if (id === 'active-mask') {
      setMaskOverlayOpacity(opacity / 100);
      return;
    }
    setInpaintLayers(prev => prev.map(l => l.id === id ? { ...l, opacity: Math.max(0, Math.min(100, opacity)) } : l));
  }, []);

  const handleToggleLock = useCallback((id: string) => {
    setInpaintLayers(prev => prev.map(l => l.id === id ? { ...l, locked: !l.locked } : l));
  }, []);

  const handleRenameLayer = useCallback((id: string, newName: string) => {
    setInpaintLayers(prev => prev.map(l => l.id === id ? { ...l, name: newName } : l));
  }, []);

  const handleToggleLayerVisibility = useCallback((id: string) => {
    if (id === 'active-mask') {
      setLayerVisibility(v => ({ ...v, selection: !v.selection }));
      return;
    }
    if (id === 'base') {
      setBaseImageVisible(v => !v);
      return;
    }
    setInpaintLayers(prev => prev.map(l => l.id === id ? { ...l, visible: !l.visible } : l));
  }, []);

  const handleAddLayer = useCallback(() => {
    const newId = `layer-${Date.now()}`;
    const nextNum = inpaintLayers.length + 1;

    // If there is an active mask stencil on canvas, promote it to a new layer
    if (maskPreviewUrl) {
      const newLayer: InpaintLayer = {
        id: newId,
        name: maskPrompt.trim() ? (maskPrompt.trim().length > 18 ? maskPrompt.trim().slice(0, 18) + '...' : maskPrompt.trim()) : `Layer ${nextNum}`,
        prompt: maskPrompt.trim() || `Layer ${nextNum}`,
        image: activeImageSrc || baseOriginalImage || '',
        maskDataUrl: maskPreviewUrl,
        maskPreviewUrl: maskPreviewUrl,
        visible: true,
        opacity: 100,
        blendMode: 'normal',
        selectedTarget: 'mask',
        createdAt: Date.now(),
      };
      setInpaintLayers(prev => [newLayer, ...prev]);
      setActiveLayerId(newId);
      clearMask();
    } else {
      const newLayer: InpaintLayer = {
        id: newId,
        name: `Layer ${nextNum}`,
        prompt: '',
        image: activeImageSrc || baseOriginalImage || '',
        visible: true,
        opacity: 100,
        blendMode: 'normal',
        selectedTarget: 'image',
        createdAt: Date.now(),
      };
      setInpaintLayers(prev => [newLayer, ...prev]);
      setActiveLayerId(newId);
    }
  }, [inpaintLayers.length, maskPreviewUrl, activeImageSrc, baseOriginalImage, maskPrompt, clearMask]);

  const handleDeleteLayer = useCallback((id: string) => {
    if (id === 'active-mask') {
      clearMask();
      setActiveLayerId(inpaintLayers.length > 0 ? inpaintLayers[0].id : 'base');
      return;
    }
    setInpaintLayers(prev => {
      const filtered = prev.filter(l => l.id !== id);
      if (activeLayerId === id) {
        setActiveLayerId(filtered.length > 0 ? filtered[0].id : 'base');
      }
      return filtered;
    });
  }, [clearMask, inpaintLayers, activeLayerId]);

  const handleDuplicateLayer = useCallback((id: string) => {
    if (id === 'active-mask') {
      handleAddLayer();
      return;
    }
    if (id === 'base') {
      const newId = `layer-${Date.now()}`;
      const newLayer: InpaintLayer = {
        id: newId,
        name: 'Background Copy',
        prompt: '',
        image: resolvedBaseImage || baseOriginalImage || '',
        visible: true,
        opacity: 100,
        blendMode: 'normal',
        selectedTarget: 'image',
        createdAt: Date.now(),
      };
      setInpaintLayers(prev => [...prev, newLayer]);
      setActiveLayerId(newId);
      return;
    }
    const target = inpaintLayers.find(l => l.id === id);
    if (!target) return;
    const duplicated: InpaintLayer = {
      ...target,
      id: `layer-${Date.now()}`,
      name: `${target.name} (Copy)`,
      createdAt: Date.now(),
    };
    setInpaintLayers(prev => {
      const idx = prev.findIndex(l => l.id === id);
      if (idx >= 0) {
        const copy = [...prev];
        copy.splice(idx, 0, duplicated);
        return copy;
      }
      return [duplicated, ...prev];
    });
    setActiveLayerId(duplicated.id);
  }, [inpaintLayers, handleAddLayer, resolvedBaseImage, baseOriginalImage]);

  const handleInvertMask = useCallback((id: string) => {
    if (id === 'base') return;
    if (id === 'active-mask' || !id) {
      invertCurrentMask();
      return;
    }
    setInpaintLayers(prev => prev.map(l => {
      if (l.id !== id) return l;
      if (l.maskDataUrl || l.maskPreviewUrl) {
        const src = l.maskDataUrl || l.maskPreviewUrl!;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const c = document.createElement('canvas');
          c.width = img.width;
          c.height = img.height;
          const ctx = c.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const imgData = ctx.getImageData(0, 0, c.width, c.height);
            const d = imgData.data;
            for (let i = 0; i < d.length; i += 4) {
              d[i] = 255 - d[i];
              d[i + 1] = 255 - d[i + 1];
              d[i + 2] = 255 - d[i + 2];
            }
            ctx.putImageData(imgData, 0, 0);
            const invertedB64 = c.toDataURL('image/png');
            setInpaintLayers(current => current.map(item => item.id === id ? { ...item, maskDataUrl: invertedB64, maskPreviewUrl: invertedB64 } : item));

            if (activeLayerId === id && canvasRef.current) {
              const mainCtx = canvasRef.current.getContext('2d');
              if (mainCtx) {
                const invImg = new Image();
                invImg.onload = () => {
                  mainCtx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
                  mainCtx.drawImage(invImg, 0, 0, canvasRef.current!.width, canvasRef.current!.height);
                  updateMaskPreview();
                };
                invImg.src = invertedB64;
              }
            }
          }
        };
        img.src = src;
      }
      return l;
    }));
  }, [invertCurrentMask, activeLayerId, updateMaskPreview]);

  const handleReorderLayers = useCallback((sourceIndex: number, targetIndex: number) => {
    setInpaintLayers(prev => {
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(sourceIndex, 1);
      copy.splice(targetIndex, 0, moved);
      return copy;
    });
  }, []);

  const handleSelectLayer = useCallback((id: string, target: 'image' | 'mask' = 'mask') => {
    setActiveLayerId(id);
    if (id === 'active-mask') {
      setMaskTool('brush');
      setDrawSubTool('brush');
      setWorkspaceMode('mask');
      setLayerVisibility(v => ({ ...v, selection: true }));
      return;
    }
    if (id === 'base') {
      return;
    }
    setInpaintLayers(prev => prev.map(l => l.id === id ? { ...l, selectedTarget: target } : l));
    const targetLayer = inpaintLayers.find(l => l.id === id);
    if (target === 'mask') {
      setMaskTool('brush');
      setDrawSubTool('brush');
      setWorkspaceMode('mask');
      setLayerVisibility(v => ({ ...v, selection: true }));
      const maskSrc = targetLayer?.maskDataUrl || targetLayer?.maskPreviewUrl;
      if (maskSrc && canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            updateMaskPreview();
          };
          img.src = maskSrc;
        }
      }
    }
  }, [inpaintLayers, updateMaskPreview]);

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
    setShowRulers,
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

  const handleGenerate = useCallback(async () => {
    setLocalIsGenerating(true);
    const finalPrompt = maskPrompt.trim();
    const refImages: string[] = [];

    const winPrompt = (window as any).__anarchyCurrentPrompt?.trim() || useAIConfigStore.getState().workspacePrompt?.trim() || '';

    const promptParts: string[] = [];
    if (finalPrompt) promptParts.push(finalPrompt);
    else if (winPrompt) promptParts.push(winPrompt);

    if (arrowNodes.length > 0) {
      const pinInstructions = arrowNodes
        .map((a, idx) => {
          const txt = a.text.trim();
          if (!txt) return null;
          const xPct = Math.round(a.targetPos.x);
          const yPct = Math.round(a.targetPos.y);
          const horiz = xPct < 35 ? 'left' : xPct > 65 ? 'right' : 'center';
          const vert = yPct < 35 ? 'top' : yPct > 65 ? 'bottom' : 'middle';
          const loc = vert === 'middle' && horiz === 'center' ? 'center' : `${vert}-${horiz}`;
          return `Target #${idx + 1} (${loc}, approx X: ${xPct}%, Y: ${yPct}%): replace with ${txt}`;
        })
        .filter(Boolean) as string[];

      if (pinInstructions.length > 0) {
        const joinedPins = pinInstructions.join('; ');
        promptParts.push(`[Pin edits: ${joinedPins}. Strict preservation: keep all other unmasked areas completely unchanged.]`);
      }

      arrowNodes.forEach((a) => {
        if (a.refImage) refImages.push(a.refImage);
      });
    }

    // Deduplicate identical prompt parts
    const uniqueParts = Array.from(new Set(promptParts.map(p => p.trim()))).filter(Boolean);
    const combinedPrompt = uniqueParts.join(', ');
    const payloadPrompt = combinedPrompt || 'AI Mask Generation';

    const result = await getCompositeAndMask();
    if (!result) {
      setLocalIsGenerating(false);
      return;
    }

    if (onGenerate) {
      onGenerate(result.composite, result.mask, payloadPrompt, refImages, liveModel);
    } else {
      window.dispatchEvent(
        new CustomEvent('anarchy:mask-generate', {
          detail: {
            compositeImage: result.composite,
            maskDataUrl: result.mask,
            prompt: payloadPrompt,
            refImages,
            model: liveModel,
            sourceNodeId: useAIConfigStore.getState().selectedNode?.id
          },
        })
      );
    }
  }, [maskPrompt, arrowNodes, onGenerate, liveModel, resolvedImage, image]);

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
        showRulers={showRulers}
        onToggleRulers={() => setShowRulers((prev) => !prev)}
        onOpenColorRange={() => setShowColorRangeModal(true)}
        onClearGuides={() => setGuides([])}
      />

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
        />
      )}

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
        onMouseUp={(e) => {
          if (isDraggingSplit) {
            setIsDraggingSplit(false);
            return;
          }
          if (endPan()) return;
          if (maskTool === 'crop') {
            crop.onCropWrapperUp();
          }
        }}
        onMouseLeave={(e) => {
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
        {/* Before / After Comparison Banner */}
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

        {/* Solo Alpha Stencil Banner */}
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
            onMouseDown={maskTool !== 'crop' && maskTool !== 'arrow' && !isSpacebarDown && maskTool !== 'hand' ? startDrawing : undefined}
            onMouseMove={maskTool !== 'crop' && maskTool !== 'arrow' && !isSpacebarDown && maskTool !== 'hand' ? draw : undefined}
            onMouseUp={maskTool !== 'crop' && maskTool !== 'arrow' ? stopDrawing : undefined}
            onTouchStart={maskTool !== 'crop' && maskTool !== 'arrow' && !isSpacebarDown && maskTool !== 'hand' ? startDrawing : undefined}
            onTouchMove={maskTool !== 'crop' && maskTool !== 'arrow' && !isSpacebarDown && maskTool !== 'hand' ? draw : undefined}
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
            onMouseEnter={maskTool !== 'crop' && maskTool !== 'arrow' && !isSpacebarDown && maskTool !== 'hand' ? () => setShowBrushCursor(true) : undefined}
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
              {/* Translucent Enclosed Area */}
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

              {/* Dynamic Laser Rubberband line to cursor */}
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

              {/* Placed Vertex Nodes */}
              {polygonPoints.map((pt, idx) => (
                <g key={idx}>
                  {idx === 0 ? (
                    // Start Vertex (Click to close target)
                    <g>
                      <circle cx={pt.x} cy={pt.y} r={7} fill="#10b981" stroke="#ffffff" strokeWidth="2" />
                      <circle cx={pt.x} cy={pt.y} r={14} fill="none" stroke="#10b981" strokeWidth="1.5" strokeDasharray="3 2" opacity="0.8" />
                      <text x={pt.x + 14} y={pt.y + 4} fill="#10b981" fontSize="10.5" fontWeight="bold" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
                        Click or Enter to Close
                      </text>
                    </g>
                  ) : (
                    // Intermediate Vertex
                    <circle cx={pt.x} cy={pt.y} r={4.5} fill="#e11d48" stroke="#ffffff" strokeWidth="1.5" />
                  )}
                </g>
              ))}
            </svg>
          )}

          {isDrawing && ((maskTool === 'lasso' && shapeSubTool !== 'polygon') || (maskTool === 'brush' && (drawSubTool === 'rect' || drawSubTool === 'circle' || drawSubTool === 'line'))) && (
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
                {/* Dynamic Inner Solid Core Ring (showing feather border) */}
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

                {/* Precision Center Dot */}
                <div className="mask-cursor-center-dot" />

                {/* Dynamic Floating Size & Softness HUD Badge */}
                <div className="mask-cursor-hud-badge">
                  <span>Ø {Math.round(brushSize)}px • {brushHardness}%</span>
                </div>
              </div>
            );
          })()}
        </div>


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
          <CropOverlay cropCssRect={cropCssRect} onApply={crop.applyCrop} onCancel={crop.clearCropRect} />
        )}

        {/* Architectural Rulers & Magnetic Snap Guides Overlay */}
        <RulerGuidesOverlay
          visible={showRulers}
          canvasRef={canvasRef}
          wrapperRef={wrapperRef}
          zoomScale={zoomScale}
          panOffset={panOffset}
          guides={guides}
          onGuidesChange={setGuides}
          cursorPos={cursorPos}
          onClearGuides={() => {
            setGuides([]);
            useNotificationStore.getState().addNotification({
              type: 'info',
              title: 'Guides Cleared',
              message: 'All magnetic guide lines removed.',
              duration: 1500,
            });
          }}
        />
      </div>

      {/* Smart Color Range & Luma Mask Isolation Studio Modal */}
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

      {/* Floating Canvas Viewport Zoom HUD (Part of Image Area / مساحة الصورة) */}
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
  );
};

export default MaskCanvas;
