import React, { useCallback, useState, useEffect, useRef, useMemo, memo } from 'react';
import { logger } from '../../utils/logger';
import { useLocation } from 'react-router-dom';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  type Node,
  useReactFlow,
  ReactFlowProvider,
  SelectionMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { BaseNode } from './BaseNode';
import { GhostNode } from './GhostNode';
import VizGhostAttachEdge from './VizGhostAttachEdge';
import { useBuilderWorkflow, type ProcessingType } from './useBuilderWorkflow';
import { sanitizeEdges } from './types';
import { useAIConfigStore } from '../../stores/aiConfigStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { exportImageWithDialog, exportImagesBatchWithDialog, exportNodesToPDFWithDialog, exportImageToDXFWithDialog, saveDXFFromServer, urlToDataUri, exportImagesToPDFWithDialog } from '../../services/export';
import { watermarkService } from '../../services/watermark/WatermarkService';
import { saveWorkflow, saveWorkflowAs, loadWorkflow, resetFilePath } from '../../services/workflow';
import { invoke } from '@tauri-apps/api/core';
import { STORAGE_KEYS, SESSION_KEYS } from '../../utils/storageKeys';
import { useAuth } from '../auth/AuthContext';
import { checkCreditBalance, deductCredits, getModelCost, DEV_MODE, refundCredits } from '../../services/credit/creditService';
import { ConfirmModal } from '../../components/ConfirmModal';
import { cacheLocalImage, getLocalImage } from '../../services/history/HistoryService';
import { BuilderContextMenu } from './components/BuilderContextMenu';
import { BuilderPromptBar } from './components/BuilderPromptBar';
import { CreditErrorModal } from './components/CreditErrorModal';
import { useBuilderDrop } from './hooks/useBuilderDrop';
import { useBuilderKeyboard } from './hooks/useBuilderKeyboard';
import './BuilderPage.css';

// Check if running in a Tauri desktop environment
export const isTauri = (): boolean => typeof globalThis !== 'undefined' && '__TAURI_INTERNALS__' in globalThis;

// ── Module-level helpers (outside component to avoid nesting warnings) ─────

const SOURCE_LABELS: Record<string, string> = {
  autocad: 'AutoCAD', revit: 'Revit',
  '3dsmax': '3ds Max', max: '3ds Max',
  rhino: 'Rhino', sketchup: 'SketchUp',
};

function resolveSourceLabel(raw: string): string {
  const lower = raw.toLowerCase();
  return SOURCE_LABELS[lower] ?? (lower ? lower.charAt(0).toUpperCase() + lower.slice(1) : 'External');
}

const buildGenConfig = (aiConfig: any) => ({
  model: aiConfig.model,
  resolution: aiConfig.resolution,
  aspectRatio: aiConfig.aspectRatio,
  steps: aiConfig.steps,
  cfg: aiConfig.cfg,
  seed: aiConfig.seed,
  strength: aiConfig.strength,
  referenceStrength: aiConfig.referenceStrength,
  negativePrompt: aiConfig.negativePrompt,
  disableSafetyChecker: aiConfig.disableSafetyChecker,
  upscaleFactor: aiConfig.upscaleFactor,
  prunaMode: aiConfig.prunaMode,
  prunaTarget: aiConfig.prunaTarget,
  prunaFactor: aiConfig.prunaFactor,
  prunaEnhanceDetails: aiConfig.prunaEnhanceDetails,
  prunaEnhanceRealism: aiConfig.prunaEnhanceRealism,
  prunaQuality: aiConfig.prunaQuality,
  prunaOutputFormat: aiConfig.prunaOutputFormat,
});

function convertNodeTreeToWorkflow(nodeTree: any): { nodes: any[]; edges: any[] } {
  const TYPE_LABELS: Record<string, string> = {
    source: 'Source',
    render: 'AI Render',
    detail: 'Detail Edit',
    upscale: 'Upscale',
    people: 'Add People',
    daynight: 'Day to Night',
    lighting: 'Lighting',
    material: 'Materials',
    local: 'Local Edit',
    variation: 'Variation'
  };

  const nodesRaw = nodeTree.nodes || [];

  const getLineage = (node: any): { generation: number; ancestry: string[]; branchIndex: number } => {
    const ancestry: string[] = [];
    let curr = node;
    while (curr && curr.parentId) {
      ancestry.unshift(curr.parentId);
      curr = nodesRaw.find((x: any) => x.id === curr.parentId);
    }
    const generation = ancestry.length;
    
    // Find siblings (other nodes with the same parentId)
    const siblings = nodesRaw.filter((x: any) => x.parentId === node.parentId);
    // Sort siblings by ID to ensure stable branchIndex calculation
    siblings.sort((a: any, b: any) => String(a.id).localeCompare(String(b.id)));
    const branchIndex = siblings.findIndex((x: any) => x.id === node.id);
    
    return {
      generation,
      ancestry,
      branchIndex: branchIndex >= 0 ? branchIndex : 0
    };
  };

  const nodes = nodesRaw.map((n: any) => {
    const rfType = n.type === 'ghost' ? 'ghostNode' : 'baseNode';
    const { generation, ancestry, branchIndex } = getLineage(n);
    
    const lineage = {
      parentId: n.parentId || null,
      rootSourceId: nodeTree.sourceNodeId || ancestry[0] || n.id,
      generation,
      branchIndex,
      processingType: n.processingType || 'source',
      ancestry
    };

    const outputPacket = n.image ? {
      image: n.image,
      prompt: n.prompt,
      metadata: {
        timestamp: nodeTree.createdAt || Date.now(),
        operationType: n.processingType || 'source',
        format: 'png'
      }
    } : undefined;

    return {
      id: n.id,
      type: rfType,
      position: n.position || { x: 200, y: 200 },
      width: 260,
      data: {
        label: TYPE_LABELS[n.processingType || ''] || n.processingType || 'Node',
        type: n.type,
        processingType: n.processingType || 'source',
        state: n.state || 'ready',
        image: n.image,
        prompt: n.prompt,
        createdAt: nodeTree.createdAt || Date.now(),
        lineage,
        outputData: outputPacket,
        inputData: undefined,
        config: {}
      }
    };
  });

  const edges: any[] = [];
  (nodeTree.nodes || []).forEach((n: any) => {
    if (n.parentId) {
      edges.push({
        id: `e-${n.parentId}-${n.id}-0`,
        source: n.parentId,
        target: n.id,
        sourceHandle: 'source',
        targetHandle: 'ghost-target-0',
        type: 'default',
        animated: false,
        label: null,
        style: { 
          strokeWidth: 2,
          stroke: '#e11d48',
          opacity: 0.8,
          strokeDasharray: '5 5',
          strokeLinecap: 'round'
        },
        data: {
          isActive: true,
          lastUpdate: nodeTree.createdAt || Date.now()
        }
      });
    }
  });

  // Link parent's outputData to inputData of children
  nodes.forEach((node: any) => {
    if (node.data.lineage.parentId) {
      const parent = nodes.find((p: any) => p.id === node.data.lineage.parentId);
      if (parent) {
        node.data.inputData = parent.data.outputData;
      }
    }
  });

  return { nodes, edges };
}

function drawNodeImage(
  img: HTMLImageElement, nodeRect: DOMRect, rect: DOMRect,
  ctx: CanvasRenderingContext2D, res: () => void
) {
  try {
    ctx.drawImage(img, nodeRect.left - rect.left, nodeRect.top - rect.top, nodeRect.width, nodeRect.height);
  } catch (err) {
    logger.warn('[Thumbnail] Failed to draw image:', err);
  }
  res();
}

function makeNodeImagePromise(
  img: HTMLImageElement, nodeRect: DOMRect, rect: DOMRect, ctx: CanvasRenderingContext2D
): Promise<void> {
  return new Promise<void>((res) => {
    const draw = () => drawNodeImage(img, nodeRect, rect, ctx, res);
    if (img.complete) { draw(); return; }
    img.onload = draw;
    img.onerror = () => { logger.warn('[Thumbnail] Image failed to load'); res(); };
    setTimeout(() => { if (!img.complete) { logger.warn('[Thumbnail] Image load timeout'); res(); } }, 2000);
  });
}

function htmlToCanvas(element: HTMLElement): Promise<HTMLCanvasElement | null> {
  return new Promise((resolve) => {
    try {
      const rect = element.getBoundingClientRect();
      const canvas = document.createElement('canvas');
      canvas.width = rect.width;
      canvas.height = rect.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(null); return; }
      ctx.fillStyle = '#0f0f0f';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const nodeEls = element.querySelectorAll('.react-flow__node');
      const promises: Promise<void>[] = [];
      nodeEls.forEach((node) => {
        const htmlNode = node as HTMLElement;
        const nodeRect = htmlNode.getBoundingClientRect();
        const img = htmlNode.querySelector('img');
        if (img) promises.push(makeNodeImagePromise(img, nodeRect, rect, ctx));
      });
      Promise.all(promises).then(() => resolve(canvas));
    } catch { resolve(null); }
  });
}

function makeSourceOutput(url: string) {
  if (!url) return undefined;
  return { image: url, prompt: undefined, metadata: { timestamp: Date.now(), operationType: 'source' as const } };
}

function isValidPosition(node: Node): boolean {
  const p = node.position;
  if (!p) return false;
  if (typeof p.x !== 'number' || Number.isNaN(p.x)) return false;
  if (typeof p.y !== 'number' || Number.isNaN(p.y)) return false;
  return true;
}

function positionExtraNode(sourceId: string, baseX: number, baseY: number, index: number) {
  return (curr: Node[]) => curr.map(n =>
    n.id === sourceId ? { ...n, position: { x: baseX, y: baseY + 170 * (index + 1) } } : n
  );
}

function positionExternalNode(sourceId: string) {
  return (curr: Node[]) => curr.map(n =>
    n.id === sourceId
      ? { ...n, position: { x: 120, y: 260 + curr.filter(s => (s.data as any)?.type === 'source').length * 40 } }
      : n
  );
}

function patchNodeImage(sourceNodeId: string, img: string) {
  return (curr: Node[]) => curr.map(n =>
    n.id === sourceNodeId ? { ...n, data: { ...n.data, image: img, state: 'ready' } } : n
  );
}

function patchSpawnedNode(nodeId: string) {
  return (curr: Node[]) => curr.map(n =>
    n.id === nodeId
      ? { ...n, position: { x: 120, y: 200 + curr.filter(s => (s.data as any)?.type === 'source').length * 80 } }
      : n
  );
}

// createSourceIfEmpty removed as empty initialization is now handled directly by the workflow hook


// Separate node types for proper handle positioning
const nodeTypes = {
  baseNode: BaseNode,      // Source and Result nodes
  ghostNode: GhostNode,    // Ghost/Processing nodes with multiple inputs
};

// Custom Connection Line component to avoid getBezierPath errors
const CustomConnectionLine = memo(({ fromX, fromY, toX, toY }: { fromX: number; fromY: number; toX: number; toY: number }) => {
  // Simple straight line for connection (avoid bezier errors)
  const path = `M ${fromX} ${fromY} L ${toX} ${toY}`;
  
  return (
    <g>
      <path
        d={path}
        stroke="#e11d48"
        strokeWidth={2}
        strokeDasharray="5 5"
        fill="none"
        style={{ pointerEvents: 'none' }}
      />
    </g>
  );
});

// Custom edge types for data flow visualization
const edgeTypes = {
  default: VizGhostAttachEdge,  // Custom bezier edge with brand styling
};

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
  const [currentFilePath, setCurrentFilePathState] = useState<string | null>(initialProjectPath ?? null);
  const hasLoadedRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setCurrentFilePathState(initialProjectPath ?? null);
  }, [initialProjectPath]);
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
    deleteNode,
    rearrangeNodes,
    setNodes,
    setEdges,
    isRestored,
    undo,
    redo,
    canUndo,
    canRedo
  } = useBuilderWorkflow(tabId);

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
  const addNotification = useNotificationStore((state) => state.addNotification);
  const { user: authUser } = useAuth();

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
  const [prompt, setPrompt] = useState('');
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Monitor spacebar events for Figma-like canvas panning
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' && !isSpacePressed) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        setIsSpacePressed(true);
        e.preventDefault(); // Prevent page scrolling
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        setIsSpacePressed(false);
      }
    };

    globalThis.addEventListener('keydown', handleKeyDown);
    globalThis.addEventListener('keyup', handleKeyUp);
    return () => {
      globalThis.removeEventListener('keydown', handleKeyDown);
      globalThis.removeEventListener('keyup', handleKeyUp);
    };
  }, [isSpacePressed]);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    canvasX?: number;
    canvasY?: number;
    type: 'canvas' | 'node' | 'prompt';
    nodeId?: string;
  } | null>(null);
  const [creditError, setCreditError] = useState<{ balance: number; needed: number } | null>(null);
  const [confirmNewCanvas, setConfirmNewCanvas] = useState(false);
  const isDirtyRef = useRef(false);

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

  // Generate thumbnail from canvas for project preview
  const generateThumbnail = useCallback(async (): Promise<string | undefined> => {
    try {
      // Find the react-flow__viewport element which contains the canvas
      const viewport = document.querySelector('.react-flow__viewport') as HTMLElement;
      if (!viewport) return undefined;

      // Use html-to-image approach via canvas
      const canvas = await htmlToCanvas(viewport);
      if (!canvas) return undefined;

      // Scale down to thumbnail size (max 600px width for better quality)
      const maxWidth = 600;
      const scale = Math.min(maxWidth / canvas.width, 1);
      const thumbWidth = Math.round(canvas.width * scale);
      const thumbHeight = Math.round(canvas.height * scale);

      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = thumbWidth;
      thumbCanvas.height = thumbHeight;
      const ctx = thumbCanvas.getContext('2d');
      if (!ctx) return undefined;

      // Enable high quality scaling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      ctx.drawImage(canvas, 0, 0, thumbWidth, thumbHeight);
      return thumbCanvas.toDataURL('image/jpeg', 0.92);
    } catch (err) {
      logger.warn('[Thumbnail] Generation failed:', err);
      return undefined;
    }
  }, []);

  // htmlToCanvas is defined as a module-level function above the component

  const location = useLocation();

  // Re-check sessionStorage on every navigation to /builder (component stays mounted)
  const applyWorkflow = useCallback((wf: any, fallbackName: string) => {
    if (!wf.nodes) return;
    const mappedNodes = wf.nodes.map((n: any) => ({ id: n.id, type: n.type, position: n.position, data: n.data }));
    setNodes(mappedNodes);
    const mappedEdges = (wf.edges ?? []).map((e: any) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle || 'source', targetHandle: e.targetHandle, type: e.type, animated: e.animated, style: e.style, data: e.data }));
    setEdges(sanitizeEdges(mappedNodes, mappedEdges));
    const name = wf.name || fallbackName;
    onTitleChange?.(name);
    skipDirtyRef.current = 2;
    onDirtyChange?.(false);
    
    // Reset hasFittedInitially so we re-fit once the newly loaded nodes are measured!
    hasFittedInitially.current = false;
    
    setTimeout(() => fitView({ padding: 0.3, duration: 400 }), 200);
    addNotification({ type: 'success', title: 'Project Loaded', message: name });
  }, [setNodes, setEdges, onTitleChange, onDirtyChange, fitView, addNotification]);

  const restorePresetImage = useCallback((wf: any, img: string) => {
    sessionStorage.removeItem(SESSION_KEYS.PRESET_IMAGE);
    const sourceNode = wf.nodes.find((n: any) => n.data?.type === 'source');
    if (!sourceNode) return;
    setTimeout(() => setNodes(patchNodeImage(sourceNode.id, img)), 100);
  }, [setNodes]);

  useEffect(() => {
    if (location.pathname !== '/builder') return;

    const preset = sessionStorage.getItem(SESSION_KEYS.PRESET_PROMPT);
    if (preset) { sessionStorage.removeItem(SESSION_KEYS.PRESET_PROMPT); setPrompt(preset); }
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Sync nodes/edges snapshot for Sidebar mini-map
  useEffect(() => {
    setWorkflowSnapshot({ nodes, edges });
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
      
      // Only process the external image if this tab is the active tab
      if (tabId && tabId === activeTabId) {
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
  }, [tabId, handleExternalImage]);

  // Viewport restore removed — always start fresh

  // Sync selected node to AIConfigContext for Preview Panel
  useEffect(() => {
    logger.log('[BuilderPage] selectedNodeId changed:', selectedNodeId);
    if (selectedNodeId) {
      const node = nodes.find(n => n.id === selectedNodeId);
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
      const sourceOrResult = nodes.find(n => {
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
  }, [selectedNodeId, nodes, setSelectedNode]);
  const hasFittedInitially = useRef(false);

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

  // Dirty state: notify parent when canvas changes after initial restore
  // skipDirtyRef > 0 means the next N node/edge changes should be ignored (restore, load, save)
  const onDirtyChangeRef = useRef(onDirtyChange);
  useEffect(() => {
    onDirtyChangeRef.current = onDirtyChange;
  }, [onDirtyChange]);

  const skipDirtyRef = useRef(2); // skip initial restore triggers
  useEffect(() => {
    if (!isRestored) return;
    if (skipDirtyRef.current > 0) { skipDirtyRef.current--; return; }
    isDirtyRef.current = true;
    onDirtyChangeRef.current?.(true);
  }, [nodes, edges, isRestored]);



  // Execute with notifications wrapper
  const executeWithNotifications = useCallback(async (
    nodeId: string, 
    nodePrompt: string, 
    config?: any
  ) => {
    try {
      await executeNode(nodeId, nodePrompt, config);
      const node = nodes.find(n => n.id === nodeId);
      const nodeData = node?.data as any;
      const resultImage = nodeData?.image || nodeData?.outputData?.image;
      
      addNotification({
        type: 'success',
        title: 'Image Generated',
        message: nodePrompt.length > 40 ? nodePrompt.slice(0, 40) + '...' : nodePrompt,
        nodeId,
        imageUrl: resultImage,
        duration: 6000,
        category: 'generation',
      });

      // History logging now happens inside useBuilderWorkflow where fresh image is available
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

      // Refund credits for this failed node
      if (authUser?.id && !DEV_MODE) {
        const aiConfig = useAIConfigStore.getState().config;
        const singleCost = getModelCost(aiConfig.model, {
          resolution: aiConfig.resolution,
          qualityVariant: (aiConfig as any).qualityVariant ?? 'auto',
          prunaTarget: aiConfig.prunaTarget,
        });

        refundCredits(authUser.id, singleCost, `Refund: Failed generation for node ${nodeId}`)
          .then((success) => {
            if (success) {
              addNotification({
                type: 'info',
                title: 'Credits Refunded',
                message: `Refunded ${singleCost} credits for failed generation.`,
                duration: 4000,
              });
            }
          })
          .catch((err) => logger.error('[Credit] Refund failed:', err));
      }

      throw error;
    }
  }, [executeNode, nodes, addNotification, authUser]);

  const makeImageUploadHandler = useCallback((nodeId: string) => (url: string) => {
    if (!url) { updateNodeData(nodeId, { image: url, originalImage: undefined, state: 'idle', outputData: undefined }); return; }
    applyWatermarkToSource(url).then(async (watermarked) => {
      const imageKey = `idb://${crypto.randomUUID()}`;
      await cacheLocalImage(imageKey, watermarked);
      updateNodeData(nodeId, { image: imageKey, originalImage: imageKey, state: 'ready', outputData: makeSourceOutput(imageKey) });
    });
  }, [updateNodeData, applyWatermarkToSource]);

  const spawnExtraSources = useCallback((node: Node, watermarkedUrls: string[]) => {
    watermarkedUrls.slice(1).forEach((wUrl, index) => {
      const sourceId = createSourceNode(wUrl);
      setTimeout(() => {
        setNodes(positionExtraNode(sourceId, node.position.x, node.position.y, index));
      }, 0);
    });
  }, [createSourceNode, setNodes]);

  const handleRetryExecution = useCallback(async (nodeId: string, prompt: string, config: any) => {
    try {
      await executeWithNotifications(nodeId, prompt, config);
    } catch {
      // ignored
    }
  }, [executeWithNotifications]);

  const makeImagesUploadHandler = useCallback((node: Node) => (urls: string[]) => {
    if (!urls.length) return;
    Promise.all(urls.map(u => applyWatermarkToSource(u))).then(async (watermarkedUrls) => {
      const watermarked = watermarkedUrls[0];
      const imageKey = `idb://${crypto.randomUUID()}`;
      await cacheLocalImage(imageKey, watermarked);
      updateNodeData(node.id, { image: imageKey, originalImage: imageKey, state: 'ready', outputData: makeSourceOutput(imageKey) });
      spawnExtraSources(node, watermarkedUrls);
      setSelectedNode({ id: node.id, type: 'source', image: imageKey, originalImage: imageKey, prompt: undefined, state: 'ready' });
    });
  }, [updateNodeData, applyWatermarkToSource, spawnExtraSources, setSelectedNode]);

  const makeRetryHandler = useCallback((node: Node) => {
    const d = node.data as any;
    if (d.state !== 'error' || d.type !== 'ghost') return undefined;
    return () => {
      if (!d.prompt) return;
      updateNodeData(node.id, { state: 'idle', errorMessage: undefined });
      setTimeout(() => handleRetryExecution(node.id, d.prompt, d.config), 50);
    };
  }, [updateNodeData, handleRetryExecution]);

  // Bind callbacks to nodes - filter out nodes with invalid/unmeasured positions
  const nodesWithCallbacks = useMemo(() => nodes
    .filter(node => {
      if (isValidPosition(node)) return true;
      // Only warn for truly invalid positions, not just unmeasured (newly added) nodes
      const p = node.position;
      const hasInvalidPos = !p || typeof p.x !== 'number' || Number.isNaN(p.x) || typeof p.y !== 'number' || Number.isNaN(p.y);
      if (hasInvalidPos) logger.warn('[Builder] Filtering out node with invalid position:', node.id);
      return false;
    })
    .map(node => ({
      ...node,
      data: {
        ...node.data,
        onAddChild:     (processingType: ProcessingType) => addChildNode(node.id, processingType),
        onImageUpload:  node.data.type === 'source' ? makeImageUploadHandler(node.id) : undefined,
        onImagesUpload: node.data.type === 'source' ? makeImagesUploadHandler(node) : undefined,
        onDelete:       node.data.type === 'source' ? undefined : () => deleteNode(node.id),
        onRetry:        makeRetryHandler(node),
        onExecute:      node.data.type === 'ghost' ? (promptText: string) => {
          const aiConfig = getConfig();
          const genConfig = buildGenConfig(aiConfig);
          executeWithNotifications(node.id, promptText, genConfig).catch(() => {});
        } : undefined,
      },
    })),
  [nodes, addChildNode, makeImageUploadHandler, makeImagesUploadHandler, deleteNode, makeRetryHandler, executeWithNotifications, getConfig]);

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

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (event.button !== 0) return;
    setContextMenu(null);
    logger.log('[BuilderPage] onNodeClick:', node.id);
    setSelectedNodeId(node.id);
  }, [setSelectedNodeId]);

  // Sync ReactFlow selection → selectedNodeId (covers drag-select, keyboard, etc.)
  const onSelectionChange = useCallback(({ nodes: selectedNodes }: { nodes: Node[]; edges: any[] }) => {
    if (selectedNodes.length === 1) {
      const node = selectedNodes[0];
      const data = node.data as any;
      const img = data?.image || data?.outputData?.image;
      setSelectedNodeId(node.id);
      setSelectedNode({
        id: node.id,
        type: data?.type || null,
        image: img,
        originalImage: data?.originalImage,
        prompt: data?.prompt,
        state: data?.state,
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

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
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




  const executeGhost = useCallback((ghostId: string, genConfig: ReturnType<typeof buildGenConfig>) => {
    executeWithNotifications(ghostId, prompt, genConfig).catch(() => {});
    setPrompt('');
  }, [executeWithNotifications, prompt, setPrompt]);

  const spawnAndExecute = useCallback((genConfig: ReturnType<typeof buildGenConfig>) => {
    const existingParent =
      nodes.find(n => { const d = n.data as any; return (d.type === 'source' || d.type === 'result') && !!d.image; }) ??
      nodes.find(n => (n.data as any)?.type === 'source');
    const parentId = existingParent ? existingParent.id : createSourceNode();
    setTimeout(() => {
      const ghostId = spawnGhostNode(parentId, 'render');
      if (ghostId) setTimeout(() => executeGhost(ghostId, genConfig), 50);
    }, 50);
  }, [nodes, createSourceNode, spawnGhostNode, executeGhost]);

  const handleGenerate = useCallback(async () => {
    const aiConfig = getConfig();
    const cost = getModelCost(aiConfig.model, {
      resolution: aiConfig.resolution,
      qualityVariant: (aiConfig as any).qualityVariant ?? 'auto',
      prunaTarget: aiConfig.prunaTarget,
    });

    if (authUser?.id && !DEV_MODE) {
      const creditCheck = await checkCreditBalance(authUser.id, cost);
      if (!creditCheck.hasEnough) {
        setCreditError({ balance: creditCheck.balance, needed: creditCheck.needed });
        return;
      }
    }

    const isUpscaler = aiConfig.selectedTool === 'image-upscaler';
    if (!prompt.trim() && !(isUpscaler && aiConfig.upscaleFactor && aiConfig.upscaleFactor > 1)) return;

    const genConfig = buildGenConfig(aiConfig);
    const idleGhosts = nodes.filter(n => { const d = n.data as any; return d.type === 'ghost' && d.state === 'idle'; });
    const totalCost = cost * (idleGhosts.length > 0 ? idleGhosts.length : 1);

    if (authUser?.id && !DEV_MODE) {
      const deduct = await deductCredits(authUser.id, totalCost, `Generation: ${prompt.slice(0, 30)}...`);
      if (!deduct.success) {
        addNotification({ type: 'error', title: 'Deduction Failed', message: deduct.error ?? 'Insufficient balance' });
        return;
      }
    }

    if (idleGhosts.length > 0) {
      idleGhosts.forEach(g => executeWithNotifications(g.id, prompt, genConfig).catch(() => {}));
      setPrompt('');
    } else {
      spawnAndExecute(genConfig);
    }
  }, [getConfig, authUser, prompt, nodes, executeWithNotifications, setPrompt, spawnAndExecute, addNotification]);

  const handleRearrange = () => {
    rearrangeNodes();
    setTimeout(() => fitView({ padding: 0.2, duration: 500 }), 100);
  };

  const saveBuilderViewport = useCallback(() => {
    try {
      const key = tabId ? `${STORAGE_KEYS.BUILDER_AUTOSAVE}_${tabId}` : STORAGE_KEYS.BUILDER_AUTOSAVE;
      const saved = localStorage.getItem(key);
      const data = saved ? JSON.parse(saved) : {};
      localStorage.setItem(key, JSON.stringify({
        ...data,
        nodes,
        edges,
        viewport: getViewport(),
      }));
    } catch {
      // Silent fail
    }
  }, [nodes, edges, getViewport, tabId]);

  // Silent background file autosave to disk project path
  useEffect(() => {
    if (!isRestored) return;
    if (!currentFilePath) return;

    const timeoutId = setTimeout(async () => {
      try {
        const thumbnail = await generateThumbnail();
        await saveWorkflow(nodes, edges, { thumbnail, filePath: currentFilePath });
      } catch (err) {
        logger.warn('[Autosave] Background disk save failed:', err);
      }
    }, 5000); // Debounce 5s for disk autosaving

    return () => clearTimeout(timeoutId);
  }, [nodes, edges, isRestored, generateThumbnail, currentFilePath]);

  const contextNode = contextMenu?.type === 'node'
    ? nodesWithCallbacks.find(n => n.id === contextMenu.nodeId)
    : undefined;



  // ── Save / Load handlers ──────────────────────────────────────────────
  const handleSave = useCallback(async (): Promise<string | null> => {
    try {
      const thumbnail = await generateThumbnail();
      const path = await saveWorkflow(nodes, edges, { thumbnail, filePath: currentFilePath });
      if (path) {
        if (!isMountedRef.current) return path;
        const name = path.split(/[\\/]/).pop()?.replace(/\.ana$/i, '') || 'Saved';
        addNotification({ type: 'success', title: 'Project Saved', message: name });
        onTitleChange?.(name);
        setCurrentFilePathState(path);
        onProjectPathChange?.(path);
        skipDirtyRef.current = 1;
        isDirtyRef.current = false;
        onDirtyChange?.(false);
        return path;
      }
      return null;
    } catch (err) {
      if (!isMountedRef.current) return null;
      logger.error('[Save] failed:', err);
      addNotification({ type: 'error', title: 'Save Failed', message: String(err) });
      return null;
    }
  }, [nodes, edges, addNotification, generateThumbnail, onTitleChange, onDirtyChange, currentFilePath, onProjectPathChange]);

  const handleSaveAs = useCallback(async (): Promise<string | null> => {
    try {
      const thumbnail = await generateThumbnail();
      const path = await saveWorkflowAs(nodes, edges, undefined, thumbnail, currentFilePath);
      if (path) {
        if (!isMountedRef.current) return path;
        const name = path.split(/[\\/]/).pop()?.replace(/\.ana$/i, '') || 'Saved';
        addNotification({ type: 'success', title: 'Project Saved', message: name });
        onTitleChange?.(name);
        setCurrentFilePathState(path);
        onProjectPathChange?.(path);
        skipDirtyRef.current = 1;
        isDirtyRef.current = false;
        onDirtyChange?.(false);
        return path;
      }
      return null;
    } catch (err) {
      if (!isMountedRef.current) return null;
      logger.error('[Save As] failed:', err);
      addNotification({ type: 'error', title: 'Save Failed', message: String(err) });
      return null;
    }
  }, [nodes, edges, addNotification, generateThumbnail, onTitleChange, onDirtyChange, currentFilePath, onProjectPathChange]);

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
  // Consolidated keyboard shortcuts handled globally below to prevent duplicate events

  const handleLoad = useCallback(async () => {
    try {
      const result = await loadWorkflow();
      if (result) {
        setNodes(result.nodes);
        setEdges(sanitizeEdges(result.nodes, result.edges || []));
        onTitleChange?.(result.name);
        setCurrentFilePathState(result.filePath);
        onProjectPathChange?.(result.filePath);
        skipDirtyRef.current = 2;
        isDirtyRef.current = false;
        onDirtyChange?.(false);
        addNotification({ type: 'success', title: 'Project Loaded', message: result.name });
        setTimeout(() => fitView({ padding: 0.3, duration: 400 }), 100);
      }
    } catch (err) {
      logger.error('[Load] failed:', err);
      addNotification({ type: 'error', title: 'Load Failed', message: String(err) });
    }
  }, [setNodes, setEdges, addNotification, fitView, onTitleChange, onDirtyChange, onProjectPathChange]);

  // ── New Canvas — clear autosave and start fresh ───────────────────────
  const doNewCanvas = useCallback(() => {
    try {
      const key = tabId ? `${STORAGE_KEYS.BUILDER_AUTOSAVE}_${tabId}` : STORAGE_KEYS.BUILDER_AUTOSAVE;
      localStorage.removeItem(key);
    } catch {}
    resetFilePath();
    setCurrentFilePathState(null);
    onProjectPathChange?.(null);
    setNodes([]);
    setEdges([]);
    setSelectedNodeId(null);
    setSelectedNode({ id: null, type: null, image: undefined, prompt: undefined, state: undefined });
    skipDirtyRef.current = 2;
    onDirtyChange?.(false);
    isDirtyRef.current = false;
    setTimeout(() => {
      createSourceNode();
      setTimeout(() => fitView({ padding: 0.8, duration: 400 }), 100);
    }, 30);
  }, [setNodes, setEdges, setSelectedNodeId, setSelectedNode, createSourceNode, fitView, onDirtyChange, tabId, onProjectPathChange]);

  const handleNewCanvas = useCallback(() => {
    if (isDirtyRef.current) {
      setConfirmNewCanvas(true);
    } else {
      doNewCanvas();
    }
  }, [doNewCanvas]);

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

  const handleContextAddSource = () => {
    const position = contextMenu?.canvasX !== undefined && contextMenu?.canvasY !== undefined
      ? { x: contextMenu.canvasX, y: contextMenu.canvasY }
      : undefined;
    createSourceNode(undefined, undefined, position);
  };

  const handleContextSpawnGhost = () => {
    const data = contextNode?.data as any;
    if (data?.onAddChild) data.onAddChild('render');
    else logger.warn('[Context Action] onAddChild not found on node:', contextNode?.id);
  };

  const handleContextRetryNode = () => {
    const data = contextNode?.data as any;
    if (data?.onRetry) data.onRetry();
    else logger.warn('[Context Action] onRetry not found on node:', contextNode?.id);
  };

  const handleContextDeleteNode = () => {
    const data = contextNode?.data as any;
    if (data?.type === 'source') { logger.warn('[Context Action] Cannot delete source node:', contextNode?.id); return; }
    if (contextNode) deleteNode(contextNode.id);
  };

  const handleContextCompare = (slot: 'A' | 'B') => {
    const data = contextNode?.data as any;
    const imageUrl = data?.image ?? data?.outputData?.image;
    if (imageUrl) {
      setCompareSlot(slot, imageUrl);
      setConfig(prev => ({ ...prev }));
    }
  };

  const handleContextSaveNodeImage = () => {
    const data = contextNode?.data as any;
    const imageUrl = data?.image ?? data?.outputData?.image;
    if (!imageUrl) return;
    const baseName = `${data?.type || 'node'}_${contextNode!.id}`;
    exportImageWithDialog(imageUrl, baseName)
      .then(filePath => filePath && addNotification({ type: 'success', title: 'Image Saved', message: `Saved to: ${filePath.split(/[\\/]/).pop()}` }))
      .catch(err => { logger.error('[Save Image] failed:', err); addNotification({ type: 'error', title: 'Save Failed', message: err?.message || 'Failed to save image' }); });
  };

  const handleContextExportDXF = () => {
    const data = contextNode?.data as any;
    const imageUrl = data?.image ?? data?.outputData?.image;
    if (!imageUrl) return;
    const baseName = `${data?.type || 'node'}_${contextNode!.id}`;
    exportImageToDXFWithDialog(imageUrl, baseName)
      .then(filePath => filePath && addNotification({ type: 'success', title: 'CAD File Saved', message: `Saved to: ${filePath.split(/[\\/]/).pop()}` }))
      .catch(err => { logger.error('[Export CAD] failed:', err); addNotification({ type: 'error', title: 'Export Failed', message: err?.message || 'Failed to export CAD file' }); });
  };

  // ── Analyze Floor Plan → CAD via local Image2CAD FastAPI server ────────────
  const handleContextAnalyzePlan = async () => {
    const data = contextNode?.data as any;
    const imageUrl: string = data?.image ?? data?.outputData?.image;
    if (!imageUrl) return;

    addNotification({ type: 'success', title: 'Analyzing Floor Plan...', message: 'Sending to Image2CAD engine, please wait.' });

    try {
      // 1. Resolve IndexedDB image cache (idb://) if needed
      let resolvedUrl = imageUrl;
      if (imageUrl.startsWith('idb://')) {
        const cached = await getLocalImage(imageUrl);
        if (!cached) throw new Error('Could not retrieve image from local database');
        resolvedUrl = cached;
      }

      // Convert to base64 if it is remote or local file path
      let base64Uri = resolvedUrl;
      if (!resolvedUrl.startsWith('data:')) {
        base64Uri = await urlToDataUri(resolvedUrl);
      }

      // 2. Call Tauri native Rust command to send the image to the local FastAPI server
      const responseText = await invoke<string>('analyze_floor_plan', { imageBase64: base64Uri });
      const result = JSON.parse(responseText);

      // 3. Show native save dialog and save the file via the ExportService helper
      const dxfUrl = `http://127.0.0.1:8000${result.dxf_url}`;
      const baseName = `floor_plan_${contextNode!.id}`;
      const filePath = await saveDXFFromServer(dxfUrl, baseName);

      if (!filePath) {
        addNotification({ type: 'info', title: 'Export Cancelled', message: 'CAD export was cancelled.' });
        return;
      }

      const { lines, circles } = result.entities ?? {};
      addNotification({
        type:    'success',
        title:   'Floor Plan → CAD Complete ✓',
        message: `Saved to: ${filePath.split(/[\\/]/).pop()} (Lines: ${lines ?? 0} Circles: ${circles ?? 0})`,
      });

    } catch (err: any) {
      logger.error('[Analyze Plan] failed:', err);
      addNotification({
        type:    'error',
        title:   'Analyze Plan Failed',
        message: err?.message || String(err) || 'Unknown error',
      });
    }
  };

  const handleContextExportAll = () => {
    const items = nodes
      .map(n => {
        const d = n.data as any;
        const url = d?.image ?? d?.outputData?.image;
        if (!url) return null;
        const item: { url: string; name: string; prompt?: string } = { url: String(url), name: `${d?.type || 'node'}_${n.id}` };
        if (d?.prompt) item.prompt = String(d.prompt);
        return item;
      })
      .filter((x): x is { url: string; name: string; prompt?: string } => x !== null);

    if (items.length === 0) {
      addNotification({ type: 'info', title: 'No Images', message: 'No images found on canvas.' });
      return;
    }
    exportImagesBatchWithDialog(items)
      .then(({ succeeded, failed }) => {
        if (succeeded > 0) addNotification({ type: 'success', title: 'Images Exported', message: `${succeeded} image(s) saved successfully` });
        if (failed > 0)    addNotification({ type: 'error',   title: 'Export Failed',   message: `${failed} image(s) failed to export` });
      })
      .catch(err => { logger.error('[Export All] error:', err); addNotification({ type: 'error', title: 'Export Error', message: String(err) }); });
  };

  const handleContextExportPDF = () => {
    exportNodesToPDFWithDialog(nodes, { title: 'Anarchy AI Canvas Export', author: 'Anarchy AI', subject: 'AI Generated Images from Canvas', includeMetadata: true })
      .then(filePath => filePath && addNotification({ type: 'success', title: 'PDF Exported', message: `Saved to: ${filePath.split(/[\\/]/).pop()}` }))
      .catch((err: any) => { logger.error('[PDF Export] failed:', err); addNotification({ type: 'error', title: 'PDF Export Failed', message: err?.message || 'Failed to export PDF' }); });
  };

  const handleContextOpenImagesFolder = async () => {
    const data = contextNode?.data as any;
    const imageUrl = data?.image ?? data?.outputData?.image;
    
    try {
      if (!imageUrl) {
        await invoke('open_images_folder');
        return;
      }

      // Resolve IndexedDB image cache (idb://) if needed
      let resolvedUrl = imageUrl;
      if (imageUrl.startsWith('idb://')) {
        const cached = await getLocalImage(imageUrl);
        if (!cached) throw new Error('Could not retrieve image from local database');
        resolvedUrl = cached;
      }

      // Convert to base64 if it is a remote or local file path
      let base64Uri = resolvedUrl;
      if (!resolvedUrl.startsWith('data:')) {
        base64Uri = await urlToDataUri(resolvedUrl);
      }

      // Determine extension and file name
      const ext = base64Uri.split(';')[0].split('/')[1] || 'png';
      const cleanExt = ext === 'jpeg' ? 'jpg' : ext;
      const fileName = `${data?.type || 'node'}_${contextNode!.id}.${cleanExt}`;

      // Save to standard Documents/Anarchy AI directory
      const filePath = await invoke<string>('save_image_to_documents', {
        dataUri: base64Uri,
        fileName
      });

      // Highlight the saved file in Windows Explorer / Finder
      await invoke('show_in_explorer', { path: filePath });

    } catch (err: any) {
      logger.error('[Open Images Folder] failed:', err);
      // Fallback: just open the folder
      invoke('open_images_folder').catch(() => {});
    }
  };

  const handleContextExportNodePDF = async () => {
    const data = contextNode?.data as any;
    const imageUrl = data?.image ?? data?.outputData?.image;
    if (!imageUrl) return;

    addNotification({ type: 'info', title: 'Exporting PDF...', message: 'Preparing PDF document, please wait.' });

    try {
      let resolvedUrl = imageUrl;
      if (imageUrl.startsWith('idb://')) {
        const cached = await getLocalImage(imageUrl);
        if (!cached) throw new Error('Could not retrieve image from local database');
        resolvedUrl = cached;
      }

      const baseName = `${data?.type || 'node'}_${contextNode!.id}`;
      const item = {
        url: resolvedUrl,
        name: baseName,
        prompt: data?.prompt ? String(data.prompt) : undefined
      };

      const filePath = await exportImagesToPDFWithDialog([item], {
        title: `Anarchy AI Export - ${baseName}`,
        author: 'Anarchy AI',
        subject: 'AI Generated Image',
        includeMetadata: true
      });

      if (filePath) {
        addNotification({
          type: 'success',
          title: 'PDF Exported ✓',
          message: `Saved to: ${filePath.split(/[\\/]/).pop()}`
        });
      }
    } catch (err: any) {
      logger.error('[Node PDF Export] failed:', err);
      addNotification({
        type: 'error',
        title: 'PDF Export Failed',
        message: err?.message || String(err) || 'Failed to export PDF'
      });
    }
  };

  type ContextAction = 
    | 'add-source' | 'rearrange' | 'spawn-ghost' | 'retry-node' | 'delete-node' 
    | 'compare-a' | 'compare-b' | 'save-node-image' | 'export-dxf' | 'analyze-plan' 
    | 'export-all' | 'export-pdf' | 'save-project' | 'load-project'
    | 'open-images-folder' | 'export-node-pdf';

  const runContextAction = (action: ContextAction) => {
    logger.log('[Context Action]', action, 'contextNode:', contextNode?.id);
    const actionMap: Record<ContextAction, () => void> = {
      'add-source':     handleContextAddSource,
      'rearrange':      handleRearrange,
      'spawn-ghost':    handleContextSpawnGhost,
      'retry-node':     handleContextRetryNode,
      'delete-node':    handleContextDeleteNode,
      'compare-a':      () => handleContextCompare('A'),
      'compare-b':      () => handleContextCompare('B'),
      'save-node-image': handleContextSaveNodeImage,
      'export-dxf':     handleContextExportDXF,
      'analyze-plan':   handleContextAnalyzePlan,
      'export-all':     handleContextExportAll,
      'export-pdf':     handleContextExportPDF,
      'save-project':   handleSave,
      'load-project':   handleLoad,
      'open-images-folder': handleContextOpenImagesFolder,
      'export-node-pdf': handleContextExportNodePDF,
    };
    actionMap[action]?.();
    setContextMenu(null);
  };


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
    <div className="builder-page">
      <div
        className="canvas-container"
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
            onMoveEnd={saveBuilderViewport}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
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
            {nodesWithCallbacks.length > 0 && nodesWithCallbacks.every(n => 
              typeof n.position?.x === 'number' && !Number.isNaN(n.position.x) &&
              typeof n.position?.y === 'number' && !Number.isNaN(n.position.y)
            ) && (
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
            onGenerate={handleGenerate}
            onExportAll={() => runContextAction('export-all')}
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
