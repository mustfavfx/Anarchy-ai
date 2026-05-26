import React, { useCallback, useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  type Node,
  useReactFlow,
  ReactFlowProvider,
  ConnectionLineType,
  SelectionMode,
} from '@xyflow/react';
import { 
  Search, Plus, GitBranch,
  Sparkles,
  LayoutGrid,
  SplitSquareHorizontal,
  Download,
  FolderDown,
  Save,
  FolderOpen,
  BookOpen,
  Camera, Building, Moon, Lightbulb, Sun, Sunset, SunDim, Palette,
  CloudRain, Leaf, Snowflake, CloudFog, SunMedium,
  Focus, PersonStanding, Cat,
  Users, Footprints, Car, Zap, Bird,
  Flower2, Sprout, TreePine,
  Plane, MoveRight, ArrowDownFromLine, RotateCcw, RotateCw,
  SwatchBook, PanelTop, Ruler, Scissors, Box, PenLine, Hexagon,
  HardHat, Trash2, Maximize2,
  Copy, Clipboard as ClipboardIcon, X,
  Clapperboard, Gem, BookImage, CircleDashed,
  type LucideIcon
} from 'lucide-react';
import '@xyflow/react/dist/style.css';
import { BaseNode } from './BaseNode';
import { GhostNode } from './GhostNode';
import { useBuilderWorkflow, type ProcessingType } from './useBuilderWorkflow';
import { useAIConfigStore } from '../../stores/aiConfigStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { exportImageWithDialog, exportImagesBatchWithDialog, exportNodesToPDFWithDialog } from '../../services/export';
import { saveWorkflow, saveWorkflowAs, loadWorkflow } from '../../services/workflow';
import { PRESET_PROMPTS } from './presetPrompts';
import { invoke } from '@tauri-apps/api/core';
import { STORAGE_KEYS, SESSION_KEYS } from '../../utils/storageKeys';
import { useAuth } from '../auth/AuthContext';
import { checkCreditBalance, deductCredits, GENERATION_COST, DEV_MODE } from '../../services/credit/creditService';
import { ConfirmModal } from '../../components/ConfirmModal';
import './BuilderPage.css';

// Lucide icon map for preset prompts
const PRESET_ICON_MAP: Record<string, LucideIcon> = {
  Camera, Sparkles, Building, HardHat,
  Moon, Lightbulb, Sun, Sunset, SunDim, Palette,
  CloudRain, Leaf, Snowflake, CloudFog, SunMedium,
  Search, Focus, PersonStanding, Cat,
  Users, Footprints, Car, Zap, Bird,
  Flower2, Sprout, TreePine,
  Plane, MoveRight, ArrowDownFromLine, RotateCcw,
  SwatchBook, PanelTop, Ruler, Scissors, Box, PenLine, Hexagon,
  Clapperboard, Gem, BookImage, CircleDashed,
};

// Separate node types for proper handle positioning
const nodeTypes = {
  baseNode: BaseNode,      // Source and Result nodes
  ghostNode: GhostNode,    // Ghost/Processing nodes with multiple inputs
};

const BUILDER_AUTOSAVE_KEY = STORAGE_KEYS.BUILDER_AUTOSAVE;

// Props for multi-tab support
interface BuilderContentProps {
  tabId?: string;
  projectPath?: string | null;
  onTitleChange?: (title: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

// Inner component that uses React Flow hooks (must be inside ReactFlowProvider)
export const BuilderContent: React.FC<BuilderContentProps> = ({ 
  tabId,
  projectPath: initialProjectPath,
  onTitleChange,
  onDirtyChange,
}) => {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    selectedNodeId,
    setSelectedNodeId,
    updateNodeData,
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

  const getConfig = useAIConfigStore((state) => state.getConfig);
  const setSelectedNode = useAIConfigStore((state) => state.setSelectedNode);
  const setCompareSlot = useAIConfigStore((state) => state.setCompareSlot);
  const setConfig = useAIConfigStore((state) => state.setConfig);
  const isEnlargedView = useAIConfigStore((state) => state.isEnlargedView);
  const setWorkflowSnapshot = useAIConfigStore((state) => state.setWorkflowSnapshot);
  const setFocusNodeFn = useAIConfigStore((state) => state.setFocusNodeFn);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const { user: authUser } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: 'canvas' | 'node' | 'prompt';
    nodeId?: string;
  } | null>(null);
  const [creditError, setCreditError] = useState<{ balance: number; needed: number } | null>(null);
  const [confirmNewCanvas, setConfirmNewCanvas] = useState(false);
  const isDirtyRef = useRef(false);
  const [copiedNode, setCopiedNode] = useState<any>(null);
  const isTauriRef = useRef(false);
  const dropHandledRef = useRef(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({ visibility: 'hidden' });

  useLayoutEffect(() => {
    if (!contextMenu) {
      setMenuStyle({ visibility: 'hidden' });
      return;
    }
    if (!contextMenuRef.current) return;
    const el = contextMenuRef.current;
    const menuW = el.offsetWidth;
    const menuH = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8;
    let left = contextMenu.x;
    let top = contextMenu.y;
    if (left + menuW + margin > vw) left = Math.max(margin, left - menuW);
    if (top + menuH + margin > vh) top = Math.max(margin, vh - menuH - margin);
    setMenuStyle({ left, top, visibility: 'visible' });
  }, [contextMenu]);
  const { fitView, getViewport, fitBounds, getNode: getRFNode } = useReactFlow();

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

      // Scale down to thumbnail size (max 300px width)
      const maxWidth = 300;
      const scale = Math.min(maxWidth / canvas.width, 1);
      const thumbWidth = Math.round(canvas.width * scale);
      const thumbHeight = Math.round(canvas.height * scale);

      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = thumbWidth;
      thumbCanvas.height = thumbHeight;
      const ctx = thumbCanvas.getContext('2d');
      if (!ctx) return undefined;

      ctx.drawImage(canvas, 0, 0, thumbWidth, thumbHeight);
      return thumbCanvas.toDataURL('image/jpeg', 0.85);
    } catch (err) {
      console.warn('[Thumbnail] Generation failed:', err);
      return undefined;
    }
  }, []);

  // Helper to convert DOM element to canvas
  const htmlToCanvas = (element: HTMLElement): Promise<HTMLCanvasElement | null> => {
    return new Promise((resolve) => {
      try {
        const rect = element.getBoundingClientRect();
        const canvas = document.createElement('canvas');
        canvas.width = rect.width;
        canvas.height = rect.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(null); return; }

        // Fill background
        ctx.fillStyle = '#0f0f0f';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Get all nodes as images
        const nodes = element.querySelectorAll('.react-flow__node');
        const promises: Promise<void>[] = [];

        nodes.forEach((node) => {
          const htmlNode = node as HTMLElement;
          const nodeRect = htmlNode.getBoundingClientRect();
          const img = htmlNode.querySelector('img');
          if (img && img.complete) {
            const promise = new Promise<void>((res) => {
              try {
                const x = nodeRect.left - rect.left;
                const y = nodeRect.top - rect.top;
                ctx.drawImage(img, x, y, nodeRect.width, nodeRect.height);
              } catch {}
              res();
            });
            promises.push(promise);
          }
        });

        Promise.all(promises).then(() => resolve(canvas));
      } catch {
        resolve(null);
      }
    });
  };

  // Close presets popup on outside click
  useEffect(() => {
    if (!showPresets) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.prompt-presets-wrapper')) {
        setShowPresets(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showPresets]);

  const location = useLocation();

  // Re-check sessionStorage on every navigation to /builder (component stays mounted)
  useEffect(() => {
    if (location.pathname !== '/builder') return;

    const preset = sessionStorage.getItem(SESSION_KEYS.PRESET_PROMPT);
    if (preset) {
      sessionStorage.removeItem(SESSION_KEYS.PRESET_PROMPT);
      setPrompt(preset);
    }

    const img = sessionStorage.getItem(SESSION_KEYS.PRESET_IMAGE);
    const hasWorkflow = sessionStorage.getItem(SESSION_KEYS.LOADED_WORKFLOW);
    
    // Only create source node from preset image if no workflow is being loaded
    if (img && !hasWorkflow) {
      sessionStorage.removeItem(SESSION_KEYS.PRESET_IMAGE);
      const nodeId = createSourceNode(img);
      setSelectedNodeId(nodeId);
      setSelectedNode({ id: nodeId, type: 'source', image: img, prompt: undefined, state: 'ready' });
    }
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-load project if provided via props (once) or sessionStorage (on every navigation)
  useEffect(() => {
    const pathToLoad = initialProjectPath || sessionStorage.getItem(SESSION_KEYS.OPEN_PROJECT_PATH);
    const rawWorkflow = sessionStorage.getItem(SESSION_KEYS.LOADED_WORKFLOW);

    if (pathToLoad) {
      sessionStorage.removeItem(SESSION_KEYS.OPEN_PROJECT_PATH);
      (async () => {
        try {
          const contents: string = await invoke('load_file', { path: pathToLoad });
          const wf = JSON.parse(contents);
          if (wf.nodes) {
            setNodes(wf.nodes.map((n: any) => ({ id: n.id, type: n.type, position: n.position, data: n.data })));
            setEdges(wf.edges.map((e: any) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle, type: e.type, animated: e.animated, style: e.style, data: e.data })));
            const name = wf.name || pathToLoad.split(/[\\/]/).pop()?.replace(/\.ana$/i, '') || 'Project';
            onTitleChange?.(name);
            skipDirtyRef.current = 2;
            onDirtyChange?.(false);
            setTimeout(() => fitView({ padding: 0.3, duration: 400 }), 200);
            addNotification({ type: 'success', title: 'Project Loaded', message: name });
          }
        } catch (err) {
          console.error('[Builder] Auto-load failed:', err);
          addNotification({ type: 'error', title: 'Load Failed', message: String(err) });
        }
      })();
    } else if (rawWorkflow) {
      sessionStorage.removeItem(SESSION_KEYS.LOADED_WORKFLOW);
      try {
        const wf = JSON.parse(rawWorkflow);
        if (wf.nodes) {
          setNodes(wf.nodes.map((n: any) => ({ id: n.id, type: n.type, position: n.position, data: n.data })));
          setEdges(wf.edges.map((e: any) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle, type: e.type, animated: e.animated, style: e.style, data: e.data })));
          const name = wf.name || 'Imported Project';
          onTitleChange?.(name);
          skipDirtyRef.current = 2;
          onDirtyChange?.(false);
          setTimeout(() => fitView({ padding: 0.3, duration: 400 }), 200);
          addNotification({ type: 'success', title: 'Project Loaded', message: name });
        }
      } catch (err) {
        console.error('[Builder] LOADED_WORKFLOW parse failed:', err);
      }
    }
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync nodes/edges snapshot for Sidebar mini-map
  useEffect(() => {
    setWorkflowSnapshot({ nodes, edges });
  }, [nodes, edges, setWorkflowSnapshot]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    import('@tauri-apps/api/event').then(({ listen }) => {
      if (cancelled) return;

      listen<{ image: string; source: string }>('anarchy://external-image', (event) => {
        const image = event.payload?.image;
        if (!image) return;

        // Map source identifier to a human-readable node label
        const SOURCE_LABELS: Record<string, string> = {
          autocad: 'AutoCAD',
          revit: 'Revit',
          '3dsmax': '3ds Max',
          max: '3ds Max',
          rhino: 'Rhino',
          sketchup: 'SketchUp',
        };
        const rawSource = (event.payload?.source || '').toLowerCase();
        const nodeLabel = SOURCE_LABELS[rawSource] || (rawSource ? rawSource.charAt(0).toUpperCase() + rawSource.slice(1) : 'External');

        const sourceId = createSourceNode(image, nodeLabel);
        setSelectedNodeId(sourceId);
        setSelectedNode({
          id: sourceId,
          type: 'source',
          image,
          prompt: undefined,
          state: 'ready',
        });

        setTimeout(() => {
          setNodes(currentNodes => currentNodes.map(sourceNode => (
            sourceNode.id === sourceId
              ? {
                  ...sourceNode,
                  position: {
                    x: 120,
                    y: 260 + currentNodes.filter(n => (n.data as any)?.type === 'source').length * 40,
                  },
                }
              : sourceNode
          )));
          fitView({ padding: 0.3, duration: 400 });
        }, 0);
      }).then((dispose) => {
        unlisten = dispose;
      });
    }).catch((error) => {
      console.warn('[3ds Max Bridge] Tauri event listener unavailable:', error);
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [createSourceNode, fitView, setNodes, setSelectedNode, setSelectedNodeId]);

  // Viewport restore removed — always start fresh

  // Sync selected node to AIConfigContext for Preview Panel
  useEffect(() => {
    console.log('[BuilderPage] selectedNodeId changed:', selectedNodeId);
    if (selectedNodeId) {
      const node = nodes.find(n => n.id === selectedNodeId);
      if (node) {
        const data = node.data as any;
        console.log('[BuilderPage] Updating selectedNode to:', node.id, 'image:', (data?.image || data?.outputData?.image)?.slice(0, 50));
        setSelectedNode({
          id: node.id,
          type: data?.type || null,
          image: data?.image || data?.outputData?.image,
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
          prompt: data?.prompt,
          state: data?.state,
        });
      } else {
        setSelectedNode({ id: null, type: null, image: undefined, prompt: undefined, state: undefined });
      }
    }
  }, [selectedNodeId, nodes, setSelectedNode]);
  const hasFittedInitially = useRef(false);
  const hasCreatedSource = useRef(false);
  const createSourceNodeRef = useRef(createSourceNode);
  useEffect(() => { createSourceNodeRef.current = createSourceNode; }, [createSourceNode]);

  // Initial setup: wait for restore to complete, then add Source node only if canvas is empty
  useEffect(() => {
    if (!isRestored) return;
    if (hasCreatedSource.current) return;
    hasCreatedSource.current = true;
    // Defer 50ms so React flushes any pending setNodes from localStorage restore
    setTimeout(() => {
      setNodes(current => {
        if (current.length === 0) {
          // Schedule outside of setNodes updater to avoid nested state updates
          setTimeout(() => createSourceNodeRef.current(), 0);
        }
        return current;
      });
    }, 50);
  }, [isRestored]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dirty state: notify parent when canvas changes after initial restore
  // skipDirtyRef > 0 means the next N node/edge changes should be ignored (restore, load, save)
  const skipDirtyRef = useRef(2); // skip initial restore triggers
  useEffect(() => {
    if (!isRestored) return;
    if (skipDirtyRef.current > 0) { skipDirtyRef.current--; return; }
    isDirtyRef.current = true;
    onDirtyChange?.(true);
  }, [nodes, edges]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fit view when nodes change significantly - zoom out to show more space
  useEffect(() => {
    if (nodes.length > 0 && !hasFittedInitially.current) {
      setTimeout(() => {
        fitView({ padding: 0.8, duration: 400 });
        hasFittedInitially.current = true;
      }, 100);
    }
  }, [nodes.length, fitView]);

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
      });

      // History logging now happens inside useBuilderWorkflow where fresh image is available
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Generation failed';
      addNotification({
        type: 'error',
        title: 'Generation Failed',
        message: errorMsg,
        nodeId,
      });
      throw error;
    }
  }, [executeNode, nodes, addNotification]);

  // Bind callbacks to nodes
  const nodesWithCallbacks = useMemo(() => {
    return nodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        onAddChild: (processingType: ProcessingType) => addChildNode(node.id, processingType),
        onImageUpload: node.data.type === 'source' 
          ? (url: string) => {
              updateNodeData(node.id, {
                image: url,
                state: url ? 'ready' : 'idle',
                outputData: url ? {
                  image: url,
                  prompt: undefined,
                  metadata: {
                    timestamp: Date.now(),
                    operationType: 'source',
                  },
                } : undefined,
              });
            }
          : undefined,
        onImagesUpload: node.data.type === 'source'
          ? (urls: string[]) => {
              if (!urls.length) return;

              updateNodeData(node.id, {
                image: urls[0],
                state: 'ready',
                outputData: {
                  image: urls[0],
                  prompt: undefined,
                  metadata: {
                    timestamp: Date.now(),
                    operationType: 'source',
                  },
                },
              });

              urls.slice(1).forEach((url, index) => {
                const sourceId = createSourceNode(url);
                setTimeout(() => {
                  setNodes(currentNodes => currentNodes.map(sourceNode => (
                    sourceNode.id === sourceId
                      ? {
                          ...sourceNode,
                          position: {
                            x: node.position.x,
                            y: node.position.y + 170 * (index + 1),
                          },
                        }
                      : sourceNode
                  )));
                }, 0);
              });

              setSelectedNode({
                id: node.id,
                type: 'source',
                image: urls[0],
                prompt: undefined,
                state: 'ready',
              });
            }
          : undefined,
        onDelete: node.data.type !== 'source' 
          ? () => deleteNode(node.id)
          : undefined,
        onRetry: (node.data.state === 'error' && node.data.type === 'ghost')
          ? () => {
              const storedPrompt = (node.data as any).prompt;
              const storedConfig = (node.data as any).config;
              if (!storedPrompt) return;
              // Reset to idle then re-execute
              updateNodeData(node.id, { state: 'idle', errorMessage: undefined });
              setTimeout(() => {
                executeWithNotifications(node.id, storedPrompt, storedConfig).catch(() => {});
              }, 50);
            }
          : undefined,
      }
    }));
  }, [nodes, addChildNode, updateNodeData, deleteNode, executeWithNotifications, selectedNodeId]);

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (event.button !== 0) return;
    setContextMenu(null);
    console.log('[BuilderPage] onNodeClick:', node.id);
    setSelectedNodeId(node.id);
  }, [setSelectedNodeId]);

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
        now - (node.data.createdAt as number) < 3000
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
    setContextMenu({
      x: (event as MouseEvent).clientX ?? (event as React.MouseEvent).clientX,
      y: (event as MouseEvent).clientY ?? (event as React.MouseEvent).clientY,
      type: 'canvas',
    });
  }, [setSelectedNodeId]);

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

  useEffect(() => {
    if (!contextMenu) return;

    const handleMouseDown = (e: MouseEvent) => {
      // Only close on left-click (button 0) AND if click is outside the menu
      if (e.button !== 0) return;
      
      // Check if click is inside the menu
      const menuEl = contextMenuRef.current;
      if (menuEl && e.target instanceof Node && menuEl.contains(e.target)) {
        // Click is inside menu, don't close
        return;
      }
      
      // Click is outside menu, close it
      setContextMenu(null);
    };
    
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };

    // Add listener immediately (no delay)
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('keydown', handleEsc);

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [contextMenu]);

  // Copy/Paste functionality
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Copy node (Ctrl+C)
      if (e.ctrlKey && e.key === 'c' && selectedNodeId) {
        const node = nodes.find(n => n.id === selectedNodeId);
        if (node && (node.data as any)?.image) {
          setCopiedNode({
            type: node.data.type,
            image: (node.data as any).image,
            prompt: (node.data as any).prompt
          });
          addNotification({ type: 'success', title: 'Node Copied', message: 'Press Ctrl+V to paste' });
        }
      }
      
      // Paste node (Ctrl+V)
      if (e.ctrlKey && e.key === 'v' && copiedNode) {
        const newNodeId = createSourceNode(copiedNode.image);
        if (copiedNode.prompt) {
          updateNodeData(newNodeId, { prompt: copiedNode.prompt });
        }
        addNotification({ type: 'success', title: 'Node Pasted', message: 'Image copied to canvas' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, nodes, copiedNode, createSourceNode, updateNodeData, addNotification]);

  const handleGenerate = async () => {
    // Check credit balance before generating (skip in DEV_MODE)
    const cost = GENERATION_COST.standard;
    if (authUser?.id && !DEV_MODE) {
      const creditCheck = await checkCreditBalance(authUser.id, cost);
      if (!creditCheck.hasEnough) {
        setCreditError({ balance: creditCheck.balance, needed: creditCheck.needed });
        return;
      }
    }

    const aiConfig = getConfig();
    const isUpscaler = aiConfig.selectedTool === 'image-upscaler';
    const hasUpscaleFactor = aiConfig.upscaleFactor && aiConfig.upscaleFactor > 1;

    if (!prompt.trim() && !(isUpscaler && hasUpscaleFactor)) return;
    const genConfig = {
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
      // Pruna AI settings
      prunaMode: aiConfig.prunaMode,
      prunaTarget: aiConfig.prunaTarget,
      prunaFactor: aiConfig.prunaFactor,
      prunaEnhanceDetails: aiConfig.prunaEnhanceDetails,
      prunaEnhanceRealism: aiConfig.prunaEnhanceRealism,
      prunaQuality: aiConfig.prunaQuality,
      prunaOutputFormat: aiConfig.prunaOutputFormat,
    };
    
    const idleGhosts = nodes.filter(n => {
      const d = n.data as any;
      return d.type === 'ghost' && d.state === 'idle';
    });
    
    // Deduct credits for each generation
    const ghostCount = idleGhosts.length > 0 ? idleGhosts.length : 1;
    const totalCost = cost * ghostCount;

    // Deduct credits (skip in DEV_MODE)
    if (authUser?.id && !DEV_MODE) {
      const deduct = await deductCredits(authUser.id, totalCost, `Generation: ${prompt.slice(0, 30)}...`);
      if (!deduct.success) {
        addNotification({ type: 'error', title: 'فشل الخصم', message: deduct.error || 'رصيد غير كافٍ' });
        return;
      }
      // Credit deducted successfully
    }

    if (idleGhosts.length > 0) {
      // Execute existing idle ghost nodes
      idleGhosts.forEach(g => {
        executeWithNotifications(g.id, prompt, genConfig).catch(() => {});
      });
      setPrompt('');
    } else {
      // Find existing source/result nodes to spawn ghost from
      const existingParent = nodes.find(n => {
        const d = n.data as any;
        return (d.type === 'source' || d.type === 'result') && !!d.image;
      }) || nodes.find(n => (n.data as any)?.type === 'source');

      const parentId = existingParent ? existingParent.id : createSourceNode();

      setTimeout(() => {
        const ghostId = spawnGhostNode(parentId, 'render');
        if (ghostId) {
          setTimeout(() => {
            executeWithNotifications(ghostId, prompt, genConfig).catch(() => {});
            setPrompt('');
          }, 50);
        }
      }, 50);
    }
  };

  const handleRearrange = () => {
    rearrangeNodes();
    setTimeout(() => fitView({ padding: 0.2, duration: 500 }), 100);
  };

  const saveBuilderViewport = useCallback(() => {
    try {
      const saved = localStorage.getItem(BUILDER_AUTOSAVE_KEY);
      const data = saved ? JSON.parse(saved) : {};
      localStorage.setItem(BUILDER_AUTOSAVE_KEY, JSON.stringify({
        ...data,
        nodes,
        edges,
        viewport: getViewport(),
      }));
    } catch {
      // Silent fail
    }
  }, [nodes, edges, getViewport]);

  const contextNode = contextMenu?.type === 'node'
    ? nodesWithCallbacks.find(n => n.id === contextMenu.nodeId)
    : undefined;

  const canSpawnFromContextNode = !!(
    contextNode &&
    (((contextNode.data as any)?.type === 'source') || ((contextNode.data as any)?.type === 'result'))
  );

  const canRetryContextNode = !!(
    contextNode &&
    (contextNode.data as any)?.type === 'ghost' &&
    (contextNode.data as any)?.state === 'error'
  );

  const canDeleteContextNode = !!(
    contextNode &&
    (contextNode.data as any)?.type !== 'source'
  );

  // ── Save / Load handlers ──────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    try {
      const thumbnail = await generateThumbnail();
      const path = await saveWorkflow(nodes, edges, { thumbnail });
      if (path) {
        const name = path.split(/[\\/]/).pop()?.replace(/\.ana$/i, '') || 'Saved';
        addNotification({ type: 'success', title: 'Project Saved', message: name });
        onTitleChange?.(name);
        skipDirtyRef.current = 1;
        isDirtyRef.current = false;
        onDirtyChange?.(false);
      }
    } catch (err) {
      console.error('[Save] failed:', err);
      addNotification({ type: 'error', title: 'Save Failed', message: String(err) });
    }
  }, [nodes, edges, addNotification, generateThumbnail, onTitleChange, onDirtyChange]);

  const handleSaveAs = useCallback(async () => {
    try {
      const thumbnail = await generateThumbnail();
      const path = await saveWorkflowAs(nodes, edges, undefined, thumbnail);
      if (path) {
        const name = path.split(/[\\/]/).pop()?.replace(/\.ana$/i, '') || 'Saved';
        addNotification({ type: 'success', title: 'Project Saved', message: name });
        onTitleChange?.(name);
        skipDirtyRef.current = 1;
        isDirtyRef.current = false;
        onDirtyChange?.(false);
      }
    } catch (err) {
      console.error('[Save As] failed:', err);
      addNotification({ type: 'error', title: 'Save Failed', message: String(err) });
    }
  }, [nodes, edges, addNotification, generateThumbnail, onTitleChange, onDirtyChange]);

  const handleLoad = useCallback(async () => {
    try {
      const result = await loadWorkflow();
      if (result) {
        setNodes(result.nodes);
        setEdges(result.edges);
        onTitleChange?.(result.name);
        skipDirtyRef.current = 2;
        isDirtyRef.current = false;
        onDirtyChange?.(false);
        addNotification({ type: 'success', title: 'Project Loaded', message: result.name });
        setTimeout(() => fitView({ padding: 0.3, duration: 400 }), 100);
      }
    } catch (err) {
      console.error('[Load] failed:', err);
      addNotification({ type: 'error', title: 'Load Failed', message: String(err) });
    }
  }, [setNodes, setEdges, addNotification, fitView, onTitleChange, onDirtyChange]);

  // ── New Canvas — clear autosave and start fresh ───────────────────────
  const doNewCanvas = useCallback(() => {
    try { localStorage.removeItem(BUILDER_AUTOSAVE_KEY); } catch {}
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
  }, [setNodes, setEdges, setSelectedNodeId, setSelectedNode, createSourceNode, fitView, onDirtyChange]);

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

  const spawnFromImage = useCallback(async (dataUrl: string) => {
    console.log('[Spawn From Image] Creating source node with image');
    const nodeId = createSourceNode(dataUrl);
    
    // Position the new node better
    setTimeout(() => {
      setNodes(currentNodes => currentNodes.map(node => 
        node.id === nodeId 
          ? { 
              ...node, 
              position: {
                x: 120,
                y: 200 + currentNodes.filter(n => (n.data as any)?.type === 'source').length * 80
              }
            }
          : node
      ));
    }, 50);
    
    setSelectedNodeId(nodeId);
    setSelectedNode({ id: nodeId, type: 'source', image: dataUrl, prompt: undefined, state: 'ready' });
    
    setTimeout(() => {
      fitView({ padding: 0.3, duration: 400 });
    }, 200);
    
    console.log('[Spawn From Image] Source node created successfully:', nodeId);
  }, [createSourceNode, setSelectedNodeId, setSelectedNode, fitView, setNodes]);

  // ── Drag & Drop image onto canvas ──────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
      // Only set overlay state in non-Tauri (web) mode
      if (!isTauriRef.current) setIsDraggingFile(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as HTMLElement)) {
      setIsDraggingFile(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
    // Skip if already handled by Tauri native handler
    if (dropHandledRef.current) return;
    // Also skip in Tauri env to let native handler work
    const isTauriEnv = isTauriRef.current || (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window);
    if (isTauriEnv) return;
    const imageFiles = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    for (const file of imageFiles.slice(0, 5)) {
      try {
        const dataUrl = await imageFileToDataUrl(file);
        await spawnFromImage(dataUrl);
      } catch (error) {
        console.error('[Drag & Drop] Error processing file:', error);
      }
    }
  }, [imageFileToDataUrl, spawnFromImage]);

  // ── Native file drop via Tauri's drag-drop API ──────────────────────────
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    // Detect Tauri synchronously via window object to block HTML5 drop immediately
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      isTauriRef.current = true;
    }

    const setupTauriDrop = async () => {
      try {
        const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
        const appWindow = getCurrentWebviewWindow();
        isTauriRef.current = true;
        unlisten = await appWindow.onDragDropEvent(async (event) => {
          const type = event.payload.type;
          if (type === 'over' || type === 'enter') {
            setIsDraggingFile(true);
          } else if (type === 'leave') {
            setIsDraggingFile(false);
          } else if (type === 'drop') {
            if (dropHandledRef.current) return;
            dropHandledRef.current = true;
            setIsDraggingFile(false);
            const paths: string[] = (event.payload as any).paths ?? [];
            const imageExts = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tiff'];
            for (const filePath of paths.slice(0, 5)) {
              const lower = filePath.toLowerCase();
              if (!imageExts.some(ext => lower.endsWith(ext))) continue;
              try {
                const { invoke } = await import('@tauri-apps/api/core');
                const dataUrl = await invoke<string>('read_local_image', { path: filePath });
                await spawnFromImage(dataUrl);
              } catch (err) {
                console.error('[Tauri Drop] Failed to read file:', filePath, err);
              }
            }
            setTimeout(() => { dropHandledRef.current = false; }, 500);
          }
        });
      } catch {
        // Fallback: Tauri API not available (dev mode web), use HTML5 events
        const handleWindowDragOver = (e: DragEvent) => { e.preventDefault(); };
        const handleWindowDrop = async (e: DragEvent) => {
          e.preventDefault();
          setIsDraggingFile(false);
          if (!e.dataTransfer) return;
          const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
          for (const file of files.slice(0, 5)) {
            try {
              const dataUrl = await imageFileToDataUrl(file);
              await spawnFromImage(dataUrl);
            } catch { /* skip */ }
          }
        };
        window.addEventListener('dragover', handleWindowDragOver);
        window.addEventListener('drop', handleWindowDrop);
        unlisten = () => {
          window.removeEventListener('dragover', handleWindowDragOver);
          window.removeEventListener('drop', handleWindowDrop);
        };
      }
    };

    setupTauriDrop();
    return () => { unlisten?.(); };
  }, [spawnFromImage, imageFileToDataUrl]);

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
      const nodeId = nodeEl?.getAttribute('data-id') ?? undefined;
      if (nodeId) setSelectedNodeId(nodeId);
      setContextMenu({
        x: me.clientX,
        y: me.clientY,
        type: nodeId ? 'node' : 'canvas',
        ...(nodeId ? { nodeId } : {}),
      });
    };

    window.addEventListener('contextmenu', handleWindowContextMenu, true);
    return () => window.removeEventListener('contextmenu', handleWindowContextMenu, true);
  }, [setSelectedNodeId]);

  // ── Keyboard shortcuts (Ctrl+S, Ctrl+Shift+S, Ctrl+O, Ctrl+V) ───────
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' ||
          (e.target as HTMLElement).tagName === 'TEXTAREA') return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        handleNewCanvas();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        if (canRedo) redo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (e.shiftKey) handleSaveAs(); else handleSave();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        handleLoad();
      }
      // Ctrl+V → paste image from clipboard
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        const isTauri = isTauriRef.current || (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window);
        if (isTauri) {
          try {
            console.log('[Paste] Trying Tauri clipboard...');
            const dataUrl = await invoke('read_clipboard_image') as string;
            console.log('[Paste] Got image from Tauri clipboard');
            await spawnFromImage(dataUrl);
            return;
          } catch (err) {
            console.log('[Paste] No image in Tauri clipboard:', err);
          }
        }
        // Web fallback: use Web Clipboard API
        try {
          console.log('[Paste] Trying Web Clipboard API...');
          const items = await navigator.clipboard.read();
          for (const item of items) {
            const imgType = item.types.find(t => t.startsWith('image/'));
            if (imgType) {
              const blob = await item.getType(imgType);
              const dataUrl = await imageFileToDataUrl(new File([blob], 'paste.png', { type: imgType }));
              console.log('[Paste] Got image from Web Clipboard');
              await spawnFromImage(dataUrl);
              break;
            }
          }
        } catch (err) {
          console.log('[Paste] Web Clipboard failed:', err);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, handleSaveAs, handleLoad, handleNewCanvas, imageFileToDataUrl, spawnFromImage, undo, redo, canUndo, canRedo]);

  const runContextAction = (action: 'add-source' | 'rearrange' | 'spawn-ghost' | 'retry-node' | 'delete-node' | 'compare-a' | 'compare-b' | 'save-node-image' | 'export-all' | 'export-pdf' | 'save-project' | 'load-project') => {
    console.log('[Context Action]', action, 'contextNode:', contextNode?.id);
    
    if (action === 'add-source') {
      console.log('[Context Action] Creating source node...');
      const nodeId = createSourceNode();
      console.log('[Context Action] Source node created:', nodeId);
    }

    if (action === 'rearrange') {
      console.log('[Context Action] Rearranging graph...');
      handleRearrange();
    }

    if (action === 'spawn-ghost' && contextNode) {
      const data = contextNode.data as any;
      console.log('[Context Action] Spawning ghost from node:', contextNode.id, 'onAddChild:', !!data?.onAddChild);
      if (data?.onAddChild) {
        data.onAddChild('render');
      } else {
        console.warn('[Context Action] onAddChild not found on node:', contextNode.id);
      }
    }

    if (action === 'retry-node' && contextNode) {
      const data = contextNode.data as any;
      console.log('[Context Action] Retrying node:', contextNode.id, 'onRetry:', !!data?.onRetry);
      if (data?.onRetry) {
        data.onRetry();
      } else {
        console.warn('[Context Action] onRetry not found on node:', contextNode.id);
      }
    }

    if (action === 'delete-node' && contextNode) {
      const data = contextNode.data as any;
      console.log('[Context Action] Deleting node:', contextNode.id, 'type:', data?.type);
      if (data?.type !== 'source') {
        deleteNode(contextNode.id);
      } else {
        console.warn('[Context Action] Cannot delete source node:', contextNode.id);
      }
    }
    
    if ((action === 'compare-a' || action === 'compare-b') && contextNode) {
      const data = contextNode.data as any;
      const imageUrl = data?.image || data?.outputData?.image;
      if (imageUrl) {
        setCompareSlot(action === 'compare-a' ? 'A' : 'B', imageUrl);
        // Switch to compare mode in sidebar
        setConfig(prev => ({ ...prev })); // Trigger re-render
      }
    }

    if (action === 'save-node-image' && contextNode) {
      const data = contextNode.data as any;
      const imageUrl = data?.image || data?.outputData?.image;
      if (imageUrl) {
        const baseName = `${data?.type || 'node'}_${contextNode.id}`;
        // Use new export with save dialog
        exportImageWithDialog(imageUrl, baseName).then((filePath) => {
          if (filePath) {
            addNotification({ 
              type: 'success', 
              title: 'Image Saved', 
              message: `Saved to: ${filePath.split(/[\\/]/).pop()}` 
            });
          }
        }).catch(err => {
          console.error('[Save Image] failed:', err);
          addNotification({ 
            type: 'error', 
            title: 'Save Failed', 
            message: err?.message || 'Failed to save image' 
          });
        });
      }
    }

    if (action === 'save-project') {
      handleSave();
    }

    if (action === 'load-project') {
      handleLoad();
    }

    if (action === 'export-all') {
      const items = nodes
        .map(n => {
          const d = n.data as any;
          const url = d?.image || d?.outputData?.image;
          return url ? { url, name: `${d?.type || 'node'}_${n.id}`, prompt: d?.prompt } : null;
        })
        .filter((x): x is { url: string; name: string; prompt?: string } => !!x);

      if (items.length === 0) {
        alert('No images found on canvas.');
      } else {
        // Use new export with save dialog
        exportImagesBatchWithDialog(items).then(({ succeeded, failed, paths }) => {
          console.log(`[Export All] ${succeeded} saved, ${failed} failed`, paths);
          if (succeeded > 0) {
            addNotification({ 
              type: 'success', 
              title: 'Images Exported', 
              message: `${succeeded} image(s) saved successfully` 
            });
          }
          if (failed > 0) {
            addNotification({ 
              type: 'error', 
              title: 'Export Failed', 
              message: `${failed} image(s) failed to export` 
            });
          }
        }).catch(err => {
          console.error('[Export All] error:', err);
          addNotification({ 
            type: 'error', 
            title: 'Export Error', 
            message: String(err) 
          });
        });
      }
    }

    if (action === 'export-pdf') {
      exportNodesToPDFWithDialog(nodes, {
        title: 'Anarchy AI Canvas Export',
        author: 'Anarchy AI',
        subject: 'AI Generated Images from Canvas',
        includeMetadata: true
      }).then((filePath) => {
        if (filePath) {
          addNotification({ 
            type: 'success', 
            title: 'PDF Exported', 
            message: `Saved to: ${filePath.split(/[\\/]/).pop()}` 
          });
        }
      }).catch((err: any) => {
        console.error('[PDF Export] failed:', err);
        addNotification({ 
          type: 'error', 
          title: 'PDF Export Failed', 
          message: err?.message || 'Failed to export PDF' 
        });
      });
    }

    setContextMenu(null);
  };

  const contextNodeHasImage = !!(
    contextNode &&
    ((contextNode.data as any)?.image || (contextNode.data as any)?.outputData?.image)
  );
  const canvasHasAnyImage = nodes.some(n => {
    const d = n.data as any;
    return !!(d?.image || d?.outputData?.image);
  });

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  // Check if we can generate
  const aiConfig = getConfig();
  const isUpscaler = aiConfig.selectedTool === 'image-upscaler';
  const hasUpscaleFactor = aiConfig.upscaleFactor && aiConfig.upscaleFactor > 1;
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
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onPaneContextMenu={onPaneContextMenu}
            onNodeContextMenu={onNodeContextMenu}
            onMoveEnd={saveBuilderViewport}
            nodeTypes={nodeTypes}
            fitViewOptions={{ padding: 0.2, minZoom: 0.01, maxZoom: 2, duration: 300 }}
            colorMode="dark"
            minZoom={0.01}
            maxZoom={2}
            connectionLineType={ConnectionLineType.Bezier}
            connectionLineStyle={{
              stroke: '#e11d48',
              strokeWidth: 2,
            }}
            defaultEdgeOptions={{
              type: 'default',
              animated: false,
              style: { 
                strokeWidth: 2,
                strokeDasharray: '8, 6',
              },
              markerEnd: {
                type: 'arrowclosed',
                width: 10,
                height: 10,
                color: 'rgba(255,255,255,0.35)'
              }
            }}
            // Smoothness & Performance optimizations
            panOnScroll={false}
            zoomOnScroll={true}
            zoomOnPinch={true}
            zoomOnDoubleClick={false}
            panOnDrag={[1, 2]}
            selectionOnDrag={true}
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
            <MiniMap
              position="bottom-right"
              nodeColor={() => 'rgba(225, 29, 72, 0.6)'}
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
          </ReactFlow>
        )}

        {contextMenu && (
          <div
            ref={contextMenuRef}
            className="builder-context-menu"
            style={{ position: 'fixed', zIndex: 9999, ...menuStyle }}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
          >
            <div className="context-menu-title">
              {contextMenu.type === 'canvas' ? 'Canvas Menu' : contextMenu.type === 'node' ? 'Node Menu' : 'Prompt Menu'}
            </div>

            {contextMenu.type === 'prompt' ? (
              <>
                <div className="context-section-label">Text Actions</div>

                <button className="context-item" onClick={() => {
                  navigator.clipboard.writeText(prompt);
                  setContextMenu(null);
                }}>
                  <Copy size={14} className="context-icon" />
                  <span className="context-main">Copy Prompt</span>
                </button>

                <button className="context-item" onClick={() => {
                  navigator.clipboard.readText().then(text => setPrompt(text as string));
                  setContextMenu(null);
                }}>
                  <ClipboardIcon size={14} className="context-icon" />
                  <span className="context-main">Paste from Clipboard</span>
                </button>

                <button className="context-item" onClick={() => {
                  setPrompt('');
                  setContextMenu(null);
                }}>
                  <X size={14} className="context-icon" />
                  <span className="context-main">Clear Prompt</span>
                </button>

                <div className="context-section-label">History</div>

                <button className="context-item" onClick={() => {
                  if (selectedNode && (selectedNode.data as any)?.prompt) {
                    setPrompt((selectedNode.data as any).prompt);
                    setContextMenu(null);
                  }
                }} disabled={!selectedNode || !(selectedNode.data as any)?.prompt}>
                  <RotateCcw size={14} className="context-icon" />
                  <span className="context-main">Restore Last Prompt</span>
                </button>
              </>
            ) : contextMenu.type === 'canvas' ? (
              <>
                <div className="context-section-label">Workflow</div>

                <button className="context-item" onClick={(e) => { e.stopPropagation(); console.log('[Menu Click] add-source'); runContextAction('add-source'); setContextMenu(null); }}>
                  <Plus size={14} className="context-icon" />
                  <span className="context-main">Add Source Node</span>
                </button>

                <button className="context-item" onClick={async () => {
                  setContextMenu(null);
                  try {
                    const items = await navigator.clipboard.read();
                    for (const item of items) {
                      const imgType = item.types.find(t => t.startsWith('image/'));
                      if (imgType) {
                        const blob = await item.getType(imgType);
                        const dataUrl = await imageFileToDataUrl(new File([blob], 'paste.png', { type: imgType }));
                        await spawnFromImage(dataUrl);
                        break;
                      }
                    }
                  } catch (err) {
                    console.log('[Paste] Clipboard failed:', err);
                    alert('No image found in clipboard');
                  }
                }}>
                  <ClipboardIcon size={14} className="context-icon" />
                  <span className="context-main">Paste Image</span>
                </button>

                <button className="context-item" onClick={(e) => { e.stopPropagation(); console.log('[Menu Click] rearrange'); runContextAction('rearrange'); setContextMenu(null); }}>
                  <LayoutGrid size={14} className="context-icon" />
                  <span className="context-main">Rearrange Graph</span>
                </button>

                <button className="context-item" onClick={() => { fitView({ padding: 0.2, duration: 400 }); setContextMenu(null); }}>
                  <Maximize2 size={14} className="context-icon" />
                  <span className="context-main">Fit to View</span>
                </button>

                <div className="context-section-label">Edit</div>

                <button className="context-item" onClick={() => { if (canUndo) undo(); setContextMenu(null); }} disabled={!canUndo}>
                  <RotateCcw size={14} className="context-icon" />
                  <span className="context-main">Undo</span>
                </button>

                <button className="context-item" onClick={() => { if (canRedo) redo(); setContextMenu(null); }} disabled={!canRedo}>
                  <RotateCw size={14} className="context-icon" />
                  <span className="context-main">Redo</span>
                </button>

                <button className="context-item danger" onClick={() => { handleNewCanvas(); setContextMenu(null); }}>
                  <X size={14} className="context-icon" />
                  <span className="context-main">New Canvas</span>
                </button>

                <div className="context-section-label">Project</div>

                <button className="context-item" onClick={() => { runContextAction('save-project'); setContextMenu(null); }}>
                  <Save size={14} className="context-icon" />
                  <span className="context-main">Save Project</span>
                </button>

                <button className="context-item" onClick={() => { runContextAction('load-project'); setContextMenu(null); }}>
                  <FolderOpen size={14} className="context-icon" />
                  <span className="context-main">Open Project</span>
                </button>

                <div className="context-section-label">Export</div>

                <button
                  className="context-item"
                  onClick={() => { runContextAction('export-all'); setContextMenu(null); }}
                  disabled={!canvasHasAnyImage}
                >
                  <FolderDown size={14} className="context-icon" />
                  <span className="context-main">Export All Images</span>
                </button>

                <button
                  className="context-item"
                  onClick={() => { runContextAction('export-pdf'); setContextMenu(null); }}
                  disabled={!canvasHasAnyImage}
                >
                  <Download size={14} className="context-icon" />
                  <span className="context-main">Export to PDF</span>
                </button>
              </>
            ) : (
              <>
                <div className="context-section-label">Node Actions</div>

                <button
                  className="context-item"
                  onClick={(e) => { e.stopPropagation(); console.log('[Menu Click] spawn-ghost'); runContextAction('spawn-ghost'); setContextMenu(null); }}
                  disabled={!canSpawnFromContextNode}
                >
                  <GitBranch size={14} className="context-icon" />
                  <span className="context-main">Add Render Child</span>
                </button>

                <button
                  className="context-item"
                  onClick={() => { runContextAction('retry-node'); setContextMenu(null); }}
                  disabled={!canRetryContextNode}
                >
                  <Sparkles size={14} className="context-icon" />
                  <span className="context-main">Retry</span>
                </button>

                <button
                  className="context-item"
                  onClick={() => { runContextAction('save-node-image'); setContextMenu(null); }}
                  disabled={!contextNodeHasImage}
                >
                  <Download size={14} className="context-icon" />
                  <span className="context-main">Save Image</span>
                </button>

                <button
                  className="context-item danger"
                  onClick={() => { runContextAction('delete-node'); setContextMenu(null); }}
                  disabled={!canDeleteContextNode}
                >
                  <Trash2 size={14} className="context-icon" />
                  <span className="context-main">Delete Node</span>
                </button>
                
                <div className="context-section-label">Compare</div>
                
                <button
                  className="context-item"
                  onClick={() => { runContextAction('compare-a'); setContextMenu(null); }}
                  disabled={!contextNodeHasImage}
                >
                  <SplitSquareHorizontal size={14} className="context-icon" />
                  <span className="context-main">Set as Image A</span>
                </button>
                
                <button
                  className="context-item"
                  onClick={() => { runContextAction('compare-b'); setContextMenu(null); }}
                  disabled={!contextNodeHasImage}
                >
                  <SplitSquareHorizontal size={14} className="context-icon" />
                  <span className="context-main">Set as Image B</span>
                </button>
              </>
            )}
          </div>
        )}

        {/* Watermark */}
        <div className="builder-watermark">ANARCHY</div>

        {/* Full Width Prompt Bar - hide when swapped view */}
        {!isEnlargedView && (
          <div className="builder-prompt-container">
          <input 
            type="text" 
            className="builder-prompt-input"
            placeholder="Describe what you want to create..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleGenerate();
              }
            }}
            disabled={!canGenerate}
            onContextMenu={onPromptContextMenu}
          />
          <div className="prompt-presets-wrapper">
            <button
              className="prompt-presets-btn"
              onClick={() => setShowPresets(prev => !prev)}
              title="Preset Prompts"
            >
              <BookOpen size={16} />
            </button>
            {showPresets && (
              <div className="prompt-presets-popup">
                <div className="presets-header">Preset Prompts</div>
                {PRESET_PROMPTS.map((group) => (
                  <div key={group.category} className="presets-group">
                    <div className="presets-category">{group.category}</div>
                    {group.prompts.map((p, i) => (
                      <button
                        key={i}
                        className="preset-item"
                        onClick={() => {
                          setPrompt(p.text);
                          setShowPresets(false);
                        }}
                      >
                        <span className="preset-label">{(() => { const Icon = PRESET_ICON_MAP[p.icon]; return Icon ? <Icon size={16} className="preset-icon" /> : null; })()}{p.label}</span>
                        <span className="preset-preview">{p.text.length > 70 ? p.text.slice(0, 70) + '...' : p.text}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            className="export-all-btn"
            onClick={() => runContextAction('export-all')}
            disabled={!canvasHasAnyImage}
            title="Export All Images"
          >
            <FolderDown size={16} />
          </button>
          <button 
            className="generate-btn" 
            onClick={handleGenerate}
            disabled={!canGenerate || (!prompt.trim() && !(isUpscaler && hasUpscaleFactor && hasSourceWithImage))}
          >
            <Sparkles size={16} />
            <span>Generate</span>
          </button>
        </div>
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
        <div className="credit-error-overlay" onClick={() => setCreditError(null)}>
          <div className="credit-error-modal" onClick={e => e.stopPropagation()}>
            <h3>رصيد غير كافٍ</h3>
            <p>الرصيد المتاح: {creditError.balance}</p>
            <p>الرصيد المطلوب: {creditError.needed}</p>
            <div className="credit-error-actions">
              <button onClick={() => setCreditError(null)}>إلغاء</button>
              <button
                className="btn-add-credit"
                onClick={() => {
                  setCreditError(null);
                  window.location.href = '/add-credit';
                }}
              >
                إضافة رصيد
              </button>
            </div>
          </div>
        </div>
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
