export {
  addHistoryEntry,
  getHistory,
  toggleStar,
  deleteHistoryEntry,
  clearHistory,
  getHistoryStats,
  cacheLocalImage,
  getLocalImage,
  deleteLocalImage,
  saveFullImage,
  loadFullImage,
  deleteFullImages,
  saveWorkflowTree,
  loadWorkflowTree,
  formatTime,
  formatDuration,
  getDateLabel
} from '../../features/history/services/HistoryService';

export type { HistoryEntry, NodeTreeData, HistoryGroup } from '../../features/history/types';

import { 
  loadFullImage, 
  getHistory
} from '../../features/history/services/HistoryService';
import { groupHistoryEntries } from '../../features/history/services/HistoryGroupingService';
import type { HistoryEntry, HistoryGroup } from '../../features/history/types';

export async function enrichWithFullImages(entry: HistoryEntry): Promise<HistoryEntry> {
  const enriched = { ...entry };
  const fullOutput = await loadFullImage(entry.id, 'output');
  if (fullOutput) enriched.outputImage = fullOutput;
  const fullInput = await loadFullImage(entry.id, 'input');
  if (fullInput) enriched.inputImage = fullInput;
  const fullRoot = await loadFullImage(entry.id, 'root_source');
  if (fullRoot) enriched.rootSourceImage = fullRoot;
  return enriched;
}

export function getHistoryGrouped(): HistoryGroup[] {
  return groupHistoryEntries(getHistory());
}
