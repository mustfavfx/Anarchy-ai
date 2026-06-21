import React, { useCallback, useState, useEffect, useRef, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  useReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useStore,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useBuilderWorkflow, type ProcessingType } from './useBuilderWorkflow';
import { PerformanceHUD } from './components/PerformanceHUD';
import { type BuilderNode } from './types';
import { useAIConfigStore } from '../../stores/aiConfigStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { ConfirmModal } from '../../shared/components/ConfirmModal';
import { BuilderContextMenu } from './components/BuilderContextMenu';
import { BuilderPromptBar } from './components/BuilderPromptBar';
import { CreditErrorModal } from './components/CreditErrorModal';
import { useBuilderDrop } from './hooks/useBuilderDrop';
import { useBuilderKeyboard } from './hooks/useBuilderKeyboard';
import { useAuth } from '../auth/AuthContext';
import { cacheLocalImage } from '../../services/history/HistoryService';
import { logger } from '../../utils/logger';
import { STORAGE_KEYS, SESSION_KEYS } from '../../utils/storageKeys';
import { invoke } from '@tauri-apps/api/core';
import { watermarkService } from '../../services/watermark/WatermarkService';

// Hooks
import { useBuilderCredits } from './hooks/useBuilderCredits';
import { useBuilderExport } from './hooks/useBuilderExport';
import { useBuilderPersistence } from './hooks/useBuilderPersistence';
import { useBuilderGeneration } from './hooks/useBuilderGeneration';

// Helpers
import {
  resolveSourceLabel,
  buildGenConfig,
  convertNodeTreeToWorkflow,
  htmlToCanvas,
  makeSourceOutput,
  isValidPosition,
  positionExtraNode,
  positionExternalNode,
  patchNodeImage,
  patchSpawnedNode,
  nodeTypes,
  edgeTypes,
  CustomConnectionLine,
} from './utils/builderHelpers.tsx';

import './BuilderPage.css';

// Check if running in a Tauri desktop environment
export const isTauri = (): boolean => typeof globalThis !== 'undefined' && '__TAURI_INTERNALS__' in globalThis;

type ContextAction = 
  | 'add-source' | 'rearrange' | 'spawn-ghost' | 'retry-node' | 'delete-node' 
  | 'compare-a' | 'compare-b' | 'save-node-image' | 'export-dxf' | 'analyze-plan' 
  | 'export-all' | 'export-pdf' | 'save-project' | 'load-project'
  | 'open-images-folder' | 'export-node-pdf';

// Props for multi-tab support
interface BuilderContentProps {
  tabId?: string;
  projectPath?: string | null;
  initialWorkflow?: any;
  initialImage?: string;
  onTitleChange?: (title: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onProjectPathChange?: (path: string | null) => void;
  isActive?: boolean;
}

// Inner component that uses React Flow hooks (must be inside ReactFlowProvider)
export const BuilderContent: React.FC<BuilderContentProps> = ({ 
  tabId,
  projectPath: initialProjectPath,
  initialWorkflow,
  initialImage,
  onTitleChange,
  onDirtyChange,
  onProjectPathChange,
  isActive = true,
}) => {
  const { user: authUser } = useAuth();
  const addNotification = useNotificationStore((state) => state.addNotification);
  const zoom = useStore((s) => s.transform[2]);
  const isZoomedOut = zoom < 0.6;
  
  const hasFittedInitially = useRef(false);

  // Memoize custom node/edge renderer objects to prevent react-flow re-creation warning
  const memoizedNodeTypes = useMemo(() => nodeTypes, []);
  const memoizedEdgeTypes = useMemo(() => edgeTypes, []);

  // Hook 1: Credits State Management
  const {
    userCredits,
    setUserCredits,
    creditError,
    setCreditError,
  } = useBuilderCredits(authUser?.id);

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    selectedNodeId,
    setSelectedNodeId,
    updateNodeData,
    updateNodeImageAndPropagate,
    addChildNode,
    createSourceNode,
    spawnGhostNode,
    executeNode,
    cancelExecution,
    deleteNode,
    rearrangeNodes,
    setNodes,
    setEdges,
    isRestored,
    undo,
    redo,
    canUndo,
    canRedo
  } = useBuilderWorkflow(tabId, !!initialWorkflow || !!initialImage);

  // Hook 2: Generation, retry & credit validation operations
  const {
    prompt,
    setPrompt,
    executeWithNotifications,
    handleGenerate,
    makeRetryHandler,
  } = useBuilderGeneration({
    nodes,
    executeNode,
    createSourceNode,
    spawnGhostNode,
    updateNodeData,
    setUserCredits,
    setCreditError,
  });

  // Sanitize onNodesChange to prevent NaN position errors
  const handleNodesChange = useCallback((changes: any[]) => {
    const sanitizedChanges = changes.filter(change => {
      if (change.type === 'position' && change.position) {
        const hasValidPosition = 
          typeof change.position.x === 'number' && !Number.isNaN(change.position.x) &&
          typeof change.position.y === 'number' && !Number.isNaN(change.position.y);
        if (!hasValidPosition) {
          logger.warn('[Builder] Filtering out position change with NaN:', change.id);
          return false;
        }
      }
      return true;
    });
    if (sanitizedChanges.length > 0) {
      onNodesChange(sanitizedChanges);
    }
  }, [onNodesChange]);

  const getConfig = useAIConfigStore((state) => state.getConfig);
  const liveModel      = useAIConfigStore((state) => state.config.model);
  const liveResolution = useAIConfigStore((state) => state.config.resolution);
  const liveQuality    = useAIConfigStore((state) => (state.config as any).qualityVariant ?? 'auto');
  const livePruna      = useAIConfigStore((state) => state.config.prunaTarget);
  const setSelectedNode = useAIConfigStore((state) => state.setSelectedNode);
  const setCompareSlot = useAIConfigStore((state) => state.setCompareSlot);
  const setConfig = useAIConfigStore((state) => state.setConfig);
  const isEnlargedView = useAIConfigStore((state) => state.isEnlargedView);
  const setWorkflowSnapshot = useAIConfigStore((state) => state.setWorkflowSnapshot);
  const setFocusNodeFn = useAIConfigStore((state) => state.setFocusNodeFn);
  const setNodeImageUpdateFn = useAIConfigStore((state) => state.setNodeImageUpdateFn);
  // FIX 6: Single subscription here instead of one per BaseNode instance
  const enableWatermark = useAIConfigStore((state) => state.config.enableWatermark);

  const applyWatermarkToSource = useCallback(async (url: string): Promise<string> => {
    if (!url) return url;
    const aiConfig = useAIConfigStore.getState().config;
    const wmText = (aiConfig.watermarkText || '').trim();
    const wmEnabled = aiConfig.enableWatermark &&
      (aiConfig.watermarkType === 'image' ? !!aiConfig.watermarkImage : wmText.length > 0);
    if (!wmEnabled) return url;
    try {
      let imageForWm = url;
      if (imageForWm.startsWith('http')) {
        imageForWm = await invoke<string>('url_to_base64', { url: imageForWm });
      }
      return await watermarkService.applyWatermark(imageForWm, {
        type: aiConfig.watermarkType || 'text',
        text: wmText || 'Anarchy AI',
        watermarkImage: aiConfig.watermarkImage,
        watermarkImageSize: aiConfig.watermarkImageSize ?? 80,
        position: aiConfig.watermarkPosition ?? 'bottom-right',
        opacity: aiConfig.watermarkOpacity ?? 0.5,
        fontSize: aiConfig.watermarkFontSize ?? 24,
      });
    } catch (err) {
      logger.warn('[Watermark] Source node watermark failed:', err);
      return url;
    }
  }, []);



  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const spaceRef = useRef(false);

  // Monitor spacebar events for Figma-like canvas panning (Priority 8 - optimized)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' && !spaceRef.current) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        spaceRef.current = true;
        setIsSpacePressed(true);
        e.preventDefault(); // Prevent page scrolling
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        spaceRef.current = false;
        setIsSpacePressed(false);
      }
    };

    globalThis.addEventListener('keydown', handleKeyDown);
    globalThis.addEventListener('keyup', handleKeyUp);
    return () => {
      globalThis.removeEventListener('keydown', handleKeyDown);
      globalThis.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Periodic warm-up ping for the Replicate proxy edge function to prevent cold start delays on first generation
  useEffect(() => {
    if (!isActive) return;

    let intervalId: any = null;
    let isDisabled = false;

    const runPing = async () => {
      if (isDisabled) return;
      try {
        const { replicateService } = await import('../../services/replicate');
        const success = await replicateService.pingProxy();
        if (!success) {
          logger.warn('[BuilderPage] Warm-up ping failed (proxy function may not be deployed). Disabling periodic warm-up.');
          isDisabled = true;
          if (intervalId) {
            clearInterval(intervalId);
          }
        }
      } catch (err) {
        logger.warn('[BuilderPage] Warm-up ping error:', err);
        isDisabled = true;
        if (intervalId) {
          clearInterval(intervalId);
        }
      }
    };

    // Run immediately on active
    runPing();

    // Run every 3 minutes (180000 ms)
    intervalId = setInterval(() => {
      if (isDisabled) {
        if (intervalId) clearInterval(intervalId);
        return;
      }
      runPing();
    }, 180000);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isActive]);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    canvasX?: number;
    canvasY?: number;
    type: 'canvas' | 'node' | 'prompt';
    nodeId?: string;
  } | null>(null);

  const { fitView, getViewport, fitBounds, getNode: getRFNode, screenToFlowPosition, setViewport } = useReactFlow();

  // Register node image update callback so RightSidebar crop/edit updates node data in canvas
  useEffect(() => {
    setNodeImageUpdateFn((nodeId: string, image: string) => {
      updateNodeImageAndPropagate(nodeId, image);
    });
    return () => setNodeImageUpdateFn(null);
  }, [setNodeImageUpdateFn, updateNodeImageAndPropagate]);

  // Register canvas focus callback so notifications can navigate to a node
  useEffect(() => {
    const focusFn = (nodeId: string) => {
      const node = getRFNode(nodeId);
      if (!node) return;
      const w = (node.width ?? 240);
      const h = (node.height ?? 200);
      fitBounds(
        { x: node.position.x, y: node.position.y, width: w, height: h },
        { padding: 0.5, duration: 600 }
      );
      setSelectedNodeId(nodeId);
    };
    setFocusNodeFn(focusFn);
    return () => setFocusNodeFn(null);
  }, [fitBounds, getRFNode, setFocusNodeFn, setSelectedNodeId]);

  // Generate thumbnail from canvas for project preview (used by persistence hook)
  const generateThumbnail = useCallback(async (): Promise<string | undefined> => {
    try {
      const viewport = document.querySelector('.react-flow__viewport') as HTMLElement;
      if (!viewport) return undefined;

      const canvas = await htmlToCanvas(viewport);
      if (!canvas) return undefined;

      const maxWidth = 600;
      const scale = Math.min(maxWidth / canvas.width, 1);
      const thumbWidth = Math.round(canvas.width * scale);
      const thumbHeight = Math.round(canvas.height * scale);

      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = thumbWidth;
      thumbCanvas.height = thumbHeight;
      const ctx = thumbCanvas.getContext('2d');
      if (!ctx) return undefined;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      ctx.drawImage(canvas, 0, 0, thumbWidth, thumbHeight);
      return thumbCanvas.toDataURL('image/jpeg', 0.92);
    } catch (err) {
      logger.warn('[Thumbnail] Generation failed:', err);
      return undefined;
    }
  }, []);

  const hasLoadedRef = useRef(false);

  // Hook 2: Persistence Save/Load operations
  const {
    setCurrentFilePathState,
    confirmNewCanvas,
    setConfirmNewCanvas,
    handleSave,
    handleSaveAs,
    handleLoad,
    doNewCanvas,
    handleNewCanvas,
    applyWorkflow,
  } = useBuilderPersistence({
    nodes,
    edges,
    setNodes,
    setEdges,
    initialProjectPath,
    onTitleChange,
    onDirtyChange,
    onProjectPathChange,
    generateThumbnail,
    addNotification,
    fitView,
    isRestored,
    createSourceNode,
    setSelectedNodeId,
    setSelectedNode,
    hasFittedInitiallyRef: hasFittedInitially,
  });

  const location = useLocation();

  // Hook 3: Exports & Floor Plan analysis context handlers
  const {
    handleContextCompare,
    handleContextSaveNodeImage,
    handleContextExportDXF,
    handleContextAnalyzePlan,
    handleContextExportAll,
    handleContextExportPDF,
    handleContextOpenImagesFolder,
    handleContextExportNodePDF,
  } = useBuilderExport({
    nodes,
    addNotification,
    setCompareSlot,
    setConfig,
  });

  const restorePresetImage = useCallback((wf: any, img: string) => {
    sessionStorage.removeItem(SESSION_KEYS.PRESET_IMAGE);
    const sourceNode = wf.nodes.find((n: any) => n.data?.type === 'source');
    if (!sourceNode) return;
    setTimeout(() => setNodes(patchNodeImage(sourceNode.id, img)), 100);
  }, [setNodes]);

  useEffect(() => {
    if (location.pathname !== '/builder') return;
    const preset = sessionStorage.getItem(SESSION_KEYS.PRESET_PROMPT);
    if (preset) {
      sessionStorage.removeItem(SESSION_KEYS.PRESET_PROMPT);
      setPrompt(preset);
    }
  }, [location.pathname, setPrompt]);

  // Auto-load project if provided via props (once)
  useEffect(() => {
    if (hasLoadedRef.current) return;

    const key = tabId ? `${STORAGE_KEYS.BUILDER_AUTOSAVE}_${tabId}` : STORAGE_KEYS.BUILDER_AUTOSAVE;
    const hasAutosave = (() => {
      try {
        const saved = localStorage.getItem(key);
        if (saved) {
          const data = JSON.parse(saved);
          return !!(data.nodes && data.nodes.length > 0);
        }
      } catch {}
      return false;
    })();

    const pathToLoad = initialProjectPath;

    if (hasAutosave) {
      hasLoadedRef.current = true;
      if (pathToLoad) {
        setCurrentFilePathState(pathToLoad);
        onProjectPathChange?.(pathToLoad);
      }
      return;
    }

    if (pathToLoad) {
      hasLoadedRef.current = true;
      (async () => {
        try {
          const contents = await invoke<string>('load_file', { path: pathToLoad });
          const wf = JSON.parse(contents);
          const fallback = pathToLoad.split(/[\\/]/).pop()?.replace(/\.ana$/i, '') ?? 'Project';
          setCurrentFilePathState(pathToLoad);
          onProjectPathChange?.(pathToLoad);
          applyWorkflow(wf, fallback);
        } catch (err) {
          logger.error('[Builder] Auto-load failed:', err);
          addNotification({ type: 'error', title: 'Load Failed', message: String(err) });
        }
      })();
    } else if (initialWorkflow) {
      hasLoadedRef.current = true;
      try {
        let wf = initialWorkflow;
        if (wf.sourceNodeId || (wf.nodes && wf.nodes.length > 0 && !wf.nodes[0].data)) {
          wf = convertNodeTreeToWorkflow(wf);
        }
        if (wf.nodes?.length > 0) {
          applyWorkflow(wf, wf.name || 'Imported Project');
          if (initialImage) {
            restorePresetImage(wf, initialImage);
          }
        }
      } catch (err) { logger.error('[Builder] initialWorkflow load failed:', err); }
    } else if (initialImage) {
      hasLoadedRef.current = true;
      applyWatermarkToSource(initialImage).then(watermarked => {
        const nodeId = createSourceNode(watermarked);
        setSelectedNodeId(nodeId);
        setSelectedNode({ id: nodeId, type: 'source', image: watermarked, prompt: undefined, state: 'ready' });
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: setCurrentFilePathState is a stable setter, adding it causes circular dep
  }, [
    initialProjectPath,
    tabId,
    onProjectPathChange,
    initialWorkflow,
    initialImage,
    applyWorkflow,
    restorePresetImage,
    applyWatermarkToSource,
    createSourceNode,
    setSelectedNodeId,
    setSelectedNode,
    addNotification
  ]);

  // FIX 2: Debounce snapshot updates — syncing on every drag frame causes a
  // Zustand store write on every animation frame, triggering downstream re-renders.
  const snapshotTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    clearTimeout(snapshotTimerRef.current);
    snapshotTimerRef.current = setTimeout(() => {
      setWorkflowSnapshot({ nodes, edges });
    }, 500);
    return () => clearTimeout(snapshotTimerRef.current);
  }, [nodes, edges, setWorkflowSnapshot]);

  // Re-measure container and fit view when tab becomes active
  useEffect(() => {
    if (isActive) {
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
        setTimeout(() => {
          fitView({ padding: 0.3, duration: 400 });
        }, 150);
      }, 100);
    }
  }, [isActive, fitView]);

  const handleExternalImage = useCallback((image: string, rawSource: string) => {
    const nodeLabel = resolveSourceLabel(rawSource);
    applyWatermarkToSource(image).then(watermarked => {
      const sourceId = createSourceNode(watermarked, nodeLabel);
      setSelectedNodeId(sourceId);
      setSelectedNode({ id: sourceId, type: 'source', image: watermarked, prompt: undefined, state: 'ready' });
      setTimeout(() => {
        setNodes(positionExternalNode(sourceId));
        fitView({ padding: 0.3, duration: 400 });
      }, 0);
    });
  }, [createSourceNode, setSelectedNodeId, setSelectedNode, setNodes, fitView, applyWatermarkToSource]);

  useEffect(() => {
    const handleGlobalEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ image: string; source: string }>;
      const activeTabId = localStorage.getItem('anarchy_builder_active_tab');
      
      console.log('EVENT RECEIVED');
      console.log('tabId=', tabId);
      console.log('activeTabId=', activeTabId);
      console.log('equal=', tabId === activeTabId);
      console.log('isActive=', isActive);

      // Only process the external image if this tab is the active tab
      if (isActive) {
        const { image, source } = customEvent.detail;
        if (image) {
          handleExternalImage(image, source);
        }
      }
    };

    window.addEventListener('anarchy:external-image-global', handleGlobalEvent);
    return () => {
      window.removeEventListener('anarchy:external-image-global', handleGlobalEvent);
    };
  }, [tabId, isActive, handleExternalImage]);

  // Viewport restore removed — always start fresh

  // FIX 3: Sync selected node to AIConfigContext for Preview Panel.
  // Use nodesRef so `nodes` is NOT a dependency — this effect previously fired
  // on every single drag-frame update of any node, even unrelated ones.
  useEffect(() => {
    logger.log('[BuilderPage] selectedNodeId changed:', selectedNodeId);
    if (selectedNodeId) {
      const node = nodesRef.current.find(n => n.id === selectedNodeId);
      if (node) {
        const data = node.data as any;
        logger.log('[BuilderPage] Updating selectedNode to:', node.id, 'image:', (data?.image || data?.outputData?.image)?.slice(0, 50));
        setSelectedNode({
          id: node.id,
          type: data?.type || null,
          image: data?.image || data?.outputData?.image,
          originalImage: data?.originalImage,
          prompt: data?.prompt,
          state: data?.state,
        });
      }
    } else {
      // If no node selected, show first source or result node
      const sourceOrResult = nodesRef.current.find(n => {
        const data = n.data as any;
        return (data?.type === 'source' || data?.type === 'result') && (data?.image || data?.outputData?.image);
      });
      if (sourceOrResult) {
        const data = sourceOrResult.data as any;
        setSelectedNode({
          id: sourceOrResult.id,
          type: data?.type,
          image: data?.image || data?.outputData?.image,
          originalImage: data?.originalImage,
          prompt: data?.prompt,
          state: data?.state,
        });
      } else {
        setSelectedNode({ id: null, type: null, image: undefined, originalImage: undefined, prompt: undefined, state: undefined });
      }
    }
  // nodes intentionally omitted — use nodesRef to avoid re-render on every drag frame
  }, [selectedNodeId, setSelectedNode]);

  // Restore viewport from localStorage if available, preventing fitView jump on mount
  const hasRestoredViewport = useRef(false);
  useEffect(() => {
    if (!isRestored || hasRestoredViewport.current) return;
    
    try {
      const key = tabId ? `${STORAGE_KEYS.BUILDER_AUTOSAVE}_${tabId}` : STORAGE_KEYS.BUILDER_AUTOSAVE;
      const saved = localStorage.getItem(key);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.viewport) {
          const { x, y, zoom } = data.viewport;
          if (typeof x === 'number' && typeof y === 'number' && typeof zoom === 'number') {
            setViewport({ x, y, zoom });
            hasFittedInitially.current = true; // Block manual fitView jump
          }
        }
      }
    } catch (err) {
      logger.warn('[Builder] Failed to restore viewport:', err);
    }
    hasRestoredViewport.current = true;
  }, [isRestored, setViewport, tabId]);





  const makeImageUploadHandler = useCallback((nodeId: string) => (url: string) => {
    if (!url) { updateNodeData(nodeId, { image: url, originalImage: undefined, state: 'idle', outputData: undefined }); return; }
    applyWatermarkToSource(url).then(async (watermarked) => {
      const imageKey = `idb://${crypto.randomUUID()}`;
      await cacheLocalImage(imageKey, watermarked);
      updateNodeData(nodeId, { image: imageKey, originalImage: imageKey, state: 'ready', outputData: makeSourceOutput(imageKey) });
    });
  }, [updateNodeData, applyWatermarkToSource]);

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
      const imageKey = `idb://${crypto.randomUUID()}`;
      await cacheLocalImage(imageKey, watermarked);
      updateNodeData(node.id, { image: imageKey, originalImage: imageKey, state: 'ready', outputData: makeSourceOutput(imageKey) });
      spawnExtraSources(node, watermarkedUrls);
      setSelectedNode({ id: node.id, type: 'source', image: imageKey, originalImage: imageKey, prompt: undefined, state: 'ready' });
    });
  }, [updateNodeData, applyWatermarkToSource, spawnExtraSources, setSelectedNode]);

  // FIX 1: nodesRef gives stable callbacks live access to nodes without making
  // stableHandlers depend on the nodes array. This prevents ALL nodes from
  // re-rendering whenever any single node changes position.
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  const mappedNodesCache = useRef<Map<string, BuilderNode>>(new Map());
  const nodeDataCache = useRef<Map<string, { rawData: any; mappedData: any; enableWatermark: boolean }>>(new Map());

  const stableHandlers = useMemo(() => ({
    onAddChild: (id: string, type: ProcessingType) => {
      addChildNode(id, type);
    },
    onImageUpload: (id: string, url: string) => {
      makeImageUploadHandler(id)(url);
    },
    onImagesUpload: (id: string, urls: string[]) => {
      // Use ref — not closure — so this doesn't force stableHandlers to remake
      const node = nodesRef.current.find(n => n.id === id);
      if (node) makeImagesUploadHandler(node)(urls);
    },
    onDelete: (id: string) => {
      deleteNode(id);
    },
    onRetry: (id: string) => {
      const node = nodesRef.current.find(n => n.id === id);
      if (node) { const handler = makeRetryHandler(node); handler?.(); }
    },
    onExecute: (id: string, promptText: string) => {
      const cfg = buildGenConfig(getConfig());
      executeWithNotifications(id, promptText, cfg).catch(() => {});
    },
    onCancel: (id: string) => {
      cancelExecution(id);
    }
    // ↑ nodes intentionally removed from deps — use nodesRef instead
  }), [addChildNode, deleteNode, makeImageUploadHandler, makeImagesUploadHandler, makeRetryHandler, getConfig, executeWithNotifications, cancelExecution]);

  // Bind callbacks to nodes - filter out nodes with invalid/unmeasured positions
  const nodesWithCallbacks = useMemo(() => {
    const nextCache = new Map<string, BuilderNode>();
    const result = nodes
      .filter(node => isValidPosition(node))
      .map(node => {
        // Retrieve or build stable data object to prevent custom nodes from re-rendering during dragging
        const cachedEntry = nodeDataCache.current.get(node.id);
        let mappedData = cachedEntry?.mappedData;
        
        if (!cachedEntry || cachedEntry.rawData !== node.data || cachedEntry.enableWatermark !== enableWatermark) {
          mappedData = {
            ...node.data,
            onAddChild:      (type: ProcessingType) => stableHandlers.onAddChild(node.id, type),
            onImageUpload:   node.data.type === 'source' ? (url: string) => stableHandlers.onImageUpload(node.id, url) : undefined,
            onImagesUpload:  node.data.type === 'source' ? (urls: string[]) => stableHandlers.onImagesUpload(node.id, urls) : undefined,
            onDelete:        node.data.type === 'source' ? undefined : () => stableHandlers.onDelete(node.id),
            onRetry:         node.data.type === 'ghost' && (node.data.state === 'error' || node.data.state === 'failed') ? () => stableHandlers.onRetry(node.id) : undefined,
            onExecute:       node.data.type === 'ghost' ? (promptText: string) => stableHandlers.onExecute(node.id, promptText) : undefined,
            onCancel:        (node.data.type === 'ghost' || node.data.type === 'result') ? () => stableHandlers.onCancel(node.id) : undefined,
            enableWatermark, // injected once — avoids per-node Zustand subscription
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
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- enableWatermark intentionally omitted per nodesRef pattern above
  }, [nodes, stableHandlers, enableWatermark]);

  // Fit view when nodes are measured to center them perfectly on initial load
  useEffect(() => {
    if (nodesWithCallbacks.length > 0 && !hasFittedInitially.current) {
      const allMeasured = nodesWithCallbacks.every(n => n.measured && typeof n.measured.width === 'number' && n.measured.width > 0);
      if (allMeasured) {
        fitView({ padding: 0.3, duration: 0 });
        hasFittedInitially.current = true;
      }
    }
  }, [nodesWithCallbacks, fitView]);

  const onNodeClick = useCallback((event: React.MouseEvent, node: BuilderNode) => {
    if (event.button !== 0) return;
    setContextMenu(null);
    logger.log('[BuilderPage] onNodeClick:', node.id);
    setSelectedNodeId(node.id);
  }, [setSelectedNodeId]);

  // Sync ReactFlow selection → selectedNodeId (covers drag-select, keyboard, etc.)
  const onSelectionChange = useCallback(({ nodes: selectedNodes }: { nodes: BuilderNode[]; edges: any[] }) => {
    if (selectedNodes.length === 1) {
      const node = selectedNodes[0];
      const data = node.data;
      const img = data.image || data.outputData?.image;
      setSelectedNodeId(node.id);
      setSelectedNode({
        id: node.id,
        type: data.type || null,
        image: img,
        originalImage: data.originalImage,
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
    // Only delete ghost nodes that are brand-new (within 3s) and still idle — avoids
    // wiping ghost nodes that finished processing and are waiting for the user
    const now = Date.now();
    nodes.forEach(node => {
      if (
        node.data.type === 'ghost' &&
        node.data.state === 'idle' &&
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
    // Convert screen coordinates to canvas coordinates
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
  }, [setContextMenu]);

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
      const key = tabId ? `${STORAGE_KEYS.BUILDER_AUTOSAVE}_${tabId}` : STORAGE_KEYS.BUILDER_AUTOSAVE;
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

  // FIX 5: Add/remove a CSS class while panning so all node transitions are
  // suppressed during movement, eliminating per-frame style recalculation.
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const handleMoveStart = useCallback(() => {
    canvasContainerRef.current?.classList.add('canvas-panning');
  }, []);
  const handleMoveEnd = useCallback(() => {
    canvasContainerRef.current?.classList.remove('canvas-panning');
    saveBuilderViewport();
  }, [saveBuilderViewport]);

  // PERF: Stable drag handlers — extracted from JSX so ReactFlow doesn't get
  // a new function reference on every render (inline arrows recreate each time).
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

  // Listen to external save triggers (like closing the tab, closing the app, etc.)
  useEffect(() => {
    const handleTriggerSave = async (e: Event) => {
      const customEvent = e as CustomEvent<{ tabId: string; closeAfterSave?: boolean }>;
      if (customEvent.detail?.tabId !== tabId) return;

      const path = await handleSave();
      if (customEvent.detail?.closeAfterSave) {
        window.dispatchEvent(new CustomEvent('anarchy:save-completed', {
          detail: { tabId, success: !!path }
        }));
      }
    };

    window.addEventListener('anarchy:trigger-save-tab', handleTriggerSave);
    return () => {
      window.removeEventListener('anarchy:trigger-save-tab', handleTriggerSave);
    };
  }, [tabId, handleSave]);

  // ── Image file → data URL ─────────────────────────────────────────────
  const imageFileToDataUrl = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) { reject(new Error('Not an image')); return; }
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result as string);
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
    setTimeout(() => { fitView({ padding: 0.3, duration: 400 }); }, 200);
    logger.log('[Spawn From Image] Source node created successfully:', nodeId);
  }, [createSourceNode, setSelectedNodeId, setSelectedNode, fitView, setNodes, applyWatermarkToSource]);

  // Use custom hooks to isolate Drag & Drop and Keyboard hotkey concerns
  const {
    isDraggingFile,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  } = useBuilderDrop({
    spawnFromImage,
    imageFileToDataUrl,
    applyWatermarkToSource,
    createSourceNode,
    setSelectedNodeId,
    setSelectedNode,
    addNotification,
  });

  useBuilderKeyboard({
    handleSave,
    handleSaveAs,
    handleLoad,
    handleNewCanvas,
    undo,
    redo,
    canUndo,
    canRedo,
    selectedNodeId,
    nodes,
    deleteNode,
    setSelectedNodeId,
    createSourceNode,
    updateNodeData,
    addNotification,
    spawnFromImage,
    imageFileToDataUrl,
  });

  // ── Window-level contextmenu for Tauri (ReactFlow's onPaneContextMenu may not fire) ──
  useEffect(() => {
    const canvasEl = document.querySelector('.canvas-container');
    if (!canvasEl) return;

    const handleWindowContextMenu = (e: Event) => {
      const me = e as MouseEvent;
      if (!canvasEl.contains(me.target as Element)) return;
      me.preventDefault();
      me.stopPropagation();
      const target = me.target as Element;
      // ReactFlow sets data-id attribute on .react-flow__node wrapper
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

  const runContextAction = useCallback((action: ContextAction) => {
    logger.log('[Context Action]', action, 'contextNode:', contextNode?.id);
    switch (action) {
      case 'add-source': {
        const position = contextMenu?.canvasX !== undefined && contextMenu?.canvasY !== undefined
          ? { x: contextMenu.canvasX, y: contextMenu.canvasY }
          : undefined;
        createSourceNode(undefined, undefined, position);
        break;
      }
      case 'rearrange': {
        rearrangeNodes();
        setTimeout(() => fitView({ padding: 0.2, duration: 500 }), 100);
        break;
      }
      case 'spawn-ghost': {
        const data = contextNode?.data as any;
        if (data?.onAddChild) data.onAddChild('render');
        else logger.warn('[Context Action] onAddChild not found on node:', contextNode?.id);
        break;
      }
      case 'retry-node': {
        const data = contextNode?.data as any;
        if (data?.onRetry) data.onRetry();
        else logger.warn('[Context Action] onRetry not found on node:', contextNode?.id);
        break;
      }
      case 'delete-node': {
        const data = contextNode?.data as any;
        if (data?.type === 'source') {
          logger.warn('[Context Action] Cannot delete source node:', contextNode?.id);
        } else if (contextNode) {
          deleteNode(contextNode.id);
        }
        break;
      }
      case 'compare-a':
        handleContextCompare(contextNode, 'A');
        break;
      case 'compare-b':
        handleContextCompare(contextNode, 'B');
        break;
      case 'save-node-image':
        handleContextSaveNodeImage(contextNode);
        break;
      case 'export-dxf':
        handleContextExportDXF(contextNode);
        break;
      case 'analyze-plan':
        void handleContextAnalyzePlan(contextNode);
        break;
      case 'export-all':
        handleContextExportAll();
        break;
      case 'export-pdf':
        handleContextExportPDF();
        break;
      case 'save-project':
        void handleSave();
        break;
      case 'load-project':
        void handleLoad();
        break;
      case 'open-images-folder':
        void handleContextOpenImagesFolder(contextNode);
        break;
      case 'export-node-pdf':
        void handleContextExportNodePDF(contextNode);
        break;
      default:
        break;
    }
    setContextMenu(null);
  }, [
    contextNode,
    contextMenu,
    createSourceNode,
    rearrangeNodes,
    fitView,
    deleteNode,
    handleContextCompare,
    handleContextSaveNodeImage,
    handleContextExportDXF,
    handleContextAnalyzePlan,
    handleContextExportAll,
    handleContextExportPDF,
    handleSave,
    handleLoad,
    handleContextOpenImagesFolder,
    handleContextExportNodePDF,
  ]);


  const canvasHasAnyImage = nodes.some(n => {
    const d = n.data as any;
    return !!(d?.image || d?.outputData?.image);
  });

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  // Check if we can generate
  const aiConfig = getConfig();
  const isUpscaler = aiConfig.selectedTool === 'image-upscaler';
  const hasUpscaleFactor = !!(aiConfig.upscaleFactor && aiConfig.upscaleFactor > 1);
  // Check for any ghost node (upscaler needs a target node to process)
  const hasGhostNode = nodes.some(n => (n.data as any)?.type === 'ghost');
  // Check if there's a source node with an image (for upscaler input)
  const hasSourceWithImage = nodes.some(n => {
    const data = n.data as any;
    return data?.type === 'source' && !!data?.image;
  });
  
  
  // Enable generate if:
  // - For upscaler: has upscale factor selected AND there's a ghost node AND source has image
  // - For other tools: always enabled (prompt check is separate)
  const canGenerate = isUpscaler ? (hasUpscaleFactor && hasGhostNode && hasSourceWithImage) : true;

  return (
    <div className={`builder-page ${isZoomedOut ? 'lod-zoomed-out' : ''}`}>
      <div
        className="canvas-container"
        ref={canvasContainerRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onContextMenu={(e) => e.preventDefault()}
        role="application"
        aria-label="Builder canvas"
      >
        {/* Drag & Drop overlay */}
        {isDraggingFile && (
          <div className="canvas-drop-overlay">
            <div className="canvas-drop-hint">
              <span className="canvas-drop-icon">🖼</span>
              <span>Drop image to add as source node</span>
            </div>
          </div>
        )}

        {/* SVG Definitions for Edge Gradients */}
        <svg width="0" height="0" className="svg-defs">
          <defs>
            <linearGradient id="edge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.15)" />
              <stop offset="50%" stopColor="rgba(225,29,72,0.3)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.15)" />
            </linearGradient>
            <linearGradient id="edge-gradient-active" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(225,29,72,0.5)" />
              <stop offset="100%" stopColor="rgba(225,29,72,0.8)" />
            </linearGradient>
          </defs>
        </svg>

        {/* ReactFlow canvas — always rendered, AppShell controls size in enlarged mode */}
        {(
          <ReactFlow
            proOptions={{ hideAttribution: true }}
            nodes={nodesWithCallbacks}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onSelectionChange={onSelectionChange}
            onPaneClick={onPaneClick}
            onPaneContextMenu={onPaneContextMenu}
            onNodeContextMenu={onNodeContextMenu}
            onMoveStart={handleMoveStart}
            onMoveEnd={handleMoveEnd}
            onNodeDragStart={handleNodeDragStart}
            onNodeDragStop={handleNodeDragStop}
            nodeTypes={memoizedNodeTypes}
            edgeTypes={memoizedEdgeTypes}
            fitViewOptions={{ padding: 0.2, minZoom: 0.01, maxZoom: 2, duration: 300 }}
            colorMode="dark"
            minZoom={0.01}
            maxZoom={2}
            // Note: ConnectionLineType.Bezier removed - causes errors in @xyflow/react v12
            // Custom connection line to avoid getBezierPath errors
            connectionLineComponent={CustomConnectionLine}
            defaultEdgeOptions={{
              type: 'default',
              animated: false,
              label: null, // Prevent any labels on edges
              style: { 
                strokeWidth: 2.5,
                stroke: '#e11d48',
                strokeDasharray: '6 4',
                strokeLinecap: 'round',
              }
            }}
            // Smoothness & Performance optimizations
            onlyRenderVisibleElements={true}
            panOnScroll={false}
            zoomOnScroll={true}
            zoomOnPinch={true}
            zoomOnDoubleClick={false}
            panOnDrag={isSpacePressed ? true : [1, 2]}
            selectionOnDrag={!isSpacePressed}
            selectionMode={SelectionMode.Partial}
            multiSelectionKeyCode={['Shift', 'Control']}
            deleteKeyCode={['Delete', 'Backspace']}
            elevateNodesOnSelect={true}
            nodesDraggable={true}
            nodesConnectable={true}
            elementsSelectable={true}
            selectNodesOnDrag={true}
            zoomActivationKeyCode={null}
            preventScrolling={true}
          >
            <Background 
              variant={BackgroundVariant.Dots} 
              gap={20} 
              size={1} 
              color="rgba(255, 255, 255, 0.05)" 
            />
            {/* FIX 4: Hide MiniMap above 50 nodes — it re-renders on every node
                 position change and becomes very expensive at scale. */}
            {nodesWithCallbacks.length > 0 && nodesWithCallbacks.length <= 50 && (
              <MiniMap
                position="bottom-right"
                nodeColor={() => 'rgba(225, 29, 72, 0.8)'}
                nodeStrokeColor={() => 'rgba(225, 29, 72, 1)'}
                nodeBorderRadius={2}
                maskColor="rgba(0, 0, 0, 0.6)"
                style={{
                  background: 'rgba(10, 10, 12, 0.85)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '10px',
                  width: 120,
                  height: 80,
                  marginBottom: 80,
                }}
                zoomable
                pannable
              />
            )}
          </ReactFlow>
        )}

        <BuilderContextMenu
          contextMenu={contextMenu}
          onClose={() => setContextMenu(null)}
          nodes={nodes}
          selectedNode={selectedNode}
          prompt={prompt}
          setPrompt={setPrompt}
          canUndo={!!canUndo}
          canRedo={!!canRedo}
          undo={undo}
          redo={redo}
          handleNewCanvas={handleNewCanvas}
          onAction={runContextAction}
          fitView={fitView}
          imageFileToDataUrl={imageFileToDataUrl}
          spawnFromImage={spawnFromImage}
        />

        <PerformanceHUD />

        {/* Watermark */}
        <div className="builder-watermark">ANARCHY</div>

        {/* Full Width Prompt Bar - hide when swapped view */}
        {!isEnlargedView && (
          <BuilderPromptBar
            prompt={prompt}
            setPrompt={setPrompt}
            canGenerate={canGenerate}
            isUpscaler={isUpscaler}
            hasUpscaleFactor={hasUpscaleFactor}
            hasSourceWithImage={hasSourceWithImage}
            canvasHasAnyImage={canvasHasAnyImage}
            liveModel={liveModel}
            liveResolution={liveResolution}
            liveQuality={liveQuality}
            livePruna={livePruna}
            userCredits={userCredits}
            onGenerate={handleGenerate}
            onPromptContextMenu={onPromptContextMenu}
          />
        )}
      </div>

      {/* Confirm New Canvas Modal */}
      {confirmNewCanvas && (
        <ConfirmModal
          title="New Canvas"
          message="You have unsaved changes. Start a new canvas anyway?"
          confirmLabel="Discard & Continue"
          danger
          onConfirm={() => { setConfirmNewCanvas(false); doNewCanvas(); }}
          onCancel={() => setConfirmNewCanvas(false)}
        />
      )}

      {/* Credit Error Modal */}
      {creditError && (
        <CreditErrorModal
          balance={creditError.balance}
          needed={creditError.needed}
          onClose={() => setCreditError(null)}
        />
      )}
    </div>
  );
};

// Main exported component wrapped in ReactFlowProvider
export const BuilderPage: React.FC = () => {
  return (
    <ReactFlowProvider>
      <BuilderContent />
    </ReactFlowProvider>
  );
};

export default BuilderPage;
