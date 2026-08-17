import { CanvasSessionManager } from '../canvas/CanvasSessionManager';
import type { HistoryEntry } from '../../../types/history';
import { getHistoryNodeLabel } from '../../../utils/nodeLabel';

export class RestoreService {
  static restoreToCanvas(entry: HistoryEntry, navigate: (path: string) => void): void {
    const nodeLabel = getHistoryNodeLabel(entry);
    const promptText = entry.prompt || entry.params?.prompt || '';
    const hasFullTree = entry.nodeTree && Array.isArray(entry.nodeTree.nodes) && entry.nodeTree.nodes.length > 0;

    if (hasFullTree && entry.nodeTree) {
      CanvasSessionManager.initiateHandoff({
        kind: 'nodeTree',
        nodeTree: entry.nodeTree,
        source: entry.id ? `history:${entry.id}` : 'history',
        entryId: entry.id,
      });
    } else {
      CanvasSessionManager.initiateHandoff({
        kind: 'image',
        image: entry.outputImage || entry.inputImage || '',
        source: entry.id ? `history:${entry.id}` : 'history',
        label: nodeLabel,
        prompt: promptText,
        model: entry.model || entry.params?.model || '',
      });
    }

    navigate('/builder');
  }
}
