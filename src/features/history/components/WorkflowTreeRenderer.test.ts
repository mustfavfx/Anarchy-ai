import { describe, it, expect } from 'vitest';
import { buildWorkflowTreeForEntry } from './WorkflowTreeRenderer';
import type { HistoryEntry } from '../types';

describe('WorkflowTreeRenderer - buildWorkflowTreeForEntry', () => {
  it('should correctly build a hierarchical tree from flat history entries', () => {
    const entries: HistoryEntry[] = [
      { id: 'img1', timestamp: 1000, type: 'render', prompt: 'original prompt', rootId: 'img1', nodeType: 'source' } as any,
      { id: 'img2', parentId: 'img1', rootId: 'img1', timestamp: 2000, type: 'variation', prompt: 'var 1', nodeType: 'variation' } as any,
      { id: 'img3', parentId: 'img2', rootId: 'img1', timestamp: 3000, type: 'upscale', prompt: 'upscale x2', nodeType: 'upscale' } as any,
      { id: 'img4', parentId: 'img2', rootId: 'img1', timestamp: 4000, type: 'upscale', prompt: 'upscale x4', nodeType: 'upscale' } as any,
      { id: 'img5', parentId: 'img1', rootId: 'img1', timestamp: 2500, type: 'variation', prompt: 'var 2', nodeType: 'variation' } as any,
    ];

    // Build tree for img3
    const { root, activePath } = buildWorkflowTreeForEntry(entries[2], entries);

    // Root should be img1
    expect(root.id).toBe('img1');
    expect(root.children).toHaveLength(2); // img2 (timestamp 2000) and img5 (timestamp 2500)
    
    // Check children sort order (chronological: img2 first, then img5)
    expect(root.children[0].id).toBe('img2');
    expect(root.children[1].id).toBe('img5');

    // img2 should have two children: img3 and img4
    const img2Node = root.children[0];
    expect(img2Node.children).toHaveLength(2);
    expect(img2Node.children[0].id).toBe('img3');
    expect(img2Node.children[1].id).toBe('img4');

    // Active path from root to img3 should be ['img1', 'img2', 'img3']
    expect(activePath).toEqual(['img1', 'img2', 'img3']);
  });

  it('should fallback gracefully if parentId is specified but parent entry is missing', () => {
    const entries: HistoryEntry[] = [
      { id: 'img3', parentId: 'img-missing', rootId: 'img1', timestamp: 3000, type: 'upscale', prompt: 'upscale x2', nodeType: 'upscale' } as any,
    ];

    const { root, activePath } = buildWorkflowTreeForEntry(entries[0], entries);

    // Since parent and root are missing, it should fallback to img3 itself as the root
    expect(root.id).toBe('img3');
    expect(root.children).toHaveLength(0);
    expect(activePath).toEqual(['img3']);
  });
});
