import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CanvasSessionManager, RestoreEngine } from '@/services/history/engine';
import { CanvasHandoffService } from '@/services/canvas/CanvasHandoffService';
import { getHistoryNodeLabel } from '@/utils/nodeLabel';
import { loadWorkflowTree } from '@/services/history/HistoryService';
import { useHistoryStore } from '@/stores/historyStore';
import { buildWorkflowTreeForEntry, type HistoryTreeNode } from '@/features/history/components/WorkflowTreeRenderer';
import type { HistoryEntry, NodeTreeData } from '@/types/history';

const DEFAULT_SESSION_ID = 'default-canvas';

export function createNodeTreeFromEntry(entry: HistoryEntry, allEntries: HistoryEntry[]): NodeTreeData {
  // 1. Build true lineage IDs for entry by tracing ancestors upwards & descendants downwards via parentId ONLY
  const lineageIds = new Set<string>([entry.id]);

  let curr: HistoryEntry | undefined = entry;
  const visitedAncestors = new Set<string>([entry.id]);
  while (curr && curr.parentId && !visitedAncestors.has(curr.parentId)) {
    visitedAncestors.add(curr.parentId);
    const parent = allEntries.find(e => e.id === curr!.parentId);
    if (!parent) break;
    lineageIds.add(parent.id);
    curr = parent;
  }

  const rootEntry = curr || entry;
  const rootId = rootEntry.id;

  let addedNew = true;
  while (addedNew) {
    addedNew = false;
    for (const e of allEntries) {
      if (!lineageIds.has(e.id) && e.parentId && lineageIds.has(e.parentId)) {
        lineageIds.add(e.id);
        addedNew = true;
      }
    }
  }

  // Filter entries to strictly related lineage entries only
  const strictlyRelatedEntries = allEntries.filter(e => lineageIds.has(e.id));

  const { root } = buildWorkflowTreeForEntry(entry, strictlyRelatedEntries);

  const nodesMap = new Map<string, HistoryTreeNode>();
  const collectNodes = (node: HistoryTreeNode) => {
    nodesMap.set(node.id, node);
    node.children.forEach(collectNodes);
  };
  collectNodes(root);

  const positions = new Map<string, { x: number; y: number }>();
  let currentY = 150;

  const layoutNode = (node: HistoryTreeNode, depth = 0) => {
    const x = 120 + depth * 380;
    const y = currentY;
    positions.set(node.id, { x, y });

    if (node.children.length === 0) {
      currentY += 280;
    } else {
      node.children.forEach(child => {
        layoutNode(child, depth + 1);
      });
    }
  };

  layoutNode(root);

  const nodes = Array.from(nodesMap.values()).map(node => {
    const pos = positions.get(node.id) || { x: 200, y: 200 };
    const isRoot = node.id === rootId;
    const entryItem = node.entry;

    const imgUrl = entryItem.url || entryItem.thumbnailUrl || `idb://${entryItem.id}_output`;

    const cleanModel = entryItem.model || entryItem.params?.model || '';
    const nodeLabel = cleanModel ? cleanModel : getHistoryNodeLabel(entryItem);
    const promptText = entryItem.prompt || entryItem.params?.prompt || '';
    const layoutData = entryItem.layout || entryItem.extractedLayout || entryItem.params?.layout || entryItem.params?.analysisResult;

    return {
      id: node.id,
      type: isRoot ? ('source' as const) : ('result' as const),
      position: pos,
      image: imgUrl,
      label: nodeLabel,
      prompt: promptText,
      model: cleanModel,
      layout: layoutData,
      extractedLayout: layoutData,
      isAnalyzed: !!layoutData,
      processingType: isRoot ? 'source' : entryItem.type === 'upscale' ? 'upscale' : entryItem.type,
      state: 'ready' as const,
      parentId: node.parentId,
      historyEntryId: entryItem.id,
      children: node.children.map(c => c.id),
    };
  });

  return {
    nodes,
    sourceNodeId: rootId,
    activeNodeId: entry.id,
    createdAt: Date.now(),
  };
}

/**
 * useHistoryRestore — Safe restore hook via HistoryEngine v3.1 RestorePipeline.
 */
export function useHistoryRestore() {
  const navigate = useNavigate();

  const restore = useCallback(async (entry: HistoryEntry, targetSessionId = DEFAULT_SESSION_ID): Promise<boolean> => {
    let nodeTree: NodeTreeData | null = entry.nodeTree || null;

    if (!nodeTree) {
      try {
        nodeTree = await loadWorkflowTree(entry.id);
      } catch {}
    }

    if (!nodeTree || !nodeTree.nodes || nodeTree.nodes.length === 0) {
      const allEntries = useHistoryStore.getState().entries;
      nodeTree = createNodeTreeFromEntry(entry, allEntries);
    }

    if (nodeTree && nodeTree.nodes && nodeTree.nodes.length > 0) {
      const plan = RestoreEngine.planFullRestore(nodeTree);
      const repairedTree = plan.repairedTree || nodeTree;

      const payload = {
        kind: 'nodeTree' as const,
        nodeTree: repairedTree,
        source: entry.id ? `history:${entry.id}` : 'history',
        entryId: entry.id,
      };

      CanvasSessionManager.setPending(targetSessionId, payload);
      CanvasHandoffService.setPending(payload);

      navigate('/builder');

      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent('anarchy:external-image-global', {
            detail: payload,
          })
        );
      }, 100);

      return true;
    }

    // Fallback if no tree could be built
    const cleanModel = entry.model || entry.params?.model || '';
    const nodeLabel = cleanModel ? cleanModel : getHistoryNodeLabel(entry);
    const promptText = entry.prompt || entry.params?.prompt || '';
    const payload = {
      kind: 'image' as const,
      image: entry.url || entry.thumbnailUrl || '',
      source: entry.id ? `history:${entry.id}` : 'history',
      label: nodeLabel,
      prompt: promptText,
      model: cleanModel,
    };

    CanvasSessionManager.setPending(targetSessionId, payload);
    CanvasHandoffService.setPending(payload);

    navigate('/builder');

    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('anarchy:external-image-global', {
          detail: payload,
        })
      );
    }, 100);

    return true;
  }, [navigate]);

  const restoreSingleNode = useCallback((entry: HistoryEntry, nodeId: string, attachToNodeId?: string, targetSessionId = DEFAULT_SESSION_ID) => {
    if (!entry.nodeTree) return false;
    const payload = {
      kind: 'singleNode' as const,
      nodeTree: entry.nodeTree,
      nodeId,
      source: entry.id ? `history:${entry.id}` : 'history',
      attachToNodeId,
    };

    CanvasSessionManager.setPending(targetSessionId, payload as any);
    CanvasHandoffService.setPending(payload as any);
    navigate('/builder');
    return true;
  }, [navigate]);

  return { restore, restoreSingleNode };
}
