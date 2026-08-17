import { GraphValidator } from './GraphValidator';
import { GraphRepair } from './GraphRepair';
import { CanvasSessionManager } from '../canvas/CanvasSessionManager';
import { HistoryEventBus } from './HistoryEventBus';
import type { HistoryEntry } from '../../../types/history';
import { getHistoryNodeLabel } from '../../../utils/nodeLabel';

export class RestorePipeline {
  static restore(entry: HistoryEntry, navigate: (path: string) => void, sessionId: string = 'default'): boolean {
    try {
      let finalTree = entry.nodeTree;
      const edges = entry.params?.edges || [];

      if (finalTree) {
        const validation = GraphValidator.validateGraph(finalTree, edges);
        if (!validation.isValid) {
          console.warn('[RestorePipeline] Graph validation failed. Executing GraphRepair...', validation);
          const { repairedTree } = GraphRepair.repairGraph(finalTree, edges);
          finalTree = repairedTree;
        }
      }

      const nodeLabel = getHistoryNodeLabel(entry);
      const promptText = entry.prompt || entry.params?.prompt || '';
      const hasFullTree = finalTree && Array.isArray(finalTree.nodes) && finalTree.nodes.length > 0;

      if (hasFullTree && finalTree) {
        CanvasSessionManager.setPendingPayload({
          kind: 'nodeTree',
          nodeTree: finalTree,
          source: entry.id ? `history:${entry.id}` : 'history',
          entryId: entry.id,
        }, sessionId);
      } else {
        CanvasSessionManager.setPendingPayload({
          kind: 'image',
          image: entry.outputImage || entry.inputImage || '',
          source: entry.id ? `history:${entry.id}` : 'history',
          label: nodeLabel,
          prompt: promptText,
          model: entry.model || entry.params?.model || '',
        }, sessionId);
      }

      HistoryEventBus.getInstance().emit({
        type: 'CanvasRestored',
        entryId: entry.id,
        hasFullTree: !!hasFullTree,
        timestamp: Date.now(),
      });

      navigate('/builder');
      return true;
    } catch (err: any) {
      console.error('[RestorePipeline] Restore failed:', err);
      HistoryEventBus.getInstance().emit({
        type: 'ValidationFailed',
        entryId: entry.id,
        errors: [err?.message || 'Unknown restore error'],
        timestamp: Date.now(),
      });
      return false;
    }
  }
}
