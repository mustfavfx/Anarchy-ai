import React, { useCallback, useState, useEffect, useRef, useMemo } from 'react';
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
  getNodesBounds,
} from '@xyflow/react';
import { 
  Search, Plus, GitBranch, Pencil,
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
  Plane, MoveRight, ArrowDownFromLine, RotateCcw,
  SwatchBook, PanelTop, Ruler, Scissors, Box, PenLine, Hexagon,
  HardHat,
  Copy, Clipboard as ClipboardIcon, X,
  type LucideIcon
} from 'lucide-react';
import '@xyflow/react/dist/style.css';
import { BaseNode } from './BaseNode';
import { GhostNode } from './GhostNode';
import { useBuilderWorkflow, type ProcessingType } from './useBuilderWorkflow';
import { useAIConfigStore } from '../../stores/aiConfigStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { downloadImage, downloadImagesBatch } from '../../utils/imageExport';
import { saveWorkflow, saveWorkflowAs, loadWorkflow } from '../../services/workflow';
import { PRESET_PROMPTS } from './presetPrompts';
import { invoke } from '@tauri-apps/api/core';
import { STORAGE_KEYS, SESSION_KEYS } from '../../utils/storageKeys';
import { useAuth } from '../auth/AuthContext';
import { checkCreditBalance, deductCredits, GENERATION_COST, DEV_MODE } from '../../services/credit/creditService';
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
}

// Inner component that uses React Flow hooks (must be inside ReactFlowProvider)
export const BuilderContent: React.FC<BuilderContentProps> = ({ 
  tabId,
  projectPath: initialProjectPath
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
  const { fitView, getViewport } = useReactFlow();

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

  // Auto-apply preset prompt from Dashboard / History
  useEffect(() => {
    const preset = sessionStorage.getItem(SESSION_KEYS.PRESET_PROMPT);
    if (preset) {
      sessionStorage.removeItem(SESSION_KEYS.PRESET_PROMPT);
      setPrompt(preset);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-load image from History "Send to Canvas"
  useEffect(() => {
    const img = sessionStorage.getItem(SESSION_KEYS.PRESET_IMAGE);
    if (!img) return;
    sessionStorage.removeItem(SESSION_KEYS.PRESET_IMAGE);
    const nodeId = createSourceNode(img);
    setSelectedNodeId(nodeId);
    setSelectedNode({ id: nodeId, type: 'source', image: img, prompt: undefined, state: 'ready' });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-load project if provided via props (from multi-tab) or sessionStorage
  useEffect(() => {
    const pathToLoad = initialProjectPath || sessionStorage.getItem(SESSION_KEYS.OPEN_PROJECT_PATH);
    if (pathToLoad) {
      sessionStorage.removeItem(SESSION_KEYS.OPEN_PROJECT_PATH);
      (async () => {
        try {
          const contents: string = await invoke('load_file', { path: pathToLoad });
          const wf = JSON.parse(contents);
          if (wf.nodes) {
            setNodes(wf.nodes.map((n: any) => ({ id: n.id, type: n.type, position: n.position, data: n.data })));
            setEdges(wf.edges.map((e: any) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle, type: e.type, animated: e.animated, style: e.style, data: e.data })));
            setTimeout(() => fitView({ padding: 0.3, duration: 400 }), 200);
            addNotification({ type: 'success', title: 'Project Loaded', message: wf.name || 'Loaded' });
          }
        } catch (err) {
          console.error('[Builder] Auto-load failed:', err);
          addNotification({ type: 'error', title: 'Load Failed', message: String(err) });
        }
      })();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

        const sourceId = createSourceNode(image);
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
    if (selectedNodeId) {
      const node = nodes.find(n => n.id === selectedNodeId);
      if (node) {
        const data = node.data as any;
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

  // Initial setup: wait for restore to complete, then add Source node only if canvas is empty
  useEffect(() => {
    console.log('[Init] useEffect triggered, isRestored:', isRestored, 'nodes.length:', nodes.length);
    if (!isRestored) return;                          // wait for localStorage restore
    if (hasCreatedSource.current) return;             // only run once
    hasCreatedSource.current = true;
    console.log('[Init] Creating initial source node..., nodes.length:', nodes.length, 'createSourceNode type:', typeof createSourceNode);
    if (nodes.length === 0) {
      try {
        console.log('[Init] About to call createSourceNode...');
        const id = createSourceNode();
        console.log('[Init] Created initial node:', id);
      } catch (err) {
        console.error('[Init] Failed to create initial node:', err);
      }
    } else {
      console.log('[Init] Skipping node creation, nodes.length:', nodes.length);
    }
  }, [isRestored]); // eslint-disable-line react-hooks/exhaustive-deps

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

    const handleClose = () => setContextMenu(null);
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };

    window.addEventListener('click', handleClose);
    window.addEventListener('contextmenu', handleClose);
    window.addEventListener('keydown', handleEsc);

    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('contextmenu', handleClose);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [contextMenu]);

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
    ? nodes.find(n => n.id === contextMenu.nodeId)
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
        addNotification({ type: 'success', title: 'Project Saved', message: path.split(/[\\/]/).pop() || 'Saved' });
      }
    } catch (err) {
      console.error('[Save] failed:', err);
      addNotification({ type: 'error', title: 'Save Failed', message: String(err) });
    }
  }, [nodes, edges, addNotification, generateThumbnail]);

  const handleSaveAs = useCallback(async () => {
    try {
      const thumbnail = await generateThumbnail();
      const path = await saveWorkflowAs(nodes, edges, undefined, thumbnail);
      if (path) {
        addNotification({ type: 'success', title: 'Project Saved', message: path.split(/[\\/]/).pop() || 'Saved' });
      }
    } catch (err) {
      console.error('[Save As] failed:', err);
      addNotification({ type: 'error', title: 'Save Failed', message: String(err) });
    }
  }, [nodes, edges, addNotification, generateThumbnail]);

  const handleLoad = useCallback(async () => {
    try {
      const result = await loadWorkflow();
      if (result) {
        setNodes(result.nodes);
        setEdges(result.edges);
        addNotification({ type: 'success', title: 'Project Loaded', message: result.name });
        setTimeout(() => fitView({ padding: 0.3, duration: 400 }), 100);
      }
    } catch (err) {
      console.error('[Load] failed:', err);
      addNotification({ type: 'error', title: 'Load Failed', message: String(err) });
    }
  }, [setNodes, setEdges, addNotification, fitView]);

  // ── New Canvas — clear autosave and start fresh ───────────────────────
  const handleNewCanvas = useCallback(() => {
    try { localStorage.removeItem(BUILDER_AUTOSAVE_KEY); } catch {}
    setNodes([]);
    setEdges([]);
    setSelectedNodeId(null);
    setSelectedNode({ id: null, type: null, image: undefined, prompt: undefined, state: undefined });
    setTimeout(() => {
      createSourceNode();
      setTimeout(() => fitView({ padding: 0.8, duration: 400 }), 100);
    }, 30);
  }, [setNodes, setEdges, setSelectedNodeId, setSelectedNode, createSourceNode, fitView]);

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
    const nodeId = createSourceNode(dataUrl);
    setSelectedNodeId(nodeId);
    setSelectedNode({ id: nodeId, type: 'source', image: dataUrl, prompt: undefined, state: 'ready' });
    setTimeout(() => fitView({ padding: 0.3, duration: 400 }), 100);
  }, [createSourceNode, setSelectedNodeId, setSelectedNode, fitView]);

  // ── Drag & Drop image onto canvas ──────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setIsDraggingFile(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as HTMLElement)) {
      setIsDraggingFile(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    for (const file of files.slice(0, 5)) {
      try {
        const dataUrl = await imageFileToDataUrl(file);
        await spawnFromImage(dataUrl);
      } catch { /* skip invalid */ }
    }
  }, [imageFileToDataUrl, spawnFromImage]);

  // ── Native file drop (Tauri + HTML5) ─────────────────────────────────────
  useEffect(() => {
    const handleWindowDragOver = (e: DragEvent) => { e.preventDefault(); };
    const handleWindowDrop = async (e: DragEvent) => {
      e.preventDefault();
      if (!e.dataTransfer) return;
      const files = Array.from(e.dataTransfer.files);
      for (const file of files.slice(0, 5)) {
        if (file.type.startsWith('image/')) {
          try {
            const dataUrl = await imageFileToDataUrl(file);
            await spawnFromImage(dataUrl);
          } catch { /* skip invalid files */ }
        }
      }
    };
    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('drop', handleWindowDrop);
    return () => {
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('drop', handleWindowDrop);
    };
  }, [spawnFromImage, imageFileToDataUrl]);

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
        } catch { /* clipboard access denied or no image */ }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, handleSaveAs, handleLoad, handleNewCanvas, imageFileToDataUrl, spawnFromImage, undo, redo, canUndo, canRedo]);

  const runContextAction = (action: 'add-source' | 'rearrange' | 'spawn-ghost' | 'retry-node' | 'delete-node' | 'compare-a' | 'compare-b' | 'save-node-image' | 'export-all' | 'save-project' | 'load-project') => {
    if (action === 'add-source') {
      createSourceNode();
    }

    if (action === 'rearrange') {
      handleRearrange();
    }

    if (action === 'spawn-ghost' && contextNode) {
      const data = contextNode.data as any;
      if (data?.onAddChild) data.onAddChild('render');
    }

    if (action === 'retry-node' && contextNode) {
      const data = contextNode.data as any;
      if (data?.onRetry) data.onRetry();
    }

    if (action === 'delete-node' && contextNode) {
      const data = contextNode.data as any;
      if (data?.type !== 'source') deleteNode(contextNode.id);
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
        downloadImage(imageUrl, baseName).catch(err => {
          console.error('[Save Image] failed:', err);
          alert('Failed to save image. Check console for details.');
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
          return url ? { url, name: `${d?.type || 'node'}_${n.id}` } : null;
        })
        .filter((x): x is { url: string; name: string } => !!x);

      if (items.length === 0) {
        alert('No images found on canvas.');
      } else {
        downloadImagesBatch(items).then(({ succeeded, failed }) => {
          console.log(`[Export All] ${succeeded} saved, ${failed} failed`);
          if (failed > 0) {
            alert(`Exported ${succeeded} image(s). ${failed} failed (see console).`);
          }
        });
      }
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
            className="builder-context-menu"
            style={{
              position: 'fixed',
              left: typeof window !== 'undefined' ? Math.min(contextMenu.x, window.innerWidth - 260) : contextMenu.x,
              top: typeof window !== 'undefined' ? Math.min(contextMenu.y, window.innerHeight - 280) : contextMenu.y,
              zIndex: 9999,
            }}
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
                  <span className="context-text">
                    <span className="context-main">Copy Prompt</span>
                    <span className="context-sub">Copy to clipboard</span>
                  </span>
                </button>

                <button className="context-item" onClick={() => {
                  navigator.clipboard.readText().then(text => setPrompt(text as string));
                  setContextMenu(null);
                }}>
                  <ClipboardIcon size={14} className="context-icon" />
                  <span className="context-text">
                    <span className="context-main">Paste from Clipboard</span>
                    <span className="context-sub">Paste text</span>
                  </span>
                </button>

                <button className="context-item" onClick={() => {
                  setPrompt('');
                  setContextMenu(null);
                }}>
                  <X size={14} className="context-icon" />
                  <span className="context-text">
                    <span className="context-main">Clear Prompt</span>
                    <span className="context-sub">Remove all text</span>
                  </span>
                </button>

                <div className="context-section-label">History</div>

                <button className="context-item" onClick={() => {
                  if (selectedNode && (selectedNode.data as any)?.prompt) {
                    setPrompt((selectedNode.data as any).prompt);
                    setContextMenu(null);
                  }
                }} disabled={!selectedNode || !(selectedNode.data as any)?.prompt}>
                  <RotateCcw size={14} className="context-icon" />
                  <span className="context-text">
                    <span className="context-main">Restore Last Prompt</span>
                    <span className="context-sub">From selected node</span>
                  </span>
                </button>
              </>
            ) : contextMenu.type === 'canvas' ? (
              <>
                <div className="context-section-label">Workflow</div>

                <button className="context-item" onClick={(e) => {
                  e.stopPropagation();
                  runContextAction('add-source');
                }}>
                  <Plus size={14} className="context-icon" />
                  <span className="context-text">
                    <span className="context-main">Add Source Node</span>
                    <span className="context-sub">Create new starting point</span>
                  </span>
                </button>

                <button className="context-item" onClick={() => runContextAction('rearrange')}>
                  <LayoutGrid size={14} className="context-icon" />
                  <span className="context-text">
                    <span className="context-main">Rearrange Graph</span>
                    <span className="context-sub">Auto-align all connected nodes</span>
                  </span>
                </button>

                <div className="context-section-label">Project</div>

                <button className="context-item" onClick={() => runContextAction('save-project')}>
                  <Save size={14} className="context-icon" />
                  <span className="context-text">
                    <span className="context-main">Save Project</span>
                    <span className="context-sub">Ctrl+S</span>
                  </span>
                </button>

                <button className="context-item" onClick={() => runContextAction('load-project')}>
                  <FolderOpen size={14} className="context-icon" />
                  <span className="context-text">
                    <span className="context-main">Open Project</span>
                    <span className="context-sub">Ctrl+O</span>
                  </span>
                </button>

                <div className="context-section-label">Export</div>

                <button
                  className="context-item"
                  onClick={() => runContextAction('export-all')}
                  disabled={!canvasHasAnyImage}
                >
                  <FolderDown size={14} className="context-icon" />
                  <span className="context-text">
                    <span className="context-main">Export All Images</span>
                    <span className="context-sub">Save every image on the canvas</span>
                  </span>
                </button>
              </>
            ) : (
              <>
                <div className="context-section-label">Node Actions</div>

                <button
                  className="context-item"
                  onClick={() => runContextAction('spawn-ghost')}
                  disabled={!canSpawnFromContextNode}
                >
                  <GitBranch size={14} className="context-icon" />
                  <span className="context-text">
                    <span className="context-main">Add Render Child</span>
                    <span className="context-sub">Spawn a new processing branch</span>
                  </span>
                </button>

                <button
                  className="context-item"
                  onClick={() => runContextAction('retry-node')}
                  disabled={!canRetryContextNode}
                >
                  <Sparkles size={14} className="context-icon" />
                  <span className="context-text">
                    <span className="context-main">Retry</span>
                    <span className="context-sub">Run last prompt again</span>
                  </span>
                </button>

                <button
                  className="context-item"
                  onClick={() => runContextAction('save-node-image')}
                  disabled={!contextNodeHasImage}
                >
                  <Download size={14} className="context-icon" />
                  <span className="context-text">
                    <span className="context-main">Save Image</span>
                    <span className="context-sub">Download this image to your computer</span>
                  </span>
                </button>

                <button
                  className="context-item danger"
                  onClick={() => runContextAction('delete-node')}
                  disabled={!canDeleteContextNode}
                >
                  <Pencil size={14} className="context-icon" />
                  <span className="context-text">
                    <span className="context-main">Delete Node</span>
                    <span className="context-sub">Remove selected node</span>
                  </span>
                </button>
                
                <div className="context-section-label">Compare</div>
                
                <button
                  className="context-item"
                  onClick={() => runContextAction('compare-a')}
                  disabled={!contextNode?.data?.image && !(contextNode?.data as any)?.outputData?.image}
                >
                  <SplitSquareHorizontal size={14} className="context-icon" />
                  <span className="context-text">
                    <span className="context-main">Set as Image A</span>
                    <span className="context-sub">Add to compare slot A</span>
                  </span>
                </button>
                
                <button
                  className="context-item"
                  onClick={() => runContextAction('compare-b')}
                  disabled={!contextNode?.data?.image && !(contextNode?.data as any)?.outputData?.image}
                >
                  <SplitSquareHorizontal size={14} className="context-icon" />
                  <span className="context-text">
                    <span className="context-main">Set as Image B</span>
                    <span className="context-sub">Add to compare slot B</span>
                  </span>
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
