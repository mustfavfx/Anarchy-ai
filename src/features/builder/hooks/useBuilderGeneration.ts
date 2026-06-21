import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { checkCreditBalance, deductCredits, getModelCost, DEV_MODE, refundCredits, getUserCredit } from '../../../services/credit/creditService';
import { useAIConfigStore } from '../../../stores/aiConfigStore';
import { useNotificationStore } from '../../../stores/notificationStore';
import { logger } from '../../../utils/logger';
import { buildGenConfig } from '../utils/builderHelpers';
import type { BuilderNode } from '../types';
import { useBuilderQueueStore } from '../../../stores/builderQueueStore';

interface UseBuilderGenerationProps {
  nodes: BuilderNode[];
  executeNode: (nodeId: string, promptText: string, config?: any) => Promise<any>;
  createSourceNode: (imageUrl?: string, label?: string, position?: { x: number; y: number }) => string;
  spawnGhostNode: (parentId: string, type: 'render' | 'variation' | 'upscale') => string | null;
  updateNodeData: (id: string, data: Record<string, any>) => void;
  setUserCredits: (credits: number) => void;
  setCreditError: (error: { balance: number; needed: number } | null) => void;
}

export function useBuilderGeneration({
  nodes,
  executeNode,
  createSourceNode,
  spawnGhostNode,
  updateNodeData,
  setUserCredits,
  setCreditError,
}: UseBuilderGenerationProps) {
  const { user: authUser } = useAuth();
  const addNotification = useNotificationStore((state) => state.addNotification);
  const getConfig = useAIConfigStore((state) => state.getConfig);

  const [prompt, setPrompt] = useState('');
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

  const handleGenerate = useCallback(async () => {
    const aiConfig = getConfig();
    const cost = getModelCost(aiConfig.model, {
      resolution: aiConfig.resolution,
      qualityVariant: (aiConfig as any).qualityVariant ?? 'auto',
      prunaTarget: aiConfig.prunaTarget,
    });

    const isUpscaler = aiConfig.selectedTool === 'image-upscaler';
    const promptText = prompt.trim();
    if (!promptText && !(isUpscaler && aiConfig.upscaleFactor && aiConfig.upscaleFactor > 1)) return;

    const genConfig = buildGenConfig(aiConfig);
    const idleGhosts = nodes.filter(n => n.data.type === 'ghost' && n.data.state === 'idle');
    const totalCost = cost * (idleGhosts.length > 0 ? idleGhosts.length : 1);

    // 1. Optimistically identify or spawn ghost nodes and transition them to 'connecting' state
    let targetNodeIds: string[] = [];
    if (idleGhosts.length > 0) {
      targetNodeIds = idleGhosts.map(g => g.id);
      idleGhosts.forEach(g => {
        useBuilderQueueStore.getState().addJob(g.id, { state: 'connecting' });
      });
    } else {
      const existingParent =
        nodes.find(n => (n.data.type === 'source' || n.data.type === 'result') && !!n.data.image) ??
        nodes.find(n => n.data.type === 'source');
      const parentId = existingParent ? existingParent.id : createSourceNode();
      const ghostId = spawnGhostNode(parentId, 'render');
      if (ghostId) {
        targetNodeIds = [ghostId];
        useBuilderQueueStore.getState().addJob(ghostId, { state: 'connecting' });
      }
    }

    if (targetNodeIds.length === 0) return;

    // Clear prompt instantly for responsive UX
    setPrompt('');

    // 2. Perform credit validation, deduction, and replicate submission in the background
    (async () => {
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
