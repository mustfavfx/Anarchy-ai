import { useCallback } from 'react';
import { logger } from '../../../../utils/logger';
import { useAIConfigStore } from '../../../../stores/aiConfigStore';
import { useNotificationStore } from '../../../../stores/notificationStore';
import { exportToPsdWithDialog } from '../../../../services/export';
import {
  featherMask,
  expandMask as expandMaskUtil,
  contractMask as contractMaskUtil,
  fillMask,
  hexToRgba,
  renderCompositeAndMask,
} from '../utils/maskBitmapUtils';
import type { InpaintLayer } from '../../components/LayersPanel';
import type { ArrowNodeItem } from '../../components/VizMakerArrowCard';
import type { LayerVisibility } from '../types';

export interface UseMaskExportAndActionsParams {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  drawingCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  resolvedImage?: string | null;
  image?: string | null;
  imgMeta: { w: number; h: number } | null;
  layerVisibility: LayerVisibility;
  inpaintLayers: InpaintLayer[];
  workspaceMode: string;
  arrowNodes: ArrowNodeItem[];
  maskPreviewUrl: string | null;
  maskPrompt: string;
  liveModel: string;
  brushColor: string;
  maskOverlayOpacity: number;
  pushHistory: () => void;
  updateMaskPreview: () => void;
  setHasSelectionContent: (val: boolean) => void;
  setHasCopiedMask: (val: boolean) => void;
  setLocalIsGenerating: (val: boolean) => void;
  onGenerate?: (composite: string, mask: string, prompt: string, refImages?: string[], model?: string) => void;
}

export function useMaskExportAndActions({
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
}: UseMaskExportAndActionsParams) {
  const getCompositeAndMask = useCallback(async (): Promise<{ composite: string; mask: string } | null> => {
    const canvas = canvasRef.current;
    const baseImgSrc = resolvedImage || image;
    if (!canvas || !baseImgSrc) {
      logger.warn('[MaskCanvas] getCompositeAndMask: missing canvas or baseImgSrc');
      return null;
    }

    return renderCompositeAndMask({
      canvas,
      baseImgSrc,
      imgMeta,
      layerVisibility,
      inpaintLayers,
      drawingCanvas: drawingCanvasRef.current,
      workspaceMode,
      arrowNodes,
      wrapperEl: wrapperRef.current,
    });
  }, [resolvedImage, image, imgMeta, layerVisibility, inpaintLayers, workspaceMode, arrowNodes, canvasRef, drawingCanvasRef, wrapperRef]);

  const exportBinaryMask = useCallback(async () => {
    const res = await getCompositeAndMask();
    if (!res) return;
    const link = document.createElement('a');
    link.download = `binary_mask_${Date.now()}.png`;
    link.href = res.mask;
    link.click();
  }, [getCompositeAndMask]);

  const exportFullComposite = useCallback(async () => {
    const res = await getCompositeAndMask();
    if (!res) return;
    const link = document.createElement('a');
    link.download = `composite_${Date.now()}.png`;
    link.href = res.composite;
    link.click();
  }, [getCompositeAndMask]);

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
          title: 'PSD Saved',
          message: `Saved layers to: ${savedPath}`,
          duration: 4000,
        });
      }
    } catch (err) {
      logger.error('[MaskCanvas] PSD export failed:', err);
      useNotificationStore.getState().addNotification({
        type: 'error',
        title: 'PSD Export Failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, [resolvedImage, image, getCompositeAndMask, maskPreviewUrl, inpaintLayers, layerVisibility.image, imgMeta, canvasRef]);

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
  }, [getCompositeAndMask, setHasCopiedMask]);

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
  }, [getCompositeAndMask, liveModel, maskPrompt]);

  const featherCurrentMask = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    featherMask(canvas);
    pushHistory();
    updateMaskPreview();
  }, [pushHistory, updateMaskPreview, canvasRef]);

  const expandMask = useCallback((px = 4) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    expandMaskUtil(canvas, px);
    setHasSelectionContent(true);
    pushHistory();
    updateMaskPreview();
    useNotificationStore.getState().addNotification({
      type: 'info',
      title: 'Mask Expanded',
      message: `Expanded selection boundary by +${px}px.`,
      duration: 2000
    });
  }, [pushHistory, updateMaskPreview, canvasRef, setHasSelectionContent]);

  const contractMask = useCallback((px = 4) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    contractMaskUtil(canvas, px);
    setHasSelectionContent(true);
    pushHistory();
    updateMaskPreview();
    useNotificationStore.getState().addNotification({
      type: 'info',
      title: 'Mask Contracted',
      message: `Contracted selection boundary by -${px}px.`,
      duration: 2000
    });
  }, [pushHistory, updateMaskPreview, canvasRef, setHasSelectionContent]);

  const fillEntireMask = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    fillMask(canvas, hexToRgba(brushColor, maskOverlayOpacity));
    setHasSelectionContent(true);
    pushHistory();
    updateMaskPreview();
    useNotificationStore.getState().addNotification({
      type: 'info',
      title: 'Mask Inverted / Filled',
      message: 'Canvas filled with mask stencil.',
      duration: 1500
    });
  }, [brushColor, maskOverlayOpacity, pushHistory, updateMaskPreview, canvasRef, setHasSelectionContent]);

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
  }, [maskPrompt, arrowNodes, onGenerate, liveModel, getCompositeAndMask, setLocalIsGenerating]);

  return {
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
  };
}
