import { useCallback, useState, useEffect } from 'react';
import { logger } from '../../../utils/logger';
import { useBuilderQueueStore } from '../../../stores/builderQueueStore';
import { STORAGE_KEYS } from '../../../utils/storageKeys';
import { getCurrentUserId } from '../../../services/supabase/supabaseClient';
import type { BuilderNode, ProcessingType } from '../types';
import { patchSpawnedNode } from '../utils/builderHelpers';

const getAutosaveKey = (tabId?: string) => {
  const uid = getCurrentUserId();
  const base = uid && uid !== 'default_user' ? `${STORAGE_KEYS.BUILDER_AUTOSAVE}_${uid}` : STORAGE_KEYS.BUILDER_AUTOSAVE;
  return tabId ? `${base}_${tabId}` : base;
};

export interface UseBuilderCanvasEventsParams {
  nodes: BuilderNode[];
  nodesWithCallbacks: BuilderNode[];
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedNode: (node: any) => void;
  deleteNode: (id: string) => void;
  screenToFlowPosition: (clientPos: { x: number; y: number }) => { x: number; y: number };
  getViewport: () => { x: number; y: number; zoom: number };
  tabId?: string;
  canvasContainerRef: React.RefObject<HTMLDivElement | null>;
  addChildNode: (id: string, type: ProcessingType) => string | null;
  setConfig: React.Dispatch<React.SetStateAction<any>>;
  handleGenerate: () => void;
  applyWatermarkToSource: (url: string) => Promise<string>;
  createSourceNode: (imageUrl?: string, label?: string, position?: { x: number; y: number }, prompt?: string) => string;
  setNodes: (update: any) => void;
  fitView: (options?: any) => void;
}

export function useBuilderCanvasEvents({
  nodes,
  nodesWithCallbacks,
  selectedNodeId,
  setSelectedNodeId,
  setSelectedNode,
  deleteNode,
  screenToFlowPosition,
  getViewport,
  tabId,
  canvasContainerRef,
  addChildNode,
  setConfig,
  handleGenerate,
  applyWatermarkToSource,
  createSourceNode,
  setNodes,
  fitView,
}: UseBuilderCanvasEventsParams) {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    canvasX?: number;
    canvasY?: number;
    type: 'canvas' | 'node' | 'prompt';
    nodeId?: string;
  } | null>(null);

  const onNodeClick = useCallback((event: React.MouseEvent, node: BuilderNode) => {
    if (event.button !== 0) return;
    setContextMenu(null);
    logger.log('[BuilderPage] onNodeClick:', node.id);
    setSelectedNodeId(node.id);
    const data = node.data || {};
    const img = data?.image || data?.outputData?.image;
    setSelectedNode({
      id: node.id,
      type: data?.type || null,
      image: img,
      originalImage: data?.originalImage,
      prompt: data?.prompt,
      state: data?.state,
    });
  }, [setSelectedNodeId, setSelectedNode]);

  const onSelectionChange = useCallback(({ nodes: selectedNodes }: { nodes: BuilderNode[]; edges: any[] }) => {
    if (selectedNodes.length === 1) {
      const node = selectedNodes[0];
      const data = node.data || {};
      const img = data?.image || data?.outputData?.image;
      setSelectedNodeId(node.id);
      setSelectedNode({
        id: node.id,
        type: data?.type || null,
        image: img,
        originalImage: data?.originalImage,
        prompt: data.prompt,
        state: data.state,
      });
    } else if (selectedNodes.length === 0) {
      setSelectedNodeId(null);
    }
  }, [setSelectedNodeId, setSelectedNode]);

  const onPaneClick = useCallback((event: React.MouseEvent) => {
    if (event.button !== 0) return;
    setContextMenu(null);
    const now = Date.now();
    const queueStore = useBuilderQueueStore.getState();
    nodes.forEach(node => {
      const job = queueStore.jobs[node.id];
      const isQueuedOrExecuting = queueStore.activeQueue.includes(node.id) ||
        (job && job.state !== 'idle') ||
        node.data.state !== 'idle';
      if (
        node.data.type === 'ghost' &&
        !isQueuedOrExecuting &&
        typeof node.data.createdAt === 'number' &&
        now - node.data.createdAt < 3000
      ) {
        deleteNode(node.id);
      }
    });
    setSelectedNodeId(null);
  }, [setSelectedNodeId, nodes, deleteNode]);

  const onPaneContextMenu = useCallback((event: React.MouseEvent | MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedNodeId(null);
    const clientX = (event as MouseEvent).clientX ?? (event as React.MouseEvent).clientX;
    const clientY = (event as MouseEvent).clientY ?? (event as React.MouseEvent).clientY;
    const canvasPos = screenToFlowPosition({ x: clientX, y: clientY });
    setContextMenu({
      x: clientX,
      y: clientY,
      canvasX: canvasPos.x,
      canvasY: canvasPos.y,
      type: 'canvas',
    });
  }, [setSelectedNodeId, screenToFlowPosition]);

  const onPromptContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      type: 'prompt',
    });
  }, []);

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: BuilderNode) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedNodeId(node.id);
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      type: 'node',
      nodeId: node.id,
    });
  }, [setSelectedNodeId]);

  const saveBuilderViewport = useCallback(() => {
    try {
      const key = getAutosaveKey(tabId);
      const saved = localStorage.getItem(key);
      const data = saved ? JSON.parse(saved) : {};
      localStorage.setItem(key, JSON.stringify({
        ...data,
        viewport: getViewport(),
      }));
    } catch {
      // Silent fail
    }
  }, [getViewport, tabId]);

  const handleMoveStart = useCallback(() => {
    canvasContainerRef.current?.classList.add('canvas-panning');
  }, [canvasContainerRef]);

  const handleMoveEnd = useCallback(() => {
    canvasContainerRef.current?.classList.remove('canvas-panning');
    saveBuilderViewport();
  }, [canvasContainerRef, saveBuilderViewport]);

  const handleNodeDragStart = useCallback(() => {
    const container = document.querySelector('.react-flow');
    if (container) container.classList.add('canvas-node-dragging');
  }, []);

  const handleNodeDragStop = useCallback(() => {
    const container = document.querySelector('.react-flow');
    if (container) container.classList.remove('canvas-node-dragging');
  }, []);

  const contextNode = contextMenu?.type === 'node'
    ? nodesWithCallbacks.find(n => n.id === contextMenu.nodeId)
    : undefined;

  const handleSpawnWithModel = useCallback((
    tool: 'image-editor' | 'image-upscaler' | 'video-creator' | 'anarchy-creator',
    model: string
  ) => {
    if (!contextNode) return;

    setConfig((prev: any) => ({
      ...prev,
      selectedTool: tool,
      model: model as any,
      ...(tool !== 'image-editor' ? { studioMode: 'edit' } : {})
    }));

    const processingType = tool === 'video-creator' ? 'video' : (tool === 'image-upscaler' ? 'upscale' : 'render');
    const childId = addChildNode(contextNode.id, processingType);

    if (childId) {
      setSelectedNodeId(childId);
      setTimeout(() => {
        const spawnedNode = nodes.find(n => n.id === childId);
        if (spawnedNode) {
          const data = spawnedNode.data || {};
          setSelectedNode({
            id: childId,
            type: data?.type || null,
            image: data?.image || data?.outputData?.image,
            originalImage: data?.originalImage,
            prompt: data?.prompt,
            state: data?.state,
          });
        }
      }, 50);
    }

    setTimeout(() => {
      handleGenerate();
    }, 120);

    setContextMenu(null);
  }, [contextNode, addChildNode, setSelectedNodeId, setSelectedNode, setConfig, handleGenerate, nodes]);

  const imageFileToDataUrl = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) { reject(new Error('Not an image')); return; }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, []);

  const spawnFromImage = useCallback(async (dataUrl: string, position?: { x: number; y: number }) => {
    logger.log('[Spawn From Image] Creating source node with image');
    const watermarked = await applyWatermarkToSource(dataUrl);
    const nodeId = createSourceNode(watermarked, undefined, position);

    setTimeout(() => setNodes(patchSpawnedNode(nodeId)), 50);
    setSelectedNodeId(nodeId);
    setSelectedNode({ id: nodeId, type: 'source', image: watermarked, prompt: undefined, state: 'ready' });
    setTimeout(() => { fitView({ padding: 0.3, minZoom: 0.6, duration: 400 }); }, 200);
    logger.log('[Spawn From Image] Source node created successfully:', nodeId);
  }, [createSourceNode, setSelectedNodeId, setSelectedNode, fitView, setNodes, applyWatermarkToSource]);

  // Window-level contextmenu for Tauri (ReactFlow's onPaneContextMenu may not fire)
  useEffect(() => {
    const canvasEl = document.querySelector('.canvas-container');
    if (!canvasEl) return;

    const handleWindowContextMenu = (e: Event) => {
      const me = e as MouseEvent;
      if (!canvasEl.contains(me.target as Element)) return;
      me.preventDefault();
      me.stopPropagation();
      const target = me.target as Element;
      const nodeEl = target.closest('[data-id]') as HTMLElement | null;
      const nodeId = nodeEl?.dataset['id'] ?? undefined;
      if (nodeId) setSelectedNodeId(nodeId);

      const canvasPos = screenToFlowPosition({ x: me.clientX, y: me.clientY });

      setContextMenu({
        x: me.clientX,
        y: me.clientY,
        canvasX: canvasPos.x,
        canvasY: canvasPos.y,
        type: nodeId ? 'node' : 'canvas',
        ...(nodeId ? { nodeId } : {}),
      });
    };

    globalThis.addEventListener('contextmenu', handleWindowContextMenu, true);
    return () => globalThis.removeEventListener('contextmenu', handleWindowContextMenu, true);
  }, [setSelectedNodeId, screenToFlowPosition]);

  return {
    contextMenu,
    setContextMenu,
    contextNode,
    onNodeClick,
    onSelectionChange,
    onPaneClick,
    onPaneContextMenu,
    onPromptContextMenu,
    onNodeContextMenu,
    handleMoveStart,
    handleMoveEnd,
    handleNodeDragStart,
    handleNodeDragStop,
    handleSpawnWithModel,
    imageFileToDataUrl,
    spawnFromImage,
  };
}
