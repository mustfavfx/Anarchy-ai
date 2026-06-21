import { describe, it, expect } from 'vitest';
import { groupHistoryEntries } from './HistoryGroupingService';
import type { HistoryEntry } from '@/types/history';

describe('HistoryGroupingService', () => {
  it('should group entries by rootSourceId', () => {
    const entries: HistoryEntry[] = [
      { id: '1', timestamp: 1000, type: 'generate', prompt: 'a' } as any,
      { id: '2', rootSourceId: '1', timestamp: 2000, type: 'upscale' } as any,
      { id: '3', rootSourceId: '1', timestamp: 1500, type: 'variation' } as any,
      { id: '4', timestamp: 3000, type: 'render', prompt: 'b' } as any,
    ];

    const groups = groupHistoryEntries(entries);

    // Should create 2 groups (Group '1' and Group '4')
    expect(groups).toHaveLength(2);

    // Group '4' has lastModified = 3000, Group '1' has lastModified = 2000.
    // So Group '4' should be first (sorted by lastModified descending).
    expect(groups[0].id).toBe('4');
    expect(groups[0].children).toHaveLength(1);
    expect(groups[0].totalGenerations).toBe(1);
    expect(groups[0].totalUpscales).toBe(0);
    expect(groups[0].totalVariations).toBe(0);

    // Group '1' should be second
    expect(groups[1].id).toBe('1');
    expect(groups[1].children).toHaveLength(3);
    // Children sorted chronologically (oldest first: 1000, then 1500, then 2000)
    expect(groups[1].children[0].id).toBe('1');
    expect(groups[1].children[1].id).toBe('3');
    expect(groups[1].children[2].id).toBe('2');

    expect(groups[1].totalGenerations).toBe(1); // 'generate'
    expect(groups[1].totalVariations).toBe(1); // 'variation'
    expect(groups[1].totalUpscales).toBe(1); // 'upscale'
    expect(groups[1].lastModified).toBe(2000);
  });

  it('should fallback to oldest entry if rootId is not matched in group', () => {
    const entries: HistoryEntry[] = [
      { id: 'child-1', rootSourceId: 'root-none', timestamp: 2000, type: 'variation' } as any,
      { id: 'child-2', rootSourceId: 'root-none', timestamp: 1000, type: 'upscale' } as any,
    ];

    const groups = groupHistoryEntries(entries);
    expect(groups).toHaveLength(1);
    // sourceImageId should be the oldest child because no entry matched rootId 'root-none'
    expect(groups[0].sourceImageId).toBe('child-2');
  });

  it('should handle empty input array', () => {
    expect(groupHistoryEntries([])).toEqual([]);
  });
});
