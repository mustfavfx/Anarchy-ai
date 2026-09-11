import { useCallback } from 'react';
import type { Edge, XYPosition } from '@xyflow/react';
import { invoke } from '@tauri-apps/api/core';
import type { BuilderNode, BuilderNodeData, ProcessingType, DataPacket } from '../types';
import {
  type GenerationConfig,
  uploadImageIfLocal,
  persistImageLocally,
  resolveImageIfCached,
  createDataPacket,
  createEdge,
  MODEL_DISPLAY_NAMES,
  HORIZONTAL_SPACING,
  VERTICAL_SPACING,
} from './workflowConstants';
import { logger } from '../../../utils/logger';
import { replicateService } from '../../../services/replicate';
import { anarchyService } from '../../../services/anarchy/AnarchyService';
import { UpscalerFactory } from '../../../services/upscalers/UpscalerFactory';
import { useAIConfigStore } from '../../../stores/aiConfigStore';
import { useNotificationStore } from '../../../stores/notificationStore';
import { useBuilderQueueStore } from '../../../stores/builderQueueStore';
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
  getLocalImage,
  deleteLocalImage,
  revokeObjectUrl,
  dataURLtoBlob,
  resolveUrlToBlob,
} from '../../../services/history/HistoryService';
import type { NodeTreeData } from '../../../types/history';
import { track } from '../../../services/tracking/trackingService';

export interface UseWorkflowExecutionParams {
  nodesRef: React.MutableRefObject<BuilderNode[]>;
  edgesRef: React.MutableRefObject<Edge[]>;
  setNodes: (update: BuilderNode[] | ((curr: BuilderNode[]) => BuilderNode[])) => void;
  setEdges: (update: Edge[] | ((curr: Edge[]) => Edge[])) => void;
  getNode: (nodeId: string) => BuilderNode | undefined;
  getParent: (nodeId: string) => BuilderNode | undefined;
  getChildren: (nodeId: string) => BuilderNode[];
  propagateNodeUpdate: (nodeId: string, explicitPacket?: DataPacket) => void;
  pushHistory: (nodes: BuilderNode[], edges: Edge[]) => void;
  abortControllers: React.MutableRefObject<Map<string, AbortController>>;
  tabId?: string;
  userId: string;
  spawnGhostNode: (parentId: string, processingType: ProcessingType) => string | null;
}

export const useWorkflowExecution = ({
  nodesRef,
  edgesRef,
  setNodes,
  setEdges,
  getNode,
  getParent,
  getChildren,
  propagateNodeUpdate,
  pushHistory,
  abortControllers,
  tabId,
  userId,
  spawnGhostNode,
}: UseWorkflowExecutionParams) => {
  const executeNodeSingle = useCallback(async (
    nodeId: string,
    prompt: string,
    config?: GenerationConfig
  ): Promise<{ image: string }> => {
    const node = getNode(nodeId) || nodesRef.current.find(n => n.id === nodeId);
    if (!node) throw new Error(`Node ${nodeId} not found`);

    const nodeData = node.data as BuilderNodeData;
    
    // Validate: only ghost, source, or result nodes can be executed
    if (nodeData.type !== 'ghost' && nodeData.type !== 'source' && nodeData.type !== 'result') {
      throw new Error(`Cannot execute ${nodeData.type} node`);
    }

    // Check if already processing (active controller indicates running process)
    if (abortControllers.current.has(nodeId)) {
      throw new Error('Node is already processing');
    }

    const _execStartTime = Date.now();
    const model = config?.model || 'google/nano-banana-2';
    
    // Get source image(s) from connected parent nodes
    // Include edges both with and without explicit targetHandle
    const incomingEdges = edgesRef.current
      .filter(e => e.target === nodeId)
      .sort((a, b) => {
        const matchA = a.targetHandle ? a.targetHandle.match(/ghost-target-(\d+)/) : null;
        const matchB = b.targetHandle ? b.targetHandle.match(/ghost-target-(\d+)/) : null;
        const idxA = matchA ? parseInt(matchA[1], 10) : 0;
        const idxB = matchB ? parseInt(matchB[1], 10) : 0;
        return idxA - idxB;
      });

    const allParentImages: string[] = [];
    incomingEdges.forEach(edge => {
      const parentNode = nodesRef.current.find(n => n.id === edge.source);
      if (parentNode) {
        const parentData = parentNode.data as BuilderNodeData;
        const img = (typeof parentData.outputData?.image === 'string' ? parentData.outputData.image : undefined) || 
                    (typeof parentData.image === 'string' ? parentData.image : undefined) || 
                    parentData.previewUrl || 
                    (typeof parentData.inputData?.image === 'string' ? parentData.inputData.image : undefined);
        if (img && typeof img === 'string' && !allParentImages.includes(img)) {
          allParentImages.push(img);
        }
      }
    });

    // Fallback 1: check lineage parentId if no image found via edges
    if (allParentImages.length === 0 && (nodeData as BuilderNodeData)?.lineage?.parentId) {
      const lineageParent = nodesRef.current.find(n => n.id === (nodeData as BuilderNodeData).lineage?.parentId);
      if (lineageParent) {
        const pData = lineageParent.data as BuilderNodeData;
        const img = (typeof pData.outputData?.image === 'string' ? pData.outputData.image : undefined) || 
                    (typeof pData.image === 'string' ? pData.image : undefined) || 
                    pData.previewUrl || 
                    (typeof pData.inputData?.image === 'string' ? pData.inputData.image : undefined);
        if (img && typeof img === 'string') allParentImages.push(img);
      }
    }

    // Fallback 2: check node's own inputData
    if (allParentImages.length === 0 && nodeData.inputData?.image) {
      allParentImages.push(nodeData.inputData.image);
    }
    
    // Resolve any IndexedDB image references to actual base64/URL data
    const resolvedParentResults = await Promise.allSettled(
      allParentImages.map(img => resolveImageIfCached(img))
    );
    const resolvedParentImages = resolvedParentResults.map(r => r.status === 'fulfilled' ? r.value : undefined);
    const validResolvedParentImages = resolvedParentImages.filter((img): img is string => !!img);

    // Upload images based on model requirements
    const uploadedResults = await Promise.allSettled(
      validResolvedParentImages.map(img => uploadImageIfLocal(img, model as string))
    );
    const uploadedImages = uploadedResults.map(r => r.status === 'fulfilled' ? r.value : undefined).filter((img): img is string => !!img);

    // Primary source image is the first connected one
    const sourceImage = uploadedImages[0];
    
    // Check if using an upscale model (Replicate upscale models)
    const isUpscaleModel = (model as string) === 'topazlabs/image-upscale'
      || (model as string) === 'philz1337x/clarity-upscaler'
      || (model as string) === 'prunaai/p-image-upscale'
      || (model as string) === 'philz1337x/clarity-pro-upscaler';
    if (isUpscaleModel && !sourceImage) {
      throw new Error('Upscaling engines require a source image. Please upload or connect an image first.');
    }

    // Central Queue Store: track connecting state
    useBuilderQueueStore.getState().addJob(nodeId, {
      state: 'connecting',
      errorMessage: undefined,
    });

    // Update prompt draft and config once (does not trigger layout/edge recals)
    setNodes(nds => nds.map(n => 
      n.id === nodeId 
        ? { 
            ...n, 
            type: 'ghostNode',
            data: { 
              ...n.data, 
              state: 'connecting',
              promptDraft: prompt,
              config: { ...config },
              pendingPlacement: false,
              onCancel: () => {
                const ctrl = abortControllers.current.get(nodeId);
                if (ctrl) ctrl.abort();
              }
            } 
          }
        : n
    ));

    const controller = new AbortController();
    abortControllers.current.set(nodeId, controller);

    try {
      const onStatusChange = (status: 'queued' | 'processing', predictionId?: string) => {
        useBuilderQueueStore.getState().updateJob(nodeId, {
          state: status,
          predictionId
        });
        setNodes(nds => nds.map(n => 
          n.id === nodeId 
            ? { 
                ...n, 
                type: 'ghostNode',
                data: { 
                  ...n.data, 
                  state: status,
                  predictionId
                } 
              }
            : n
        ));
      };

      // Resolve source dimensions from the first connected parent node (ghost-target-0)
      let sourceDims: { width: number; height: number } | undefined = undefined;
      const primaryEdge = incomingEdges[0];
      if (primaryEdge) {
        const primaryParentNode = nodesRef.current.find(n => n.id === primaryEdge.source);
        if (primaryParentNode) {
          const parentData = primaryParentNode.data as BuilderNodeData;
          const d = (parentData.outputData?.dimensions ?? parentData.dimensions) as { width: number; height: number } | undefined;
          sourceDims = d;
        }
      }
      if (!sourceDims) {
        sourceDims = nodeData.inputData?.dimensions;
      }
      
      let result: { imageUrl: string; imageUrls?: string[]; metadata: { width: number; height: number; model: string; prompt: string } };

      // For upscale models, use upscaleImage API
      if (isUpscaleModel) {
        const upscaler = UpscalerFactory.create(model);
        
        // Build an AIConfig-compatible object from the generation config
        const aiConfig: any = {
          model: model as import('../../../services/replicate').ReplicateUpscaleModel,
          nodeId: nodeId,
          userId: userId || 'user',
          upscaleFactor: config?.upscaleFactor ?? 4,
          negativePrompt: config?.negativePrompt ?? '',
          steps: config?.steps ?? 20,
          cfg: config?.cfg ?? 7,
          seed: config?.seed ?? null,
          strength: config?.strength ?? 0.75,
          referenceStrength: config?.referenceStrength ?? 0.5,
          results: 1,
          disableSafetyChecker: config?.disableSafetyChecker ?? false,
          resolution: config?.resolution ?? 'Auto',
          aspectRatio: config?.aspectRatio ?? 'Auto',
          selectedTool: 'image-upscaler',
          enableWatermark: config?.enableWatermark ?? false,
          watermarkType: 'text',
          watermarkText: config?.watermarkText ?? '',
          watermarkImage: '',
          watermarkImageSize: config?.watermarkFontSize ?? 24,
          watermarkPosition: config?.watermarkPosition ?? 'bottom-right',
          watermarkOpacity: config?.watermarkOpacity ?? 0.5,
          watermarkFontSize: config?.watermarkFontSize ?? 24,
          ...config
        };

        upscaler.validateInputs(aiConfig);
        const upscaleResult = await upscaler.execute(aiConfig, sourceImage, controller.signal, onStatusChange);
        
        result = {
          imageUrl: upscaleResult.imageUrl,
          metadata: {
            width: upscaleResult.width ?? (sourceDims?.width ? sourceDims.width * (config?.upscaleFactor ?? 4) : 1024),
            height: upscaleResult.height ?? (sourceDims?.height ? sourceDims.height * (config?.upscaleFactor ?? 4) : 1024),
            model: upscaleResult.model,
            prompt: prompt || 'Upscale',
          }
        };

      } else {
        // For regular image models, use generate or generateImg2Img
        const baseParams = {
          ...config,
          prompt,
          model: model as import('../../../services/replicate').ReplicateImageModel,
          negativePrompt: config?.negativePrompt,
          resolution: config?.resolution || 'Auto',
          aspectRatio: config?.aspectRatio || 'Auto',
          steps: config?.steps,
          cfg: config?.cfg,
          seed: config?.seed ?? undefined,
          strength: config?.strength,
          referenceStrength: config?.referenceStrength,
          disableSafetyChecker: config?.disableSafetyChecker,
          sourceWidth: sourceDims?.width,
          sourceHeight: sourceDims?.height,
          nodeId,
          userId: userId || 'anonymous',
          sequentialImageGeneration: config?.sequentialImageGeneration,
          maxImages: config?.maxImages,
        };

        if (
          model === 'reve/edit-fast' ||
          model === 'reve/create' ||
          model === 'reve/extract-layout' ||
          model === 'reve/render-layout' ||
          model === 'reve/create-layout' ||
          model === 'reve/reconcile-layouts'
        ) {
          result = await anarchyService.generate(
            {
              ...baseParams,
              model,
              anarchyRemoveBackground: (config as any)?.anarchyRemoveBackground,
              anarchyUpscaleFactor: (config as any)?.anarchyUpscaleFactor,
              anarchyEffect: (config as any)?.anarchyEffect,
            },
            uploadedImages,
            controller.signal,
            onStatusChange
          );
        } else {
          // Choose generation mode based on model capabilities and available images
          const modelCaps = replicateService.getModelCapabilities(
            model as import('../../../services/replicate').ReplicateImageModel
          );
          const useImg2Img = sourceImage && modelCaps.supportsImg2Img;
          result = useImg2Img
            ? await replicateService.generateImg2Img(baseParams, uploadedImages, controller.signal, onStatusChange)
            : await replicateService.generate(baseParams, controller.signal, onStatusChange);
        }
      }

      let finalImage: any = result.imageUrl;
      const isVideo = model && [
        'bytedance/seedance-2.0',
        'kwaivgi/kling-v3-omni-video',
        'xai/grok-imagine-video-1.5',
        'prunaai/p-video',
        'google/veo-3.1-fast',
        'pixverse/pixverse-v6',
        'openai/sora-2-pro',
        'wavespeedai/wan-2.1-i2v-480p',
        'wavespeedai/wan-2.1-i2v-720p',
      ].some(m => (model as string).startsWith(m) || m.startsWith(model as string));

      const aiConfig = useAIConfigStore.getState().config;
      const wmText = (aiConfig.watermarkText || '').trim();
      const wmEnabled = aiConfig.enableWatermark &&
        (aiConfig.watermarkType === 'image' ? !!aiConfig.watermarkImage : wmText.length > 0);

      if (isVideo) {
        try {
          // Bypasses CORS by downloading via Tauri Rust backend proxy
          logger.log('[BuilderWorkflow] Fetching video blob via Rust proxy...', { url: result.imageUrl });
          const base64Data = await invoke<string>('url_to_base64', { url: result.imageUrl });
          logger.log('[BuilderWorkflow] url_to_base64 returned, starts with:', base64Data?.substring(0, 40));
          if (base64Data && base64Data.startsWith('data:')) {
            finalImage = dataURLtoBlob(base64Data);
            logger.log('[BuilderWorkflow] Video blob created, size:', (finalImage as Blob).size, 'type:', (finalImage as Blob).type);
          } else {
            logger.warn('[BuilderWorkflow] Rust proxy returned invalid base64, using URL fallback', { prefix: base64Data?.substring(0, 50) });
          }
        } catch (err) {
          logger.error('[BuilderWorkflow] Failed to fetch video blob via Rust proxy, using URL fallback:', err);
        }
      } else {
        const resultImage = await persistImageLocally(result.imageUrl);
        finalImage = resultImage;

        // Apply watermark if enabled
        if (wmEnabled) {
          try {
            // Canvas requires a data URI — convert http:// URLs via Tauri first
            let imageForWm = finalImage;
            if (imageForWm.startsWith('http')) {
              imageForWm = await invoke<string>('url_to_base64', { url: imageForWm });
            }
            finalImage = await watermarkService.applyWatermark(imageForWm, {
              type: aiConfig.watermarkType || 'text',
              text: wmText || 'Anarchy AI',
              watermarkImage: aiConfig.watermarkImage,
              watermarkImageSize: aiConfig.watermarkImageSize ?? 80,
              position: aiConfig.watermarkPosition ?? 'bottom-right',
              opacity: aiConfig.watermarkOpacity ?? 0.5,
              fontSize: aiConfig.watermarkFontSize ?? 24,
            });
          } catch (wmErr) {
            logger.warn('[Watermark] Failed to apply:', wmErr);
          }
        }
      }

      const imageKey = `idb://${crypto.randomUUID()}`;
      await cacheLocalImage(imageKey, finalImage);

      const outputPacket = createDataPacket(
        imageKey,
        prompt,
        nodeData.processingType,
        { width: result.metadata.width, height: result.metadata.height },
        model,
        isVideo
      );

      let modelLabel = '';
      let parentId: string | undefined = undefined;

      try {
        const parent = getParent(nodeId);
        const rawParentImage = parent ? (parent.data as BuilderNodeData)?.image : undefined;
        // Resolve raw parent image first if it's cached
        const resolvedRawParentImage = await resolveImageIfCached(rawParentImage);
        // Persist parent image locally so history doesn't rely on expiring URLs
        const parentImage = resolvedRawParentImage ? await persistImageLocally(resolvedRawParentImage) : undefined;
        const modelId = model as string;
        
        const rootSourceNode = nodesRef.current.find(n => (n.data as BuilderNodeData)?.type === 'source');
        const rawRootImage = rootSourceNode ? (rootSourceNode.data as BuilderNodeData)?.image : undefined;
        const rootSourceImage = rawRootImage ? await resolveImageIfCached(rawRootImage) : undefined;
        const rootSourceId = rootSourceNode?.id;

        const parentHistoryEntryId = parent ? (parent.data as BuilderNodeData)?.historyEntryId : undefined;
        const rootHistoryEntryId = rootSourceNode ? (rootSourceNode.data as BuilderNodeData)?.historyEntryId : undefined;

        // Fallback to session values if the node is at the root level of the graph
        const sessionParentId = sessionStorage.getItem('presetParentId') || undefined;
        const sessionRootId = sessionStorage.getItem('presetRootId') || undefined;

        const finalParentId = parentHistoryEntryId || (!parent ? sessionParentId : undefined);
        const finalRootId = rootHistoryEntryId || (!parent ? sessionRootId : undefined);

        const nodeType = 
          nodeData.processingType === 'source' ? 'source' :
          nodeData.processingType === 'upscale' ? 'upscale' :
          nodeData.processingType === 'variation' ? 'variation' :
          nodeData.processingType === 'render' ? 'variation' :
          'edit';

        const nodeTree: NodeTreeData = {
          nodes: nodesRef.current.map(n => {
            const data = (n.data || {}) as BuilderNodeData;
            return {
              id: n.id,
              type: data?.type || 'source',
              position: n.position,
              image: data?.image,
              prompt: data?.prompt,
              processingType: data.processingType,
              state: data.state,
              parentId: data.lineage?.parentId || undefined,
              historyEntryId: data.historyEntryId,
            };
          }),
          sourceNodeId: rootSourceId || nodeId,
          activeNodeId: nodeId,
          createdAt: Date.now(),
        };

        modelLabel = MODEL_DISPLAY_NAMES[model] || model.split('/').pop() || model;
        parentId = parent?.id;
        
        const savedEntry = await addHistoryEntry({
          type: (nodeData.processingType as any) === 'upscale' ? 'upscale' : 'render',
          label: prompt && prompt.length > 50 ? prompt.slice(0, 50) + '...' : (prompt || 'Generation'),
          prompt,
          model: modelId,
          inputImage: parentImage,
          outputImage: finalImage,
          duration: Date.now() - _execStartTime,
          nodeTree,
          rootSourceId,
          rootSourceImage,
          parentId: finalParentId,
          rootId: finalRootId,
          nodeType,
        });

        // Link the canvas node to the newly created history entry and spawn extra sibling nodes if any
        const extraNodes: BuilderNode[] = [];
        const extraEdges: Edge[] = [];

        if (result.imageUrls && result.imageUrls.length > 1) {
          const extraUrls = result.imageUrls.slice(1);
          const siblings = parentId ? getChildren(parentId) : [];
          let extraCount = siblings.length + 1; // plus 1 for the current nodeId which is already a child

          for (let i = 0; i < extraUrls.length; i++) {
            const url = extraUrls[i];
            const localUrl = await persistImageLocally(url);
            
            let finalExtraImage = localUrl;
            if (wmEnabled) {
              try {
                let imageForWm = finalExtraImage;
                if (imageForWm.startsWith('http')) {
                  imageForWm = await invoke<string>('url_to_base64', { url: imageForWm });
                }
                finalExtraImage = await watermarkService.applyWatermark(imageForWm, {
                  type: aiConfig.watermarkType || 'text',
                  text: wmText || 'Anarchy AI',
                  watermarkImage: aiConfig.watermarkImage,
                  watermarkImageSize: aiConfig.watermarkImageSize ?? 80,
                  position: aiConfig.watermarkPosition ?? 'bottom-right',
                  opacity: aiConfig.watermarkOpacity ?? 0.5,
                  fontSize: aiConfig.watermarkFontSize ?? 24,
                });
              } catch (wmErr) {
                logger.warn('[Watermark] Failed to apply to extra image:', wmErr);
              }
            }

            const key = `idb://${crypto.randomUUID()}`;
            await cacheLocalImage(key, finalExtraImage);

            const childPacket = createDataPacket(
              key,
              prompt,
              nodeData.processingType,
              { width: result.metadata.width, height: result.metadata.height },
              model,
              isVideo
            );

            // Save extra history entry
            let extraHistoryId: string | undefined = undefined;
            try {
              const savedEntryExtra = await addHistoryEntry({
                type: (nodeData.processingType as any) === 'upscale' ? 'upscale' : 'render',
                label: prompt && prompt.length > 50 ? prompt.slice(0, 50) + '...' : (prompt || 'Generation'),
                prompt,
                model: modelId,
                inputImage: parentImage,
                outputImage: finalExtraImage,
                duration: Date.now() - _execStartTime,
                nodeTree, // We can reuse the same initial node tree
                rootSourceId,
                rootSourceImage,
                parentId: finalParentId,
                rootId: finalRootId,
                nodeType,
              });
              extraHistoryId = savedEntryExtra.id;
            } catch (historyErr) {
              logger.error('[History] Failed to save extra history entry:', historyErr);
            }

            // Calculate position
            let newPosition: XYPosition;
            if (parentId && parent) {
              const direction = extraCount % 2 === 0 ? 1 : -1;
              const offsetMultiplier = Math.ceil(extraCount / 2);
              const yOffset = direction * offsetMultiplier * VERTICAL_SPACING;
              newPosition = {
                x: parent.position.x + HORIZONTAL_SPACING,
                y: parent.position.y + yOffset
              };
              extraCount++;
            } else {
              newPosition = {
                x: node.position.x,
                y: node.position.y + (i + 1) * VERTICAL_SPACING
              };
            }

            const parentData = parent?.data as BuilderNodeData | undefined;
            const parentLineage = parentData?.lineage;
            const newId = `node-${crypto.randomUUID()}`;
            const extraNode: BuilderNode = {
              id: newId,
              type: 'baseNode',
              position: newPosition,
              width: 260,
              data: {
                label: modelLabel,
                type: 'result',
                processingType: nodeData.processingType,
                state: 'ready',
                image: key,
                originalImage: key,
                prompt,
                modelUsed: model,
                createdAt: Date.now(),
                processedAt: Date.now(),
                lineage: {
                  parentId: parentId || null,
                  rootSourceId: rootSourceId || '',
                  generation: parentLineage ? parentLineage.generation + 1 : 1,
                  branchIndex: i + 1,
                  processingType: nodeData.processingType,
                  ancestry: parentLineage && parent ? [...parentLineage.ancestry, parent.id] : [],
                },
                inputData: nodeData.inputData,
                outputData: childPacket,
                dimensions: { width: result.metadata.width, height: result.metadata.height },
                historyEntryId: extraHistoryId
              }
            };

            extraNodes.push(extraNode);

            // Create edges from all parents of original node to newId
            incomingEdges.forEach((edge, handleIndex) => {
              const ed = createEdge(edge.source, newId, {
                animated: false,
                isDataFlow: true,
                packet: edge.data?.packet as DataPacket | undefined,
                targetHandleIndex: handleIndex
              });
              ed.targetHandle = 'target';
              extraEdges.push(ed);
            });
          }
        }

        setNodes(nds => {
          const updated = nds.map(n => 
            n.id === nodeId 
              ? { ...n, data: { ...n.data, historyEntryId: savedEntry.id } }
              : n
          );
          return [...updated, ...extraNodes];
        });

        if (extraEdges.length > 0) {
          setEdges(eds => [...eds, ...extraEdges]);
        }

        // Propagate updates for extra nodes safely
        if (extraNodes.length > 0) {
          setTimeout(() => {
            extraNodes.forEach(extraNode => {
              if (extraNode?.id) {
                try {
                  propagateNodeUpdate(extraNode.id);
                } catch (e) {
                  logger.warn('[BuilderWorkflow] propagateNodeUpdate error for extraNode:', e);
                }
              }
            });
          }, 200);
        }

        const isUpscale = (nodeData.processingType as any) === 'upscale';
        track({
          event: isUpscale ? 'image_upscaled' : 'image_generated',
          properties: {
            model: modelId,
            duration_ms: Date.now() - _execStartTime,
            has_prompt: Boolean(prompt),
          },
        }).catch(() => {});
      } catch (historyErr) {
        logger.error('[History] Failed to save history entry:', historyErr);
      }

      // Auto-save generated image to Documents/Anarchy AI
      try {
        const timestamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-').slice(0, 19);
        const safeName = (prompt || 'generation').replace(/[^a-zA-Z0-9\u0600-\u06FF\s]/g, '').trim().slice(0, 40).replaceAll(' ', '_').replaceAll('  ', '_') || 'generation';
        const fileName = `${timestamp}_${safeName}.png`;
        await invoke('save_image_to_documents', { dataUri: finalImage, fileName });
      } catch { /* Non-critical — silently ignore */ }



      setNodes(nds => nds.map(n => {
        if (n.id !== nodeId) return n;
        
        return {
          ...n,
          type: 'baseNode', // Switch React Flow renderer so image is displayed
          data: {
            ...n.data,
            type: 'result',
            processingType: isVideo ? 'video' : nodeData.processingType,
            state: 'ready',
            label: modelLabel,
            modelUsed: model,
            prompt,
            image: imageKey,
            originalImage: imageKey,
            outputData: outputPacket,
            dimensions: { width: result.metadata.width, height: result.metadata.height },
            processedAt: Date.now()
          }
        };
      }));

      // Update selected node state in Zustand if it is the currently selected node
      const currentSelected = useAIConfigStore.getState().selectedNode;
      if (currentSelected?.id === nodeId) {
        useAIConfigStore.getState().setSelectedNode({
          id: nodeId,
          type: 'result',
          image: imageKey,
          originalImage: imageKey,
          prompt,
          state: 'ready',
          isVideo: isVideo
        });
      }

      pushHistory(nodesRef.current, edgesRef.current); // snapshot before result lands

      // Update edges targeting this node: ghost handle 'ghost-target-0' -> BaseNode handle 'target'
      setEdges(eds => eds.map(e => 
        e.target === nodeId 
          ? { ...e, targetHandle: 'target' } 
          : e
      ));

      // Propagate update to children
      propagateNodeUpdate(nodeId, outputPacket);

      return { image: imageKey };

    } catch (error) {
      logger.error('Generation failed:', error);
      useBuilderQueueStore.getState().updateJob(nodeId, {
        state: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Generation failed'
      });
      setNodes(nds => nds.map(n => 
        n.id === nodeId 
          ? { 
              ...n, 
              data: { 
                ...n.data, 
                state: 'error',
                errorMessage: error instanceof Error ? error.message : 'Generation failed'
              } 
            }
          : n
      ));
      // Update selected node state in Zustand if it is the currently selected node
      const currentSelected = useAIConfigStore.getState().selectedNode;
      if (currentSelected?.id === nodeId) {
        useAIConfigStore.getState().setSelectedNode({
          ...currentSelected,
          state: 'error',
          errorMessage: error instanceof Error ? error.message : 'Generation failed'
        });
      }
      throw error;
    } finally {
      abortControllers.current.delete(nodeId);
    }
  }, [getNode, getParent, getChildren, nodesRef, setNodes, propagateNodeUpdate]); // eslint-disable-line react-hooks/exhaustive-deps

  const cancelExecution = useCallback((nodeId: string) => {
    const controller = abortControllers.current.get(nodeId);
    if (controller) {
      controller.abort();
      abortControllers.current.delete(nodeId);
    }
    
    // Set state to cancelled in central queue store
    useBuilderQueueStore.getState().updateJob(nodeId, {
      state: 'cancelled',
      errorMessage: 'Execution cancelled by user'
    });

    setNodes(nds => nds.map(n => 
      n.id === nodeId 
        ? { 
            ...n, 
            data: { 
              ...n.data, 
              state: 'cancelled',
              errorMessage: 'Execution cancelled by user'
            } 
          }
        : n
    ));

    // Update selected node state in Zustand if it is the currently selected node
    const currentSelected = useAIConfigStore.getState().selectedNode;
    if (currentSelected?.id === nodeId) {
      useAIConfigStore.getState().setSelectedNode({
        ...currentSelected,
        state: 'cancelled',
        errorMessage: 'Execution cancelled by user'
      });
    }

    // Clear execution queue if this node was part of the running queue
    const queueStore = useBuilderQueueStore.getState();
    if (queueStore.activeQueue.includes(nodeId)) {
      queueStore.setQueue([]);
    }
  }, [setNodes]);

  const executeNode = useCallback(async (
    nodeId: string,
    prompt: string,
    config?: GenerationConfig
  ): Promise<{ image: string }> => {
    const queueStore = useBuilderQueueStore.getState();
    const order = queueStore.resolveAndQueue(nodeId, nodesRef.current, edgesRef.current);

    // If target has no upstream unexecuted dependencies, run directly with zero delay
    if (order.length <= 1) {
      return executeNodeSingle(nodeId, prompt, config);
    }

    const executeSingle = async (id: string) => {
      const node = nodesRef.current.find(n => n.id === id);
      const nodePrompt = id === nodeId ? prompt : ((node?.data?.prompt || node?.data?.promptDraft || 'AI generation') as string);
      const nodeConfig = id === nodeId ? config : (node?.data?.config as GenerationConfig || undefined);
      return executeNodeSingle(id, nodePrompt, nodeConfig);
    };

    try {
      queueStore.setIsExecuting(true);
      await queueStore.runQueue(executeSingle);
      const node = nodesRef.current.find(n => n.id === nodeId);
      return { image: node?.data?.image || '' };
    } finally {
      queueStore.setIsExecuting(false);
    }
  }, [executeNodeSingle]);

  // ========================================================================
  // LEGACY COMPATIBILITY - Bridge to old API
  // ========================================================================

  const addChildNode = useCallback((
    parentId: string,
    processingType: ProcessingType
  ): string | null => {
    // New API: Always spawn a ghost node
    return spawnGhostNode(parentId, processingType);
  }, [spawnGhostNode]);

  const executeProcessing = useCallback((
    nodeId: string,
    prompt: string,
    options?: { strength?: number; seed?: number }
  ): void => {
    // Async wrapper for sync API compatibility (legacy)
    executeNode(nodeId, prompt, {
      model: 'black-forest-labs/flux-1.1-pro' as import('../../../services/replicate').ReplicateImageModel,
      strength: options?.strength,
      seed: options?.seed,
    }).catch((e) => logger.error(e));
  }, [executeNode]);


  return {
    executeNodeSingle,
    cancelExecution,
    executeNode,
    addChildNode,
    executeProcessing,
  };
};
