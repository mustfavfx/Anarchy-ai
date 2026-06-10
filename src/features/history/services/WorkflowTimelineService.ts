import { getLocalImage, registerObjectUrl, dataURLtoBlob } from './HistoryService';
import type { HistoryEntry, NodeTreeData } from '../types';

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
  fullInputUrl: string | null,
  fullOutputUrl: string | null
): Promise<TimelineStep[]> {
  const steps: TimelineStep[] = [];

  if (nodeTree && nodeTree.nodes && nodeTree.nodes.length > 0) {
    // Trace back from the active node (usually the sourceNodeId of the tree)
    const activeId = nodeTree.sourceNodeId;
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
        let imageUrl = node.image;
        if (imageUrl.startsWith('idb://')) {
          const cached = await getLocalImage(imageUrl);
          if (cached) imageUrl = cached;
        }
        
        // Convert to Blob Object URL for memory efficiency
        let finalUrl = imageUrl;
        if (imageUrl.startsWith('data:')) {
          try {
            const blob = dataURLtoBlob(imageUrl);
            finalUrl = registerObjectUrl(URL.createObjectURL(blob));
          } catch {}
        }

        steps.push({
          id: node.id,
          image: finalUrl,
          prompt: node.prompt,
          model: entry.model, // Reuse the model ID from parent metadata
          processingType: node.type === 'source' ? 'source' : (node.processingType || 'render'),
          timestamp: entry.timestamp,
        });
      }
    }
  }

  // Fallback to Before -> After if no timeline steps were generated
  if (steps.length === 0) {
    if (fullInputUrl) {
      steps.push({
        id: 'before',
        image: fullInputUrl,
        prompt: entry.prompt,
        model: entry.model,
        processingType: 'source',
        timestamp: entry.timestamp,
      });
    }
    if (fullOutputUrl) {
      steps.push({
        id: 'after',
        image: fullOutputUrl,
        prompt: entry.prompt,
        model: entry.model,
        processingType: entry.type || 'render',
        timestamp: entry.timestamp,
      });
    }
  }

  return steps;
}
