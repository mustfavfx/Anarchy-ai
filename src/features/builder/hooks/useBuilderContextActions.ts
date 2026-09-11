import { useCallback } from 'react';
import { logger } from '../../../utils/logger';
import { useAIConfigStore } from '../../../stores/aiConfigStore';
import type { BuilderNode } from '../types';
import type { ContextAction } from '../components/BuilderContextMenu';

export interface UseBuilderContextActionsParams {
  contextNode: BuilderNode | null;
  contextMenu: { x: number; y: number; canvasX?: number; canvasY?: number } | null;
  setContextMenu: (menu: any) => void;
  createSourceNode: (imageUrl?: string, label?: string, position?: { x: number; y: number }) => string;
  rearrangeNodes: () => void;
  fitView: (options?: any) => void;
  deleteNode: (id: string) => void;
  handleContextCompare: (node: BuilderNode | undefined, slot: 'A' | 'B') => void;
  handleContextSaveNodeImage: (node: BuilderNode | undefined) => void;
  handleContextExportDXF: (node: BuilderNode | undefined) => void;
  handleContextAnalyzePlan: (node: BuilderNode | undefined) => Promise<void>;
  handleContextExportAll: () => void;
  handleContextExportPDF: () => void;
  handleContextExportZip: (selectedOnly: boolean, node?: BuilderNode | undefined) => Promise<void>;
  handleSave: () => Promise<void>;
  handleLoad: () => Promise<void>;
  handleContextOpenImagesFolder: (node: BuilderNode | undefined) => Promise<void>;
  handleContextExportNodePDF: (node: BuilderNode | undefined) => Promise<void>;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedNode: (node: any) => void;
}

export function useBuilderContextActions({
  contextNode,
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
}: UseBuilderContextActionsParams) {
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
        setTimeout(() => fitView({ padding: 0.2, minZoom: 0.4, duration: 400 }), 50);
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
      case 'export-zip':
        void handleContextExportZip(false);
        break;
      case 'export-selection-zip':
        void handleContextExportZip(true, contextNode);
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
      case 'draw-mask': {
        if (contextNode) {
          // 1. Select the node
          setSelectedNodeId(contextNode.id);
          const data = (contextNode.data || {}) as any;
          setSelectedNode({
            id: contextNode.id,
            type: data?.type || null,
            image: data?.image || data?.outputData?.image,
            originalImage: data?.originalImage,
            prompt: data?.prompt,
            state: data?.state,
          });

          // 2. Open drawing/mask tab
          useAIConfigStore.getState().setPreviewMode('draw');
        }
        break;
      }
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
    handleContextExportZip,
    handleSave,
    handleLoad,
    handleContextOpenImagesFolder,
    handleContextExportNodePDF,
    setSelectedNodeId,
    setSelectedNode,
    setContextMenu,
  ]);

  return { runContextAction };
}
