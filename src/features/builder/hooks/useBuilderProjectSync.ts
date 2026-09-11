import { useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { logger } from '../../../utils/logger';
import { STORAGE_KEYS, SESSION_KEYS } from '../../../utils/storageKeys';
import { getCurrentUserId } from '../../../services/supabase/supabaseClient';
import { loadWorkflowFromPath } from '../../../services/workflow';
import { useBuilderPersistence } from './useBuilderPersistence';
import {
  htmlToCanvas,
  convertNodeTreeToWorkflow,
  patchNodeImage,
} from '../utils/builderHelpers';
import type { BuilderNode } from '../types';
import type { Edge } from '@xyflow/react';

const getAutosaveKey = (tabId?: string) => {
  const uid = getCurrentUserId();
  const base = uid && uid !== 'default_user' ? `${STORAGE_KEYS.BUILDER_AUTOSAVE}_${uid}` : STORAGE_KEYS.BUILDER_AUTOSAVE;
  return tabId ? `${base}_${tabId}` : base;
};

export interface UseBuilderProjectSyncParams {
  nodes: BuilderNode[];
  edges: Edge[];
  setNodes: (update: any) => void;
  setEdges: (update: any) => void;
  tabId?: string;
  initialProjectPath?: string | null;
  initialWorkflow?: any;
  initialImage?: string;
  onTitleChange?: (title: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onProjectPathChange?: (path: string | null) => void;
  addNotification: (notification: any) => void;
  fitView: (options?: any) => void;
  isRestored: boolean;
  createSourceNode: (imageUrl?: string, label?: string, position?: { x: number; y: number }, prompt?: string) => string;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedNode: (node: any) => void;
  hasFittedInitially: React.MutableRefObject<boolean>;
  forceCanvasRepaint: () => void;
  setWorkflowSnapshot: (snapshot: { nodes: any[]; edges: any[] }) => void;
  canvasContainerRef: React.RefObject<HTMLDivElement | null>;
  needsFitAfterLoadRef: React.MutableRefObject<boolean>;
  isActive?: boolean;
  setPrompt: (prompt: string) => void;
  applyWatermarkToSource: (url: string) => Promise<string>;
}

export function useBuilderProjectSync({
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
  isActive = true,
  setPrompt,
  applyWatermarkToSource,
}: UseBuilderProjectSyncParams) {
  const location = useLocation();
  const hasLoadedRef = useRef(false);

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

  // Persistence Save/Load operations
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
    hasFittedInitiallyRef: hasFittedInitially,
    forceCanvasRepaint,
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

  // Auto-load project if provided via props (starts on mount, doesn't wait for active state)
  useEffect(() => {
    if (hasLoadedRef.current) return;

    const key = getAutosaveKey(tabId);
    const hasAutosave = (() => {
      try {
        const saved = localStorage.getItem(key);
        if (saved) {
          const data = JSON.parse(saved);
          return !!(data.nodes && data.nodes.length > 0);
        }
      } catch { }
      return false;
    })();

    const pathToLoad = initialProjectPath;

    if (pathToLoad) {
      hasLoadedRef.current = true;
      (async () => {
        try {
          const result = await loadWorkflowFromPath(pathToLoad);
          if (result) {
            setCurrentFilePathState(result.filePath);
            onProjectPathChange?.(result.filePath);
            applyWorkflow(result, result.name);
          }
        } catch (err: any) {
          logger.error('[Builder] Auto-load failed:', err);
          addNotification({ type: 'error', title: 'Load Failed', message: String(err) });
        }
      })();
      return;
    }

    if (hasAutosave) {
      hasLoadedRef.current = true;
      return;
    }

    if (initialWorkflow) {
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
      } catch (err: any) { logger.error('[Builder] initialWorkflow load failed:', err); }
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
    isActive,
    onProjectPathChange,
    initialWorkflow,
    initialImage,
    applyWorkflow,
    restorePresetImage,
    applyWatermarkToSource,
    createSourceNode,
    setSelectedNodeId,
    setSelectedNode,
    addNotification,
    setCurrentFilePathState,
  ]);

  // Listen for project reload requests (e.g. user re-opens project from Projects page)
  useEffect(() => {
    const handleReload = async (e: Event) => {
      const detail = (e as CustomEvent<{ tabId?: string; projectPath?: string }>)?.detail;
      if (!detail) return;
      const normalizeP = (p?: string | null) => p ? p.replace(/\\/g, '/').toLowerCase() : '';
      const isTargetTab = detail.tabId === tabId;
      const isTargetPath = detail.projectPath && initialProjectPath && normalizeP(detail.projectPath) === normalizeP(initialProjectPath);
      if (isTargetTab || isTargetPath) {
        const pathToLoad = detail.projectPath || initialProjectPath;
        if (pathToLoad) {
          try {
            const result = await loadWorkflowFromPath(pathToLoad);
            if (result) {
              setCurrentFilePathState(result.filePath);
              onProjectPathChange?.(result.filePath);
              applyWorkflow(result, result.name);
            }
          } catch (err: any) {
            logger.error('[Builder] Reload failed:', err);
            addNotification({ type: 'error', title: 'Load Failed', message: String(err) });
          }
        }
      }
    };
    window.addEventListener('anarchy:reload-project', handleReload);
    return () => window.removeEventListener('anarchy:reload-project', handleReload);
  }, [tabId, initialProjectPath, applyWorkflow, onProjectPathChange, setCurrentFilePathState, addNotification]);

  // Debounce snapshot updates
  const snapshotTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    clearTimeout(snapshotTimerRef.current);
    snapshotTimerRef.current = setTimeout(() => {
      setWorkflowSnapshot({ nodes, edges });
    }, 500);
    return () => clearTimeout(snapshotTimerRef.current);
  }, [nodes, edges, setWorkflowSnapshot]);

  const nodesRefForActive = useRef(nodes);
  useEffect(() => {
    nodesRefForActive.current = nodes;
  }, [nodes]);

  // After forceCanvasRepaint fires, do a delayed fitView
  useEffect(() => {
    if (!needsFitAfterLoadRef.current) return;
    const t = setTimeout(() => {
      if (nodesRefForActive.current && nodesRefForActive.current.length > 0) {
        fitView({ padding: 0.3, duration: 300 });
        hasFittedInitially.current = true;
      }
      needsFitAfterLoadRef.current = false;
    }, 600);
    return () => clearTimeout(t);
  }, [nodes, fitView, hasFittedInitially, needsFitAfterLoadRef]);

  // Dispatch window resize after tab becomes active
  useEffect(() => {
    if (!isActive) return;

    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const container = canvasContainerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();

      if (rect.width > 50 && rect.height > 50 && rect.left >= 0) {
        window.dispatchEvent(new Event('resize'));

        setTimeout(() => {
          if (nodesRefForActive.current && nodesRefForActive.current.length > 0 && !hasFittedInitially.current) {
            fitView({ padding: 0.3, duration: 400 });
            hasFittedInitially.current = true;
          }
        }, 50);

        clearInterval(interval);
      }

      if (attempts >= 30) {
        clearInterval(interval);
      }
    }, 100);

    return () => {
      clearInterval(interval);
    };
  }, [isActive, fitView, nodes.length, canvasContainerRef, hasFittedInitially]);

  return {
    setCurrentFilePathState,
    confirmNewCanvas,
    setConfirmNewCanvas,
    handleSave,
    handleSaveAs,
    handleLoad,
    doNewCanvas,
    handleNewCanvas,
    applyWorkflow,
  };
}
