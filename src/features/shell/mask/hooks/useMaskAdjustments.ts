import { useRef, useCallback, useEffect } from 'react';
import type { InpaintLayer } from '../../components/LayersPanel';
import { logger } from '../../../../utils/logger';
import { useNotificationStore } from '../../../../stores/notificationStore';
import {
  type AdjustmentParams,
  applyAdjustmentParamsToImageData,
  applyAdjustmentParamsToImageUrl,
} from '../utils/adjustmentEngine';

interface UseMaskAdjustmentsProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  resolvedBaseImage: string | null;
  baseOriginalImage: string | null;
  setBaseOriginalImage: React.Dispatch<React.SetStateAction<string | null>>;
  currentCanvasImage: string | null;
  setCurrentCanvasImage: React.Dispatch<React.SetStateAction<string | null>>;
  baseImageVisible: boolean;
  baseImageOpacity: number;
  inpaintLayers: InpaintLayer[];
  setInpaintLayers: React.Dispatch<React.SetStateAction<InpaintLayer[]>>;
  activeLayerId: string | null;
  setActiveLayerId: (id: string | null) => void;
  hasSelectionContent: boolean;
  clearMask: () => void;
  pushHistory: () => void;
  updateMaskPreview: () => void;
  isAr?: boolean;
}

export function useMaskAdjustments({
  canvasRef,
  resolvedBaseImage,
  baseOriginalImage,
  setBaseOriginalImage,
  currentCanvasImage,
  setCurrentCanvasImage,
  baseImageVisible,
  baseImageOpacity,
  inpaintLayers,
  setInpaintLayers,
  activeLayerId,
  setActiveLayerId,
  hasSelectionContent,
  clearMask,
  pushHistory,
  updateMaskPreview,
  isAr = false,
}: UseMaskAdjustmentsProps) {
  const adjustmentSnapshotRef = useRef<{
    targetType: 'mask' | 'layer' | 'base';
    layerId?: string | null;
    originalMaskData?: ImageData;
    originalImageSrc?: string;
    originalBaseOriginal?: string | null;
    originalCanvasImage?: string | null;
    originalAdjustmentParams?: AdjustmentParams;
    cachedImageData?: ImageData;
    cachedCanvas?: HTMLCanvasElement;
    cachedCtx?: CanvasRenderingContext2D;
    isNewLayer?: boolean;
  } | null>(null);

  // Composite all layers strictly underneath targetLayerId into an offscreen ImageData
  const compositeUnderlyingLayers = useCallback(async (targetLayerId: string | null) => {
    const baseSrc = resolvedBaseImage || baseOriginalImage || currentCanvasImage;
    const canvas = canvasRef.current;

    let targetW = canvas?.width || 0;
    let targetH = canvas?.height || 0;
    let baseImgEl: HTMLImageElement | null = null;

    if (baseSrc && (targetW === 0 || targetH === 0)) {
      try {
        baseImgEl = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = baseSrc;
        });
        targetW = baseImgEl.naturalWidth || baseImgEl.width;
        targetH = baseImgEl.naturalHeight || baseImgEl.height;
      } catch (e) {
        logger.warn('Failed to preload base image for compositing', e);
      }
    }

    if (targetW === 0) targetW = 800;
    if (targetH === 0) targetH = 600;

    const offscreen = document.createElement('canvas');
    offscreen.width = targetW;
    offscreen.height = targetH;
    const offCtx = offscreen.getContext('2d', { willReadFrequently: true });
    if (!offCtx) return null;

    // 1. Draw base image if visible
    if (baseImageVisible !== false && baseSrc) {
      if (!baseImgEl) {
        try {
          baseImgEl = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = baseSrc;
          });
        } catch {
          // ignore
        }
      }
      if (baseImgEl) {
        offCtx.save();
        offCtx.globalAlpha = baseImageOpacity;
        offCtx.drawImage(baseImgEl, 0, 0, targetW, targetH);
        offCtx.restore();
      }
    }

    // 2. Determine which layers are strictly underneath targetLayerId
    let layersUnderneath: InpaintLayer[] = [];
    if (!targetLayerId) {
      layersUnderneath = inpaintLayers.slice().reverse();
    } else {
      const idx = inpaintLayers.findIndex(l => l.id === targetLayerId);
      if (idx !== -1) {
        layersUnderneath = inpaintLayers.slice(idx + 1).reverse();
      } else {
        layersUnderneath = inpaintLayers.slice().reverse();
      }
    }

    // 3. Composite each visible underlying layer
    for (const layer of layersUnderneath) {
      if (!layer.visible || !layer.image) continue;
      try {
        let layerImg: HTMLImageElement | null = null;
        const domEl = document.querySelector(`img[data-layer-id="${layer.id}"]`) as HTMLImageElement | null;
        if (domEl && domEl.complete && domEl.naturalWidth > 0) {
          layerImg = domEl;
        } else {
          layerImg = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = layer.image!;
          });
        }

        offCtx.save();
        offCtx.globalAlpha = (layer.opacity ?? 100) / 100;
        offCtx.globalCompositeOperation = (layer.blendMode && layer.blendMode !== 'normal')
          ? (layer.blendMode as GlobalCompositeOperation)
          : 'source-over';
        offCtx.drawImage(layerImg, 0, 0, targetW, targetH);
        offCtx.restore();
      } catch (err) {
        logger.warn(`Failed to composite layer ${layer.id}`, err);
      }
    }

    const rawData = offCtx.getImageData(0, 0, targetW, targetH);
    return { canvas: offscreen, ctx: offCtx, rawData, width: targetW, height: targetH };
  }, [resolvedBaseImage, baseOriginalImage, currentCanvasImage, canvasRef, baseImageVisible, baseImageOpacity, inpaintLayers]);

  // Create a new Photoshop Adjustment Layer at the top of the layer stack
  const handleCreateAdjustmentLayer = useCallback(async (key: string, name: string, initialParams: AdjustmentParams) => {
    try {
      const comp = await compositeUnderlyingLayers(null);
      if (!comp) return;

      const newLayerId = `adj-layer-${Date.now()}`;

      // Apply initial adjustment to composite
      const copy = new ImageData(
        new Uint8ClampedArray(comp.rawData.data),
        comp.rawData.width,
        comp.rawData.height
      );
      applyAdjustmentParamsToImageData(copy, initialParams, false);
      comp.ctx.putImageData(copy, 0, 0);
      const initialDataUrl = comp.canvas.toDataURL('image/png');

      // If there is an active selection on the canvas, turn it into the layer's mask
      let layerMaskUrl: string | undefined = undefined;
      if (hasSelectionContent && canvasRef.current) {
        layerMaskUrl = canvasRef.current.toDataURL('image/png');
        clearMask();
      }

      const count = inpaintLayers.filter(l => l.name.startsWith(name)).length + 1;
      const layerName = `${name} ${count}`;

      const newLayer: InpaintLayer = {
        id: newLayerId,
        name: layerName,
        visible: true,
        opacity: 100,
        blendMode: 'normal',
        image: initialDataUrl,
        layerType: 'adjustment',
        adjustmentKey: key,
        adjustmentParams: initialParams,
        maskDataUrl: layerMaskUrl,
      };

      adjustmentSnapshotRef.current = {
        targetType: 'layer',
        layerId: newLayerId,
        originalImageSrc: initialDataUrl,
        originalAdjustmentParams: initialParams,
        cachedImageData: comp.rawData,
        cachedCanvas: comp.canvas,
        cachedCtx: comp.ctx,
        isNewLayer: true,
      };

      setInpaintLayers(prev => [newLayer, ...prev]);
      setActiveLayerId(newLayerId);
      pushHistory();

      useNotificationStore.getState().addNotification({
        type: 'success',
        title: layerName,
        message: isAr ? `تمت إضافة طبقة ضبط جديدة: ${layerName}` : `Added adjustment layer: ${layerName}`,
        duration: 2200,
      });
    } catch (err) {
      logger.error('Failed to create adjustment layer', err);
    }
  }, [compositeUnderlyingLayers, hasSelectionContent, canvasRef, clearMask, inpaintLayers, setInpaintLayers, setActiveLayerId, pushHistory, isAr]);

  // Synchronize snapshot when switching active layer to an existing adjustment layer
  useEffect(() => {
    const active = inpaintLayers.find(l => l.id === activeLayerId);
    if (active && active.layerType === 'adjustment' && active.adjustmentKey) {
      if (adjustmentSnapshotRef.current?.layerId !== active.id) {
        compositeUnderlyingLayers(active.id).then((comp) => {
          if (!comp) return;
          adjustmentSnapshotRef.current = {
            targetType: 'layer',
            layerId: active.id,
            originalImageSrc: active.image,
            originalAdjustmentParams: active.adjustmentParams,
            cachedImageData: comp.rawData,
            cachedCanvas: comp.canvas,
            cachedCtx: comp.ctx,
            isNewLayer: false,
          };
        });
      }
    }
  }, [activeLayerId, inpaintLayers, compositeUnderlyingLayers]);

  const handleStartAdjustment = useCallback((_key: string) => {
    // 1. Mask target
    const isMask = activeLayerId === 'active-mask' || inpaintLayers.find(l => l.id === activeLayerId)?.selectedTarget === 'mask';
    if (isMask) {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        adjustmentSnapshotRef.current = {
          targetType: 'mask',
          originalMaskData: ctx.getImageData(0, 0, canvas.width, canvas.height),
        };
      }
      return;
    }

    // 2. Inpaint layer target
    const layer = activeLayerId && activeLayerId !== 'base' ? inpaintLayers.find(l => l.id === activeLayerId) : null;
    if (layer?.image) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth || img.width;
        c.height = img.naturalHeight || img.height;
        const cCtx = c.getContext('2d');
        if (cCtx) {
          cCtx.drawImage(img, 0, 0);
          const raw = cCtx.getImageData(0, 0, c.width, c.height);
          adjustmentSnapshotRef.current = {
            targetType: 'layer',
            layerId: activeLayerId,
            originalImageSrc: layer.image,
            cachedImageData: raw,
            cachedCanvas: c,
            cachedCtx: cCtx,
          };
        }
      };
      img.src = layer.image;
      return;
    }

    // 3. Base image target
    const baseSrc = resolvedBaseImage || baseOriginalImage || currentCanvasImage;
    if (baseSrc) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth || img.width;
        c.height = img.naturalHeight || img.height;
        const cCtx = c.getContext('2d');
        if (cCtx) {
          cCtx.drawImage(img, 0, 0);
          const raw = cCtx.getImageData(0, 0, c.width, c.height);
          adjustmentSnapshotRef.current = {
            targetType: 'base',
            originalImageSrc: baseSrc,
            originalBaseOriginal: baseOriginalImage,
            originalCanvasImage: currentCanvasImage,
            cachedImageData: raw,
            cachedCanvas: c,
            cachedCtx: cCtx,
          };
        }
      };
      img.src = baseSrc;
    }
  }, [activeLayerId, inpaintLayers, canvasRef, resolvedBaseImage, baseOriginalImage, currentCanvasImage]);

  const handlePreviewAdjustment = useCallback((params: AdjustmentParams) => {
    const snapshot = adjustmentSnapshotRef.current;
    if (!snapshot) return;

    if (snapshot.targetType === 'mask' && snapshot.originalMaskData) {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;
      const copy = new ImageData(
        new Uint8ClampedArray(snapshot.originalMaskData.data),
        snapshot.originalMaskData.width,
        snapshot.originalMaskData.height
      );
      applyAdjustmentParamsToImageData(copy, params, true);
      ctx.putImageData(copy, 0, 0);
      updateMaskPreview();
      return;
    }

    if (snapshot.targetType === 'layer' && snapshot.layerId) {
      if (snapshot.cachedImageData && snapshot.cachedCanvas && snapshot.cachedCtx) {
        const copy = new ImageData(
          new Uint8ClampedArray(snapshot.cachedImageData.data),
          snapshot.cachedImageData.width,
          snapshot.cachedImageData.height
        );
        applyAdjustmentParamsToImageData(copy, params, false);
        snapshot.cachedCtx.putImageData(copy, 0, 0);
        const previewUrl = snapshot.cachedCanvas.toDataURL('image/png');
        setInpaintLayers(prev => prev.map(l => l.id === snapshot.layerId ? {
          ...l,
          image: previewUrl,
          adjustmentParams: params
        } : l));
      } else if (snapshot.originalImageSrc) {
        applyAdjustmentParamsToImageUrl(snapshot.originalImageSrc, params).then((previewUrl) => {
          setInpaintLayers(prev => prev.map(l => l.id === snapshot.layerId ? {
            ...l,
            image: previewUrl,
            adjustmentParams: params
          } : l));
        });
      }
      return;
    }

    if (snapshot.targetType === 'base') {
      if (snapshot.cachedImageData && snapshot.cachedCanvas && snapshot.cachedCtx) {
        const copy = new ImageData(
          new Uint8ClampedArray(snapshot.cachedImageData.data),
          snapshot.cachedImageData.width,
          snapshot.cachedImageData.height
        );
        applyAdjustmentParamsToImageData(copy, params, false);
        snapshot.cachedCtx.putImageData(copy, 0, 0);
        const previewUrl = snapshot.cachedCanvas.toDataURL('image/png');
        setCurrentCanvasImage(previewUrl);
      } else if (snapshot.originalImageSrc) {
        applyAdjustmentParamsToImageUrl(snapshot.originalImageSrc, params).then((previewUrl) => {
          setCurrentCanvasImage(previewUrl);
        });
      }
    }
  }, [canvasRef, updateMaskPreview, setInpaintLayers, setCurrentCanvasImage]);

  const handleCommitAdjustment = useCallback((params: AdjustmentParams) => {
    const snapshot = adjustmentSnapshotRef.current;
    if (!snapshot) return;

    if (snapshot.targetType === 'mask') {
      pushHistory();
      updateMaskPreview();
      useNotificationStore.getState().addNotification({
        type: 'success',
        title: params.name,
        message: `Applied ${params.name} to mask.`,
        duration: 2200,
      });
      adjustmentSnapshotRef.current = null;
      return;
    }

    if (snapshot.targetType === 'layer' && snapshot.layerId) {
      pushHistory();
      useNotificationStore.getState().addNotification({
        type: 'success',
        title: params.name,
        message: `Saved ${params.name} adjustments.`,
        duration: 2200,
      });
      snapshot.isNewLayer = false;
      return;
    }

    if (snapshot.targetType === 'base') {
      const finalUrl = currentCanvasImage || snapshot.originalImageSrc;
      if (finalUrl) {
        setBaseOriginalImage(finalUrl);
        setCurrentCanvasImage(finalUrl);
      }
      pushHistory();
      useNotificationStore.getState().addNotification({
        type: 'success',
        title: params.name,
        message: `Applied ${params.name} to background base.`,
        duration: 2200,
      });
      adjustmentSnapshotRef.current = null;
    }
  }, [pushHistory, updateMaskPreview, currentCanvasImage, setBaseOriginalImage, setCurrentCanvasImage]);

  const handleCancelAdjustment = useCallback(() => {
    const snapshot = adjustmentSnapshotRef.current;
    if (!snapshot) return;

    if (snapshot.targetType === 'mask' && snapshot.originalMaskData) {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        ctx.putImageData(snapshot.originalMaskData, 0, 0);
        updateMaskPreview();
      }
    } else if (snapshot.targetType === 'layer' && snapshot.layerId) {
      if (snapshot.isNewLayer) {
        setInpaintLayers(prev => prev.filter(l => l.id !== snapshot.layerId));
      } else if (snapshot.originalImageSrc) {
        setInpaintLayers(prev => prev.map(l => l.id === snapshot.layerId ? {
          ...l,
          image: snapshot.originalImageSrc!,
          adjustmentParams: snapshot.originalAdjustmentParams
        } : l));
      }
    } else if (snapshot.targetType === 'base') {
      if (snapshot.originalBaseOriginal !== undefined) {
        setBaseOriginalImage(snapshot.originalBaseOriginal);
      }
      if (snapshot.originalCanvasImage !== undefined) {
        setCurrentCanvasImage(snapshot.originalCanvasImage);
      }
    }
    adjustmentSnapshotRef.current = null;
  }, [canvasRef, updateMaskPreview, setInpaintLayers, setBaseOriginalImage, setCurrentCanvasImage]);

  // Backward-compatible single-call adjustment applicator
  const handleApplyAdjustment = useCallback(async (key: string, name: string) => {
    const isMask = activeLayerId === 'active-mask' || inpaintLayers.find(l => l.id === activeLayerId)?.selectedTarget === 'mask';
    const params: AdjustmentParams = { key, name };

    if (isMask) {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        applyAdjustmentParamsToImageData(imgData, params, true);
        ctx.putImageData(imgData, 0, 0);
        pushHistory();
        updateMaskPreview();
        useNotificationStore.getState().addNotification({
          type: 'success',
          title: name,
          message: `Applied ${name} to mask.`,
          duration: 2200,
        });
        return;
      }
    }

    if (activeLayerId && activeLayerId !== 'base') {
      const layer = inpaintLayers.find(l => l.id === activeLayerId);
      if (layer?.image) {
        const adjustedImg = await applyAdjustmentParamsToImageUrl(layer.image, params);
        setInpaintLayers(prev => prev.map(l => l.id === activeLayerId ? { ...l, image: adjustedImg } : l));
        pushHistory();
        useNotificationStore.getState().addNotification({
          type: 'success',
          title: name,
          message: `Applied ${name} to layer ${layer.name}.`,
          duration: 2500,
        });
        return;
      }
    }

    const baseSrc = resolvedBaseImage || baseOriginalImage || currentCanvasImage;
    if (baseSrc) {
      const adjustedImg = await applyAdjustmentParamsToImageUrl(baseSrc, params);
      setBaseOriginalImage(adjustedImg);
      setCurrentCanvasImage(adjustedImg);
      pushHistory();
      useNotificationStore.getState().addNotification({
        type: 'success',
        title: name,
        message: `Applied ${name} to background base.`,
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
    canvasRef,
    pushHistory,
    updateMaskPreview,
    setBaseOriginalImage,
    setCurrentCanvasImage,
  ]);

  return {
    handleCreateAdjustmentLayer,
    handleStartAdjustment,
    handlePreviewAdjustment,
    handleCommitAdjustment,
    handleCancelAdjustment,
    handleApplyAdjustment,
  };
}
