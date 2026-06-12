import { useState, useEffect, useRef, useCallback } from 'react';
import { logger } from '../../../utils/logger';
import { saveWorkflow, saveWorkflowAs, loadWorkflow, resetFilePath } from '../../../services/workflow';
import { sanitizeEdges } from '../types';
import type { BuilderNode } from '../types';
import { type Edge } from '@xyflow/react';

interface UseBuilderPersistenceArgs {
  nodes: BuilderNode[];
  edges: Edge[];
  setNodes: React.Dispatch<React.SetStateAction<BuilderNode[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  initialProjectPath?: string | null;
  onTitleChange?: (title: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onProjectPathChange?: (path: string | null) => void;
  generateThumbnail: () => Promise<string | undefined>;
  addNotification: (notification: any) => void;
  fitView: (options?: any) => void;
  isRestored: boolean;
  createSourceNode: () => string;
  setSelectedNodeId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedNode: (node: any) => void;
  hasFittedInitiallyRef?: React.RefObject<boolean>;
}

export function useBuilderPersistence({
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
  hasFittedInitiallyRef,
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

  const applyWorkflow = useCallback((wf: any, fallbackName: string) => {
    if (!wf.nodes) return;
    const mappedNodes = wf.nodes.map((n: any) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: n.data,
    }));
    setNodes(mappedNodes);
    const mappedEdges = (wf.edges ?? []).map((e: any) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle || 'source',
      targetHandle: e.targetHandle,
      type: e.type,
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

    setTimeout(() => fitView({ padding: 0.3, duration: 400 }), 200);
    addNotification({ type: 'success', title: 'Project Loaded', message: name });
  }, [setNodes, setEdges, onTitleChange, onDirtyChange, fitView, addNotification, hasFittedInitiallyRef]);

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

  const handleLoad = useCallback(async () => {
    try {
      const result = await loadWorkflow();
      if (result) {
        setNodes(result.nodes as BuilderNode[]);
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

  const doNewCanvas = useCallback(() => {
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
  }, [setNodes, setEdges, setSelectedNodeId, setSelectedNode, createSourceNode, fitView, onDirtyChange, onProjectPathChange]);

  const handleNewCanvas = useCallback(() => {
    if (isDirtyRef.current) {
      setConfirmNewCanvas(true);
    } else {
      doNewCanvas();
    }
  }, [doNewCanvas]);

  // Background autosave without thumbnail generation (saves nodes, edges)
  useEffect(() => {
    if (!isRestored) return;
    if (!currentFilePath) return;

    const timeoutId = setTimeout(async () => {
      try {
        await saveWorkflow(nodes, edges, { filePath: currentFilePath });
      } catch (err) {
        logger.warn('[Autosave] Background disk save failed:', err);
      }
    }, 5000); // Debounce 5s

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
