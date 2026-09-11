import { useState, useEffect, useRef, useCallback } from 'react';
import { logger } from '../../../utils/logger';
import { saveWorkflow, saveWorkflowAs, loadWorkflow, resetFilePath } from '../../../services/workflow';
import { AutoRecoveryService } from '../../../services/recovery/AutoRecoveryService';
import { sanitizeEdges } from '../types';
import type { BuilderNode } from '../types';
import { type Edge } from '@xyflow/react';

interface UseBuilderPersistenceArgs {
  nodes: BuilderNode[];
  edges: Edge[];
  setNodes: React.Dispatch<React.SetStateAction<BuilderNode[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  tabId?: string;
  initialProjectPath?: string | null;
  onTitleChange?: (title: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onProjectPathChange?: (path: string | null) => void;
  generateThumbnail: () => Promise<string | undefined>;
  addNotification: (notification: any) => void;
  fitView: (options?: any) => void;
  isRestored: boolean;
  createSourceNode: () => string;
  setSelectedNodeId: React.Dispatch<React.SetStateAction<string | null>> | ((id: string | null) => void);
  setSelectedNode: (node: any) => void;
  hasFittedInitiallyRef?: React.RefObject<boolean>;
  forceCanvasRepaint?: () => void;
}

export function useBuilderPersistence({
  nodes,
  edges,
  setNodes,
  setEdges,
  tabId,
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
  hasFittedInitiallyRef,
  forceCanvasRepaint,
}: UseBuilderPersistenceArgs) {
  const [currentFilePath, setCurrentFilePathState] = useState<string | null>(initialProjectPath ?? null);
  const [confirmNewCanvas, setConfirmNewCanvas] = useState(false);
  const isDirtyRef = useRef(false);
  const skipDirtyRef = useRef(2); // skip initial restore triggers
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

  // Sync onDirtyChange
  const onDirtyChangeRef = useRef(onDirtyChange);
  useEffect(() => {
    onDirtyChangeRef.current = onDirtyChange;
  }, [onDirtyChange]);

  useEffect(() => {
    if (!isRestored) return;
    if (skipDirtyRef.current > 0) {
      skipDirtyRef.current--;
      return;
    }
    isDirtyRef.current = true;
    onDirtyChangeRef.current?.(true);
  }, [nodes, edges, isRestored]);

  // Auto-Recovery periodic snapshot save for dirty sessions (.ana.bak)
  useEffect(() => {
    if (!isRestored || !isDirtyRef.current || !tabId) return;
    const timer = setTimeout(() => {
      if (isDirtyRef.current && isMountedRef.current && tabId) {
        const title = currentFilePath ? currentFilePath.split(/[\\/]/).pop()?.replace(/\.ana$/i, '') || 'Untitled' : 'Untitled';
        AutoRecoveryService.saveRecoverySnapshot(tabId, title, nodes, edges, currentFilePath).catch(() => {});
      }
    }, 15000); // 15s debounced auto-recovery snapshot
    return () => clearTimeout(timer);
  }, [nodes, edges, isRestored, tabId, currentFilePath]);

  const applyWorkflow = useCallback((wf: any, fallbackName: string) => {
    if (!wf) return;
    let rawNodes = Array.isArray(wf.nodes) ? wf.nodes : [];

    // If workflow has 0 nodes, create a default clean source node so canvas is never blank
    if (rawNodes.length === 0) {
      const sourceNodeId = `source-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      rawNodes = [{
        id: sourceNodeId,
        type: 'baseNode',
        position: { x: 200, y: 200 },
        width: 260,
        data: {
          label: 'Source',
          type: 'source',
          processingType: 'source',
          state: 'idle',
          image: undefined,
          createdAt: Date.now(),
          lineage: {
            parentId: null,
            rootSourceId: sourceNodeId,
            generation: 0,
            branchIndex: 0,
            processingType: 'source',
            ancestry: []
          },
          config: {}
        }
      }];
    }

    const mappedNodes: BuilderNode[] = rawNodes.map((n: any) => {
      // Normalize React Flow node type
      let nodeType: string = n.type || 'baseNode';
      if (nodeType === 'ghost' || nodeType === 'ghostNode') nodeType = 'ghostNode';
      else if (nodeType === 'dummy' || nodeType === 'dummyNode') nodeType = 'dummyNode';
      else if (nodeType === 'group' || nodeType === 'groupNode') nodeType = 'groupNode';
      else nodeType = 'baseNode';

      const data = { ...(n.data || {}) };
      // Clean up interrupted session states
      if (data.state === 'connecting' || data.state === 'processing' || data.state === 'queued') {
        data.state = 'idle';
      }

      return {
        id: String(n.id || `node-${Date.now()}`),
        type: nodeType,
        position: {
          x: typeof n.position?.x === 'number' && !isNaN(n.position.x) ? n.position.x : 200,
          y: typeof n.position?.y === 'number' && !isNaN(n.position.y) ? n.position.y : 200,
        },
        width: typeof n.width === 'number' && n.width > 0 ? n.width : 260,
        data,
      } as BuilderNode;
    });

    setNodes(mappedNodes);
    const mappedEdges = (wf.edges ?? []).map((e: any) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle || 'source',
      targetHandle: e.targetHandle,
      type: e.type || 'default',
      animated: e.animated,
      style: e.style,
      data: e.data,
    }));
    setEdges(sanitizeEdges(mappedNodes, mappedEdges));
    const name = wf.name || fallbackName;
    onTitleChange?.(name);
    skipDirtyRef.current = 2;
    onDirtyChange?.(false);
    isDirtyRef.current = false;

    if (hasFittedInitiallyRef) {
      hasFittedInitiallyRef.current = false;
    }

    addNotification({ type: 'success', title: 'Project Loaded', message: name });
    if (tabId) {
      AutoRecoveryService.clearRecoverySnapshot(tabId, currentFilePath).catch(() => {});
    }
    // Force center viewport and real GPU repaint after DOM commits new nodes
    setTimeout(() => {
      try { fitView?.({ padding: 0.3, duration: 300 }); } catch {}
      forceCanvasRepaint?.();
    }, 150);
  }, [setNodes, setEdges, onTitleChange, onDirtyChange, fitView, addNotification, hasFittedInitiallyRef, forceCanvasRepaint, tabId, currentFilePath]);

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
        if (tabId) {
          AutoRecoveryService.clearRecoverySnapshot(tabId, path).catch(() => {});
        }
        return path;
      }
      return null;
    } catch (err) {
      if (!isMountedRef.current) return null;
      logger.error('[Save] failed:', err);
      addNotification({ type: 'error', title: 'Save Failed', message: String(err) });
      return null;
    }
  }, [nodes, edges, addNotification, generateThumbnail, onTitleChange, onDirtyChange, currentFilePath, onProjectPathChange, tabId]);

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
        if (tabId) {
          AutoRecoveryService.clearRecoverySnapshot(tabId, path).catch(() => {});
        }
        return path;
      }
      return null;
    } catch (err) {
      if (!isMountedRef.current) return null;
      logger.error('[Save As] failed:', err);
      addNotification({ type: 'error', title: 'Save Failed', message: String(err) });
      return null;
    }
  }, [nodes, edges, addNotification, generateThumbnail, onTitleChange, onDirtyChange, currentFilePath, onProjectPathChange, tabId]);

  const handleLoad = useCallback(async () => {
    try {
      const result = await loadWorkflow();
      if (result) {
        if (hasFittedInitiallyRef) {
          hasFittedInitiallyRef.current = false;
        }
        setNodes(result.nodes as BuilderNode[]);
        setEdges(sanitizeEdges(result.nodes, result.edges || []));
        onTitleChange?.(result.name);
        setCurrentFilePathState(result.filePath);
        onProjectPathChange?.(result.filePath);
        skipDirtyRef.current = 2;
        isDirtyRef.current = false;
        onDirtyChange?.(false);
        if (tabId) {
          AutoRecoveryService.clearRecoverySnapshot(tabId, result.filePath).catch(() => {});
        }
        addNotification({ type: 'success', title: 'Project Loaded', message: result.name });
        // Force a real GPU repaint after nodes settle — fixes WebView2 black canvas bug.
        setTimeout(() => forceCanvasRepaint?.(), 300);
      }
    } catch (err) {
      logger.error('[Load] failed:', err);
      addNotification({ type: 'error', title: 'Load Failed', message: String(err) });
    }
  }, [setNodes, setEdges, addNotification, fitView, onTitleChange, onDirtyChange, onProjectPathChange, hasFittedInitiallyRef, forceCanvasRepaint, tabId]);

  const doNewCanvas = useCallback(() => {
    resetFilePath();
    setCurrentFilePathState(null);
    onProjectPathChange?.(null);
    if (tabId) {
      AutoRecoveryService.clearRecoverySnapshot(tabId, currentFilePath).catch(() => {});
    }
    setNodes([]);
    setEdges([]);
    setSelectedNodeId(null);
    setSelectedNode({ id: null, type: null, image: undefined, prompt: undefined, state: undefined });
    skipDirtyRef.current = 2;
    onDirtyChange?.(false);
    isDirtyRef.current = false;
    setTimeout(() => {
      createSourceNode();
      setTimeout(() => fitView({ padding: 0.8, minZoom: 0.6, duration: 400 }), 100);
    }, 30);
  }, [setNodes, setEdges, setSelectedNodeId, setSelectedNode, createSourceNode, fitView, onDirtyChange, onProjectPathChange, tabId, currentFilePath]);

  const handleNewCanvas = useCallback(() => {
    if (isDirtyRef.current) {
      setConfirmNewCanvas(true);
    } else {
      doNewCanvas();
    }
  }, [doNewCanvas]);

  // Helper to detect if the canvas is just the initial untouched empty template
  const isDefaultBlankCanvas = (nodeList: BuilderNode[]): boolean => {
    if (nodeList.length === 0) return true;
    if (nodeList.length === 1) {
      const d = nodeList[0].data as any;
      const isSource = d?.type === 'source' || nodeList[0].type === 'baseNode';
      const hasNoImage = !d?.image && !d?.inputData?.image && !d?.outputData?.image;
      const hasNoPrompt = !d?.prompt && !d?.config?.prompt;
      return isSource && hasNoImage && hasNoPrompt;
    }
    return false;
  };

  // Background autosave (saves to disk ONLY when dirty and has substantive changes or an existing file)
  useEffect(() => {
    if (!isRestored) return;
    if (!isDirtyRef.current) return;
    if (isDefaultBlankCanvas(nodes)) return;

    // Only autosave to disk if the project has a known filePath.
    // Unsaved untitled projects stay safely in localStorage autosave to avoid overwriting untitled.ana on disk.
    if (!currentFilePath) return;

    const timeoutId = setTimeout(async () => {
      try {
        const name = currentFilePath.split(/[\\/]/).pop()?.replace(/\.ana$/i, '') || 'untitled';
        await saveWorkflow(nodes, edges, { filePath: currentFilePath, name });
      } catch (err) {
        logger.warn('[Autosave] Background disk save failed:', err);
      }
    }, 3000); // Debounce 3s

    return () => clearTimeout(timeoutId);
  }, [nodes, edges, isRestored, currentFilePath]);

  return {
    currentFilePath,
    setCurrentFilePathState,
    confirmNewCanvas,
    setConfirmNewCanvas,
    handleSave,
    handleSaveAs,
    handleLoad,
    doNewCanvas,
    handleNewCanvas,
    applyWorkflow,
    isDirtyRef,
    skipDirtyRef,
  };
}
