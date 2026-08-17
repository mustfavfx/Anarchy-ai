import type { HistoryEntry, NodeTreeData } from '../../../types/history';

export class SnapshotService {
  static createSnapshot(
    id: string,
    type: any,
    label: string,
    prompt?: string,
    model?: string,
    outputImage?: string,
    nodeTree?: NodeTreeData
  ): HistoryEntry {
    return {
      id,
      timestamp: Date.now(),
      type,
      label,
      prompt,
      model,
      outputImage,
      nodeTree,
      params: { prompt, model },
    };
  }
}
