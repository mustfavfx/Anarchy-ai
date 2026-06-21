import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mockPipeline = vi.fn();

vi.mock('@xenova/transformers', () => ({
  pipeline: (...args: any[]) => mockPipeline(...args),
  env: {
    allowLocalModels: true,
    useBrowserCache: true,
  }
}));

// Provide a no-op Cache API so the cache-purge code path doesn't throw in jsdom
if (typeof self !== 'undefined' && !('caches' in self)) {
  (self as any).caches = {
    keys: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(true),
  };
}


// Mock HistoryService
vi.mock('./HistoryService', () => ({
  saveEmbedding: vi.fn(),
  loadEmbedding: vi.fn(),
}));

describe('SemanticSearchService', () => {
  let SemanticSearchService: typeof import('./SemanticSearchService');
  let mockExtractor: any;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      text: async () => '{}',
    } as any);

    mockExtractor = vi.fn().mockImplementation((_text: string) => {
      // Mocking 3-dimensional embedding
      return Promise.resolve({
        data: [0.1, 0.2, 0.3],
      });
    });
    mockPipeline.mockResolvedValue(mockExtractor);
    
    SemanticSearchService = await import('./SemanticSearchService');
  });

  it('should have initial status as unloaded, not loading, and no error', () => {
    expect(SemanticSearchService.isModelLoading()).toBe(false);
    expect(SemanticSearchService.isModelLoaded()).toBe(false);
    expect(SemanticSearchService.isModelError()).toBe(false);
  });

  it('should load model on demand and generate embedding successfully', async () => {
    const embedding = await SemanticSearchService.generateEmbedding('hello world');
    expect(embedding).toEqual([0.1, 0.2, 0.3]);
    expect(SemanticSearchService.isModelLoaded()).toBe(true);
    expect(SemanticSearchService.isModelLoading()).toBe(false);
    expect(SemanticSearchService.isModelError()).toBe(false);
    expect(mockPipeline).toHaveBeenCalledTimes(1);
    expect(mockExtractor).toHaveBeenCalledWith('hello world', { pooling: 'mean', normalize: true });
  });

  it('should handle model loading failures and set error state', async () => {
    mockPipeline.mockRejectedValue(new Error('Failed to download model'));
    const embedding = await SemanticSearchService.generateEmbedding('hello world');
    expect(embedding).toBeNull();
    expect(SemanticSearchService.isModelError()).toBe(true);
    expect(SemanticSearchService.isModelLoaded()).toBe(false);
    expect(SemanticSearchService.isModelLoading()).toBe(false);
  });

  it('should index missing entries in background', async () => {
    const { loadEmbedding: mockLoad, saveEmbedding: mockSave } = await import('./HistoryService');
    vi.mocked(mockLoad).mockImplementation((id: string) => {
      if (id === 'entry-1') return Promise.resolve([0.5, 0.5, 0.5]);
      return Promise.resolve(null);
    });

    const entries = [
      { id: 'entry-1', label: 'Label 1', prompt: 'Prompt 1', type: 'render' as const, timestamp: Date.now() },
      { id: 'entry-2', label: 'Label 2', prompt: 'Prompt 2', type: 'render' as const, timestamp: Date.now() },
      { id: 'entry-3', label: 'Label 3', prompt: '', type: 'render' as const, timestamp: Date.now() }, // empty prompt should be skipped
    ];

    await SemanticSearchService.indexMissingEntries(entries);

    // entry-1 already has embedding, entry-3 has empty prompt.
    // entry-2 has no embedding, so it should generate and save it.
    expect(mockLoad).toHaveBeenCalledWith('entry-1');
    expect(mockLoad).toHaveBeenCalledWith('entry-2');
    expect(mockSave).toHaveBeenCalledWith('entry-2', [0.1, 0.2, 0.3]);
    expect(mockSave).not.toHaveBeenCalledWith('entry-1', expect.any(Array));
  });

  it('should perform semantic search and return cosine similarity ranked results', async () => {
    const { loadEmbedding: mockLoad } = await import('./HistoryService');
    
    // Query vector: [1, 0, 0]
    // We mock generator to return query vector for the query 'query text'
    // and distinct vectors for the entries.
    mockExtractor.mockImplementation((text: string) => {
      if (text === 'query text') {
        return Promise.resolve({ data: [1.0, 0.0, 0.0] });
      }
      return Promise.resolve({ data: [0.0, 1.0, 0.0] }); // completely orthogonal
    });

    vi.mocked(mockLoad).mockImplementation((id: string) => {
      if (id === 'entry-1') return Promise.resolve([1.0, 0.0, 0.0]); // Identical to query vector
      if (id === 'entry-2') return Promise.resolve([0.0, 1.0, 0.0]); // Orthogonal
      return Promise.resolve(null);
    });

    const entries = [
      { id: 'entry-1', label: 'Matching entry', prompt: 'Matching prompt', type: 'render' as const, timestamp: Date.now() },
      { id: 'entry-2', label: 'Non-matching entry', prompt: 'Non-matching prompt', type: 'render' as const, timestamp: Date.now() },
    ];

    const results = await SemanticSearchService.semanticSearch('query text', entries);
    
    // entry-1 similarity should be ~1.0
    // entry-2 similarity should be ~0.0 (below 0.15 threshold, so excluded or low score)
    expect(results).toHaveLength(1);
    expect(results[0].entry.id).toBe('entry-1');
    expect(results[0].score).toBeGreaterThan(0.9);
  });

  it('should fallback to keyword-based relevance search when query embedding generation fails', async () => {
    mockExtractor.mockRejectedValue(new Error('Extraction failed'));

    const entries = [
      { id: 'entry-1', label: 'Apples and Bananas', prompt: 'Fresh fruit today', type: 'render' as const, timestamp: Date.now() },
      { id: 'entry-2', label: 'Cars and bikes', prompt: 'Electric vehicle', type: 'render' as const, timestamp: Date.now() },
    ];

    const results = await SemanticSearchService.semanticSearch('fruit', entries);

    expect(results).toHaveLength(1);
    expect(results[0].entry.id).toBe('entry-1');
    expect(results[0].score).toBeGreaterThan(0);
  });

  describe('BackgroundIndexQueue', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      // Mock fetch so the connectivity probe in getExtractor() resolves
      // immediately without making real network requests (fake timers block I/O).
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        text: async () => '{}',
      } as any);
    });

    afterEach(() => {
      vi.restoreAllMocks();
      vi.useRealTimers();
    });


    it('should queue items and process them sequentially', async () => {
      const { indexQueue } = SemanticSearchService;
      // Force clear queue state
      (indexQueue as any).queue = [];
      (indexQueue as any).activeItem = null;
      (indexQueue as any).failedMap.clear();

      const { saveEmbedding: mockSave } = await import('./HistoryService');

      indexQueue.enqueue('item-1', 'text 1');
      indexQueue.enqueue('item-2', 'text 2');

      const stats = indexQueue.getStats();
      expect(stats.pending).toBe(1);
      expect(stats.processing).toBe(1);

      // Let first process finish
      await vi.runOnlyPendingTimersAsync();
      expect(mockSave).toHaveBeenCalledWith('item-1', [0.1, 0.2, 0.3]);

      await vi.runOnlyPendingTimersAsync();
      expect(mockSave).toHaveBeenCalledWith('item-2', [0.1, 0.2, 0.3]);
    });

    it('should skip items gracefully when model is unavailable (null embedding)', async () => {
      const { indexQueue } = SemanticSearchService;
      // Force clear queue state
      (indexQueue as any).queue = [];
      (indexQueue as any).activeItem = null;
      (indexQueue as any).failedMap.clear();

      // Make the extractor fail — generateEmbedding() catches this and returns null.
      // The new graceful-skip behavior suspends the queue instead of retrying in a loop.
      mockExtractor.mockRejectedValueOnce(new Error('Temporary error'));

      indexQueue.enqueue('skip-item', 'unavailable model text');

      // Run the processing step — it should fail gracefully and skip
      await vi.runOnlyPendingTimersAsync();

      // Item must be skipped: no active item, no pending items
      const stats = indexQueue.getStats();
      expect(stats.processing).toBe(0);
      expect(stats.pending).toBe(0);

      // saveEmbedding must NOT have been called (skipped, not saved)
      const { saveEmbedding: mockSave } = await import('./HistoryService');
      expect(mockSave).not.toHaveBeenCalledWith('skip-item', expect.anything());
    });
  });
});

