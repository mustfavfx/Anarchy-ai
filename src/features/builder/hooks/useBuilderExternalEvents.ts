import { useCallback, useEffect } from 'react';
import { CanvasHandoffService } from '../../../services/canvas/CanvasHandoffService';
import { getHistoryNodeLabel } from '@/utils/nodeLabel';
import { resolveSourceLabel, positionExternalNode } from '../utils/builderHelpers';

export interface UseBuilderExternalEventsParams {
  tabId?: string;
  isActive?: boolean;
  createSourceNode: (imageUrl?: string, label?: string, position?: { x: number; y: number }, prompt?: string) => string;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedNode: (node: any) => void;
  setNodes: (update: any) => void;
  fitView: (options?: any) => void;
  applyWatermarkToSource: (url: string) => Promise<string>;
  restoreWorkflow: (workflowData: { nodes: any[]; edges?: any[]; name?: string }) => void;
}

export function useBuilderExternalEvents({
  tabId,
  isActive = true,
  createSourceNode,
  setSelectedNodeId,
  setSelectedNode,
  setNodes,
  fitView,
  applyWatermarkToSource,
  restoreWorkflow,
}: UseBuilderExternalEventsParams) {
  const handleExternalImage = useCallback((image: string, rawSource: string, label?: string, prompt?: string) => {
    let nodeLabel = label;
    if (!nodeLabel || rawSource.startsWith('history:h_')) {
      nodeLabel = rawSource.startsWith('history:') ? 'History Image' : resolveSourceLabel(rawSource);
    }
    applyWatermarkToSource(image).then(watermarked => {
      const sourceId = createSourceNode(watermarked, nodeLabel, undefined, prompt);
      setSelectedNodeId(sourceId);
      setSelectedNode({ id: sourceId, type: 'source', image: watermarked, prompt: prompt || undefined, state: 'ready' });
      setTimeout(() => {
        setNodes(positionExternalNode(sourceId));
        fitView({ padding: 0.3, duration: 400 });
      }, 0);
    });
  }, [createSourceNode, setSelectedNodeId, setSelectedNode, setNodes, fitView, applyWatermarkToSource]);

  const handleRestoreFullNodeTree = useCallback((nodeTree: any, fallbackImage?: string, fallbackPrompt?: string, fallbackLabel?: string) => {
    if (!nodeTree || !Array.isArray(nodeTree.nodes) || nodeTree.nodes.length === 0) {
      if (fallbackImage) {
        handleExternalImage(fallbackImage, 'history', fallbackLabel, fallbackPrompt);
      }
      return;
    }

    const restoredNodes = nodeTree.nodes.map((n: any) => {
      const typeStr = n.type || n.processingType || 'source';
      const cleanModel = getHistoryNodeLabel({ model: n.model || n.config?.model || n.params?.model || n.label || '' });
      const nodeLabel = cleanModel || (typeStr === 'source' ? (fallbackLabel || 'Source') : typeStr.charAt(0).toUpperCase() + typeStr.slice(1));
      const promptText = n.prompt || n.config?.prompt || n.params?.prompt || fallbackPrompt || '';
      const layoutData = n.layout || n.extractedLayout || n.analysisResult || n.params?.layout || n.params?.analysisResult;

      return {
        id: n.id,
        type: 'baseNode',
        position: n.position || { x: 200, y: 200 },
        width: 260,
        data: {
          label: nodeLabel,
          type: typeStr === 'source' ? 'source' : 'result',
          processingType: n.processingType || typeStr,
          state: n.state || 'ready',
          image: n.image || fallbackImage,
          originalImage: n.image || fallbackImage,
          prompt: promptText,
          layout: layoutData,
          extractedLayout: layoutData,
          isAnalyzed: !!layoutData,
          createdAt: Date.now(),
          historyEntryId: n.historyEntryId,
          config: { prompt: promptText, model: cleanModel }
        }
      };
    });

    const restoredEdges: any[] = [];
    nodeTree.nodes.forEach((n: any) => {
      if (n.parentId) {
        restoredEdges.push({
          id: `edge-${n.parentId}-${n.id}`,
          source: n.parentId,
          target: n.id,
          sourceHandle: 'source',
          type: 'default',
          animated: false,
          style: { stroke: '#e11d48', strokeWidth: 2, strokeDasharray: '5 5' }
        });
      }
    });

    restoreWorkflow({ nodes: restoredNodes, edges: restoredEdges });

    setTimeout(() => {
      const activeId = nodeTree.activeNodeId || nodeTree.nodes[nodeTree.nodes.length - 1]?.id;
      if (activeId) {
        setSelectedNodeId(activeId);
      }
      fitView({ padding: 0.3, duration: 400 });
    }, 50);
  }, [restoreWorkflow, handleExternalImage, setSelectedNodeId, fitView]);

  useEffect(() => {
    if (!isActive) return;

    // Signal canvas is initialized and ready
    CanvasHandoffService.signalReady();

    const processRestorePayload = (payload: any) => {
      if (!payload) return;
      if (payload.kind === 'nodeTree' && payload.nodeTree) {
        handleRestoreFullNodeTree(payload.nodeTree);
      } else if (payload.kind === 'image') {
        handleExternalImage(payload.image, payload.source || 'history', payload.label, payload.prompt);
      } else if (payload.nodeTree && Array.isArray(payload.nodeTree.nodes) && payload.nodeTree.nodes.length > 0) {
        handleRestoreFullNodeTree(payload.nodeTree, payload.image, payload.prompt, payload.label);
      } else if (payload.image) {
        handleExternalImage(payload.image, payload.source || 'history', payload.label, payload.prompt);
      }
    };

    // 1. Process immediate memory handoff
    const handoffPayload = CanvasHandoffService.consumePending();
    if (handoffPayload) {
      processRestorePayload(handoffPayload);
    }

    // 2. Process global event
    const handleGlobalEvent = (e: Event) => {
      const customEvent = e as CustomEvent<any>;
      if (isActive && customEvent.detail) {
        processRestorePayload(customEvent.detail);
      }
    };

    window.addEventListener('anarchy:external-image-global', handleGlobalEvent);

    // 3. Check fallback pending queue in localStorage
    try {
      const pending = localStorage.getItem('anarchy_pending_canvas_restore');
      if (pending) {
        localStorage.removeItem('anarchy_pending_canvas_restore');
        processRestorePayload(JSON.parse(pending));
      }
    } catch {}

    return () => {
      window.removeEventListener('anarchy:external-image-global', handleGlobalEvent);
    };
  }, [tabId, isActive, handleExternalImage, handleRestoreFullNodeTree]);

  return {
    handleExternalImage,
    handleRestoreFullNodeTree,
  };
}
