import type { HistoryEntry, HistoryGroup } from '../types';

/**
 * Group flat history entries by their rootSourceId.
 * If an entry has no rootSourceId, it is treated as its own root/standalone group.
 */
export function groupHistoryEntries(entries: HistoryEntry[]): HistoryGroup[] {
  const groupsMap = new Map<string, HistoryEntry[]>();

  // First pass: Group entries by rootSourceId
  for (const entry of entries) {
    const rootId = entry.rootSourceId || entry.id;
    if (!groupsMap.has(rootId)) {
      groupsMap.set(rootId, []);
    }
    groupsMap.get(rootId)!.push(entry);
  }

  const groups: HistoryGroup[] = [];

  for (const [rootId, groupEntries] of groupsMap.entries()) {
    // Sort entries chronologically (oldest first for children order)
    const sortedEntries = [...groupEntries].sort((a, b) => a.timestamp - b.timestamp);
    
    // Find the primary source entry representing this group
    // Ideally the entry whose ID is rootId, otherwise the oldest entry in the group
    const sourceEntry = sortedEntries.find(e => e.id === rootId) || sortedEntries[0];

    const totalGenerations = sortedEntries.filter(e => e.type === 'generate' || e.type === 'render').length;
    const totalUpscales = sortedEntries.filter(e => e.type === 'upscale').length;
    const totalVariations = sortedEntries.filter(e => e.type === 'variation').length;
    
    const lastModified = Math.max(...sortedEntries.map(e => e.timestamp));

    groups.push({
      id: rootId,
      sourceImageId: sourceEntry.id,
      sourceImage: '', // Resolved dynamically in UI via hook/component from IDB
      createdAt: sourceEntry.timestamp,
      children: sortedEntries,
      totalGenerations,
      totalUpscales,
      totalVariations,
      lastModified,
    });
  }

  // Sort groups by lastModified descending (newest group activity first)
  return groups.sort((a, b) => b.lastModified - a.lastModified);
}
