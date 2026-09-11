import React from 'react';
import { anarchyService } from '../../../../../services/anarchy/AnarchyService';
import { logger } from '../../../../../utils/logger';
import { getModelCost, checkCreditBalance, deductCredits } from '../../../../../services/credit/creditService';
import { geminiAgentService } from '../../../../../services/gemini/GeminiAgentService';
import {
  type LayoutRegion,
  type LayoutData,
  type CropBounds,
  type ChatMessage,
  DEFAULT_CROP_BOUNDS,
} from '../types';

export interface UseLayoutAIOperationsProps {
  userId: string;
  activeStageImage: string | null;
  displayImage: string | null;
  rawImage: string | null;
  layout: LayoutData | null;
  setLayout: React.Dispatch<React.SetStateAction<LayoutData | null>>;
  regionPrompts: Record<number, string>;
  setRegionPrompts: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  setExpandedNodes: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  onLayoutExtracted?: (layout: LayoutData) => void;
  onApplyResult: (resultImageUrl: string) => void;
  saveSceneToLibrary: (imageUrl: string, layoutData: any, promptText?: string) => void;
  setActiveStageImage: React.Dispatch<React.SetStateAction<string | null>>;
  setImageHistory: React.Dispatch<React.SetStateAction<string[]>>;
  setExtractError: React.Dispatch<React.SetStateAction<string | null>>;
  setIsExtracting: React.Dispatch<React.SetStateAction<boolean>>;
  setIsRendering: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedRegionIdx: React.Dispatch<React.SetStateAction<number | null>>;
  setHoveredRegionIdx: React.Dispatch<React.SetStateAction<number | null>>;
  maskCanvasRef: React.RefObject<HTMLCanvasElement>;
  maskPrompt: string;
  setMaskPrompt: React.Dispatch<React.SetStateAction<string>>;
  clearMaskCanvas: () => void;
  cropBounds: CropBounds;
  setCropBounds: React.Dispatch<React.SetStateAction<CropBounds>>;
  setIsReframeActive: React.Dispatch<React.SetStateAction<boolean>>;
  askAnarchyPrompt: string;
  setAskAnarchyPrompt: React.Dispatch<React.SetStateAction<string>>;
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setPanelMode: React.Dispatch<React.SetStateAction<'edit' | 'chat'>>;
}

export const useLayoutAIOperations = ({
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
  setPanelMode,
}: UseLayoutAIOperationsProps) => {
  // Safe LocalStorage Helper with Quota Cleanup Defense
  const safeSetLocalStorage = (key: string, data: any) => {
    try {
      localStorage.setItem(key, typeof data === 'string' ? data : JSON.stringify(data));
    } catch (e) {
      logger.warn('[LayoutEditor] localStorage quota exceeded, pruning old layout caches...', e);
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('anarchy_layout_')) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.slice(0, Math.ceil(keysToRemove.length / 2)).forEach(k => localStorage.removeItem(k));
        localStorage.setItem(key, typeof data === 'string' ? data : JSON.stringify(data));
      } catch {}
    }
  };

  const handleSendAskAnarchy = async () => {
    const text = askAnarchyPrompt.trim();
    if (!text) return;
    setAskAnarchyPrompt('');

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      sender: 'user',
      text,
      time: 'Just now'
    };
    const agentMsgId = String(Date.now() + 1);

    setChatMessages(prev => [
      ...prev,
      userMsg,
      {
        id: agentMsgId,
        sender: 'agent',
        text: 'Analyzing scene composition and applying AI modification...',
        isThinking: true,
        time: 'Just now'
      }
    ]);
    setPanelMode('chat');

    const targetImage = activeStageImage || displayImage || rawImage;
    if (!targetImage) return;

    setIsRendering(true);

    try {
      const naturalExplainer = await geminiAgentService.generateAgentResponse(text, targetImage);

      const result = await anarchyService.generate(
        {
          model: 'reve/edit-fast',
          prompt: text,
          aspectRatio: 'match_input_image'
        },
        [targetImage]
      );

      if (result?.imageUrl) {
        onApplyResult(result.imageUrl);
        setActiveStageImage(result.imageUrl);
        setImageHistory(prev => [result.imageUrl, ...prev]);

        setChatMessages(prev =>
          prev.map(msg =>
            msg.id === agentMsgId
              ? {
                  ...msg,
                  text: naturalExplainer,
                  imageUrl: result.imageUrl,
                  isThinking: false,
                  time: 'Just now'
                }
              : msg
          )
        );
        setExtractError(null);
      } else {
        throw new Error('Agent generation returned no result');
      }
    } catch (err: any) {
      logger.error('[LayoutEditor] Agent Chat generation failed:', err);
      setChatMessages(prev =>
        prev.map(msg =>
          msg.id === agentMsgId
            ? {
                ...msg,
                text: `Sorry, I couldn't complete the modification: ${err?.message || 'API error'}`,
                isThinking: false,
                time: 'Just now'
              }
            : msg
        )
      );
    } finally {
      setIsRendering(false);
    }
  };

  const handleExtractLayout = async (forceRefreshParam?: boolean | React.MouseEvent) => {
    const forceRefresh = typeof forceRefreshParam === 'boolean' ? forceRefreshParam : false;
    const targetImage = activeStageImage || displayImage || rawImage;
    if (!targetImage) return;

    const scanCost = getModelCost('reve/extract-layout');
    if (forceRefresh) {
      const check = await checkCreditBalance(userId, scanCost);
      if (!check.hasEnough) {
        setExtractError(`Insufficient credits! Scene layout scan requires ${scanCost} credits (Balance: ${check.balance}).`);
        return;
      }
    }

    setIsExtracting(true);
    setExtractError(null);
    setSelectedRegionIdx(null);
    setHoveredRegionIdx(null);

    try {
      const result = await anarchyService.extractLayout(targetImage, undefined, undefined, forceRefresh);
      if (result && Array.isArray(result.regions)) {
        setLayout(result);
        onLayoutExtracted?.(result);
        saveSceneToLibrary(targetImage, result);
        const initialPrompts: Record<number, string> = {};
        const defaultExpanded: Record<number, boolean> = {};
        result.regions.forEach((reg: LayoutRegion, i: number) => {
          initialPrompts[i] = reg.prompt || '';
          defaultExpanded[i] = true;
        });
        setRegionPrompts(initialPrompts);
        setExpandedNodes(defaultExpanded);

        if (forceRefresh) {
          await deductCredits(userId, scanCost, 'Anarchy AI Scene Layout Scan');
        }
      } else {
        throw new Error('Reve extract layout returned no regions');
      }
    } catch (err: any) {
      logger.error('[LayoutEditor] Extract layout failed:', err);

      // Graceful cache recovery check: strictly for THIS image cacheKey only!
      const cacheKey = anarchyService.getCacheKey(targetImage);
      const fallbackCache = anarchyService.layoutCache.get(cacheKey);

      if (fallbackCache && Array.isArray(fallbackCache.regions)) {
        logger.log('[LayoutEditor] Recovered layout successfully from cache fallback:', fallbackCache);
        setLayout(fallbackCache);
        onLayoutExtracted?.(fallbackCache);
        setExtractError(null);
        return;
      }

      const isRateLimit = err?.message?.toLowerCase().includes('too many requests');
      if (isRateLimit) {
        setExtractError('API Rate Limit (429): You are making requests too quickly. Please wait 10-15 seconds before retrying.');
      } else {
        setExtractError(err?.message || 'Failed to extract layout regions from image');
      }
    } finally {
      setIsExtracting(false);
    }
  };

  const handleApplyEdits = async () => {
    const targetImage = activeStageImage || displayImage || rawImage;
    if (!targetImage || !layout) return;
    setIsRendering(true);

    try {
      const modifiedRegions = layout.regions.map((reg, idx) => ({
        ...reg,
        prompt: regionPrompts[idx] !== undefined ? regionPrompts[idx] : (reg.prompt || '')
      }));

      const modifiedLayout = {
        ...layout,
        regions: modifiedRegions
      };

      const result = await anarchyService.renderLayout(modifiedLayout, [targetImage]);
      if (result?.imageUrl) {
        onApplyResult(result.imageUrl);
        onLayoutExtracted?.(modifiedLayout);
        saveSceneToLibrary(result.imageUrl, modifiedLayout);
        const base64 = await anarchyService.resolveImageToPngBase64(result.imageUrl);
        const cacheKey = anarchyService.getCacheKey(base64);
        anarchyService.layoutCache.set(cacheKey, modifiedLayout);
        safeSetLocalStorage(`anarchy_layout_${cacheKey}`, modifiedLayout);
        setActiveStageImage(result.imageUrl);
        setImageHistory(prev => [result.imageUrl, ...prev]);
        setExtractError(null);
      } else {
        throw new Error('Render layout did not return an image URL');
      }
    } catch (err: any) {
      logger.error('[LayoutEditor] Render layout failed:', err);
      setExtractError(err?.message || 'Failed to render modified layout');
    } finally {
      setIsRendering(false);
    }
  };

  /**
   * Generates a binary inpaint mask (Black background #000000, Solid Opaque White strokes #ffffff)
   * scaled precisely to targetImage's true natural resolution (img.naturalWidth x img.naturalHeight).
   */
  const exportBinaryInpaintMask = (
    displayCanvas: HTMLCanvasElement,
    targetImgUrl: string
  ): Promise<string | undefined> => {
    return new Promise((resolve) => {
      const img = new Image();
      if (targetImgUrl.startsWith('http://') || targetImgUrl.startsWith('https://')) {
        img.crossOrigin = 'anonymous';
      }
      img.onload = () => {
        try {
          const targetW = img.naturalWidth || 1024;
          const targetH = img.naturalHeight || 1024;

          const offCanvas = document.createElement('canvas');
          offCanvas.width = targetW;
          offCanvas.height = targetH;
          const ctx = offCanvas.getContext('2d');

          if (!ctx) {
            resolve(displayCanvas.toDataURL('image/png'));
            return;
          }

          // 1. Fill solid black background (#000000)
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, targetW, targetH);

          // 2. Draw display canvas content scaled up to target natural resolution
          ctx.drawImage(displayCanvas, 0, 0, targetW, targetH);

          // 3. Convert any painted pixel to solid 100% opaque white (#ffffff)
          const imgData = ctx.getImageData(0, 0, targetW, targetH);
          const data = imgData.data;
          let hasMaskPixels = false;

          for (let i = 0; i < data.length; i += 4) {
            const alpha = data[i + 3];
            if (alpha > 10) {
              data[i] = 255;     // R
              data[i + 1] = 255; // G
              data[i + 2] = 255; // B
              data[i + 3] = 255; // Alpha 100%
              hasMaskPixels = true;
            } else {
              data[i] = 0;       // R
              data[i + 1] = 0;   // G
              data[i + 2] = 0;   // B
              data[i + 3] = 255; // Alpha 100% Opaque Black
            }
          }

          if (!hasMaskPixels) {
            resolve(undefined);
            return;
          }

          ctx.putImageData(imgData, 0, 0);
          resolve(offCanvas.toDataURL('image/png'));
        } catch (e) {
          logger.warn('[LayoutEditor] Mask binary export failed, fallback to display canvas:', e);
          try {
            resolve(displayCanvas.toDataURL('image/png'));
          } catch {
            resolve(undefined);
          }
        }
      };
      img.onerror = () => {
        try {
          resolve(displayCanvas.toDataURL('image/png'));
        } catch {
          resolve(undefined);
        }
      };
      img.src = targetImgUrl;
    });
  };

  // Mask Brush API Inpainting Integration (Connected to Anarchy AI)
  const handleApplyMaskEdit = async () => {
    const targetImage = activeStageImage || displayImage || rawImage;
    if (!targetImage) return;
    setIsRendering(true);

    try {
      let maskBase64: string | undefined = undefined;
      const canvas = maskCanvasRef.current;
      if (canvas) {
        maskBase64 = await exportBinaryInpaintMask(canvas, targetImage);
      }

      const promptText = maskPrompt.trim() || 'Inpaint and modify masked region';
      const imagesPayload = maskBase64 ? [targetImage, maskBase64] : [targetImage];

      const result = await anarchyService.generate(
        {
          model: 'reve/edit-fast',
          prompt: promptText,
          aspectRatio: 'match_input_image'
        },
        imagesPayload
      );

      if (result?.imageUrl) {
        onApplyResult(result.imageUrl);
        setActiveStageImage(result.imageUrl);
        setImageHistory(prev => [result.imageUrl, ...prev]);
        clearMaskCanvas();
        setMaskPrompt('');
        setExtractError(null);
      } else {
        throw new Error('Mask edit generation returned no image result');
      }
    } catch (err: any) {
      logger.error('[LayoutEditor] Mask inpaint failed:', err);
      setExtractError(err?.message || 'Failed to generate mask inpaint edit');
    } finally {
      setIsRendering(false);
    }
  };

  const handleApplyReframe = async () => {
    const targetImage = activeStageImage || displayImage || rawImage;
    if (!targetImage) return;
    setIsRendering(true);

    try {
      const spanX = Math.max(0.1, cropBounds.x1 - cropBounds.x0);
      const spanY = Math.max(0.1, cropBounds.y1 - cropBounds.y0);

      // Remap existing layout regions to the expanded crop bounds
      const remappedRegions = (layout?.regions || []).map((reg) => {
        const origX0 = typeof reg.bbox === 'object' && !Array.isArray(reg.bbox) ? reg.bbox.x0 : (Array.isArray(reg.bbox) ? reg.bbox[1] : 0);
        const origY0 = typeof reg.bbox === 'object' && !Array.isArray(reg.bbox) ? reg.bbox.y0 : (Array.isArray(reg.bbox) ? reg.bbox[0] : 0);
        const origX1 = typeof reg.bbox === 'object' && !Array.isArray(reg.bbox) ? reg.bbox.x1 : (Array.isArray(reg.bbox) ? reg.bbox[3] : 1);
        const origY1 = typeof reg.bbox === 'object' && !Array.isArray(reg.bbox) ? reg.bbox.y1 : (Array.isArray(reg.bbox) ? reg.bbox[2] : 1);

        const rx0 = (origX0 - cropBounds.x0) / spanX;
        const ry0 = (origY0 - cropBounds.y0) / spanY;
        const rx1 = (origX1 - cropBounds.x0) / spanX;
        const ry1 = (origY1 - cropBounds.y0) / spanY;

        return {
          ...reg,
          bbox: {
            x0: Math.max(0, Math.min(1, rx0)),
            y0: Math.max(0, Math.min(1, ry0)),
            x1: Math.max(0, Math.min(1, rx1)),
            y1: Math.max(0, Math.min(1, ry1))
          }
        };
      });

      // Add base image original bounds inside expanded canvas as reference object if outpainted
      const isOutpainted = cropBounds.x0 < -0.01 || cropBounds.y0 < -0.01 || cropBounds.x1 > 1.01 || cropBounds.y1 > 1.01;
      if (isOutpainted) {
        const baseRefX0 = (0 - cropBounds.x0) / spanX;
        const baseRefY0 = (0 - cropBounds.y0) / spanY;
        const baseRefX1 = (1 - cropBounds.x0) / spanX;
        const baseRefY1 = (1 - cropBounds.y1) / spanY;
        remappedRegions.unshift({
          label: 'Original Scene',
          bbox: {
            x0: Math.max(0, Math.min(1, baseRefX0)),
            y0: Math.max(0, Math.min(1, baseRefY0)),
            x1: Math.max(0, Math.min(1, baseRefX1)),
            y1: Math.max(0, Math.min(1, baseRefY1))
          },
          prompt: 'Original image contents'
        });
      }

      const expandedLayout = {
        width: layout?.width || 1024,
        height: layout?.height || 1024,
        regions: remappedRegions
      };

      const result = await anarchyService.renderLayout(expandedLayout, [targetImage]);
      if (result?.imageUrl) {
        onApplyResult(result.imageUrl);
        const base64 = await anarchyService.resolveImageToPngBase64(result.imageUrl);
        const cacheKey = anarchyService.getCacheKey(base64);
        anarchyService.layoutCache.set(cacheKey, expandedLayout);
        safeSetLocalStorage(`anarchy_layout_${cacheKey}`, expandedLayout);
        setActiveStageImage(result.imageUrl);
        setImageHistory(prev => [result.imageUrl, ...prev]);
        setCropBounds(DEFAULT_CROP_BOUNDS);
        setExtractError(null);
      }
      setIsReframeActive(false);
    } catch (err: any) {
      logger.error('[LayoutEditor] Apply reframe failed:', err);
      setExtractError(err?.message || 'Failed to reframe/outpaint image');
    } finally {
      setIsRendering(false);
    }
  };

  return {
    safeSetLocalStorage,
    handleSendAskAnarchy,
    handleExtractLayout,
    handleApplyEdits,
    exportBinaryInpaintMask,
    handleApplyMaskEdit,
    handleApplyReframe
  };
};
