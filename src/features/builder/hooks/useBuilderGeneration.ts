import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { checkCreditBalance, deductCredits, getModelCost, DEV_MODE, refundCredits, getUserCredit } from '../../../services/credit/creditService';
import { useAIConfigStore } from '../../../stores/aiConfigStore';
import { useNotificationStore } from '../../../stores/notificationStore';
import { logger } from '../../../utils/logger';
import { buildGenConfig } from '../utils/builderHelpers';
import type { BuilderNode, ProcessingType } from '../types';
import { useBuilderQueueStore } from '../../../stores/builderQueueStore';

interface UseBuilderGenerationProps {
  selectedNodeId?: string | null;
  nodes: BuilderNode[];
  getNodes?: () => BuilderNode[];
  setNodes?: (update: BuilderNode[] | ((curr: BuilderNode[]) => BuilderNode[])) => void;
  executeNode: (nodeId: string, promptText: string, config?: any) => Promise<any>;
  createSourceNode: (imageUrl?: string, label?: string, position?: { x: number; y: number }) => string;
  createStandaloneGhostNode?: (position?: { x: number; y: number }) => string;
  spawnGhostNode: (parentId: string, type: ProcessingType) => string | null;
  setUserCredits: (credits: number) => void;
  setCreditError: (error: { balance: number; needed: number } | null) => void;
}

export function useBuilderGeneration({
  selectedNodeId,
  nodes,
  getNodes,
  setNodes,
  executeNode,
  createSourceNode,
  createStandaloneGhostNode,
  spawnGhostNode,
  setUserCredits,
  setCreditError,
}: UseBuilderGenerationProps) {
  const { user: authUser } = useAuth();
  const addNotification = useNotificationStore((state) => state.addNotification);
  const getConfig = useAIConfigStore((state) => state.getConfig);
  const prompt = useAIConfigStore((state) => state.workspacePrompt);
  const setPrompt = useAIConfigStore((state) => state.setWorkspacePrompt);
  const promptRef = useRef(prompt);
  useEffect(() => {
    promptRef.current = prompt;
  }, [prompt]);

  // Execute with notifications wrapper
  const executeWithNotifications = useCallback(async (
    nodeId: string, 
    nodePrompt: string, 
    config?: any,
    chargedCost?: number
  ) => {
    try {
      const result = await executeNode(nodeId, nodePrompt, config);
      const resultImage = result?.image;
      
      addNotification({
        type: 'success',
        title: 'Image Generated',
        message: nodePrompt.length > 40 ? nodePrompt.slice(0, 40) + '...' : nodePrompt,
        nodeId,
        imageUrl: resultImage,
        duration: 6000,
        category: 'generation',
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Generation failed';
      addNotification({
        type: 'error',
        title: 'Generation Failed',
        message: errorMsg,
        nodeId,
        duration: 0,
        category: 'generation',
      });

      // Refund credits for this failed node using chargedCost
      if (authUser?.id && !DEV_MODE && chargedCost) {
        refundCredits(authUser.id, chargedCost, `Refund: Failed generation for node ${nodeId}`)
          .then((success) => {
            if (success) {
              addNotification({
                type: 'info',
                title: 'Credits Refunded',
                message: `Refunded ${chargedCost} credits for failed generation.`,
                duration: 4000,
              });
              getUserCredit(authUser.id).then(c => c && setUserCredits(c.balance)).catch(() => {});
            }
          })
          .catch((err) => logger.error('[Credit] Refund failed:', err));
      }

      throw error;
    }
  }, [executeNode, addNotification, authUser, setUserCredits]);

  const handleRetryExecution = useCallback(async (nodeId: string, promptText: string, config: any) => {
    try {
      await executeWithNotifications(nodeId, promptText, config);
    } catch {
      // ignored
    }
  }, [executeWithNotifications]);

  const makeRetryHandler = useCallback((node: BuilderNode) => {
    const d = node.data;
    if (d.state !== 'error' || d.type !== 'ghost') return undefined;
    return () => {
      const promptText = d.prompt;
      if (!promptText) return;
      useBuilderQueueStore.getState().updateJob(node.id, { state: 'idle', errorMessage: undefined });
      setTimeout(() => handleRetryExecution(node.id, promptText, d.config), 50);
    };
  }, [handleRetryExecution]);

  const handleGenerate = useCallback(() => {
    const aiConfig = getConfig();
    const previewMode = useAIConfigStore.getState().previewMode;

    // If currently in Mask mode, trigger mask generation (combining mask notes, mask canvas drawing & prompt)
    if (previewMode === 'draw') {
      window.dispatchEvent(new CustomEvent('anarchy:trigger-mask-generate'));
      return;
    }

    const isUpscaler = aiConfig.selectedTool === 'image-upscaler';
    const promptText = prompt.trim();

    let resolvedUpscaleFactor: number | undefined = undefined;
    if (aiConfig.model === 'topazlabs/image-upscale') {
      const topazFactor = (aiConfig as any).topazUpscaleFactor ?? '4x';
      if (topazFactor === '2x') resolvedUpscaleFactor = 2;
      else if (topazFactor === '4x') resolvedUpscaleFactor = 4;
      else if (topazFactor === '6x') resolvedUpscaleFactor = 6;
      else resolvedUpscaleFactor = 4;
    } else if (aiConfig.model === 'philz1337x/clarity-upscaler') {
      resolvedUpscaleFactor = (aiConfig as any).clarityScale ?? 2;
    }

    if (!promptText && !(isUpscaler && resolvedUpscaleFactor && resolvedUpscaleFactor > 1)) return;

    const genConfig = buildGenConfig(aiConfig);
    const currentNodes = getNodes ? getNodes() : nodes;
    const idleGhosts = currentNodes.filter(n => n.data.type === 'ghost' && n.data.state === 'idle');

    // 1. Optimistically identify or spawn nodes and transition them to 'connecting' state SYNCHRONOUSLY
    let targetNodeIds: string[] = [];
    if (aiConfig.studioMode === 'generate') {
      // Find an existing idle Ghost Node or create a new Standalone Ghost Node in empty canvas space!
      const targetNode = currentNodes.find(n => n.data.type === 'ghost' && n.data.state === 'idle');

      let targetId = targetNode?.id;
      if (!targetId) {
        const lastNode = currentNodes[currentNodes.length - 1];
        const newPos = lastNode 
          ? { x: lastNode.position.x + 360, y: lastNode.position.y }
          : { x: 250, y: 150 };

        targetId = createStandaloneGhostNode 
          ? createStandaloneGhostNode(newPos)
          : createSourceNode(undefined, promptText.slice(0, 24) || 'Generated Image', newPos);
      }

      if (targetId) {
        targetNodeIds = [targetId];
        useAIConfigStore.getState().setSelectedNode({ id: targetId, type: 'ghost', state: 'connecting' } as any);
        useBuilderQueueStore.getState().addJob(targetId, { state: 'connecting' });
        if (setNodes) {
          setNodes(nds => nds.map(n => 
            n.id === targetId 
              ? { 
                  ...n, 
                  type: 'ghostNode',
                  data: { 
                    ...n.data, 
                    type: 'ghost',
                    state: 'connecting',
                    promptDraft: promptText,
                    updatedAt: Date.now()
                  } 
                } 
              : n
          ));
        }
      }
    } else if (idleGhosts.length > 0) {
      targetNodeIds = idleGhosts.map(g => g.id);
      idleGhosts.forEach(g => {
        useBuilderQueueStore.getState().addJob(g.id, { state: 'connecting' });
      });
    } else {
      const existingParent =
        nodes.find(n => (n.data?.type === 'source' || n.data?.type === 'result') && !!n.data?.image) ??
        nodes.find(n => n.data?.type === 'source');
      const parentId = existingParent ? existingParent.id : createSourceNode();
      const isVideo = [
        'bytedance/seedance-2.0',
        'kwaivgi/kling-v3-omni-video',
        'xai/grok-imagine-video-1.5',
        'prunaai/p-video',
        'google/veo-3.1-fast',
        'pixverse/pixverse-v6',
        'openai/sora-2-pro',
        'wavespeedai/wan-2.1-i2v-480p',
        'wavespeedai/wan-2.1-i2v-720p',
      ].some(m => aiConfig.model?.startsWith(m) || m.startsWith(aiConfig.model));
      const processingType = isVideo ? 'video' : 'render';
      const ghostId = spawnGhostNode(parentId, processingType);
      if (ghostId) {
        targetNodeIds = [ghostId];
        useBuilderQueueStore.getState().addJob(ghostId, { state: 'connecting' });
      }
    }

    if (targetNodeIds.length === 0) return;

    // Clear prompt instantly for responsive UX
    setPrompt('');

    // 2. Perform credit validation, deduction, and replicate submission asynchronously in the background
    (async () => {
      let isTrial = true;
      if (authUser?.id && !DEV_MODE) {
        try {
          const credit = await getUserCredit(authUser.id);
          if (credit) {
            isTrial = credit.totalPurchased === 0;
          }
        } catch (err) {
          logger.error('[BuilderCredits] Error loading user credit for cost calculation:', err);
        }
      }

      const cost = getModelCost(aiConfig.model, {
        resolution: aiConfig.resolution,
        qualityVariant: (aiConfig as any).qualityVariant ?? 'auto',
        prunaTarget: aiConfig.prunaTarget,
        upscaleFactor: resolvedUpscaleFactor,
        isTrial,
        width: (aiConfig as any).width,
        height: (aiConfig as any).height,
        videoDuration: aiConfig.videoDuration,
      });

      const totalCost = cost * (idleGhosts.length > 0 ? idleGhosts.length : 1);

      try {
        if (authUser?.id && !DEV_MODE) {
          const creditCheck = await checkCreditBalance(authUser.id, totalCost);
          if (!creditCheck.hasEnough) {
            setCreditError({ balance: creditCheck.balance, needed: totalCost });
            targetNodeIds.forEach(id => {
              useBuilderQueueStore.getState().updateJob(id, { state: 'failed', errorMessage: 'Insufficient credit balance' });
            });
            return;
          }

          const deduct = await deductCredits(authUser.id, totalCost, `Generation: ${promptText.slice(0, 30)}...`);
          if (!deduct.success) {
            const errText = deduct.error ?? 'Insufficient balance';
            addNotification({ type: 'error', title: 'Deduction Failed', message: errText });
            targetNodeIds.forEach(id => {
              useBuilderQueueStore.getState().updateJob(id, { state: 'failed', errorMessage: `Deduction failed: ${errText}` });
            });
            return;
          }
          getUserCredit(authUser.id).then(c => c && setUserCredits(c.balance)).catch(() => {});
        }

        // Submission to Replicate execution pipeline
        targetNodeIds.forEach(id => {
          executeWithNotifications(id, promptText, genConfig, cost).catch(() => {});
        });
      } catch (err) {
        const errText = err instanceof Error ? err.message : String(err);
        targetNodeIds.forEach(id => {
          useBuilderQueueStore.getState().updateJob(id, { state: 'failed', errorMessage: errText });
        });
      }
    })();
  }, [
    getConfig,
    authUser,
    prompt,
    nodes,
    executeWithNotifications,
    addNotification,
    setUserCredits,
    setCreditError,
    createSourceNode,
    spawnGhostNode,
    setPrompt,
    selectedNodeId,
    getNodes,
  ]);

  return {
    prompt,
    setPrompt,
    executeWithNotifications,
    handleGenerate,
    makeRetryHandler,
    handleRetryExecution,
  };
}
