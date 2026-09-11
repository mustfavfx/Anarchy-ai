import { useCallback, useMemo, useRef } from 'react';
import { useAIConfigStore } from '../../../stores/aiConfigStore';
import { cacheLocalImage } from '../../../services/history/HistoryService';
import type { BuilderNode, ProcessingType } from '../types';
import {
  makeSourceOutput,
  positionExtraNode,
  buildGenConfig,
} from '../utils/builderHelpers';

export interface UseBuilderNodeCallbacksParams {
  nodes: BuilderNode[];
  setNodes: (update: any) => void;
  updateNodeData: (nodeId: string, newData: Partial<any>) => void;
  createSourceNode: (imageUrl?: string, label?: string, position?: { x: number; y: number }) => string;
  applyWatermarkToSource: (url: string) => Promise<string>;
  setSelectedNode: (node: any) => void;
  addChildNode: (id: string, type: ProcessingType) => string | null;
  deleteNode: (id: string) => void;
  makeRetryHandler: (node: BuilderNode) => (() => void) | undefined;
  getConfig: () => any;
  executeWithNotifications: (id: string, promptText: string, cfg: any) => Promise<any>;
  cancelExecution: (id: string) => void;
  enableWatermark: boolean;
  isGenerateMode: boolean;
}

export function useBuilderNodeCallbacks({
  nodes,
  setNodes,
  updateNodeData,
  createSourceNode,
  applyWatermarkToSource,
  setSelectedNode,
  addChildNode,
  deleteNode,
  makeRetryHandler,
  getConfig,
  executeWithNotifications,
  cancelExecution,
  enableWatermark,
  isGenerateMode,
}: UseBuilderNodeCallbacksParams) {
  const makeImageUploadHandler = useCallback((nodeId: string) => (url: string) => {
    if (!url) { updateNodeData(nodeId, { image: url, originalImage: undefined, state: 'idle', outputData: undefined }); return; }
    const isVid = url.startsWith('data:video/') || 
                  url.toLowerCase().includes('.mp4') || 
                  url.toLowerCase().includes('.webm') || 
                  url.toLowerCase().includes('.mov') || 
                  url.toLowerCase().includes('.avi');
    applyWatermarkToSource(url).then(async (watermarked) => {
      const imageKey = `idb://${crypto.randomUUID()}`;
      await cacheLocalImage(imageKey, watermarked);
      updateNodeData(nodeId, { 
        image: imageKey, 
        originalImage: imageKey, 
        state: 'ready', 
        isVideo: isVid,
        outputData: makeSourceOutput(imageKey, isVid) 
      });

      const currentSelected = useAIConfigStore.getState().selectedNode;
      if (currentSelected?.id === nodeId) {
        setSelectedNode({
          id: nodeId,
          type: 'source',
          image: imageKey,
          originalImage: imageKey,
          prompt: undefined,
          state: 'ready',
          isVideo: isVid
        });
      }
    });
  }, [updateNodeData, applyWatermarkToSource, setSelectedNode]);

  const spawnExtraSources = useCallback((node: BuilderNode, watermarkedUrls: string[]) => {
    watermarkedUrls.slice(1).forEach((wUrl, index) => {
      const sourceId = createSourceNode(wUrl);
      setTimeout(() => {
        setNodes(positionExtraNode(sourceId, node.position.x, node.position.y, index));
      }, 0);
    });
  }, [createSourceNode, setNodes]);

  const makeImagesUploadHandler = useCallback((node: BuilderNode) => (urls: string[]) => {
    if (!urls.length) return;
    Promise.allSettled(urls.map(u => applyWatermarkToSource(u))).then(async (results) => {
      const watermarkedUrls = results.map((r, idx) => r.status === 'fulfilled' ? r.value : urls[idx]);
      const watermarked = watermarkedUrls[0];
      const isVid = watermarked.startsWith('data:video/') || 
                    watermarked.toLowerCase().includes('.mp4') || 
                    watermarked.toLowerCase().includes('.webm') || 
                    watermarked.toLowerCase().includes('.mov') || 
                    watermarked.toLowerCase().includes('.avi');
      const imageKey = `idb://${crypto.randomUUID()}`;
      await cacheLocalImage(imageKey, watermarked);
      updateNodeData(node.id, { 
        image: imageKey, 
        originalImage: imageKey, 
        state: 'ready', 
        isVideo: isVid,
        outputData: makeSourceOutput(imageKey, isVid) 
      });
      spawnExtraSources(node, watermarkedUrls);
      setSelectedNode({ 
        id: node.id, 
        type: 'source', 
        image: imageKey, 
        originalImage: imageKey, 
        prompt: undefined, 
        state: 'ready',
        isVideo: isVid
      });
    });
  }, [updateNodeData, applyWatermarkToSource, spawnExtraSources, setSelectedNode]);

  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  const handlersRef = useRef({
    addChildNode,
    deleteNode,
    makeImageUploadHandler,
    makeImagesUploadHandler,
    makeRetryHandler,
    getConfig,
    executeWithNotifications,
    cancelExecution,
  });
  handlersRef.current = {
    addChildNode,
    deleteNode,
    makeImageUploadHandler,
    makeImagesUploadHandler,
    makeRetryHandler,
    getConfig,
    executeWithNotifications,
    cancelExecution,
  };

  const mappedNodesCache = useRef<Map<string, BuilderNode>>(new Map());
  const nodeDataCache = useRef<Map<string, { rawData: any; mappedData: any; enableWatermark: boolean }>>(new Map());
  const prevResultRef = useRef<BuilderNode[]>([]);

  const stableHandlers = useMemo(() => ({
    onAddChild: (id: string, type: ProcessingType) => {
      const tool = useAIConfigStore.getState().config.selectedTool || 'image-editor';
      const mode = useAIConfigStore.getState().config.studioMode || 'edit';
      if (tool === 'image-editor' && mode === 'generate') return;
      handlersRef.current.addChildNode(id, type);
    },
    onImageUpload: (id: string, url: string) => {
      handlersRef.current.makeImageUploadHandler(id)(url);
    },
    onImagesUpload: (id: string, urls: string[]) => {
      const node = nodesRef.current.find(n => n.id === id);
      if (node) handlersRef.current.makeImagesUploadHandler(node)(urls);
    },
    onDelete: (id: string) => {
      handlersRef.current.deleteNode(id);
    },
    onRetry: (id: string) => {
      const node = nodesRef.current.find(n => n.id === id);
      if (node) {
        const handler = handlersRef.current.makeRetryHandler(node);
        handler?.();
      }
    },
    onExecute: (id: string, promptText: string) => {
      const cfg = buildGenConfig(handlersRef.current.getConfig());
      handlersRef.current.executeWithNotifications(id, promptText, cfg).catch(() => { });
    },
    onCancel: (id: string) => {
      handlersRef.current.cancelExecution(id);
    }
  }), []);

  const nodesWithCallbacks = useMemo(() => {
    const nextCache = new Map<string, BuilderNode>();
    const result = nodes
      .filter(node => {
        if (isGenerateMode) {
          if (node.data.type === 'source' && !node.data.image && node.data.state === 'idle') {
            return false;
          }
        } else {
          if ((node.data?.isStandaloneGenerator || node.data?.label === 'Generator') && node.data.type === 'ghost' && !node.data.lineage?.parentId && node.data.state === 'idle') {
            return false;
          }
        }
        return true;
      })
      .map(node => {
        const cachedEntry = nodeDataCache.current.get(node.id);
        let mappedData = cachedEntry?.mappedData;

        if (!cachedEntry || cachedEntry.rawData !== node.data || cachedEntry.enableWatermark !== enableWatermark) {
          mappedData = {
            ...node.data,
            onAddChild: (type: ProcessingType) => stableHandlers.onAddChild(node.id, type),
            onImageUpload: node.data.type === 'source' ? (url: string) => stableHandlers.onImageUpload(node.id, url) : undefined,
            onImagesUpload: node.data.type === 'source' ? (urls: string[]) => stableHandlers.onImagesUpload(node.id, urls) : undefined,
            onDelete: node.data.type === 'source' ? undefined : () => stableHandlers.onDelete(node.id),
            onRetry: node.data.type === 'ghost' && (node.data.state === 'error' || node.data.state === 'failed') ? () => stableHandlers.onRetry(node.id) : undefined,
            onExecute: node.data.type === 'ghost' ? (promptText: string) => stableHandlers.onExecute(node.id, promptText) : undefined,
            onCancel: (node.data.type === 'ghost' || node.data.type === 'result') ? () => stableHandlers.onCancel(node.id) : undefined,
            enableWatermark,
          };
          nodeDataCache.current.set(node.id, {
            rawData: node.data,
            mappedData,
            enableWatermark,
          });
        }

        const cached = mappedNodesCache.current.get(node.id);
        if (cached && (cached as any)._raw === node && cached.data === mappedData) {
          nextCache.set(node.id, cached);
          return cached;
        }

        const mappedNode: BuilderNode = {
          ...node,
          data: mappedData
        };
        (mappedNode as any)._raw = node;
        nextCache.set(node.id, mappedNode);
        return mappedNode;
      });
    mappedNodesCache.current = nextCache;

    if (
      prevResultRef.current.length === result.length &&
      result.every((n, i) => n === prevResultRef.current[i])
    ) {
      return prevResultRef.current;
    }
    prevResultRef.current = result;
    return result;
  }, [nodes, stableHandlers, enableWatermark, isGenerateMode]);

  return {
    nodesWithCallbacks,
    makeImageUploadHandler,
    makeImagesUploadHandler,
  };
}
