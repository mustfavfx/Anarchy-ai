import { useEffect, useRef, useMemo } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useAIConfigStore } from '../../../stores/aiConfigStore';
import { logger } from '../../../utils/logger';
import { STORAGE_KEYS } from '../../../utils/storageKeys';
import { getCurrentUserId } from '../../../services/supabase/supabaseClient';
import { isVideoNode, getImageFingerprint } from '../utils/builderHelpers';
import type { BuilderNode } from '../types';

const getAutosaveKey = (tabId?: string) => {
  const uid = getCurrentUserId();
  const base = uid && uid !== 'default_user' ? `${STORAGE_KEYS.BUILDER_AUTOSAVE}_${uid}` : STORAGE_KEYS.BUILDER_AUTOSAVE;
  return tabId ? `${base}_${tabId}` : base;
};

export interface UseBuilderStoreSyncParams {
  isActive?: boolean;
  tabId?: string;
  isRestored: boolean;
  nodes: BuilderNode[];
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  updateNodeData: (id: string, data: any) => void;
  updateNodeImageAndPropagate: (id: string, image?: string, layout?: any) => void;
  forkChildNode: (parentId: string, image: string, actionLabel?: string, prompt?: string) => string | null;
  executeNode?: (nodeId: string, prompt: string, config?: any) => Promise<any>;
  setPrompt: (prompt: string) => void;
  fitView: (options?: any) => void;
  hasFittedInitially: React.MutableRefObject<boolean>;
}

export function useBuilderStoreSync({
  isActive = true,
  tabId,
  isRestored,
  nodes,
  selectedNodeId,
  setSelectedNodeId,
  updateNodeData,
  updateNodeImageAndPropagate,
  forkChildNode,
  executeNode,
  setPrompt,
  fitView,
  hasFittedInitially,
}: UseBuilderStoreSyncParams) {
  const { fitBounds, getNode: getRFNode, setViewport } = useReactFlow();

  const setCanvasImages = useAIConfigStore((s) => s.setCanvasImages);
  const setSelectedNode = useAIConfigStore((state) => state.setSelectedNode);
  const storeSelectedNodeId = useAIConfigStore((state) => state.selectedNode?.id);
  const isEnlargedView = useAIConfigStore((state) => state.isEnlargedView);
  const setFocusNodeFn = useAIConfigStore((state) => state.setFocusNodeFn);
  const setNodeImageUpdateFn = useAIConfigStore((state) => state.setNodeImageUpdateFn);
  const setForkChildNodeFn = useAIConfigStore((state) => state.setForkChildNodeFn);
  const setExecuteNodeFn = useAIConfigStore((state) => state.setExecuteNodeFn);
  const setNodePromptUpdateFn = useAIConfigStore((state) => state.setNodePromptUpdateFn);
  const setNodeSemanticUpdateFn = useAIConfigStore((state) => state.setNodeSemanticUpdateFn);

  // Periodic warm-up ping for proxy edge function
  useEffect(() => {
    if (!isActive) return;

    let intervalId: any = null;
    let isDisabled = false;

    const runPing = async () => {
      if (isDisabled) return;
      try {
        const { replicateService } = await import('../../../services/replicate');
        const success = await replicateService.pingProxy();
        if (!success) {
          logger.warn('[BuilderPage] Warm-up ping failed. Disabling periodic warm-up.');
          isDisabled = true;
          if (intervalId) clearInterval(intervalId);
        }
      } catch (err) {
        logger.warn('[BuilderPage] Warm-up ping error:', err);
        isDisabled = true;
        if (intervalId) clearInterval(intervalId);
      }
    };

    runPing();
    intervalId = setInterval(() => {
      if (isDisabled) {
        if (intervalId) clearInterval(intervalId);
        return;
      }
      runPing();
    }, 180000);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isActive]);

  useEffect(() => {
    setNodeImageUpdateFn((nodeId: string, image?: string, layout?: any) => {
      updateNodeImageAndPropagate(nodeId, image, layout);
    });
    return () => setNodeImageUpdateFn(null);
  }, [setNodeImageUpdateFn, updateNodeImageAndPropagate]);

  useEffect(() => {
    setForkChildNodeFn((parentId: string, image: string, actionLabel?: string, prompt?: string) => {
      const childId = forkChildNode(parentId, image, actionLabel, prompt);
      if (childId) {
        setTimeout(() => {
          fitView({ nodes: [{ id: childId }], duration: 600, padding: 0.3 });
        }, 120);
      }
      return childId;
    });
    return () => setForkChildNodeFn(null);
  }, [setForkChildNodeFn, forkChildNode, fitView]);

  useEffect(() => {
    if (executeNode) {
      setExecuteNodeFn((nodeId: string, prompt: string, config?: any) => {
        return executeNode(nodeId, prompt, config);
      });
    } else {
      setExecuteNodeFn(null);
    }
    return () => setExecuteNodeFn(null);
  }, [setExecuteNodeFn, executeNode]);

  useEffect(() => {
    setNodePromptUpdateFn((nodeId: string, newPrompt: string) => {
      if (nodeId) {
        updateNodeData(nodeId, { prompt: newPrompt });
      }
      setPrompt(newPrompt);
    });
    return () => setNodePromptUpdateFn(null);
  }, [setNodePromptUpdateFn, updateNodeData, setPrompt]);

  useEffect(() => {
    setNodeSemanticUpdateFn((nodeId: string, semantic: any) => {
      if (nodeId) {
        updateNodeData(nodeId, { semantic });
      }
    });
    return () => setNodeSemanticUpdateFn(null);
  }, [setNodeSemanticUpdateFn, updateNodeData]);

  useEffect(() => {
    const focusFn = (nodeId: string) => {
      const node = getRFNode(nodeId);
      if (!node) return;
      const w = node.width ?? 240;
      const h = node.height ?? 200;
      fitBounds(
        { x: node.position.x, y: node.position.y, width: w, height: h },
        { padding: 0.5, duration: 600 }
      );
      setSelectedNodeId(nodeId);
    };
    setFocusNodeFn(focusFn);
    return () => setFocusNodeFn(null);
  }, [fitBounds, getRFNode, setFocusNodeFn, setSelectedNodeId]);

  useEffect(() => {
    if (!isEnlargedView) return;
    const targetNodeId = selectedNodeId || storeSelectedNodeId;
    if (!targetNodeId) return;

    const centerTimer = setTimeout(() => {
      const node = getRFNode(targetNodeId);
      if (node) {
        const w = node.width ?? 280;
        const h = node.height ?? 220;
        fitBounds(
          { x: node.position.x, y: node.position.y, width: w, height: h },
          { padding: 0.25, duration: 300 }
        );
      }
    }, 120);

    return () => clearTimeout(centerTimer);
  }, [isEnlargedView, selectedNodeId, storeSelectedNodeId, getRFNode, fitBounds]);

  // Memoized image signature to isolate canvasImages sync from node position changes during drag
  const canvasImagesSignature = useMemo(() => {
    return nodes
      .filter((n) => {
        const d = n.data as any;
        return !!(d?.image || d?.outputData?.image);
      })
      .map((n) => {
        const d = n.data as any;
        const imgFingerprint = getImageFingerprint(d?.image || d?.outputData?.image);
        return `${n.id}:${imgFingerprint}:${d?.prompt || ''}`;
      })
      .join('|');
  }, [nodes]);

  // Sync canvas images summary to AIConfigStore ONLY when images, prompts or IDs change
  useEffect(() => {
    const imgNodes = nodes
      .filter((n) => {
        const d = n.data as any;
        return !!(d?.image || d?.outputData?.image);
      })
      .map((n) => {
        const d = n.data as any;
        return {
          id: n.id,
          label: d.label || (d.type === 'source' ? 'Source Image' : 'Rendered Image'),
          image: d.image || d.outputData?.image,
          originalImage: d.originalImage,
          prompt: d.prompt,
          type: d.type,
          dimensions: d.dimensions || d.outputData?.dimensions,
        };
      });
    setCanvasImages(imgNodes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasImagesSignature, setCanvasImages]);

  // Sync selected node to AIConfigContext & Agent bridge (isolated from drag movements)
  const lastSyncedSelectedRef = useRef<string>('');

  useEffect(() => {
    const targetNode = selectedNodeId
      ? nodes.find((n) => n.id === selectedNodeId)
      : nodes.find((n) => {
          const data = n.data as any;
          return (
            (data?.type === 'source' || data?.type === 'result') &&
            (data?.image || data?.outputData?.image)
          );
        });

    if (targetNode) {
      const data = targetNode.data as any;
      const imgFingerprint = getImageFingerprint(data?.image || data?.outputData?.image);
      const signature = `${targetNode.id}:${data?.type}:${imgFingerprint}:${data?.prompt}:${data?.state}`;
      if (lastSyncedSelectedRef.current === signature) {
        return;
      }
      lastSyncedSelectedRef.current = signature;
      setSelectedNode({
        id: targetNode.id,
        type: data?.type || null,
        image: data?.image || data?.outputData?.image,
        originalImage: data?.originalImage,
        prompt: data?.prompt,
        state: data?.state,
        isVideo: isVideoNode(data),
        dimensions: data?.dimensions || data?.outputData?.dimensions,
      });
    } else {
      if (lastSyncedSelectedRef.current !== 'empty') {
        lastSyncedSelectedRef.current = 'empty';
        setSelectedNode({
          id: null,
          type: null,
          image: undefined,
          originalImage: undefined,
          prompt: undefined,
          state: undefined,
          isVideo: false,
        });
      }
    }
  }, [selectedNodeId, nodes, setSelectedNode]);

  // Restore viewport from localStorage
  const hasRestoredViewport = useRef(false);
  useEffect(() => {
    if (!isRestored || hasRestoredViewport.current) return;

    try {
      const key = getAutosaveKey(tabId);
      const saved = localStorage.getItem(key);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.viewport) {
          const { x, y, zoom } = data.viewport;
          if (typeof x === 'number' && typeof y === 'number' && typeof zoom === 'number') {
            setViewport({ x, y, zoom });
            hasFittedInitially.current = true;
          }
        }
      }
    } catch {}
    hasRestoredViewport.current = true;
  }, [isRestored, tabId, setViewport, hasFittedInitially]);
}
