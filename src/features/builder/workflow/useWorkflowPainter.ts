import { useCallback, useEffect } from 'react';
import type { Edge, XYPosition } from '@xyflow/react';
import { invoke } from '@tauri-apps/api/core';
import { logger } from '../../../utils/logger';
import { useAIConfigStore } from '../../../stores/aiConfigStore';
import { useNotificationStore } from '../../../stores/notificationStore';
import { watermarkService } from '../../../services/watermark/WatermarkService';
import {
  getUnifiedCost,
  deductCredits,
  refundCredits,
  getUserCredit,
  DEV_MODE,
} from '../../../services/credit/creditService';
import {
  addHistoryEntry,
  cacheLocalImage,
  resolveUrlToBlob,
} from '../../../services/history/HistoryService';
import { replicateService } from '../../../services/replicate';
import { getCurrentUserId } from '../../../services/supabase/supabaseClient';
import type { BuilderNode, BuilderNodeData } from '../types';
import {
  uploadImageIfLocal,
  persistImageLocally,
  resolveImageIfCached,
  createDataPacket,
  createEdge,
} from './workflowConstants';

export interface UseWorkflowPainterParams {
  nodesRef: React.MutableRefObject<BuilderNode[]>;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  setNodes: (update: BuilderNode[] | ((curr: BuilderNode[]) => BuilderNode[])) => void;
  setEdges: (update: Edge[] | ((curr: Edge[]) => Edge[])) => void;
  getNode: (id: string) => BuilderNode | undefined;
  calculateChildPosition: (parentId: string) => XYPosition;
}

export const useWorkflowPainter = ({
  nodesRef,
  selectedNodeId,
  setSelectedNodeId,
  setNodes,
  setEdges,
  getNode,
  calculateChildPosition,
}: UseWorkflowPainterParams) => {
  const onPainterRenderedImageAsNodeHandler = useCallback(async (payload: {
    compositeImage: string;
    maskDataUrl?: string;
    prompt: string;
    refImages?: string[];
    sourceNodeId?: string;
    model?: string;
  }) => {
    const currentSelectedNode = useAIConfigStore.getState().selectedNode;
    const parentId = payload.sourceNodeId || selectedNodeId || currentSelectedNode?.id || nodesRef.current.find(n => (n.data as any)?.image)?.id || nodesRef.current[0]?.id;
    if (!parentId) {
      logger.warn('[BuilderWorkflow] No parent node ID for mask generation');
      window.dispatchEvent(new CustomEvent('anarchy:mask-generation-error'));
      return;
    }

    const parentNode = nodesRef.current.find(n => n.id === parentId);
    const parentData = parentNode?.data as BuilderNodeData | undefined;
    const initialOriginalImage = parentData?.originalImage || parentData?.outputData?.image || parentData?.image || currentSelectedNode?.image;
    const cleanParentImage = parentData?.outputData?.image || parentData?.image || currentSelectedNode?.image;

    const currentConfig = useAIConfigStore.getState().config;
    const model = payload.model || currentConfig.model || 'google/nano-banana-2';
    const isTrial = useAIConfigStore.getState().isTrial ?? true;
    const cost = getUnifiedCost(currentConfig, isTrial, model as string);

    const userId = getCurrentUserId();
    let creditDeducted = false;

    try {
      // Verify credit balance from store
      const storeCredits = useAIConfigStore.getState().userCredits;
      if (storeCredits !== null && storeCredits < cost && !DEV_MODE) {
        useNotificationStore.getState().addNotification({
          type: 'error',
          title: 'Insufficient Credits',
          message: `You need ${cost} credits, but have ${storeCredits}. Please add credits.`,
          duration: 4000
        });
        window.dispatchEvent(new CustomEvent('anarchy:mask-generation-error'));
        return;
      }

      // Optimistically deduct credits locally
      if (storeCredits !== null) {
        useAIConfigStore.getState().setUserCredits(Math.max(0, storeCredits - cost));
      }

      // Background deduction from database
      if (userId && userId !== 'default_user' && !DEV_MODE) {
        deductCredits(userId, cost, `AI Mask Inpaint: ${payload.prompt?.slice(0, 30)}...`)
          .then(res => {
            if (res.success && typeof res.remaining === 'number') {
              useAIConfigStore.getState().setUserCredits(res.remaining);
            }
          })
          .catch(e => logger.warn('[BuilderWorkflow] Background credit deduction error:', e));
        creditDeducted = true;
      }

      // Update active parent node state to processing
      setNodes(nds => nds.map(n => n.id === parentId ? {
        ...n,
        data: {
          ...n.data,
          state: 'processing',
          statusMessage: 'Inpainting masked region...',
        }
      } : n));

      // 1. Resolve and upload source images
      let sourceImgUrl = cleanParentImage || payload.compositeImage;
      if (sourceImgUrl && sourceImgUrl.startsWith('idb://')) {
        sourceImgUrl = (await resolveImageIfCached(sourceImgUrl)) || sourceImgUrl;
      }
      const uploadedSourceImg = await uploadImageIfLocal(sourceImgUrl, model as string);

      let uploadedCompositeImg: string | undefined = undefined;
      if (payload.compositeImage && payload.compositeImage !== cleanParentImage) {
        let cImg = payload.compositeImage;
        if (cImg.startsWith('idb://')) {
          cImg = (await resolveImageIfCached(cImg)) || cImg;
        }
        uploadedCompositeImg = await uploadImageIfLocal(cImg, model as string);
      }

      let uploadedMaskImg: string | undefined = undefined;
      if (payload.maskDataUrl) {
        let mImg = payload.maskDataUrl;
        if (mImg.startsWith('idb://')) {
          mImg = (await resolveImageIfCached(mImg)) || mImg;
        }
        uploadedMaskImg = await uploadImageIfLocal(mImg, model as string);
      }

      // Upload reference images from Mask Note cards if present
      let uploadedRefImgs: string[] = [];
      if (payload.refImages && payload.refImages.length > 0) {
        uploadedRefImgs = (await Promise.all(
          payload.refImages.map(async (img) => {
            let rImg = img;
            if (rImg.startsWith('idb://')) {
              rImg = (await resolveImageIfCached(rImg)) || rImg;
            }
            return await uploadImageIfLocal(rImg, model as string);
          })
        )).filter(Boolean);
      }

      const effectiveUserId = userId || 'anonymous';
      let generatedImageUrl = '';

      // 2. Dispatch to AI Engine based on model family
      const cleanUserPrompt = payload.prompt ? payload.prompt.replace(/^\d+[-–\s]*/, '').trim() : '';
      const promptToUse = cleanUserPrompt || payload.prompt || 'AI Mask Generation';

      if ((model as string).startsWith('google/nano-banana')) {
        // Normalize common Arabic typos (e.g. العرف -> الحرف)
        const normalizedPrompt = promptToUse
          .replace(/\bالعرف\b/g, 'الحرف')
          .replace(/\bتغير\b/g, 'تغيير');

        const spatialPrompt = payload.maskDataUrl
          ? `High-precision targeted inpaint instruction: "${normalizedPrompt}". Seamlessly edit and replace ONLY the designated region specified by the binary mask reference image (where white indicates the target replacement zone and black indicates preserved context), matching local perspective, lighting, depth, scale, and architectural materials. CRITICAL: All unmasked surrounding elements, structures, and background must remain completely unchanged and preserved.`
          : normalizedPrompt;

        const baseParams = {
          ...currentConfig,
          prompt: spatialPrompt,
          model: model as any,
          resolution: currentConfig.resolution || '1K',
          aspectRatio: currentConfig.aspectRatio || 'Auto',
          nodeId: parentId,
          userId: effectiveUserId,
        };

        const imageInputs = [
          uploadedSourceImg,
          ...(uploadedMaskImg ? [uploadedMaskImg] : []),
          ...uploadedRefImgs
        ].filter(Boolean) as string[];

        const genResult = await replicateService.generateImg2Img(
          baseParams,
          imageInputs,
          undefined,
          (status: string) => {
            setNodes(nds => nds.map(n => n.id === parentId ? {
              ...n,
              data: { ...n.data, statusMessage: status }
            } : n));
          }
        );

        generatedImageUrl = genResult.imageUrl;
      } else if (uploadedMaskImg && (
        model === 'reve/edit-fast' ||
        (model as string).includes('inpaint') ||
        (model as string).includes('fill') ||
        (model as string).includes('flux') ||
        (model as string).includes('sdxl')
      )) {
        let inpaintInput: Record<string, any>;
        if ((model as string).includes('flux-fill')) {
          inpaintInput = {
            image: uploadedSourceImg,
            mask: uploadedMaskImg,
            prompt: promptToUse,
          };
        } else if (model === 'reve/edit-fast') {
          inpaintInput = {
            prompt: promptToUse,
            references: [uploadedSourceImg, uploadedMaskImg, ...uploadedRefImgs],
            aspect_ratio: 'auto',
          };
        } else {
          inpaintInput = {
            image: uploadedSourceImg,
            mask: uploadedMaskImg,
            prompt: promptToUse,
          };
        }

        const prediction = await replicateService.runPrediction(
          model as string,
          inpaintInput,
          parentId,
          effectiveUserId
        );

        const rawOutput = prediction.output;
        if (typeof rawOutput === 'string') {
          generatedImageUrl = rawOutput;
        } else if (Array.isArray(rawOutput) && typeof rawOutput[0] === 'string') {
          generatedImageUrl = rawOutput[0];
        } else if (rawOutput && typeof rawOutput === 'object') {
          const obj = rawOutput as any;
          generatedImageUrl = obj.url || obj.image || (Array.isArray(obj.images) ? obj.images[0] : '');
        }
      } else {
        const baseParams = {
          ...currentConfig,
          prompt: promptToUse,
          model: model as any,
          resolution: currentConfig.resolution || 'Auto',
          aspectRatio: currentConfig.aspectRatio || 'Auto',
          nodeId: parentId,
          userId: effectiveUserId,
        };

        const primaryInput = uploadedCompositeImg || uploadedSourceImg;
        const secondaryInput = uploadedSourceImg && uploadedSourceImg !== primaryInput ? uploadedSourceImg : undefined;
        const imageInputs = [
          primaryInput,
          ...(secondaryInput ? [secondaryInput] : []),
          ...(uploadedMaskImg ? [uploadedMaskImg] : []),
          ...uploadedRefImgs
        ].filter(Boolean) as string[];

        const genResult = await replicateService.generateImg2Img(
          baseParams,
          imageInputs,
          undefined,
          (status: string) => {
            setNodes(nds => nds.map(n => n.id === parentId ? {
              ...n,
              data: { ...n.data, statusMessage: status }
            } : n));
          }
        );

        generatedImageUrl = genResult.imageUrl;
      }

      if (!generatedImageUrl) {
        throw new Error('No image URL received from AI engine');
      }

      // Persist generated image locally as a Blob so it never expires
      let localBlobOrData: Blob | string = generatedImageUrl;
      try {
        const resolvedBlob = await resolveUrlToBlob(generatedImageUrl);
        if (resolvedBlob) {
          localBlobOrData = resolvedBlob;
        }
      } catch (blobErr) {
        logger.warn('[BuilderWorkflow] Could not pre-resolve generated image blob:', blobErr);
      }

      const imageKey = `idb://${crypto.randomUUID()}`;
      await cacheLocalImage(imageKey, localBlobOrData);

      const outputPacket = createDataPacket(
        imageKey,
        payload.prompt,
        'local',
        { width: 1024, height: 1024 },
        model,
        false
      );

      // In-place update of the parent node (Preserve original image in Layer 1 and set inpaint result)
      const persistentOriginalImage = parentData?.originalImage || initialOriginalImage;
      setNodes(nds => nds.map(n => 
        n.id === parentId 
          ? { 
              ...n, 
              data: { 
                ...n.data, 
                state: 'ready',
                image: imageKey,
                originalImage: persistentOriginalImage,
                prompt: payload.prompt,
                outputData: outputPacket,
                updatedAt: Date.now()
              } 
            } 
          : n
      ));

      // Update selectedNode in AIConfigStore
      useAIConfigStore.getState().setSelectedNode({
        id: parentId,
        type: parentData?.type || 'source',
        image: imageKey,
        originalImage: persistentOriginalImage,
        prompt: payload.prompt,
        state: 'ready',
      });

      // Notify MaskCanvas of the completed in-place edit
      window.dispatchEvent(new CustomEvent('anarchy:mask-generated-in-place', {
        detail: {
          imageUrl: imageKey,
          resolvedUrl: generatedImageUrl,
          originalImage: persistentOriginalImage,
          maskDataUrl: payload.maskDataUrl,
          sourceNodeId: parentId,
          prompt: payload.prompt,
        }
      }));

      useNotificationStore.getState().addNotification({
        type: 'success',
        title: 'Inpaint Generated',
        message: 'Image updated in-place successfully.',
        duration: 3000
      });
    } catch (err: any) {
      logger.error('[BuilderWorkflow] Mask generation error:', err);
      if (creditDeducted && userId && userId !== 'default_user' && !DEV_MODE) {
        await refundCredits(userId, cost, 'AI Mask Inpaint Failure Refund').catch(() => {});
        getUserCredit(userId).then((c: any) => c && useAIConfigStore.getState().setUserCredits(c.balance)).catch(() => {});
      }
      window.dispatchEvent(new CustomEvent('anarchy:mask-generation-error'));
      
      // Preserve node image and restore ready state
      setNodes(nds => nds.map(n => n.id === parentId ? {
        ...n,
        data: { 
          ...n.data, 
          state: 'ready', 
          statusMessage: undefined,
          errorMessage: err?.message || 'AI inpaint generation failed' 
        }
      } : n));

      // Keep selectedNode active in store with its original image
      if (cleanParentImage) {
        useAIConfigStore.getState().setSelectedNode({
          id: parentId,
          type: parentData?.type || 'source',
          image: cleanParentImage,
          originalImage: cleanParentImage,
          state: 'ready',
          prompt: parentData?.prompt || '',
        });
      }

      useNotificationStore.getState().addNotification({
        type: 'error',
        title: 'Inpaint Generation Error',
        message: err?.message || 'Failed to connect to AI engine. Check API key and internet connection.',
        duration: 5000
      });
    }
  }, [selectedNodeId, setNodes]);

  // Listen for mask generation triggers from MaskCanvas / EnlargedPreview
  useEffect(() => {
    const handleMaskGenerateEvent = (e: Event) => {
      const customEv = e as CustomEvent;
      if (customEv.detail) {
        onPainterRenderedImageAsNodeHandler(customEv.detail);
      }
    };

    const handleMaskGenerateNodeEvent = async (e: Event) => {
      const customEv = e as CustomEvent;
      const detail = customEv.detail;
      if (!detail || !detail.compositeImage) return;

      try {
        const { compositeImage, prompt, model, sourceNodeId } = detail;
        const key = `idb://${crypto.randomUUID()}`;
        await cacheLocalImage(key, compositeImage);

        const parentNode = (sourceNodeId ? getNode(sourceNodeId) : null) || nodesRef.current.find(n => n.id === selectedNodeId) || nodesRef.current[0];
        const parentId = parentNode?.id;
        const newPos = parentId ? calculateChildPosition(parentId) : { x: 300, y: 300 };

        const parentData = parentNode?.data as BuilderNodeData | undefined;
        const parentLineage = parentData?.lineage;
        const newId = `node-${crypto.randomUUID()}`;
        const outputPacket = createDataPacket(
          key,
          prompt || 'Masked Inpaint Edit',
          'local',
          { width: 1024, height: 1024 },
          model,
          false
        );

        const newNode: BuilderNode = {
          id: newId,
          type: 'baseNode',
          position: newPos,
          width: 260,
          data: {
            label: 'Inpaint Layer',
            type: 'result',
            processingType: 'local',
            state: 'ready',
            image: key,
            originalImage: parentData?.originalImage || parentData?.image || key,
            prompt: prompt || 'Masked Inpaint Edit',
            modelUsed: model,
            createdAt: Date.now(),
            processedAt: Date.now(),
            lineage: {
              parentId: parentId || null,
              rootSourceId: parentLineage?.rootSourceId || parentId || '',
              generation: parentLineage ? parentLineage.generation + 1 : 1,
              branchIndex: 0,
              processingType: 'local',
              ancestry: parentLineage && parentNode ? [...parentLineage.ancestry, parentNode.id] : [],
            },
            outputData: outputPacket,
            dimensions: { width: 1024, height: 1024 }
          }
        };

        setNodes(nds => [...nds, newNode]);
        if (parentId) {
          const newEdge = createEdge(parentId, newId, {
            animated: false,
            isDataFlow: true,
            packet: outputPacket
          });
          setEdges(eds => [...eds, newEdge]);
        }
        setSelectedNodeId(newId);
      } catch (err) {
        logger.error('[BuilderWorkflow] Failed to create mask node:', err);
      }
    };

    window.addEventListener('anarchy:mask-generate', handleMaskGenerateEvent);
    window.addEventListener('anarchy:mask-generate-node', handleMaskGenerateNodeEvent);
    return () => {
      window.removeEventListener('anarchy:mask-generate', handleMaskGenerateEvent);
      window.removeEventListener('anarchy:mask-generate-node', handleMaskGenerateNodeEvent);
    };
  }, [onPainterRenderedImageAsNodeHandler, calculateChildPosition, getNode, selectedNodeId, setNodes, setEdges, setSelectedNodeId]);


  return {
    onPainterRenderedImageAsNodeHandler,
  };
};
