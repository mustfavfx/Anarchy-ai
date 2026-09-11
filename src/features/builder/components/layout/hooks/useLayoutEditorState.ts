import React, { useState, useEffect, useRef } from 'react';
import { anarchyService } from '../../../../../services/anarchy/AnarchyService';
import { useResolvedImage } from '../../../../../hooks';
import { logger } from '../../../../../utils/logger';
import { useAuth } from '../../../../auth/AuthContext';
import {
  type LayoutRegion,
  type LayoutData,
  type TextOverlay,
  type StickyNote,
  type ImageAdjustments,
  type CropBounds,
  type LayoutEditorProps,
  type TreeNode,
  type ChatMessage,
  DEFAULT_ADJUSTMENTS,
  DEFAULT_CROP_BOUNDS,
  buildReveHierarchyTree,
  ASPECT_RATIO_OPTIONS,
} from '../types';
import { useLayoutSceneLibrary } from './useLayoutSceneLibrary';
import { useLayoutAIOperations } from './useLayoutAIOperations';

export const useLayoutEditorState = ({
  rawImage: rawImageProp,
  image: imageProp,
  initialLayout,
  onApplyResult,
  onLayoutExtracted,
  className = '',
  isEnlargedView = false,
}: LayoutEditorProps) => {
  const rawImage = rawImageProp || imageProp || null;
  const { user: authUser } = useAuth();
  const userId = authUser?.id || 'anon_user';
  const resolvedUrl = useResolvedImage(rawImage || undefined);
  const displayImage = resolvedUrl || rawImage || null;

  const [activeStageImage, setActiveStageImage] = useState<string | null>(displayImage);
  const [layout, setLayout] = useState<LayoutData | null>(null);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [selectedRegionIdx, setSelectedRegionIdx] = useState<number | null>(null);
  const [hoveredRegionIdx, setHoveredRegionIdx] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [regionPrompts, setRegionPrompts] = useState<Record<number, string>>({});
  const [cropThumbnails, setCropThumbnails] = useState<Record<number, string>>({});
  const [isGroupExpanded, setIsGroupExpanded] = useState<boolean>(true);
  const [activeEditingIdx, setActiveEditingIdx] = useState<number | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Record<number, boolean>>({});

  // Left Thumbnail History Strip State
  const [imageHistory, setImageHistory] = useState<string[]>([]);
  const [showKeyModal, setShowKeyModal] = useState<boolean>(false);
  const [inputKey, setInputKey] = useState<string>(() => localStorage.getItem('anarchy_api_key') || '');

  const [panelMode, setPanelMode] = useState<'edit' | 'chat'>('edit');
  const [askAnarchyPrompt, setAskAnarchyPrompt] = useState<string>('');
  const [showMentionMenu, setShowMentionMenu] = useState<boolean>(false);
  const [_chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'agent',
      text: 'Hello! I am your Anarchy AI Agent. Ask me to reformat scenes, edit layout regions, or apply style modifications.',
      time: 'Just now'
    }
  ]);

  // Interactive Region BBox Drag & Resize Engine State
  const [activeRegionHandle, setActiveRegionHandle] = useState<string | null>(null);
  const [regionDragStartPos, setRegionDragStartPos] = useState<{ x: number, y: number } | null>(null);
  const [initialRegionBbox, setInitialRegionBbox] = useState<CropBounds | null>(null);

  // Interactive Zoom & Scale Engine State
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [cropBounds, setCropBounds] = useState<CropBounds>(DEFAULT_CROP_BOUNDS);
  const [activeCropHandle, setActiveCropHandle] = useState<string | null>(null);
  const [cropDragStartPos, setCropDragStartPos] = useState<{ x: number, y: number } | null>(null);
  const [initialBoundsOnDrag, setInitialBoundsOnDrag] = useState<CropBounds | null>(null);

  // Active Tool Mode (8 Buttons + Adjust)
  const [activeToolbarTool, setActiveToolbarTool] = useState<'select' | 'bbox' | 'brush' | '3d' | 'text' | 'note' | 'image' | 'fit' | 'adjust'>('select');

  // Tool 2: Bounding Box Marquee Drawing
  const [isDrawingBbox, setIsDrawingBbox] = useState<boolean>(false);
  const [drawStart, setDrawStart] = useState<{ x: number, y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number, y: number } | null>(null);

  // Tool 3: Inpaint Mask Brush & Sub-toolbar
  const [brushSize, setBrushSize] = useState<number>(30);
  const [brushColor, setBrushColor] = useState<string>('#ec4899');
  const [isDrawingMask, setIsDrawingMask] = useState<boolean>(false);
  const [maskPrompt, setMaskPrompt] = useState<string>('');
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const lastBrushPosRef = useRef<{ x: number, y: number } | null>(null);
  const clearMaskCanvas = () => {
    if (!maskCanvasRef.current) return;
    const ctx = maskCanvasRef.current.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height);
    }
  };

  // Tool 4: 3D Perspective Grid
  const [vanishingPoint, setVanishingPoint] = useState<{ x: number, y: number }>({ x: 0.5, y: 0.5 });
  const [isDragging3DVanishingPoint, setIsDragging3DVanishingPoint] = useState<boolean>(false);

  // Tool 5: Text Tool Dragging & State
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [activeTextId, setActiveTextId] = useState<string | null>(null);
  const [draggingTextId, setDraggingTextId] = useState<string | null>(null);
  const [textDragStartPos, setTextDragStartPos] = useState<{ x: number, y: number } | null>(null);
  const [initialTextPos, setInitialTextPos] = useState<{ x: number, y: number } | null>(null);

  // Tool 6: Sticky Notes Dragging & State
  const [stickyNotes, setStickyNotes] = useState<StickyNote[]>([]);
  const [draggingNoteId, setDraggingNoteId] = useState<string | null>(null);
  const [noteDragStartPos, setNoteDragStartPos] = useState<{ x: number, y: number } | null>(null);
  const [initialNotePos, setInitialNotePos] = useState<{ x: number, y: number } | null>(null);

  // Tool 7: Add Image Popup
  const [showAddImageMenu, setShowAddImageMenu] = useState<boolean>(false);

  // Tool 8: Reframe Engine State
  const [isReframeActive, setIsReframeActive] = useState<boolean>(false);
  const [reframeTab, setReframeTab] = useState<'reshoot' | 'relayout'>('reshoot');
  const [referenceImageMode, setReferenceImageMode] = useState<string>('As inspiration');
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<string>('Freeform');
  const [reframeScale, setReframeScale] = useState<number>(1.0);
  const [showAspectDropdown, setShowAspectDropdown] = useState<boolean>(false);
  const [relayoutSelections, setRelayoutSelections] = useState<Record<string, boolean>>({ 'LinkedIn banner': true });

  // Photo Adjustments State
  const [adjustments, setAdjustments] = useState<ImageAdjustments>(DEFAULT_ADJUSTMENTS);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (dataUrl) {
          setActiveStageImage(dataUrl);
          setImageHistory(prev => [dataUrl, ...prev]);
          setShowAddImageMenu(false);
          setExtractError(null);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Scene Discovery and Caching Hook
  const {
    savedScenesList,
    setSavedScenesList,
    saveSceneToLibrary,
    deleteSavedScene,
    availableImages,
    combinedAnalyzedScenes
  } = useLayoutSceneLibrary({
    activeStageImage,
    rawImage,
    displayImage,
    imageHistory,
    layout
  });

  // AI Operations (Extract, Render, Inpaint, Reframe, Chat Agent) Hook
  const {
    handleExtractLayout,
    handleApplyEdits,
    exportBinaryInpaintMask,
    handleApplyMaskEdit,
    handleApplyReframe,
    handleSendAskAnarchy
  } = useLayoutAIOperations({
    userId,
    activeStageImage,
    displayImage,
    rawImage,
    layout,
    setLayout,
    regionPrompts,
    setRegionPrompts,
    setExpandedNodes,
    onLayoutExtracted,
    onApplyResult,
    saveSceneToLibrary,
    setActiveStageImage,
    setImageHistory,
    setExtractError,
    setIsExtracting,
    setIsRendering,
    setSelectedRegionIdx,
    setHoveredRegionIdx,
    maskCanvasRef,
    maskPrompt,
    setMaskPrompt,
    clearMaskCanvas,
    cropBounds,
    setCropBounds,
    setIsReframeActive,
    askAnarchyPrompt,
    setAskAnarchyPrompt,
    setChatMessages,
    setPanelMode
  });


  const imageContainerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({});


  // Sync display image to active stage image & history
  useEffect(() => {
    const current = displayImage || rawImage;
    if (current) {
      setActiveStageImage(current);
      setImageHistory(prev => (prev.includes(current) ? prev : [current, ...prev.slice(0, 5)]));
    }
  }, [displayImage, rawImage]);

  // Generate crop thumbnails from base image & bboxes
  useEffect(() => {
    const targetImage = activeStageImage || displayImage;
    if (!targetImage || !layout?.regions) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const thumbs: Record<number, string> = {};
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = 48;
      canvas.height = 48;

      layout.regions.forEach((reg, i) => {
        try {
          const sx = Math.max(0, reg.bbox.x0 * img.naturalWidth);
          const sy = Math.max(0, reg.bbox.y0 * img.naturalHeight);
          const sw = Math.min(img.naturalWidth - sx, (reg.bbox.x1 - reg.bbox.x0) * img.naturalWidth);
          const sh = Math.min(img.naturalHeight - sy, (reg.bbox.y1 - reg.bbox.y0) * img.naturalHeight);

          if (sw > 0 && sh > 0) {
            ctx.clearRect(0, 0, 48, 48);
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 48, 48);
            thumbs[i] = canvas.toDataURL('image/jpeg', 0.85);
          }
        } catch (e) {
          logger.warn('[LayoutEditor] Crop thumbnail canvas export warning:', e);
        }
      });
      setCropThumbnails(thumbs);
    };
    img.src = targetImage;
  }, [activeStageImage, displayImage, layout]);

  // Sync layout state strictly to the active stage image / initialLayout
  useEffect(() => {
    const targetImage = activeStageImage || displayImage || rawImage;
    if (!targetImage) {
      setLayout(null);
      return;
    }

    // Always reset temporary layout states when active image changes
    setLayout(null);
    setExtractError(null);
    setSelectedRegionIdx(null);
    setHoveredRegionIdx(null);
    setCropThumbnails({});
    setRegionPrompts({});

    // 1. Check if initialLayout prop is passed and valid
    if (initialLayout && Array.isArray(initialLayout.regions) && initialLayout.regions.length > 0) {
      setLayout(initialLayout);
      const initialPrompts: Record<number, string> = {};
      const defaultExpanded: Record<number, boolean> = {};
      initialLayout.regions.forEach((reg: LayoutRegion, i: number) => {
        initialPrompts[i] = reg.prompt || '';
        defaultExpanded[i] = true;
      });
      setRegionPrompts(initialPrompts);
      setExpandedNodes(defaultExpanded);

      // Seed cache for all candidate keys
      const candidateKeys = [activeStageImage, displayImage, rawImage, imageProp].filter(Boolean) as string[];
      candidateKeys.forEach(img => {
        const k = anarchyService.getCacheKey(img);
        anarchyService.layoutCache.set(k, initialLayout);
        try { localStorage.setItem(`anarchy_layout_${k}`, JSON.stringify(initialLayout)); } catch {}
      });
      return;
    }

    // 2. Check candidate keys across memory cache and localStorage
    const candidateImages = [activeStageImage, displayImage, rawImage, imageProp].filter(Boolean) as string[];
    for (const imgCandidate of candidateImages) {
      const cacheKey = anarchyService.getCacheKey(imgCandidate);

      // Memory check
      const cachedMemory = anarchyService.layoutCache.get(cacheKey);
      if (cachedMemory && Array.isArray(cachedMemory.regions) && cachedMemory.regions.length > 0) {
        setLayout(cachedMemory);
        const initialPrompts: Record<number, string> = {};
        const defaultExpanded: Record<number, boolean> = {};
        cachedMemory.regions.forEach((reg: LayoutRegion, i: number) => {
          initialPrompts[i] = reg.prompt || '';
          defaultExpanded[i] = true;
        });
        setRegionPrompts(initialPrompts);
        setExpandedNodes(defaultExpanded);

        // Seed memory cache for other candidate keys
        candidateImages.forEach(img => {
          const k = anarchyService.getCacheKey(img);
          anarchyService.layoutCache.set(k, cachedMemory);
        });
        return;
      }

      // localStorage check
      try {
        const storedRaw = localStorage.getItem(`anarchy_layout_${cacheKey}`);
        if (storedRaw) {
          const parsed = JSON.parse(storedRaw);
          if (parsed && Array.isArray(parsed.regions) && parsed.regions.length > 0) {
            setLayout(parsed);
            const initialPrompts: Record<number, string> = {};
            const defaultExpanded: Record<number, boolean> = {};
            parsed.regions.forEach((reg: LayoutRegion, i: number) => {
              initialPrompts[i] = reg.prompt || '';
              defaultExpanded[i] = true;
            });
            setRegionPrompts(initialPrompts);
            setExpandedNodes(defaultExpanded);

            // Seed memory cache & localStorage for all keys
            candidateImages.forEach(img => {
              const k = anarchyService.getCacheKey(img);
              anarchyService.layoutCache.set(k, parsed);
              try { localStorage.setItem(`anarchy_layout_${k}`, JSON.stringify(parsed)); } catch {}
            });
            return;
          }
        }
      } catch {}
    }

    // If NOT cached for this image: keep layout = null so user sees unanalyzed state!
  }, [activeStageImage, displayImage, rawImage, imageProp, initialLayout]);

  // Resize Mask Canvas
  useEffect(() => {
    if (maskCanvasRef.current && stageRef.current) {
      maskCanvasRef.current.width = stageRef.current.clientWidth || 800;
      maskCanvasRef.current.height = stageRef.current.clientHeight || 600;
    }
  }, [activeToolbarTool]);

  const handleSelectRegion = (idx: number) => {
    setSelectedRegionIdx(idx);
    setActiveEditingIdx(idx);
    if (cardRefs.current[idx]) {
      cardRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  const toggleNodeExpand = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodes(prev => ({ ...prev, [idx]: !prev[idx] }));
  };


  // Studio Keyboard Shortcuts (V = Select, B = Brush, T = Text, R = Reframe, Escape = Cancel)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (e.key === 'v' || e.key === 'V') {
        setActiveToolbarTool('select');
        setIsReframeActive(false);
      } else if (e.key === 'b' || e.key === 'B') {
        setActiveToolbarTool('brush');
        setIsReframeActive(false);
      } else if (e.key === 't' || e.key === 'T') {
        setActiveToolbarTool('text');
        setIsReframeActive(false);
      } else if (e.key === 'r' || e.key === 'R') {
        setIsReframeActive(prev => !prev);
      } else if (e.key === 'Escape') {
        setActiveToolbarTool('select');
        setIsReframeActive(false);
        setSelectedRegionIdx(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);


  const handleShuffleAdjustments = () => {
    setAdjustments({
      exposure: Math.floor(Math.random() * 120) - 60,
      contrast: Math.floor(Math.random() * 120) - 60,
      highlights: Math.floor(Math.random() * 120) - 60,
      shadows: Math.floor(Math.random() * 120) - 60,
      vibrance: Math.floor(Math.random() * 120) - 60,
      temperature: Math.floor(Math.random() * 120) - 60,
      tint: Math.floor(Math.random() * 120) - 60,
      blend: 'normal'
    });
  };

  const handleResetAdjustments = () => {
    setAdjustments(DEFAULT_ADJUSTMENTS);
  };

  const getStageRelativePos = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!stageRef.current) return { x: 0, y: 0 };
    const rect = stageRef.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
    };
  };

  // Aspect Ratio Crop Preset Handler
  const applyAspectRatioToCrop = (ratioStr: string) => {
    setSelectedAspectRatio(ratioStr);
    if (ratioStr === 'Freeform') return;

    const ratioOption = ASPECT_RATIO_OPTIONS.find(o => o.label === ratioStr);
    const ratioVal = ratioOption?.ratio || ratioStr;
    const parts = ratioVal.split(':').map(Number);
    if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return;

    const targetAr = parts[0] / parts[1];
    let w = 0.85;
    let h = w / targetAr;

    if (h > 0.9) {
      h = 0.9;
      w = h * targetAr;
    }

    const x0 = Math.max(-0.5, (1 - w) / 2);
    const y0 = Math.max(-0.5, (1 - h) / 2);
    const x1 = x0 + w;
    const y1 = y0 + h;

    setCropBounds({ x0, y0, x1, y1 });
  };

  // Global Window Pointer Listeners during Active Dragging
  useEffect(() => {
    if (!activeCropHandle && !activeRegionHandle && !draggingTextId && !draggingNoteId && !isDragging3DVanishingPoint) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      if (!stageRef.current) return;
      const rect = stageRef.current.getBoundingClientRect();

      // 3D Vanishing Point Dragging
      if (isDragging3DVanishingPoint) {
        const x = Math.max(0.1, Math.min(0.9, (e.clientX - rect.left) / rect.width));
        const y = Math.max(0.1, Math.min(0.9, (e.clientY - rect.top) / rect.height));
        setVanishingPoint({ x, y });
        return;
      }

      // Text Overlay Dragging
      if (draggingTextId && textDragStartPos && initialTextPos) {
        const dx = (e.clientX - textDragStartPos.x) / rect.width;
        const dy = (e.clientY - textDragStartPos.y) / rect.height;
        setTextOverlays(prev => prev.map(t => t.id === draggingTextId ? {
          ...t,
          x: Math.max(0, Math.min(0.95, initialTextPos.x + dx)),
          y: Math.max(0, Math.min(0.95, initialTextPos.y + dy))
        } : t));
        return;
      }

      // Sticky Note Dragging
      if (draggingNoteId && noteDragStartPos && initialNotePos) {
        const dx = (e.clientX - noteDragStartPos.x) / rect.width;
        const dy = (e.clientY - noteDragStartPos.y) / rect.height;
        setStickyNotes(prev => prev.map(n => n.id === draggingNoteId ? {
          ...n,
          x: Math.max(0, Math.min(0.85, initialNotePos.x + dx)),
          y: Math.max(0, Math.min(0.85, initialNotePos.y + dy))
        } : n));
        return;
      }

      // Draggable Region BBox Handle Processing (Strict 0..1 Image Bounds)
      if (activeRegionHandle && selectedRegionIdx !== null && regionDragStartPos && initialRegionBbox) {
        const dx = (e.clientX - regionDragStartPos.x) / rect.width;
        const dy = (e.clientY - regionDragStartPos.y) / rect.height;

        setLayout(prev => {
          if (!prev || !prev.regions[selectedRegionIdx]) return prev;
          const newRegions = [...prev.regions];
          let { x0, y0, x1, y1 } = initialRegionBbox;
          const w = x1 - x0;
          const h = y1 - y0;

          if (activeRegionHandle === 'move') {
            x0 = Math.max(0, Math.min(1 - w, x0 + dx));
            y0 = Math.max(0, Math.min(1 - h, y0 + dy));
            x1 = x0 + w;
            y1 = y0 + h;
          } else {
            if (activeRegionHandle.includes('left')) x0 = Math.min(x1 - 0.04, Math.max(0, x0 + dx));
            if (activeRegionHandle.includes('right')) x1 = Math.max(x0 + 0.04, Math.min(1, x1 + dx));
            if (activeRegionHandle.includes('top')) y0 = Math.min(y1 - 0.04, Math.max(0, y0 + dy));
            if (activeRegionHandle.includes('bottom')) y1 = Math.max(y0 + 0.04, Math.min(1, y1 + dy));
          }

          newRegions[selectedRegionIdx] = {
            ...newRegions[selectedRegionIdx],
            bbox: { x0, y0, x1, y1 }
          };
          return { ...prev, regions: newRegions };
        });
        return;
      }

      // Draggable Crop / Outpaint Handle Processing (Supports Outpainting -1.5..2.5)
      if (activeCropHandle && cropDragStartPos && initialBoundsOnDrag) {
        const dx = (e.clientX - cropDragStartPos.x) / rect.width;
        const dy = (e.clientY - cropDragStartPos.y) / rect.height;

        setCropBounds(() => {
          let { x0, y0, x1, y1 } = initialBoundsOnDrag;

          if (activeCropHandle === 'move') {
            const w = initialBoundsOnDrag.x1 - initialBoundsOnDrag.x0;
            const h = initialBoundsOnDrag.y1 - initialBoundsOnDrag.y0;
            x0 = Math.max(-1.5, Math.min(2.5 - w, initialBoundsOnDrag.x0 + dx));
            y0 = Math.max(-1.5, Math.min(2.5 - h, initialBoundsOnDrag.y0 + dy));
            x1 = x0 + w;
            y1 = y0 + h;
          } else {
            if (activeCropHandle.includes('left')) x0 = Math.min(x1 - 0.05, Math.max(-1.5, x0 + dx));
            if (activeCropHandle.includes('right')) x1 = Math.max(x0 + 0.05, Math.min(2.5, x1 + dx));
            if (activeCropHandle.includes('top')) y0 = Math.min(y1 - 0.05, Math.max(-1.5, y0 + dy));
            if (activeCropHandle.includes('bottom')) y1 = Math.max(y0 + 0.05, Math.min(2.5, y1 + dy));
          }

          return { x0, y0, x1, y1 };
        });
      }
    };

    const handleWindowMouseUp = () => {
      setActiveCropHandle(null);
      setCropDragStartPos(null);
      setInitialBoundsOnDrag(null);
      setActiveRegionHandle(null);
      setRegionDragStartPos(null);
      setInitialRegionBbox(null);
      setDraggingTextId(null);
      setTextDragStartPos(null);
      setInitialTextPos(null);
      setDraggingNoteId(null);
      setNoteDragStartPos(null);
      setInitialNotePos(null);
      setIsDragging3DVanishingPoint(false);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [activeCropHandle, activeRegionHandle, cropDragStartPos, initialBoundsOnDrag, regionDragStartPos, initialRegionBbox, selectedRegionIdx, draggingTextId, textDragStartPos, initialTextPos, draggingNoteId, noteDragStartPos, initialNotePos, isDragging3DVanishingPoint]);

  // Interactive Region BBox Drag & Resize Handlers
  const handleRegionHandleMouseDown = (handle: string, idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedRegionIdx(idx);
    setActiveEditingIdx(idx);
    setActiveRegionHandle(handle);
    if (stageRef.current && layout?.regions[idx]) {
      setRegionDragStartPos({ x: e.clientX, y: e.clientY });
      setInitialRegionBbox({ ...layout.regions[idx].bbox });
    }
  };

  // Interactive Crop Handle Dragging
  const handleCropHandleMouseDown = (handle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveCropHandle(handle);
    if (stageRef.current) {
      setCropDragStartPos({ x: e.clientX, y: e.clientY });
      setInitialBoundsOnDrag({ ...cropBounds });
    }
  };

  const handleStageMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeCropHandle || activeRegionHandle || draggingTextId || draggingNoteId || isDragging3DVanishingPoint) return;
    const pos = getStageRelativePos(e);

    if (activeToolbarTool === 'bbox') {
      setIsDrawingBbox(true);
      setDrawStart(pos);
      setDrawCurrent(pos);
    } else if (activeToolbarTool === 'brush') {
      setIsDrawingMask(true);
      lastBrushPosRef.current = null;
      paintMaskStroke(e);
    } else if (activeToolbarTool === 'text') {
      const newText: TextOverlay = {
        id: `text-${Date.now()}`,
        x: pos.x,
        y: pos.y,
        text: 'Text',
        font: 'Inter',
        size: 32,
        color: '#ffffff',
        opacity: 1.0
      };
      setTextOverlays(prev => [...prev, newText]);
      setActiveTextId(newText.id);
    } else if (activeToolbarTool === 'note') {
      const newNote: StickyNote = {
        id: `note-${Date.now()}`,
        x: pos.x,
        y: pos.y,
        text: 'Describe edits...'
      };
      setStickyNotes(prev => [...prev, newNote]);
    }
  };

  const handleStageMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const pos = getStageRelativePos(e);

    if (isDrawingBbox) {
      setDrawCurrent(pos);
    } else if (isDrawingMask) {
      paintMaskStroke(e);
    }
  };

  const handleStageMouseUp = () => {
    if (isDrawingBbox && drawStart && drawCurrent) {
      let x0 = Math.min(drawStart.x, drawCurrent.x);
      let y0 = Math.min(drawStart.y, drawCurrent.y);
      let x1 = Math.max(drawStart.x, drawCurrent.x);
      let y1 = Math.max(drawStart.y, drawCurrent.y);

      if (Math.abs(x1 - x0) < 0.02 && Math.abs(y1 - y0) < 0.02) {
        x0 = 0.3;
        y0 = 0.3;
        x1 = 0.7;
        y1 = 0.7;
      }

      const newRegion: LayoutRegion = {
        label: `New Object ${layout?.regions?.length ? layout.regions.length + 1 : 1}`,
        bbox: { x0, y0, x1, y1 },
        prompt: ''
      };

      setLayout(prev => ({
        ...prev,
        regions: [...(prev?.regions || []), newRegion]
      }));

      const newIdx = layout?.regions?.length || 0;
      setSelectedRegionIdx(newIdx);
      setActiveEditingIdx(newIdx);
    }

    setIsDrawingBbox(false);
    setDrawStart(null);
    setDrawCurrent(null);
    setIsDrawingMask(false);
    lastBrushPosRef.current = null;
  };

  const paintMaskStroke = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!maskCanvasRef.current || !stageRef.current) return;
    const ctx = maskCanvasRef.current.getContext('2d');
    if (!ctx) return;

    const rect = stageRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.fillStyle = `${brushColor}90`;
    ctx.strokeStyle = `${brushColor}90`;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (lastBrushPosRef.current) {
      ctx.beginPath();
      ctx.moveTo(lastBrushPosRef.current.x, lastBrushPosRef.current.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    lastBrushPosRef.current = { x, y };
  };


  const toggleRelayoutSelection = (label: string) => {
    setRelayoutSelections(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const updateRegionPrompt = (idx: number, text: string) => {
    setRegionPrompts(prev => ({ ...prev, [idx]: text }));
  };


  const currentTargetImage = activeStageImage || displayImage || rawImage;

  const hierarchyTree = layout?.regions ? buildReveHierarchyTree(layout.regions, searchQuery) : [];
  const selectedRegion = selectedRegionIdx !== null && layout?.regions ? layout.regions[selectedRegionIdx] : null;

  // Compute CSS Filter string for Photo Adjustments
  const filterStyle = `
    brightness(${1 + adjustments.exposure / 100})
    contrast(${1 + adjustments.contrast / 100})
    saturate(${1 + adjustments.vibrance / 100})
    hue-rotate(${adjustments.tint}deg)
  `;

  // Scale & Zoom Combined Transform
  const totalScaleFactor = reframeScale * zoomLevel;


  return {
    // Images & Scenes
    rawImage,
    displayImage,
    activeStageImage,
    setActiveStageImage,
    currentTargetImage,
    resolvedUrl,
    imageHistory,
    setImageHistory,
    availableImages,
    savedScenesList,
    combinedAnalyzedScenes,
    deleteSavedScene,

    // Layout & Hierarchy
    layout,
    setLayout,
    selectedRegionIdx,
    setSelectedRegionIdx,
    hoveredRegionIdx,
    setHoveredRegionIdx,
    searchQuery,
    setSearchQuery,
    regionPrompts,
    cropThumbnails,
    isGroupExpanded,
    setIsGroupExpanded,
    activeEditingIdx,
    setActiveEditingIdx,
    expandedNodes,
    hierarchyTree,
    selectedRegion,

    // Tools & Transforms
    activeToolbarTool,
    setActiveToolbarTool,
    zoomLevel,
    setZoomLevel,
    reframeScale,
    setReframeScale,
    totalScaleFactor,
    filterStyle,
    isReframeActive,
    setIsReframeActive,
    reframeTab,
    setReframeTab,
    referenceImageMode,
    setReferenceImageMode,
    selectedAspectRatio,
    setSelectedAspectRatio,
    showAspectDropdown,
    setShowAspectDropdown,
    relayoutSelections,
    cropBounds,
    setCropBounds,
    activeCropHandle,
    activeRegionHandle,

    // Overlays & Layers
    isDrawingBbox,
    drawStart,
    drawCurrent,
    brushSize,
    setBrushSize,
    brushColor,
    setBrushColor,
    isDrawingMask,
    maskPrompt,
    setMaskPrompt,
    vanishingPoint,
    setVanishingPoint,
    isDragging3DVanishingPoint,
    setIsDragging3DVanishingPoint,
    textOverlays,
    setTextOverlays,
    activeTextId,
    setActiveTextId,
    setDraggingTextId,
    setTextDragStartPos,
    setInitialTextPos,
    stickyNotes,
    setStickyNotes,
    setDraggingNoteId,
    setNoteDragStartPos,
    setInitialNotePos,
    showAddImageMenu,
    setShowAddImageMenu,
    adjustments,
    setAdjustments,

    // Status & Modals
    isExtracting,
    isRendering,
    extractError,
    setExtractError,
    showKeyModal,
    setShowKeyModal,
    inputKey,
    setInputKey,
    panelMode,
    setPanelMode,
    askAnarchyPrompt,
    setAskAnarchyPrompt,
    showMentionMenu,
    setShowMentionMenu,

    // Refs
    fileInputRef,
    imageContainerRef,
    stageRef,
    maskCanvasRef,
    cardRefs,

    // Actions & Handlers
    handleSelectRegion,
    toggleNodeExpand,
    updateRegionPrompt,
    handleExtractLayout,
    handleApplyEdits,
    handleApplyMaskEdit,
    handleApplyReframe,
    handleShuffleAdjustments,
    handleResetAdjustments,
    applyAspectRatioToCrop,
    toggleRelayoutSelection,
    handleStageMouseDown,
    handleStageMouseMove,
    handleStageMouseUp,
    handleRegionHandleMouseDown,
    handleCropHandleMouseDown,
    clearMaskCanvas,
    handleFileUpload,
    handleSendAskAnarchy,
  };
};

export type LayoutEditorState = ReturnType<typeof useLayoutEditorState>;
