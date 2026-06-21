import { describe, it, expect, vi, beforeEach } from 'vitest';
import { salvageCorruptHistoryJSON, selfHealHistory } from './HistorySelfHealing';
import * as HistoryService from './HistoryService';

// Mock HistoryService
vi.mock('./HistoryService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./HistoryService')>();
  return {
    ...actual,
    loadEntries: vi.fn(),
    saveEntries: vi.fn(),
    openImageDB: vi.fn(),
    loadRawData: vi.fn(),
    saveThumbnail: vi.fn(),
    deleteRawData: vi.fn(),
    blobToDataURL: vi.fn(),
    deleteEmbedding: vi.fn(),
  };
});

// Mock CollectionService
vi.mock('./CollectionService', () => ({
  CollectionService: {
    load: vi.fn(() => []),
    save: vi.fn(),
  }
}));

describe('HistorySelfHealing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('salvageCorruptHistoryJSON', () => {
    it('returns original array if valid JSON', () => {
      const entries = [{ id: 'h_123_abc', timestamp: 1000, type: 'render' as const, label: 'Entry 1' }];
      const result = salvageCorruptHistoryJSON(JSON.stringify(entries));
      expect(result).toEqual(entries);
    });

    it('salvages valid objects from a corrupted JSON string', () => {
      const corruptStr = 'some garbage prefix {"id":"h_1781850683355_4noxt0","timestamp":1781850683355,"type":"render","label":"Salvaged 1"} some other garbage {"id":"h_1781850683356_5xyz99","timestamp":1781850683356,"type":"upscale","label":"Salvaged 2"} suffix';
      const result = salvageCorruptHistoryJSON(corruptStr);
      expect(result).toHaveLength(2);
      expect(result[0].label).toBe('Salvaged 1');
      expect(result[0].id).toBe('h_1781850683355_4noxt0');
      expect(result[1].label).toBe('Salvaged 2');
    });

    it('returns empty array if no valid entry matches found', () => {
      const corruptStr = 'no json here at all';
      const result = salvageCorruptHistoryJSON(corruptStr);
      expect(result).toEqual([]);
    });
  });

  describe('selfHealHistory', () => {
    it('salvages metadata when localStorage contains invalid JSON', async () => {
      const corruptStr = 'corrupted data {"id":"h_1781850683355_4noxt0","timestamp":1781850683355,"type":"render","label":"Salvaged Entry"}';
      localStorage.setItem('anarchy_history', corruptStr);

      const mockDb = {
        objectStoreNames: {
          contains: vi.fn(() => false)
        },
        close: vi.fn()
      };
      vi.mocked(HistoryService.openImageDB).mockResolvedValue(mockDb as any);

      const report = await selfHealHistory();

      expect(report.repairedMetadata).toBe(true);
      expect(report.salvagedEntriesCount).toBe(1);
      expect(HistoryService.saveEntries).toHaveBeenCalled();
    });

    it('prunes orphaned images and embeddings from IndexedDB', async () => {
      // Mock 1 valid entry in localStorage
      const entries = [{ id: 'h_1781850683355_4noxt0', timestamp: 1000, type: 'render' as const, label: 'Valid' }];
      vi.mocked(HistoryService.loadEntries).mockReturnValue(entries);
      localStorage.setItem('anarchy_history', JSON.stringify(entries));

      // Mock IndexedDB stores
      const mockImagesStore = {
        getAllKeys: vi.fn().mockReturnValue({
          onsuccess: null,
          onerror: null,
          result: [
            'h_1781850683355_4noxt0_output', // Valid
            'h_999999999999_orphaned_output', // Orphaned
          ]
        })
      };

      const mockEmbeddingsStore = {
        getAllKeys: vi.fn().mockReturnValue({
          onsuccess: null,
          onerror: null,
          result: [
            'h_1781850683355_4noxt0', // Valid
            'h_999999999999_orphaned', // Orphaned
          ]
        })
      };

      const mockDb = {
        objectStoreNames: {
          contains: vi.fn((name) => name === 'images' || name === 'embeddings')
        },
        transaction: vi.fn((storeName) => {
          const store = storeName === 'images' ? mockImagesStore : mockEmbeddingsStore;
          // Trigger onsuccess asynchronously to simulate IndexedDB
          setTimeout(() => {
            if (store.getAllKeys().onsuccess) {
              store.getAllKeys().onsuccess();
            }
          }, 0);
          return { objectStore: vi.fn(() => store) };
        }),
        close: vi.fn()
      };

      vi.mocked(HistoryService.openImageDB).mockResolvedValue(mockDb as any);

      const report = await selfHealHistory();

      expect(report.cleanedOrphansCount).toBe(2); // 1 image + 1 embedding
      expect(HistoryService.deleteRawData).toHaveBeenCalledWith('h_999999999999_orphaned_output');
    });

    it('reconstructs missing thumbnails when full resolution image exists', async () => {
      const entryId = 'h_1781850683355_4noxt0';
      const entries = [{ id: entryId, timestamp: 1000, type: 'render' as const, label: 'Entry' }];
      vi.mocked(HistoryService.loadEntries).mockReturnValue(entries);
      localStorage.setItem('anarchy_history', JSON.stringify(entries));

      // Mock openImageDB returning an empty DB (no orphans)
      const mockDb = {
        objectStoreNames: { contains: vi.fn(() => false) },
        close: vi.fn()
      };
      vi.mocked(HistoryService.openImageDB).mockResolvedValue(mockDb as any);

      // Mock full image exists but thumbnail does not
      vi.mocked(HistoryService.loadRawData).mockImplementation((key) => {
        if (key === `${entryId}_output`) return Promise.resolve(new Blob(['full-res-image'], { type: 'image/png' }));
        if (key === `${entryId}_thumb_output`) return Promise.resolve(null);
        return Promise.resolve(null);
      });

      vi.mocked(HistoryService.blobToDataURL).mockResolvedValue('data:image/png;base64,full-res-data-url');

      const report = await selfHealHistory();

      expect(report.reconstructedThumbnailsCount).toBe(1);
      expect(HistoryService.saveThumbnail).toHaveBeenCalledWith(entryId, 'output', 'data:image/png;base64,full-res-data-url');
    });
  });
});
