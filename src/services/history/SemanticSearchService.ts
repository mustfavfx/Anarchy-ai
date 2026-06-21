import { logger } from '@/utils/logger';
import type { HistoryEntry } from '@/types/history';
import { saveEmbedding, loadEmbedding } from './HistoryService';

let extractorPromise: any = null;
let modelLoading = false;
let modelLoaded = false;
let modelError = false;

async function getExtractor() {
  if (modelError) {
    throw new Error('Model failed to load previously');
  }
  if (!extractorPromise) {
    modelLoading = true;
    const event = new CustomEvent('anarchy:semantic:status', { detail: { status: 'loading' } });
    window.dispatchEvent(event);

    // --- Connectivity probe ---
    // Verify that the HuggingFace CDN is reachable before attempting to load the
    // model. This surfaces network/CSP/proxy issues early with a clear message
    // rather than a cryptic JSON parse error.
    try {
      const probeUrl =
        'https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/tokenizer_config.json';
      const probe = await fetch(probeUrl);
      const contentType = probe.headers.get('content-type') ?? '';
      if (!probe.ok || contentType.includes('text/html')) {
        const preview = await probe.text();
        logger.error(
          `[SemanticSearch] Connectivity probe FAILED — HTTP ${probe.status}, content-type: "${contentType}".`,
          'First 300 chars of response:',
          preview.substring(0, 300),
        );
        logger.error(
          '[SemanticSearch] Possible causes: CSP block, firewall/proxy interception, or rate-limiting.\n' +
          'Check index.html connect-src directive and browser DevTools → Network for this URL.',
        );
        throw new Error(
          `HuggingFace CDN unreachable (HTTP ${probe.status}, content-type: ${contentType})`,
        );
      }
      logger.log(
        `[SemanticSearch] Connectivity probe OK — HTTP ${probe.status}, content-type: "${contentType}".`,
      );
    } catch (probeErr) {
      modelError = true;
      modelLoading = false;
      extractorPromise = null;
      const sEvent = new CustomEvent('anarchy:semantic:status', { detail: { status: 'error', error: probeErr } });
      window.dispatchEvent(sEvent);
      logger.error('[SemanticSearch] Aborting model load due to connectivity probe failure:', probeErr);
      throw probeErr;
    }
    // --- End connectivity probe ---

    try {
      logger.log('[SemanticSearch] Loading Xenova/all-MiniLM-L6-v2 pipeline...');
      const { pipeline, env } = await import('@xenova/transformers');

      // --- Cache hygiene ---
      // transformers.js v2.x caches model files via the Cache API (useBrowserCache).
      // If a previous load attempt received an HTML error page (CSP block, network
      // glitch, redirect) and stored it, every subsequent load will parse that
      // cached HTML as JSON and throw "Unexpected token '<'".
      // Fix: purge ALL transformers-related cache entries before each fresh load,
      // then disable the browser cache for this session so no bad entries accumulate.
      try {
        if ('caches' in self) {
          const cacheNames = await self.caches.keys();
          const transformersCaches = cacheNames.filter(name =>
            name.includes('transformers') || name.includes('huggingface') || name.includes('xenova'),
          );
          await Promise.all(transformersCaches.map(name => self.caches.delete(name)));
          if (transformersCaches.length > 0) {
            logger.log(`[SemanticSearch] Purged ${transformersCaches.length} stale cache bucket(s):`, transformersCaches);
          }
        }
      } catch (cacheErr) {
        logger.warn('[SemanticSearch] Could not purge stale browser cache:', cacheErr);
      }

      // Bypass local /models/ path (Vite SPA fallback returns HTML for missing paths)
      env.allowLocalModels = false;
      // Disable browser Cache API to avoid accumulating bad entries during this session
      env.useBrowserCache = false;

      extractorPromise = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
        progress_callback: (progress: any) => {
          const pEvent = new CustomEvent('anarchy:semantic:progress', { detail: progress });
          window.dispatchEvent(pEvent);
        }
      });
      await extractorPromise;
      modelLoaded = true;
      modelLoading = false;
      const sEvent = new CustomEvent('anarchy:semantic:status', { detail: { status: 'ready' } });
      window.dispatchEvent(sEvent);
      logger.log('[SemanticSearch] Model loaded successfully');
    } catch (err) {
      modelError = true;
      modelLoading = false;
      extractorPromise = null;
      const sEvent = new CustomEvent('anarchy:semantic:status', { detail: { status: 'error', error: err } });
      window.dispatchEvent(sEvent);
      logger.error('[SemanticSearch] Failed to load model pipeline:', err);
      throw err;
    }
  }
  return extractorPromise;
}

export function isModelLoading(): boolean {
  return modelLoading;
}

export function isModelLoaded(): boolean {
  return modelLoaded;
}

export function isModelError(): boolean {
  return modelError;
}

/** Generate a 384-dimensional vector embedding for text */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!text || !text.trim()) return null;
  try {
    const extractor = await getExtractor();
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  } catch (err) {
    logger.warn('[SemanticSearch] Failed to generate embedding:', err);
    return null;
  }
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0.0;
  let normA = 0.0;
  let normB = 0.0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

interface QueueItem {
  entryId: string;
  text: string;
  retryCount: number;
}

class BackgroundIndexQueue {
  private queue: QueueItem[] = [];
  private activeItem: QueueItem | null = null;
  private failedMap = new Map<string, number>(); // entryId -> failCount
  private idleResolvers: (() => void)[] = [];

  public enqueue(entryId: string, text: string, priority = false) {
    if (this.isQueuedOrProcessing(entryId)) return;
    const item: QueueItem = { entryId, text, retryCount: 0 };
    if (priority) {
      this.queue.unshift(item);
    } else {
      this.queue.push(item);
    }
    this.broadcastState();
    this.processNext();
  }

  public isQueuedOrProcessing(entryId: string): boolean {
    return this.queue.some(item => item.entryId === entryId) || this.activeItem?.entryId === entryId;
  }

  public getFailedCount(entryId: string): number {
    return this.failedMap.get(entryId) || 0;
  }

  public waitIdle(): Promise<void> {
    if (this.queue.length === 0 && !this.activeItem) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.idleResolvers.push(resolve);
    });
  }

  public resume() {
    this.processNext();
  }

  private broadcastState() {
    const event = new CustomEvent('anarchy:semantic:queue', {
      detail: {
        pending: this.queue.length,
        processing: this.activeItem ? 1 : 0,
        failed: this.failedMap.size
      }
    });
    if (typeof window !== 'undefined') window.dispatchEvent(event);

    if (this.queue.length === 0 && !this.activeItem) {
      const resolvers = [...this.idleResolvers];
      this.idleResolvers = [];
      resolvers.forEach(r => r());
    }
  }

  private async processNext() {
    if (modelError) {
      logger.warn('[BackgroundIndexQueue] Indexing queue suspended due to persistent model loading error.');
      return;
    }

    if (this.activeItem || this.queue.length === 0) return;

    this.activeItem = this.queue.shift()!;
    this.broadcastState();

    const { entryId, text, retryCount } = this.activeItem;

    try {
      const vector = await generateEmbedding(text);
      if (vector) {
        await saveEmbedding(entryId, vector);
        this.failedMap.delete(entryId);
        this.activeItem = null;
        this.broadcastState();
        setTimeout(() => this.processNext(), 50);
      } else {
        // Model unavailable (network issue, CSP block, etc.) — skip gracefully
        // instead of throwing so we don't flood the console with retry loops.
        logger.warn(
          `[BackgroundIndexQueue] Semantic search unavailable for entry ${entryId} — skipping (model not ready).`,
        );
        this.activeItem = null;
        this.broadcastState();
        // Don't schedule the next iteration: leave the queue suspended until
        // the caller invokes indexQueue.resume() after resetModelError().
      }
    } catch (err) {
      logger.warn(`[BackgroundIndexQueue] Failed to index entry ${entryId}:`, err);
      try {
        import('./HistoryTelemetry').then(m => m.HistoryTelemetry.recordError('indexing'));
      } catch {}
      const nextRetry = retryCount + 1;
      if (nextRetry <= 3) {
        const backoff = Math.pow(2, nextRetry) * 1000;
        logger.log(`[BackgroundIndexQueue] Scheduling retry #${nextRetry} for ${entryId} in ${backoff}ms`);
        setTimeout(() => {
          this.queue.unshift({ entryId, text, retryCount: nextRetry });
          this.broadcastState();
          this.processNext();
        }, backoff);
      } else {
        logger.error(`[BackgroundIndexQueue] Max retries reached for entry ${entryId}. Indexing aborted.`);
        this.failedMap.set(entryId, (this.failedMap.get(entryId) || 0) + 1);
      }
      this.activeItem = null;
      this.broadcastState();
      setTimeout(() => this.processNext(), 50);
    }
  }

  public getStats() {
    return {
      pending: this.queue.length,
      processing: this.activeItem ? 1 : 0,
      failed: this.failedMap.size
    };
  }
}

export const indexQueue = new BackgroundIndexQueue();

export function resetModelError() {
  if (modelError) {
    logger.log('[SemanticSearch] Resetting model error state to allow retrying...');
    modelError = false;
    extractorPromise = null;
    indexQueue.resume();
  }
}

/** Check and generate embeddings for any entries missing them in IndexedDB (background worker) */
export async function indexMissingEntries(entries: HistoryEntry[]): Promise<void> {
  let enqueuedAny = false;
  for (const entry of entries) {
    if (!entry.prompt || !entry.prompt.trim()) continue;

    if (indexQueue.isQueuedOrProcessing(entry.id)) continue;
    if (indexQueue.getFailedCount(entry.id) >= 3) continue;

    const existing = await loadEmbedding(entry.id);
    if (!existing) {
      const isRecent = (Date.now() - entry.timestamp) < 120000;
      indexQueue.enqueue(entry.id, entry.prompt, isRecent);
      enqueuedAny = true;
    }
  }

  if (enqueuedAny) {
    await indexQueue.waitIdle();
  }
}

interface RankedResult {
  entry: HistoryEntry;
  score: number;
}

/** Perform semantic similarity search */
export async function semanticSearch(query: string, entries: HistoryEntry[]): Promise<RankedResult[]> {
  const startTime = Date.now();
  
  const executeSearch = async () => {
    if (!query || !query.trim()) {
      return entries.map(entry => ({ entry, score: 1.0 }));
    }

    const queryVector = await generateEmbedding(query);
    if (!queryVector) {
      // Fallback to simple string-matching relevance if model fails or query vector is empty
      const q = query.toLowerCase();
      return entries.map(entry => {
        let score = 0;
        if (entry.label.toLowerCase().includes(q)) score += 0.5;
        if (entry.prompt?.toLowerCase().includes(q)) score += 0.8;
        if (entry.model?.toLowerCase().includes(q)) score += 0.2;
        return { entry, score };
      }).filter(r => r.score > 0).sort((a, b) => b.score - a.score);
    }

    const results: RankedResult[] = [];
    for (const entry of entries) {
      let score = 0;
      
      // Check IndexedDB cache first
      let vector = await loadEmbedding(entry.id);
      if (!vector && entry.prompt) {
        // Lazy generate embedding if missing
        vector = await generateEmbedding(entry.prompt);
        if (vector) await saveEmbedding(entry.id, vector);
      }

      if (vector) {
        score = cosineSimilarity(queryVector, vector);
      } else {
        // Fallback for entries with no text prompts
        const q = query.toLowerCase();
        if (entry.label.toLowerCase().includes(q)) score = 0.3;
      }
      
      // Boost score slightly if keywords match explicitly
      if (entry.prompt && entry.prompt.toLowerCase().includes(query.toLowerCase())) {
        score = Math.min(1.0, score + 0.1);
      }

      results.push({ entry, score });
    }

    return results
      .filter(r => r.score > 0.15)
      .sort((a, b) => b.score - a.score);
  };

  try {
    const results = await executeSearch();
    try {
      const { HistoryTelemetry } = await import('./HistoryTelemetry');
      HistoryTelemetry.recordLatency('search', Date.now() - startTime);
    } catch {}
    return results;
  } catch (err) {
    try {
      const { HistoryTelemetry } = await import('./HistoryTelemetry');
      HistoryTelemetry.recordError('indexing');
    } catch {}
    throw err;
  }
}
