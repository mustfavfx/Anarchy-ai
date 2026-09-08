import { useEffect } from 'react';

export interface UseMaskShortcutsOptions {
  // Navigation & Pan
  setIsSpacebarDown: React.Dispatch<React.SetStateAction<boolean>>;
  setIsPanning: React.Dispatch<React.SetStateAction<boolean>>;
  setZoomScale: React.Dispatch<React.SetStateAction<number>>;
  setPanOffset: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;

  // Brush & Tools
  maskTool: 'select' | 'brush' | 'eraser' | 'lasso' | 'crop' | 'wand' | 'arrow' | 'hand' | 'smart_select';
  setMaskTool: React.Dispatch<React.SetStateAction<'select' | 'brush' | 'eraser' | 'lasso' | 'crop' | 'wand' | 'arrow' | 'hand' | 'smart_select'>>;
  shapeSubTool: 'polygon' | 'rectangle' | 'circle' | 'freehand';
  setShapeSubTool: React.Dispatch<React.SetStateAction<'polygon' | 'rectangle' | 'circle' | 'freehand'>>;
  setDrawSubTool: React.Dispatch<React.SetStateAction<'brush' | 'arrow' | 'line' | 'rect' | 'circle'>>;
  setBrushSize: React.Dispatch<React.SetStateAction<number>>;
  setBrushHardness: React.Dispatch<React.SetStateAction<number>>;
  setIsAltKeyDown: React.Dispatch<React.SetStateAction<boolean>>;
  setIsOrthoMode?: React.Dispatch<React.SetStateAction<boolean>>;
  setShowRulers?: React.Dispatch<React.SetStateAction<boolean>>;

  // Inspection modes
  setIsSoloAlphaMode: React.Dispatch<React.SetStateAction<boolean>>;
  setIsComparing: React.Dispatch<React.SetStateAction<boolean>>;
  setSplitCompareMode: React.Dispatch<React.SetStateAction<boolean>>;

  // Mask Geometry Actions
  fillEntireMask: () => void;
  invertCurrentMask: () => void;
  expandMask: (px: number) => void;
  contractMask: (px: number) => void;
  clearMask: () => void;

  // Polygon Drafting
  polygonPoints: { x: number; y: number }[];
  setPolygonPoints: React.Dispatch<React.SetStateAction<{ x: number; y: number }[]>>;
  setPolygonCursor: React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>;
  completePolygon: () => void;

  // Crop
  crop: {
    cropRect: any;
    applyCrop: () => void;
    clearCropRect: () => void;
  };

  // History
  undo: () => void;
  redo: () => void;
  updateMaskPreview: () => void;

  // Photoshop Layers & Masks
  activeLayerId: string;
  setPsMaskColor: React.Dispatch<React.SetStateAction<'white' | 'black'>>;
  handleInvertMask: (layerId: string) => void;
  handleDuplicateLayer: (layerId: string) => void;
  handleDeleteLayer: (layerId: string) => void;
}

export function useMaskShortcuts(options: UseMaskShortcutsOptions) {
  const {
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
  } = options;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;

      // Spacebar for Drag-Pan
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setIsSpacebarDown(true);
        return;
      }

      // Bracket keys for Brush Size ([ and ])
      if (e.key === '[' && !e.shiftKey) {
        e.preventDefault();
        setBrushSize((s) => Math.max(2, s - 4));
        return;
      }
      if (e.key === ']' && !e.shiftKey) {
        e.preventDefault();
        setBrushSize((s) => Math.min(200, s + 4));
        return;
      }

      // Shift + [ / Shift + ] for Brush Hardness (Airbrush vs Crisp edge)
      if (e.key === '{' || (e.shiftKey && e.key === '[')) {
        e.preventDefault();
        setBrushHardness((h) => Math.max(10, h - 10));
        return;
      }
      if (e.key === '}' || (e.shiftKey && e.key === ']')) {
        e.preventDefault();
        setBrushHardness((h) => Math.min(100, h + 10));
        return;
      }

      // Quick Mask Solo View (Q key: toggle pure black & white alpha stencil)
      if (e.key === 'q' || e.key === 'Q') {
        e.preventDefault();
        setIsSoloAlphaMode((prev) => !prev);
        return;
      }

      // Alt Key for Quick Subtract / Erase
      if (e.key === 'Alt') {
        setIsAltKeyDown(true);
      }

      // Backslash (\) for Instant Before / After Peek
      if (e.key === '\\') {
        e.preventDefault();
        setIsComparing((prev) => !prev);
        return;
      }

      // Tool Switching Shortcuts
      if (e.key === 'b' || e.key === 'B') {
        setMaskTool('brush');
        setDrawSubTool('brush');
      }
      if (e.key === 'e' || e.key === 'E') setMaskTool('eraser');
      if (e.key === 'p' || e.key === 'P') {
        setMaskTool('lasso');
        setShapeSubTool('polygon');
      }
      if (e.key === 'l' || e.key === 'L') {
        setMaskTool('lasso');
        setShapeSubTool('freehand');
      }
      if (e.key === 'm' || e.key === 'M') {
        setMaskTool('lasso');
        setShapeSubTool('rectangle');
      }
      if (e.key === 'g' || e.key === 'G') {
        fillEntireMask();
      }
      if (e.key === 'w' || e.key === 'W') {
        if (e.shiftKey) {
          setMaskTool('smart_select');
        } else {
          setMaskTool('wand');
        }
      }
      if (e.key === 's' || e.key === 'S') {
        if (!e.ctrlKey && !e.metaKey) {
          setMaskTool('smart_select');
        }
      }
      if (e.key === 'o' || e.key === 'O') {
        if (!e.ctrlKey && !e.metaKey && setIsOrthoMode) {
          setIsOrthoMode((prev) => !prev);
        }
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        if (setShowRulers) {
          setShowRulers((prev) => !prev);
        }
      }
      if (e.key === 'c' || e.key === 'C') {
        if (!e.ctrlKey && !e.metaKey) {
          setMaskTool('crop');
        }
      }
      if (e.key === 'v' || e.key === 'V') setMaskTool('select');
      if (e.key === 'h' || e.key === 'H') setMaskTool('hand');

      // Zoom Reset (Ctrl + 0)
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        setZoomScale(1);
        setPanOffset({ x: 0, y: 0 });
        return;
      }
      // 100% Zoom (Ctrl + 1)
      if ((e.ctrlKey || e.metaKey) && e.key === '1') {
        e.preventDefault();
        setZoomScale(1);
        return;
      }

      // Invert Mask Selection (Ctrl + Shift + I) vs Invert Layer Mask (Ctrl + I)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'i' || e.key === 'I')) {
        e.preventDefault();
        if (e.shiftKey) {
          invertCurrentMask();
        } else {
          handleInvertMask(activeLayerId);
        }
        return;
      }

      // Expand Mask (Ctrl + Shift + E)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'e' || e.key === 'E')) {
        e.preventDefault();
        expandMask(4);
        return;
      }

      // Contract Mask (Ctrl + Shift + C)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        contractMask(4);
        return;
      }

      // Clear Mask / Deselect (Ctrl + D)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        clearMask();
        return;
      }

      // Layer Duplicate (Ctrl + J)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'j' || e.key === 'J')) {
        e.preventDefault();
        handleDuplicateLayer(activeLayerId);
        return;
      }

      // 'X' key to swap Black & White mask colors
      if (!e.ctrlKey && !e.metaKey && (e.key === 'x' || e.key === 'X')) {
        setPsMaskColor((prev) => (prev === 'white' ? 'black' : 'white'));
        return;
      }
      // 'D' key without Ctrl to reset mask color to white
      if (!e.ctrlKey && !e.metaKey && (e.key === 'd' || e.key === 'D')) {
        setPsMaskColor('white');
        return;
      }

      // Polygonal Lasso vertex undo via Backspace or Delete
      if ((e.key === 'Backspace' || e.key === 'Delete') && maskTool === 'lasso' && shapeSubTool === 'polygon') {
        if (polygonPoints.length > 0) {
          e.preventDefault();
          setPolygonPoints((prev) => prev.slice(0, -1));
          return;
        }
      }

      // Delete Active Layer via Backspace or Delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (activeLayerId && activeLayerId !== 'base' && !(maskTool === 'lasso' && shapeSubTool === 'polygon' && polygonPoints.length > 0)) {
          e.preventDefault();
          handleDeleteLayer(activeLayerId);
          return;
        }
      }

      if (e.key === 'Escape') {
        if (polygonPoints.length > 0) {
          setPolygonPoints([]);
          setPolygonCursor(null);
          return;
        }
        crop.clearCropRect();
        setIsComparing(false);
        setSplitCompareMode(false);
        setIsSoloAlphaMode(false);
        if (maskTool === 'crop') setMaskTool('brush');
      }

      if (e.key === 'Enter') {
        if (maskTool === 'lasso' && shapeSubTool === 'polygon' && polygonPoints.length >= 3) {
          e.preventDefault();
          completePolygon();
          return;
        }
        if (maskTool === 'crop' && crop.cropRect) crop.applyCrop();
      }

      // History Undo / Redo
      if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) {
        if (e.shiftKey) {
          redo();
          updateMaskPreview();
        } else {
          undo();
          updateMaskPreview();
        }
      }
      if ((e.key === 'y' || e.key === 'Y') && (e.ctrlKey || e.metaKey)) {
        redo();
        updateMaskPreview();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacebarDown(false);
        setIsPanning(false);
      }
      if (e.key === 'Alt') {
        setIsAltKeyDown(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    undo,
    redo,
    maskTool,
    shapeSubTool,
    polygonPoints,
    completePolygon,
    expandMask,
    contractMask,
    fillEntireMask,
    crop,
    updateMaskPreview,
    invertCurrentMask,
    clearMask,
    activeLayerId,
    handleInvertMask,
    handleDuplicateLayer,
    handleDeleteLayer,
    setIsSpacebarDown,
    setIsPanning,
    setZoomScale,
    setPanOffset,
    setMaskTool,
    setShapeSubTool,
    setDrawSubTool,
    setBrushSize,
    setBrushHardness,
    setIsAltKeyDown,
    setIsSoloAlphaMode,
    setIsComparing,
    setSplitCompareMode,
    setPolygonPoints,
    setPolygonCursor,
    setPsMaskColor,
  ]);
}
