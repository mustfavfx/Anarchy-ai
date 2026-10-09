import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { loadImageElement } from '../../../services/export/modules/imageExportUtils';
import { useNotificationStore } from '../../../stores/notificationStore';
import { useAIConfigStore } from '../../../stores/aiConfigStore';
import './ImageEditorToolbar.css';

// Subcomponents & utilities
import {
  type ActiveToolType,
  type CommentPin,
  type ResizeRatioOption,
  PRESET_COLORS,
  getEngineRatioOptions,
  getEngineDisplayName,
} from './imageEditor/types';
import { inpaintMaskedArea } from './imageEditor/inpaintAlgorithm';
import { MarkupSubtoolbar } from './imageEditor/MarkupSubtoolbar';
import { ResizeSubtoolbar } from './imageEditor/ResizeSubtoolbar';
import { CommentOverlay } from './imageEditor/CommentOverlay';
import { EraseControls } from './imageEditor/EraseControls';
import { MainPillToolbar } from './imageEditor/MainPillToolbar';

export type { ActiveToolType, ResizeRatioOption, CommentPin };
export { PRESET_COLORS };

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
  containerRef: _containerRef,
  nodeId,
  prompt,
  onImageUpdate,
  onCloseLightbox,
}) => {
  const addNotification = useNotificationStore((s) => s.addNotification);

  // Active Tool state
  const [activeTool, setActiveTool] = useState<ActiveToolType>(null);

  // Active engine & model metadata from AI Config Store
  const activeModel = useAIConfigStore((s) => s.aiConfig.model);
  const availableRatios = useMemo(() => getEngineRatioOptions(activeModel), [activeModel]);
  const engineDisplayName = useMemo(() => getEngineDisplayName(activeModel), [activeModel]);

  // ── Overlay Drawing Canvas State (for Markup & Erase) ──
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [markupColor, setMarkupColor] = useState<string>('#ffffff');
  const [markupType, setMarkupType] = useState<'pen' | 'highlighter'>('pen');
  const [brushSize, setBrushSize] = useState<number>(6);
  const [eraseSize, setEraseSize] = useState<number>(32);
  const [historyStack, setHistoryStack] = useState<ImageData[]>([]);

  // ── Erase Specific State ──
  const [hasEraseStrokes, setHasEraseStrokes] = useState<boolean>(false);
  const [eraseCursorPos, setEraseCursorPos] = useState<{ x: number; y: number } | null>(null);
  const sliderTrackRef = useRef<HTMLDivElement | null>(null);
  const [isDraggingSlider, setIsDraggingSlider] = useState<boolean>(false);

  // ── Comments State ──
  const [pins, setPins] = useState<CommentPin[]>([]);
  const [activePinId, setActivePinId] = useState<string | null>(null);
  const [commentInput, setCommentInput] = useState('');

  // ── Non-Destructive Resize / Framing State ──
  const [aspectRatio, setAspectRatio] = useState<string>(() => availableRatios[0]?.id || '1:1');

  // Keep selected aspect ratio in sync when engine changes
  useEffect(() => {
    if (availableRatios.length > 0 && !availableRatios.some((r) => r.id === aspectRatio)) {
      setAspectRatio(availableRatios[0].id);
    }
  }, [availableRatios, aspectRatio]);

  // ── Draggable Toolbar State (Point 1) ──
  const [toolbarPos, setToolbarPos] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingToolbar, setIsDraggingToolbar] = useState(false);
  const toolbarContainerRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef<{ clientX: number; clientY: number; initialX: number; initialY: number }>({
    clientX: 0,
    clientY: 0,
    initialX: 0,
    initialY: 0,
  });

  const handleDragHandleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!toolbarContainerRef.current) return;

    const rect = toolbarContainerRef.current.getBoundingClientRect();
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      initialX: rect.left,
      initialY: rect.top,
    };
    setIsDraggingToolbar(true);
  }, []);

  useEffect(() => {
    if (!isDraggingToolbar) return;

    const onMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartRef.current.clientX;
      const deltaY = e.clientY - dragStartRef.current.clientY;

      let newX = dragStartRef.current.initialX + deltaX;
      let newY = dragStartRef.current.initialY + deltaY;

      // Constrain within viewport padding
      const pad = 12;
      const w = toolbarContainerRef.current?.offsetWidth || 340;
      const h = toolbarContainerRef.current?.offsetHeight || 50;

      newX = Math.max(pad, Math.min(window.innerWidth - w - pad, newX));
      newY = Math.max(pad, Math.min(window.innerHeight - h - pad, newY));

      setToolbarPos({ x: newX, y: newY });
    };

    const onMouseUp = () => {
      setIsDraggingToolbar(false);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDraggingToolbar]);

  // Erase slider logic
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
    setHasEraseStrokes(false);
  }, [pushHistory]);

  // Mouse drawing on canvas (Markup & Erase)
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
    setIsDrawing(true);
    pushHistory();

    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCanvasCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);

    if (activeTool === 'markup') {
      ctx.strokeStyle = markupColor;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = markupType === 'highlighter' ? 0.45 : 1.0;
      ctx.globalCompositeOperation = 'source-over';
    } else if (activeTool === 'erase') {
      ctx.strokeStyle = '#ff2a6d';
      ctx.fillStyle = '#ff2a6d';
      ctx.lineWidth = eraseSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = 0.65;
      ctx.globalCompositeOperation = 'source-over';
      setHasEraseStrokes(true);
    }

    ctx.lineTo(x + 0.1, y + 0.1);
    ctx.stroke();
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

    if (!isDrawing) return;
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCanvasCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();

    if (activeTool === 'erase') {
      setHasEraseStrokes(true);
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.closePath();
    ctx.globalAlpha = 1.0;
  };

  // ── Apply Markup & Branch to Connected Child Node ──
  const handleApplyMarkup = async (markupPrompt?: string) => {
    if (!overlayCanvasRef.current) return;
    try {
      const img = await loadImageElement(imageUrl);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(img, 0, 0);
      ctx.drawImage(overlayCanvasRef.current, 0, 0, canvas.width, canvas.height);

      const newUrl = canvas.toDataURL('image/png');
      const actionPrompt = markupPrompt?.trim() || prompt || '';
      const actionLabel = markupPrompt?.trim()
        ? `Markup: ${markupPrompt.trim().slice(0, 24)}`
        : 'Markup: Hand-Drawn Annotation';

      if (nodeId) {
        const childId = useAIConfigStore.getState().forkChildNode(
          nodeId,
          newUrl,
          actionLabel,
          actionPrompt
        );

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

  // ── Comments Handling ──
  const handleCommentOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool !== 'comment' || !imageElementRef.current) return;
    const rect = imageElementRef.current.getBoundingClientRect();
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

  // ── Non-Destructive Resize / Ratio Selection (Point 2) ──
  const handleSelectAspectRatio = (opt: ResizeRatioOption) => {
    setAspectRatio(opt.id);
  };

  /**
   * Main OK / Confirm Handler for Resize:
   * Dispatches to the chosen AI engine with a resize prompt and dimensions,
   * creating a new child node connected to the node being edited.
   */
  const handleApplyResize = () => {
    const currentOpt = availableRatios.find((o) => o.id === aspectRatio) || availableRatios[0];
    const chosenRatio = currentOpt ? currentOpt.ratio : aspectRatio;
    const ratioName = currentOpt ? currentOpt.name : 'Custom Framing';

    // Synchronize global AI config store with chosen aspect ratio
    useAIConfigStore.getState().updateConfig({ aspectRatio: currentOpt ? currentOpt.id : aspectRatio });

    const basePrompt = prompt?.trim() || '';
    const resizeInstruction = `resize framing to ${chosenRatio} (${ratioName}), architectural composition expansion, consistent materiality and lighting`;
    const finalPrompt = basePrompt
      ? `${basePrompt}, ${resizeInstruction}`
      : `Architectural design, ${resizeInstruction}`;

    const branchLabel = `Resize: ${ratioName} (${chosenRatio})`;

    if (nodeId) {
      useAIConfigStore.getState().setLastSelectedNodeId(nodeId);
      const childId = useAIConfigStore.getState().forkChildNode(
        nodeId,
        imageUrl,
        branchLabel,
        finalPrompt
      );

      if (childId) {
        const executeFn = useAIConfigStore.getState().executeNode;
        if (executeFn) {
          executeFn(childId, finalPrompt, { aspectRatio: currentOpt ? currentOpt.id : aspectRatio }).catch((err) => {
            console.warn('AI execution after resize failed:', err);
          });
        }
      }
    } else {
      onImageUpdate?.(imageUrl);
    }

    setActiveTool(null);
    onCloseLightbox();

    addNotification({
      type: 'success',
      title: `🌿 AI Resize Node Created (${chosenRatio})`,
      message: `Dispatched to ${engineDisplayName} with ${ratioName} (${chosenRatio}) framing.`,
      duration: 3500,
    });
  };

  // Unified OK button click dispatcher for toolbar
  const handleApplyCurrentTool = () => {
    if (activeTool === 'resize') {
      handleApplyResize();
    } else if (activeTool === 'markup') {
      handleApplyMarkup();
    }
  };

  // Toggle active tool
  const handleToggleTool = (tool: ActiveToolType) => {
    if (activeTool === tool) {
      setActiveTool(null);
    } else {
      setActiveTool(tool);
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

      {/* 2. Comment Click Layer & Pins */}
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

      {/* ── Draggable Floating Toolbar Container ── */}
      <div
        ref={toolbarContainerRef}
        className={`chatgpt-image-toolbar-container ${isDraggingToolbar ? 'dragging' : ''}`}
        style={{
          display: activeTool === 'erase' ? 'none' : 'flex',
          ...(toolbarPos
            ? {
                left: `${toolbarPos.x}px`,
                top: `${toolbarPos.y}px`,
                bottom: 'auto',
                transform: 'none',
              }
            : {}),
        }}
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

        {activeTool === 'resize' && (
          <ResizeSubtoolbar
            modelName={activeModel}
            aspectRatio={aspectRatio}
            options={availableRatios}
            onSelectAspectRatio={handleSelectAspectRatio}
            onConfirmResize={handleApplyResize}
            onCancel={() => setActiveTool(null)}
          />
        )}

        {/* The Main Pill Toolbar with Drag Handle & OK Button */}
        <MainPillToolbar
          activeTool={activeTool}
          onToggleTool={handleToggleTool}
          onDragHandleMouseDown={handleDragHandleMouseDown}
          isDragging={isDraggingToolbar}
          onApplyCurrentTool={handleApplyCurrentTool}
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
