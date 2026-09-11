import React, { useCallback, useState, useEffect, useRef, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  Panel,
  useReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useStore,
} from '@xyflow/react';
import { LayoutGrid } from 'lucide-react';
import '@xyflow/react/dist/style.css';

import { useBuilderWorkflow } from './useBuilderWorkflow';
import { PerformanceHUD } from './components/PerformanceHUD';
import { type BuilderNode } from './types';
import { useAIConfigStore } from '../../stores/aiConfigStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { BuilderContextMenu } from './components/BuilderContextMenu';
import { BuilderPromptBar } from './components/BuilderPromptBar';
import { BuilderCanvasModals } from './components/BuilderCanvasModals';
import { BuilderCanvasSvgDefs } from './components/BuilderCanvasSvgDefs';
import { useBuilderDrop } from './hooks/useBuilderDrop';
import { useBuilderKeyboard } from './hooks/useBuilderKeyboard';
import { useAuth } from '../auth/AuthContext';
import { logger } from '../../utils/logger';
import { STORAGE_KEYS } from '../../utils/storageKeys';
import { invoke } from '@tauri-apps/api/core';
import { watermarkService } from '../../services/watermark/WatermarkService';
import { getCurrentUserId } from '../../services/supabase/supabaseClient';

// Extracted Hooks
import { useBuilderCredits } from './hooks/useBuilderCredits';
import { useBuilderExport } from './hooks/useBuilderExport';
import { useBuilderGeneration } from './hooks/useBuilderGeneration';
import { useBuilderProjectSync } from './hooks/useBuilderProjectSync';
import { useBuilderNodeCallbacks } from './hooks/useBuilderNodeCallbacks';
import { useBuilderCanvasEvents } from './hooks/useBuilderCanvasEvents';
import { useBuilderContextActions } from './hooks/useBuilderContextActions';
import { useBuilderExternalEvents } from './hooks/useBuilderExternalEvents';

// Helpers
import {
  nodeTypes,
  edgeTypes,
  CustomConnectionLine,
  isVideoNode,
} from './utils/builderHelpers';

import './BuilderPage.css';

const getAutosaveKey = (tabId?: string) => {
  const uid = getCurrentUserId();
  const base = uid && uid !== 'default_user' ? `${STORAGE_KEYS.BUILDER_AUTOSAVE}_${uid}` : STORAGE_KEYS.BUILDER_AUTOSAVE;
  return tabId ? `${base}_${tabId}` : base;
};

// Props for multi-tab support
export interface BuilderContentProps {
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
  const isZoomedOut = useStore((s) => s.transform[2] < 0.6);

  const hasFittedInitially = useRef(false);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const fitViewRef = useRef<((options?: any) => void) | null>(null);
  const needsFitAfterLoadRef = useRef(false);

  const forceCanvasRepaint = useCallback(() => {
    const el = canvasContainerRef.current;
    if (!el) return;
    const target = (el.closest('.tab-pane') as HTMLElement | null) || el;

    requestAnimationFrame(() => {
      target.style.setProperty('display', 'none', 'important');
      void target.offsetHeight;
      target.style.removeProperty('display');
      window.dispatchEvent(new Event('resize'));
    });

    setTimeout(() => window.dispatchEvent(new Event('resize')), 200);
    setTimeout(() => window.dispatchEvent(new Event('resize')), 500);

    needsFitAfterLoadRef.current = true;
  }, []);

  const memoizedNodeTypes = useMemo(() => nodeTypes, []);
  const memoizedEdgeTypes = useMemo(() => edgeTypes, []);

  // Hook 1: Credits State Management
  const {
    userCredits,
    setUserCredits,
    creditError,
    setCreditError,
    isTrial,
  } = useBuilderCredits(authUser?.id);

  const setUserCreditsInStore = useAIConfigStore((s) => s.setUserCreditsInStore);
  useEffect(() => {
    setUserCreditsInStore(userCredits ?? 0, isTrial);
  }, [userCredits, isTrial, setUserCreditsInStore]);

  const studioMode = useAIConfigStore(state => state.config.studioMode || 'edit');
  const selectedTool = useAIConfigStore(state => state.config.selectedTool || 'image-editor');
  const isGenerateMode = (selectedTool === 'image-editor' && studioMode === 'generate') || selectedTool === 'image-creator' || selectedTool === 'anarchy-creator';

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
    getNodes,
    addChildNode,
    createSourceNode,
    spawnGhostNode,
    createStandaloneGhostNode,
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
    canRedo,
    restoreWorkflow,
    spawnBenchmarkLayout
  } = useBuilderWorkflow(tabId, !!initialWorkflow || !!initialImage || !!initialProjectPath);

  // Hook 2: Generation, retry & credit validation operations
  const {
    prompt,
    setPrompt,
    executeWithNotifications,
    handleGenerate,
    makeRetryHandler,
  } = useBuilderGeneration({
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
  });

  // Ensure an idle Standalone Ghost Node is present on canvas ONLY when in Generate mode
  useEffect(() => {
    if (isGenerateMode && isRestored) {
      const hasIdleGhost = nodes.some(n => n.data?.type === 'ghost' && !n.data?.lineage?.parentId && n.data?.state === 'idle');
      if (!hasIdleGhost) {
        createStandaloneGhostNode();
      }
    } else if (!isGenerateMode && isRestored) {
      const idleStandaloneGhost = nodes.find(n => n.data?.type === 'ghost' && !n.data?.lineage?.parentId && n.data?.state === 'idle');
      if (idleStandaloneGhost) {
        setNodes(nds => nds.filter(n => n.id !== idleStandaloneGhost.id));
      }
    }
  }, [isGenerateMode, isRestored, nodes, createStandaloneGhostNode, setNodes]);

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
  const liveModel = useAIConfigStore((state) => state.config.model);
  const liveResolution = useAIConfigStore((state) => state.config.resolution);
  const liveQuality = useAIConfigStore((state) => state.config.qualityVariant ?? state.config.gptQuality ?? ((state.config.model === 'openai/gpt-image-2' || state.config.model?.startsWith('openai/gpt-image-2.5')) ? state.config.resolution : undefined) ?? 'auto');
  const livePruna = useAIConfigStore((state) => state.config.prunaTarget);
  const liveUpscaleFactor = useAIConfigStore((state) => {
    const model = state.config.model;
    if (model === 'topazlabs/image-upscale') {
      const factorStr = state.config.topazUpscaleFactor ?? '4x';
      if (factorStr === '2x') return 2;
      if (factorStr === '4x') return 4;
      if (factorStr === '6x') return 6;
      return 4;
    }
    if (model === 'philz1337x/clarity-upscaler') {
      return state.config.clarityScale ?? 2;
    }
    if (model === 'philz1337x/clarity-pro-upscaler') {
      return state.config.anarchyUpscaleScale ?? state.config.upscaleFactor ?? 2;
    }
    if (model === 'prunaai/p-image-upscale') {
      return state.config.prunaFactor ?? state.config.upscaleFactor ?? 2;
    }
    return state.config.upscaleFactor ?? 2;
  });
  const setSelectedNode = useAIConfigStore((state) => state.setSelectedNode);
  const storeSelectedNode = useAIConfigStore((state) => state.selectedNode);
  const setCompareSlot = useAIConfigStore((state) => state.setCompareSlot);
  const setConfig = useAIConfigStore((state) => state.setConfig);
  const isEnlargedView = useAIConfigStore((state) => state.isEnlargedView);
  const setWorkflowSnapshot = useAIConfigStore((state) => state.setWorkflowSnapshot);
  const setFocusNodeFn = useAIConfigStore((state) => state.setFocusNodeFn);
  const setNodeImageUpdateFn = useAIConfigStore((state) => state.setNodeImageUpdateFn);
  const enableWatermark = useAIConfigStore((state) => state.config.enableWatermark);

  const applyWatermarkToSource = useCallback(async (url: string): Promise<string> => {
    if (!url) return url;
    const isVid = url.startsWith('data:video/') || 
                  url.toLowerCase().includes('.mp4') || 
                  url.toLowerCase().includes('.webm') || 
                  url.toLowerCase().includes('.mov') || 
                  url.toLowerCase().includes('.avi');
    if (isVid) return url;

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' && !spaceRef.current) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        spaceRef.current = true;
        setIsSpacePressed(true);
        e.preventDefault();
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

  // Periodic warm-up ping for proxy edge function
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

  const { fitView: rawFitView, getViewport, fitBounds, getNode: getRFNode, screenToFlowPosition, setViewport } = useReactFlow();
  const fitView = useCallback((options?: any) => {
    return rawFitView(options);
  }, [rawFitView]);
  useEffect(() => { fitViewRef.current = fitView; }, [fitView]);

  useEffect(() => {
    setNodeImageUpdateFn((nodeId: string, image?: string, layout?: any) => {
      updateNodeImageAndPropagate(nodeId, image, layout);
    });
    return () => setNodeImageUpdateFn(null);
  }, [setNodeImageUpdateFn, updateNodeImageAndPropagate]);

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

  useEffect(() => {
    if (!isEnlargedView) return;
    const targetNodeId = selectedNodeId || storeSelectedNode?.id;
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
  }, [isEnlargedView, selectedNodeId, storeSelectedNode?.id, getRFNode, fitBounds]);

  // Hook 3: Project Synchronization, Auto-load & Snapshots
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
  } = useBuilderProjectSync({
    nodes,
    edges,
    setNodes,
    setEdges,
    tabId,
    initialProjectPath,
    initialWorkflow,
    initialImage,
    onTitleChange,
    onDirtyChange,
    onProjectPathChange,
    addNotification,
    fitView,
    isRestored,
    createSourceNode,
    setSelectedNodeId,
    setSelectedNode,
    hasFittedInitially,
    forceCanvasRepaint,
    setWorkflowSnapshot,
    canvasContainerRef,
    needsFitAfterLoadRef,
    isActive,
    setPrompt,
    applyWatermarkToSource,
  });

  // Hook 4: Exports & Floor Plan analysis context handlers
  const {
    handleContextCompare,
    handleContextSaveNodeImage,
    handleContextExportDXF,
    handleContextAnalyzePlan,
    handleContextExportAll,
    handleContextExportPDF,
    handleContextExportZip,
    handleContextOpenImagesFolder,
    handleContextExportNodePDF,
    dxfCalibrationTarget,
    confirmDxfExport,
    cancelDxfCalibration,
  } = useBuilderExport({
    nodes,
    addNotification,
    setCompareSlot,
    setConfig,
  });

  // Hook 5: External Events (Library, History handoff, global events)
  useBuilderExternalEvents({
    tabId,
    isActive,
    createSourceNode,
    setSelectedNodeId,
    setSelectedNode,
    setNodes,
    fitView,
    applyWatermarkToSource,
    restoreWorkflow,
  });

  // Sync selected node to AIConfigContext
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  useEffect(() => {
    logger.log('[BuilderPage] selectedNodeId changed:', selectedNodeId);
    if (selectedNodeId) {
      const node = nodesRef.current.find(n => n.id === selectedNodeId);
      if (node) {
        const data = node.data as any;
        setSelectedNode({
          id: node.id,
          type: data?.type || null,
          image: data?.image || data?.outputData?.image,
          originalImage: data?.originalImage,
          prompt: data?.prompt,
          state: data?.state,
          isVideo: isVideoNode(data),
          dimensions: data?.dimensions || data?.outputData?.dimensions,
        });
      }
    } else {
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
          isVideo: isVideoNode(data),
          dimensions: data?.dimensions || data?.outputData?.dimensions,
        });
      } else {
        setSelectedNode({ id: null, type: null, image: undefined, originalImage: undefined, prompt: undefined, state: undefined, isVideo: false });
      }
    }
  }, [selectedNodeId, setSelectedNode]);

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
  }, [isRestored, tabId, setViewport]);

  // Hook 6: Node Callbacks (Images upload, retry, deletion bindings)
  const {
    nodesWithCallbacks,
  } = useBuilderNodeCallbacks({
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
  });

  // Hook 7: Canvas Interactions & Mouse / Context Menu Events
  const {
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
  } = useBuilderCanvasEvents({
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
  });

  // External tab save listener
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

  // Hook 8: Context Menu Actions
  const { runContextAction } = useBuilderContextActions({
    contextNode: contextNode ?? null,
    contextMenu,
    setContextMenu,
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
    handleContextExportZip,
    handleSave,
    handleLoad,
    handleContextOpenImagesFolder,
    handleContextExportNodePDF,
    setSelectedNodeId,
    setSelectedNode,
  });

  // Drag & drop hook
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

  // Keyboard shortcut hook
  useBuilderKeyboard({
    isActive,
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

  const canvasHasAnyImage = nodes.some(n => {
    const d = n.data as any;
    return !!(d?.image || d?.outputData?.image);
  });

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  const aiConfig = getConfig();
  const isUpscaler = aiConfig.selectedTool === 'image-upscaler';
  const resolvedUpscaleFactor = 
    aiConfig.model === 'topazlabs/image-upscale'
      ? (aiConfig.topazUpscaleFactor === '2x' ? 2 : aiConfig.topazUpscaleFactor === '6x' ? 6 : 4)
      : aiConfig.model === 'philz1337x/clarity-upscaler'
        ? (aiConfig.clarityScale ?? 2)
        : aiConfig.model === 'philz1337x/clarity-pro-upscaler'
          ? (aiConfig.anarchyUpscaleScale ?? aiConfig.upscaleFactor ?? 2)
          : aiConfig.model === 'prunaai/p-image-upscale'
            ? (aiConfig.prunaFactor ?? aiConfig.upscaleFactor ?? 2)
            : (aiConfig.upscaleFactor ?? 2);
  const hasUpscaleFactor = !!(resolvedUpscaleFactor && resolvedUpscaleFactor >= 1);
  const hasSourceWithImage = nodes.some(n => {
    const data = n.data as any;
    return (data?.type === 'source' || data?.type === 'result') && !!(data?.image || data?.outputData?.image);
  });

  const canGenerate = isUpscaler ? (hasUpscaleFactor && hasSourceWithImage) : true;

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
        {isDraggingFile && (
          <div className="canvas-drop-overlay">
            <div className="canvas-drop-hint">
              <span className="canvas-drop-icon">🖼</span>
              <span>Drop image to add as source node</span>
            </div>
          </div>
        )}

        <BuilderCanvasSvgDefs />

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
          fitViewOptions={{ padding: 0.2, minZoom: 0.6, maxZoom: 2, duration: 300 }}
          colorMode="dark"
          minZoom={0.01}
          maxZoom={2}
          connectionLineComponent={CustomConnectionLine}
          defaultEdgeOptions={{
            type: 'default',
            animated: false,
            label: null,
            style: {
              strokeWidth: 2.5,
              stroke: '#e11d48',
              strokeDasharray: '6 4',
              strokeLinecap: 'round',
            }
          }}
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
          <Panel position="top-left" className="builder-canvas-quick-panel">
            <button
              type="button"
              className="builder-canvas-quick-btn"
              onClick={() => runContextAction('rearrange')}
              title="Rearrange Graph"
              aria-label="Rearrange Graph"
            >
              <LayoutGrid size={15} />
            </button>
          </Panel>
          {!isEnlargedView && nodesWithCallbacks.length > 0 && nodesWithCallbacks.length <= 50 && (
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
          onSpawnWithModel={handleSpawnWithModel}
        />

        <PerformanceHUD onSpawnBenchmark={spawnBenchmarkLayout} />

        <div className="builder-watermark">ANARCHY</div>

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
            upscaleFactor={liveUpscaleFactor}
            userCredits={userCredits}
            isTrial={isTrial}
            onGenerate={handleGenerate}
            onPromptContextMenu={onPromptContextMenu}
          />
        )}
      </div>

      <BuilderCanvasModals
        confirmNewCanvas={confirmNewCanvas}
        onConfirmNewCanvas={() => { setConfirmNewCanvas(false); doNewCanvas(); }}
        onCancelNewCanvas={() => setConfirmNewCanvas(false)}
        creditError={creditError}
        onCloseCreditError={() => setCreditError(null)}
        dxfCalibrationTarget={dxfCalibrationTarget}
        onConfirmDxfExport={confirmDxfExport}
        onCancelDxfCalibration={cancelDxfCalibration}
      />
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
