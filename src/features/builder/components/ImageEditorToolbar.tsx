import React, { useState, useRef, useEffect, useCallback } from 'react';
import { loadImageElement } from '../../../services/export/modules/imageExportUtils';
import { useNotificationStore } from '../../../stores/notificationStore';
import { useAIConfigStore } from '../../../stores/aiConfigStore';
import './ImageEditorToolbar.css';

// Subcomponents & utilities
import {
  type ActiveToolType,
  type CommentPin,
  type ResizeRatioOption,
  RESIZE_OPTIONS,
  PRESET_COLORS,
} from './imageEditor/types';
import { inpaintMaskedArea } from './imageEditor/inpaintAlgorithm';
import { MarkupSubtoolbar } from './imageEditor/MarkupSubtoolbar';
import { RemoveBgSubtoolbar } from './imageEditor/RemoveBgSubtoolbar';
import { ResizeSubtoolbar } from './imageEditor/ResizeSubtoolbar';
import { CropOverlay } from './imageEditor/CropOverlay';
import { CommentOverlay } from './imageEditor/CommentOverlay';
import { EraseControls } from './imageEditor/EraseControls';
import { MainPillToolbar } from './imageEditor/MainPillToolbar';

export type { ActiveToolType, ResizeRatioOption, CommentPin };
export { RESIZE_OPTIONS, PRESET_COLORS };

interface ImageEditorToolbarProps {
  imageUrl: string;
  imageElementRef: React.RefObject<HTMLImageElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  nodeId?: string;
  prompt?: string;
  onImageUpdate?: (newImageUrl: string) => void;
  onCloseLightbox: () => void;
}

export const ImageEditorToolbar: React.FC<ImageEditorToolbarProps> = ({
  imageUrl,
  imageElementRef,
  containerRef,
  nodeId,
  prompt,
  onImageUpdate,
  onCloseLightbox,
}) => {
  const [activeTool, setActiveTool] = useState<ActiveToolType>(null);
  const addNotification = useNotificationStore((s) => s.addNotification);

  // ── Markup / Erase Canvas State ──
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [markupColor, setMarkupColor] = useState<string>('#ffffff');
  const [markupType, setMarkupType] = useState<'pen' | 'highlighter'>('pen');
  const [brushSize, setBrushSize] = useState<number>(6);
  const [eraseSize, setEraseSize] = useState<number>(32);
  const [historyStack, setHistoryStack] = useState<ImageData[]>([]);

  // ── Erase Specific State (ChatGPT Style) ──
  const [hasEraseStrokes, setHasEraseStrokes] = useState<boolean>(false);
  const [eraseCursorPos, setEraseCursorPos] = useState<{ x: number; y: number } | null>(null);
  const sliderTrackRef = useRef<HTMLDivElement | null>(null);
  const [isDraggingSlider, setIsDraggingSlider] = useState<boolean>(false);

  const updateSliderFromClientY = useCallback((clientY: number) => {
    if (!sliderTrackRef.current) return;
    const rect = sliderTrackRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (rect.bottom - clientY) / rect.height));
    const minSize = 10;
    const maxSize = 100;
    const newSize = Math.round(minSize + pct * (maxSize - minSize));
    setEraseSize(newSize);
  }, []);

  const handleSliderMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDraggingSlider(true);
    updateSliderFromClientY(e.clientY);
  };

  useEffect(() => {
    if (!isDraggingSlider) return;
    const onMove = (e: MouseEvent) => {
      updateSliderFromClientY(e.clientY);
    };
    const onUp = () => {
      setIsDraggingSlider(false);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isDraggingSlider, updateSliderFromClientY]);

  const handleCloseErase = () => {
    setActiveTool(null);
    handleClearDrawing();
    setHasEraseStrokes(false);
    setEraseCursorPos(null);
  };

  // ── Remove BG State ──
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const [removeBgPreviewUrl, setRemoveBgPreviewUrl] = useState<string | null>(null);
  const [bgTolerance, setBgTolerance] = useState<number>(35);

  // ── Comments State ──
  const [pins, setPins] = useState<CommentPin[]>([]);
  const [activePinId, setActivePinId] = useState<string | null>(null);
  const [commentInput, setCommentInput] = useState('');

  // ── Resize / Crop State ──
  const [cropRect, setCropRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [aspectRatio, setAspectRatio] = useState<string>('1:1');
  const [isDraggingCrop, setIsDraggingCrop] = useState<string | null>(null);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; rect: { x: number; y: number; w: number; h: number } }>({
    mouseX: 0,
    mouseY: 0,
    rect: { x: 0, y: 0, w: 0, h: 0 },
  });

  // Keep overlay canvas matched with display image layout
  const syncOverlayCanvasSize = useCallback(() => {
    const img = imageElementRef.current;
    const canvas = overlayCanvasRef.current;
    if (!img || !canvas) return;

    const rect = img.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
        canvas.width = img.naturalWidth || rect.width;
        canvas.height = img.naturalHeight || rect.height;
      }
    }
  }, [imageElementRef]);

  useEffect(() => {
    syncOverlayCanvasSize();
    window.addEventListener('resize', syncOverlayCanvasSize);
    return () => window.removeEventListener('resize', syncOverlayCanvasSize);
  }, [syncOverlayCanvasSize]);

  // Save canvas state to undo stack
  const pushHistory = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    try {
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setHistoryStack((prev) => [...prev.slice(-12), data]);
    } catch {
      // Ignored if tainted
    }
  }, []);

  const handleUndo = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas || historyStack.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const newStack = [...historyStack];
    const prev = newStack.pop();
    setHistoryStack(newStack);

    if (prev) {
      ctx.putImageData(prev, 0, 0);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [historyStack]);

  const handleClearDrawing = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    pushHistory();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, [pushHistory]);

  // ── Drawing Events (Markup & Erase) ──
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool !== 'markup' && activeTool !== 'erase') return;
    e.stopPropagation();
    pushHistory();
    setIsDrawing(true);

    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCanvasCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);

    if (activeTool === 'markup') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = markupColor;
      ctx.fillStyle = markupColor;
      ctx.globalAlpha = markupType === 'highlighter' ? 0.38 : 1.0;
      ctx.lineWidth = markupType === 'highlighter' ? brushSize * 2.5 : brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.arc(x, y, (ctx.lineWidth || 1) / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x, y);
    } else if (activeTool === 'erase') {
      setHasEraseStrokes(true);
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.lineWidth = eraseSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.arc(x, y, eraseSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool === 'erase') {
      const canvas = overlayCanvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        setEraseCursorPos({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      }
    }
    if (!isDrawing || (activeTool !== 'markup' && activeTool !== 'erase')) return;
    e.stopPropagation();
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCanvasCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleMouseUp = () => {
    if (isDrawing) {
      setIsDrawing(false);
    }
  };

  // ── Apply Markup & Branch to Connected Child Node ──
  const handleApplyMarkup = async (markupPrompt?: string) => {
    try {
      const img = await loadImageElement(imageUrl);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw base image
      ctx.drawImage(img, 0, 0);

      // Draw markup canvas on top
      if (overlayCanvasRef.current) {
        ctx.drawImage(overlayCanvasRef.current, 0, 0, canvas.width, canvas.height);
      }

      const newUrl = canvas.toDataURL('image/png');
      const actionPrompt = markupPrompt?.trim() || prompt || '';
      const actionLabel = markupPrompt?.trim()
        ? `Markup: ${markupPrompt.trim().slice(0, 24)}`
        : 'Markup: Sketch Annotation';

      if (nodeId) {
        const childId = useAIConfigStore.getState().forkChildNode(
          nodeId,
          newUrl,
          actionLabel,
          actionPrompt
        );

        // If user gave a specific AI instruction, trigger execution on the new child node
        if (childId && markupPrompt?.trim()) {
          const executeFn = useAIConfigStore.getState().executeNode;
          if (executeFn) {
            executeFn(childId, actionPrompt).catch((err) => {
              console.warn('AI execution after markup failed:', err);
            });
          }
        }
      } else {
        onImageUpdate?.(newUrl);
      }

      handleClearDrawing();
      setActiveTool(null);
      onCloseLightbox();

      addNotification({
        type: 'success',
        title: '🌿 Child Node Created',
        message: 'Saved markup to a new connected child branch.',
        duration: 3500,
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: 'Failed to Save',
        message: err?.message || 'Could not apply markup.',
        duration: 3000,
      });
    }
  };

  // ── Apply Erase / Inpaint & Branch to Connected Child Node ──
  const handleApplyErase = async (erasePrompt?: string) => {
    if (!overlayCanvasRef.current || !hasEraseStrokes) return;
    try {
      const img = await loadImageElement(imageUrl);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw base image
      ctx.drawImage(img, 0, 0);

      // Intelligent inpainting removal of the brushed mask
      inpaintMaskedArea(canvas, overlayCanvasRef.current);

      const newUrl = canvas.toDataURL('image/png');
      const actionPrompt = erasePrompt?.trim() || prompt || '';
      const actionLabel = erasePrompt?.trim()
        ? `Erase: ${erasePrompt.trim().slice(0, 24)}`
        : 'Erase: Removed Object';

      if (nodeId) {
        const childId = useAIConfigStore.getState().forkChildNode(
          nodeId,
          newUrl,
          actionLabel,
          actionPrompt
        );

        // If user entered a replacement prompt, dispatch generation to engine on the new child node
        if (childId && erasePrompt?.trim()) {
          const executeFn = useAIConfigStore.getState().executeNode;
          if (executeFn) {
            executeFn(childId, actionPrompt).catch((err) => {
              console.warn('AI execution after erase failed:', err);
            });
          }
        }
      } else {
        onImageUpdate?.(newUrl);
      }

      handleClearDrawing();
      setHasEraseStrokes(false);
      setActiveTool(null);
      setEraseCursorPos(null);
      onCloseLightbox();

      addNotification({
        type: 'success',
        title: '🌿 Child Node Created',
        message: 'Smart inpaint completed and connected to parent node.',
        duration: 3500,
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: 'Inpaint Failed',
        message: err?.message || 'Could not apply erase.',
        duration: 3000,
      });
    }
  };

  // ── Remove BG Algorithm ──
  const processRemoveBackground = useCallback(async (customTolerance?: number) => {
    setIsRemovingBg(true);
    try {
      const tol = customTolerance !== undefined ? customTolerance : bgTolerance;
      const img = await loadImageElement(imageUrl);
      const canvas = document.createElement('canvas');
      const w = (canvas.width = img.naturalWidth || img.width);
      const h = (canvas.height = img.naturalHeight || img.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;

      // Sample perimeter corners & top edge to identify background color
      const samplePoints = [
        [0, 0],
        [Math.floor(w / 2), 0],
        [w - 1, 0],
        [0, Math.floor(h * 0.25)],
        [w - 1, Math.floor(h * 0.25)],
      ];

      let avgR = 0,
        avgG = 0,
        avgB = 0;
      for (const [sx, sy] of samplePoints) {
        const idx = (sy * w + sx) * 4;
        avgR += data[idx];
        avgG += data[idx + 1];
        avgB += data[idx + 2];
      }
      avgR /= samplePoints.length;
      avgG /= samplePoints.length;
      avgB /= samplePoints.length;

      // Flood fill from border perimeter
      const visited = new Uint8Array(w * h);
      const queue = new Int32Array(w * h * 2);
      let qHead = 0;
      let qTail = 0;

      // Seed borders (top edge, left edge, right edge)
      for (let x = 0; x < w; x++) {
        queue[qTail++] = x;
        queue[qTail++] = 0;
        visited[x] = 1;
      }
      for (let y = 1; y < Math.floor(h * 0.85); y++) {
        queue[qTail++] = 0;
        queue[qTail++] = y;
        visited[y * w] = 1;

        queue[qTail++] = w - 1;
        queue[qTail++] = y;
        visited[y * w + (w - 1)] = 1;
      }

      const threshold = tol * 2.5;

      while (qHead < qTail) {
        const cx = queue[qHead++];
        const cy = queue[qHead++];
        const cIdx = (cy * w + cx) * 4;

        const r = data[cIdx];
        const g = data[cIdx + 1];
        const b = data[cIdx + 2];

        // Color Euclidean distance to sampled background
        const dist = Math.sqrt(
          (r - avgR) * (r - avgR) +
          (g - avgG) * (g - avgG) +
          (b - avgB) * (b - avgB)
        );

        if (dist <= threshold) {
          data[cIdx + 3] = 0; // Make transparent

          // 4-way neighbors
          const neighbors = [
            [cx + 1, cy],
            [cx - 1, cy],
            [cx, cy + 1],
            [cx, cy - 1],
          ];

          for (const [nx, ny] of neighbors) {
            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
              const nOffset = ny * w + nx;
              if (!visited[nOffset]) {
                visited[nOffset] = 1;
                queue[qTail++] = nx;
                queue[qTail++] = ny;
              }
            }
          }
        }
      }

      ctx.putImageData(imgData, 0, 0);
      const resultDataUrl = canvas.toDataURL('image/png');
      setRemoveBgPreviewUrl(resultDataUrl);
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: 'Remove BG Failed',
        message: err?.message || 'Could not process background removal.',
        duration: 3000,
      });
    } finally {
      setIsRemovingBg(false);
    }
  }, [imageUrl, bgTolerance, addNotification]);

  const handleApplyRemoveBg = () => {
    if (removeBgPreviewUrl) {
      if (nodeId) {
        useAIConfigStore.getState().forkChildNode(
          nodeId,
          removeBgPreviewUrl,
          'Cutout: Transparent PNG',
          prompt
        );
      } else {
        onImageUpdate?.(removeBgPreviewUrl);
      }
      setActiveTool(null);
      setRemoveBgPreviewUrl(null);
      onCloseLightbox();
      addNotification({
        type: 'success',
        title: '🌿 Cutout Node Created',
        message: 'Background removed and branched to a new connected node.',
        duration: 3500,
      });
    }
  };

  // ── Comment Pin Drop ──
  const handleCommentOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool !== 'comment') return;
    const img = imageElementRef.current;
    if (!img) return;

    const rect = img.getBoundingClientRect();
    const xPct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const yPct = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

    const newPin: CommentPin = {
      id: `pin_${Date.now()}`,
      xPct,
      yPct,
      text: '',
      num: pins.length + 1,
    };

    setPins((prev) => [...prev, newPin]);
    setActivePinId(newPin.id);
    setCommentInput('');
  };

  // ── Send Pin to AI Architect Agent & Branch to Connected Child Node ──
  const handleSendToAgent = (pin: CommentPin) => {
    if (!pin.text.trim()) return;

    const currentPrompt = prompt || '';
    const augmented = currentPrompt ? `${currentPrompt}, ${pin.text}` : pin.text;

    if (nodeId) {
      useAIConfigStore.getState().updateNodePrompt(nodeId, augmented);
      const childId = useAIConfigStore.getState().forkChildNode(
        nodeId,
        imageUrl,
        `AI Comment: #${pin.num}`,
        augmented
      );

      if (childId) {
        const executeFn = useAIConfigStore.getState().executeNode;
        if (executeFn) {
          executeFn(childId, augmented).catch((err) => {
            console.warn('AI execution after comment failed:', err);
          });
        }
      }
    }

    setActivePinId(null);
    setActiveTool(null);
    onCloseLightbox();

    addNotification({
      type: 'info',
      title: `🌿 Instruction Node Created (#${pin.num})`,
      message: `Instruction sent to model for node generation: "${pin.text.slice(0, 40)}..."`,
      duration: 4000,
    });
  };

  // ── Resize / Crop Setup ──
  const handleSelectAspectRatio = (opt: ResizeRatioOption) => {
    setAspectRatio(opt.id);
    if (imageElementRef.current) {
      const rect = imageElementRef.current.getBoundingClientRect();
      const maxW = rect.width * 0.9;
      const maxH = rect.height * 0.9;

      let newW = maxW;
      let newH = (newW * opt.hRatio) / opt.wRatio;

      if (newH > maxH) {
        newH = maxH;
        newW = (newH * opt.wRatio) / opt.hRatio;
      }

      setCropRect({
        x: Math.max(0, (rect.width - newW) / 2),
        y: Math.max(0, (rect.height - newH) / 2),
        w: newW,
        h: newH,
      });
    }
  };

  const handleGenerateWithRatio = (opt: ResizeRatioOption) => {
    useAIConfigStore.getState().updateConfig({ aspectRatio: opt.id });
    if (nodeId) {
      useAIConfigStore.getState().setLastSelectedNodeId(nodeId);
      const childId = useAIConfigStore.getState().forkChildNode(
        nodeId,
        imageUrl,
        `AI Resize: ${opt.name} (${opt.ratio})`,
        prompt
      );

      if (childId) {
        const executeFn = useAIConfigStore.getState().executeNode;
        if (executeFn) {
          executeFn(childId, prompt || 'AI architectural expansion', { aspectRatio: opt.id }).catch((err) => {
            console.warn('AI expansion failed:', err);
          });
        }
      }
    }
    setActiveTool(null);
    onCloseLightbox();
    addNotification({
      type: 'success',
      title: `🌿 AI Expansion (${opt.ratio})`,
      message: 'Created node and dispatched outpainting request.',
      duration: 3500,
    });
  };

  useEffect(() => {
    if (activeTool === 'resize') {
      const img = imageElementRef.current;
      if (img) {
        const rect = img.getBoundingClientRect();
        const currentOpt = RESIZE_OPTIONS.find((o) => o.id === aspectRatio) || RESIZE_OPTIONS[0];
        const maxW = rect.width * 0.9;
        const maxH = rect.height * 0.9;

        let newW = maxW;
        let newH = (newW * currentOpt.hRatio) / currentOpt.wRatio;

        if (newH > maxH) {
          newH = maxH;
          newW = (newH * currentOpt.wRatio) / currentOpt.hRatio;
        }

        setCropRect({
          x: Math.max(0, (rect.width - newW) / 2),
          y: Math.max(0, (rect.height - newH) / 2),
          w: newW,
          h: newH,
        });
      }
    } else {
      setCropRect(null);
    }
  }, [activeTool, imageElementRef]);

  // ── Apply Crop & Branch to Connected Child Node ──
  const handleApplyCrop = async () => {
    if (!cropRect || !imageElementRef.current) return;
    try {
      const img = await loadImageElement(imageUrl);
      const displayRect = imageElementRef.current.getBoundingClientRect();
      const scaleX = (img.naturalWidth || img.width) / displayRect.width;
      const scaleY = (img.naturalHeight || img.height) / displayRect.height;

      const sx = Math.max(0, cropRect.x * scaleX);
      const sy = Math.max(0, cropRect.y * scaleY);
      const sw = Math.min((img.naturalWidth || img.width) - sx, cropRect.w * scaleX);
      const sh = Math.min((img.naturalHeight || img.height) - sy, cropRect.h * scaleY);

      if (sw < 10 || sh < 10) return;

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(sw);
      canvas.height = Math.round(sh);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      const croppedUrl = canvas.toDataURL('image/png');

      const currentOpt = RESIZE_OPTIONS.find((o) => o.id === aspectRatio) || RESIZE_OPTIONS[0];
      const branchLabel = `Resize: ${currentOpt.name} (${currentOpt.ratio})`;

      if (nodeId) {
        useAIConfigStore.getState().forkChildNode(
          nodeId,
          croppedUrl,
          branchLabel,
          prompt
        );
      } else {
        onImageUpdate?.(croppedUrl);
      }

      setActiveTool(null);
      onCloseLightbox();

      addNotification({
        type: 'success',
        title: '🌿 Cropped Node Created',
        message: `Aspect ratio (${currentOpt.ratio}) applied to new connected node.`,
        duration: 3500,
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: 'Crop Failed',
        message: err?.message || 'Could not crop image.',
        duration: 3000,
      });
    }
  };

  // Toggle active tool
  const handleToggleTool = (tool: ActiveToolType) => {
    if (activeTool === tool) {
      setActiveTool(null);
      setRemoveBgPreviewUrl(null);
    } else {
      setActiveTool(tool);
      if (tool === 'removeBg') {
        processRemoveBackground();
      }
    }
  };

  return (
    <>
      {/* ── Visual Overlays Mounted Directly Over the Image ── */}
      {/* 1. Markup & Erase Overlay Canvas */}
      <canvas
        ref={overlayCanvasRef}
        className={`image-editor-canvas-layer ${
          activeTool === 'markup'
            ? 'cursor-pen'
            : activeTool === 'erase'
            ? 'cursor-eraser'
            : ''
        }`}
        style={{
          display: activeTool === 'markup' || activeTool === 'erase' ? 'block' : 'none',
          zIndex: 10002,
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseEnter={(e) => {
          if (activeTool === 'erase') {
            const canvas = overlayCanvasRef.current;
            if (canvas) {
              const rect = canvas.getBoundingClientRect();
              setEraseCursorPos({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
              });
            }
          }
        }}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          handleMouseUp();
          setEraseCursorPos(null);
        }}
      />

      {/* 2. Remove BG Cutout Preview */}
      {activeTool === 'removeBg' && removeBgPreviewUrl && (
        <img
          src={removeBgPreviewUrl}
          alt="Cutout Preview"
          className="checkered-transparent-bg"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            borderRadius: '10px',
            zIndex: 10002,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* 3. Comment Click Layer & Pins */}
      {activeTool === 'comment' && (
        <CommentOverlay
          pins={pins}
          setPins={setPins}
          activePinId={activePinId}
          setActivePinId={setActivePinId}
          commentInput={commentInput}
          setCommentInput={setCommentInput}
          onOverlayClick={handleCommentOverlayClick}
          onSendToAgent={handleSendToAgent}
        />
      )}

      {/* 4. Interactive Crop & Resize Overlay */}
      {activeTool === 'resize' && cropRect && (
        <CropOverlay
          cropRect={cropRect}
          setCropRect={setCropRect}
          isDraggingCrop={isDraggingCrop}
          setIsDraggingCrop={setIsDraggingCrop}
          dragStartRef={dragStartRef}
          containerRef={containerRef}
        />
      )}

      {/* ── Floating Toolbar Container (Markup / Comment / RemoveBg / Resize) ── */}
      <div
        className="chatgpt-image-toolbar-container"
        style={{ display: activeTool === 'erase' ? 'none' : 'flex' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Floating Subtoolbar Card for the Active Tool */}
        {activeTool === 'markup' && (
          <MarkupSubtoolbar
            markupColor={markupColor}
            setMarkupColor={setMarkupColor}
            markupType={markupType}
            setMarkupType={setMarkupType}
            brushSize={brushSize}
            setBrushSize={setBrushSize}
            onUndo={handleUndo}
            onClear={handleClearDrawing}
            onApply={handleApplyMarkup}
            onCancel={() => {
              setActiveTool(null);
              handleClearDrawing();
            }}
          />
        )}

        {activeTool === 'removeBg' && (
          <RemoveBgSubtoolbar
            isRemovingBg={isRemovingBg}
            bgTolerance={bgTolerance}
            setBgTolerance={setBgTolerance}
            onProcessTolerance={processRemoveBackground}
            removeBgPreviewUrl={removeBgPreviewUrl}
            onApply={handleApplyRemoveBg}
            onCancel={() => {
              setActiveTool(null);
              setRemoveBgPreviewUrl(null);
            }}
          />
        )}

        {activeTool === 'resize' && (
          <ResizeSubtoolbar
            aspectRatio={aspectRatio}
            onSelectAspectRatio={handleSelectAspectRatio}
            onApplyCrop={handleApplyCrop}
            onGenerateWithRatio={handleGenerateWithRatio}
            onCancel={() => setActiveTool(null)}
          />
        )}

        {/* The Main Pill Toolbar */}
        <MainPillToolbar
          activeTool={activeTool}
          onToggleTool={handleToggleTool}
        />
      </div>

      {/* ── Top Floating Erase Capsule & Controls (ChatGPT Style) ── */}
      {activeTool === 'erase' && (
        <EraseControls
          eraseSize={eraseSize}
          hasEraseStrokes={hasEraseStrokes}
          historyLength={historyStack.length}
          sliderTrackRef={sliderTrackRef}
          onSliderMouseDown={handleSliderMouseDown}
          onUndo={handleUndo}
          onApply={handleApplyErase}
          onClose={handleCloseErase}
          cursorPos={eraseCursorPos}
        />
      )}
    </>
  );
};
