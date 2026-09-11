import { useState, useCallback, type RefObject, type Dispatch, type SetStateAction } from 'react';
import type { InpaintLayer, PhotoshopBlendMode } from '../../components/LayersPanel';
import type { LayerVisibility } from '../types';

export interface UseInpaintLayersParams {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  maskPrompt: string;
  activeImageSrc?: string | null;
  getActiveImageSrc?: () => string | null | undefined;
  baseOriginalImage: string | null;
  resolvedBaseImage?: string | null;
  getResolvedBaseImage?: () => string | null | undefined;
  maskPreviewUrl: string | null;
  clearMask: () => void;
  invertCurrentMask: () => void;
  updateMaskPreview: () => void;
  setLayerVisibility: Dispatch<SetStateAction<LayerVisibility>>;
  setMaskTool: (tool: any) => void;
  setDrawSubTool: (tool: any) => void;
  setWorkspaceMode: (mode: any) => void;
}

export function useInpaintLayers(params: UseInpaintLayersParams) {
  const {
    canvasRef,
    maskPrompt,
    activeImageSrc,
    getActiveImageSrc,
    baseOriginalImage,
    resolvedBaseImage,
    getResolvedBaseImage,
    maskPreviewUrl,
    clearMask,
    invertCurrentMask,
    updateMaskPreview,
    setLayerVisibility,
    setMaskTool,
    setDrawSubTool,
    setWorkspaceMode,
  } = params;

  const [inpaintLayers, setInpaintLayers] = useState<InpaintLayer[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<string>('base');
  const [baseImageVisible, setBaseImageVisible] = useState(true);
  const [showLayerStack, setShowLayerStack] = useState(true);
  const [maskOverlayBlendMode, setMaskOverlayBlendMode] = useState<PhotoshopBlendMode>('normal');
  const [maskOverlayOpacity, setMaskOverlayOpacity] = useState<number>(0.55);
  const [baseImageOpacity, setBaseImageOpacity] = useState<number>(100);
  const [psMaskColor, setPsMaskColor] = useState<'white' | 'black'>('white');

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
  }, [setLayerVisibility]);

  const handleAddLayer = useCallback(() => {
    const newId = `layer-${Date.now()}`;
    const nextNum = inpaintLayers.length + 1;
    const currentImg = (getActiveImageSrc ? getActiveImageSrc() : activeImageSrc) || baseOriginalImage || '';

    if (maskPreviewUrl) {
      const newLayer: InpaintLayer = {
        id: newId,
        name: maskPrompt.trim() ? (maskPrompt.trim().length > 18 ? maskPrompt.trim().slice(0, 18) + '...' : maskPrompt.trim()) : `Layer ${nextNum}`,
        prompt: maskPrompt.trim() || `Layer ${nextNum}`,
        image: currentImg,
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
        image: currentImg,
        visible: true,
        opacity: 100,
        blendMode: 'normal',
        selectedTarget: 'image',
        createdAt: Date.now(),
      };
      setInpaintLayers(prev => [newLayer, ...prev]);
      setActiveLayerId(newId);
    }
  }, [inpaintLayers.length, maskPreviewUrl, getActiveImageSrc, activeImageSrc, baseOriginalImage, maskPrompt, clearMask]);

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
      const baseImg = (getResolvedBaseImage ? getResolvedBaseImage() : resolvedBaseImage) || baseOriginalImage || '';
      const newLayer: InpaintLayer = {
        id: newId,
        name: 'Background Copy',
        prompt: '',
        image: baseImg,
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
  }, [inpaintLayers, handleAddLayer, getResolvedBaseImage, resolvedBaseImage, baseOriginalImage]);

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
  }, [invertCurrentMask, activeLayerId, updateMaskPreview, canvasRef]);

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
  }, [inpaintLayers, updateMaskPreview, canvasRef, setMaskTool, setDrawSubTool, setWorkspaceMode, setLayerVisibility]);

  return {
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
  };
}
