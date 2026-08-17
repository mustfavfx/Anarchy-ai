import { restoreNodeTree, type CanvasNodeFactory, type RestoreNodeTreeOptions } from '../../../services/canvas/NodeTreeRestoreService';
import type { NodeTreeData } from '../../../types/history';

export class EngineNodeTreeRestoreService {
  static async restoreGraph(
    nodeTree: NodeTreeData,
    factory: CanvasNodeFactory,
    options?: RestoreNodeTreeOptions
  ): Promise<void> {
    return restoreNodeTree(nodeTree, factory, options);
  }
}
