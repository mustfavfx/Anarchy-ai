import type { HistoryEntry, NodeTreeData } from '@/types/history';

export interface TimelineStep {
  id: string;
  image: string;          // Object URL
  prompt?: string;
  model?: string;
  processingType: string; // 'source' | 'render' | 'upscale' | 'variation' | 'edit'
  timestamp?: number;
}

/**
 * Builds a linear timeline sequence of steps leading to the given history entry.
 * If a NodeTree workflow is present, it traces from the active node back to the root source.
 * If no NodeTree is present, it returns a 2-step Before -> After timeline using input/output images.
 */
export async function buildWorkflowTimeline(
  entry: HistoryEntry,
  nodeTree: NodeTreeData | null,
  _fullInputUrl: string | null,
  _fullOutputUrl: string | null
): Promise<TimelineStep[]> {
  const steps: TimelineStep[] = [];

  if (nodeTree && nodeTree.nodes && nodeTree.nodes.length > 0) {
    // Trace back from the active node (usually the leaf node corresponding to this entry)
    const activeId = nodeTree.activeNodeId || nodeTree.nodes.find(n => n.historyEntryId === entry.id)?.id || nodeTree.nodes[nodeTree.nodes.length - 1]?.id || nodeTree.sourceNodeId;
    type TreeNode = NonNullable<NodeTreeData>['nodes'][0];
    const nodeMap = new Map<string, TreeNode>(nodeTree.nodes.map(n => [n.id, n]));
    
    let currentId: string | undefined = activeId;
    const path: TreeNode[] = [];
    const visited = new Set<string>(); // Prevent infinite loops

    while (currentId && nodeMap.has(currentId) && !visited.has(currentId)) {
      visited.add(currentId);
      const currNode: TreeNode = nodeMap.get(currentId)!;
      path.push(currNode);
      currentId = currNode.parentId;
    }

    // Reverse path so it goes from Root -> Children -> Final
    path.reverse();

    for (const node of path) {
      if (node.image) {
        // We set the step ID to the historyEntryId (so clicking the step selects that entry),
        // falling back to node.id for unsaved/ghost/legacy nodes.
        steps.push({
          id: node.historyEntryId || node.id,
          image: '', // Lazy loaded by TimelineNodeCard via useLazyImage
          prompt: node.prompt,
          model: entry.model,
          processingType: node.type === 'source' ? 'source' : (node.processingType || 'render'),
          timestamp: entry.timestamp,
        });
      }
    }
  }

  // Fallback to Before -> After if no timeline steps were generated
  if (steps.length === 0) {
    steps.push({
      id: entry.parentId || 'before',
      image: '', // Lazy loaded by TimelineNodeCard via useLazyImage
      prompt: entry.prompt,
      model: entry.model,
      processingType: 'source',
      timestamp: entry.timestamp,
    });
    steps.push({
      id: entry.id,
      image: '', // Lazy loaded by TimelineNodeCard via useLazyImage
      prompt: entry.prompt,
      model: entry.model,
      processingType: entry.type || 'render',
      timestamp: entry.timestamp,
    });
  }

  return steps;
}
