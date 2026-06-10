import { pipeline } from '@xenova/transformers';
import { logger } from '../../../utils/logger';
import type { HistoryEntry } from '../types';
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
    
    try {
      logger.log('[SemanticSearch] Loading Xenova/all-MiniLM-L6-v2 pipeline...');
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

/** Check and generate embeddings for any entries missing them in IndexedDB (background worker) */
let indexingInProgress = false;
export async function indexMissingEntries(entries: HistoryEntry[]): Promise<void> {
  if (indexingInProgress) return;
  indexingInProgress = true;
  
  try {
    const entriesToProcess = entries.filter(e => e.prompt && e.prompt.trim());
    if (entriesToProcess.length === 0) {
      indexingInProgress = false;
      return;
    }
    
    logger.log(`[SemanticSearch] Checking embeddings for ${entriesToProcess.length} entries...`);
    let count = 0;
    for (const entry of entriesToProcess) {
      const existing = await loadEmbedding(entry.id);
      if (!existing) {
        // Generate embedding
        const vector = await generateEmbedding(entry.prompt!);
        if (vector) {
          await saveEmbedding(entry.id, vector);
          count++;
        }
      }
    }
    if (count > 0) {
      logger.log(`[SemanticSearch] Background indexed ${count} new history entries`);
    }
  } catch (err) {
    logger.error('[SemanticSearch] Background indexing failed:', err);
  } finally {
    indexingInProgress = false;
  }
}

interface RankedResult {
  entry: HistoryEntry;
  score: number;
}

/** Perform semantic similarity search */
export async function semanticSearch(query: string, entries: HistoryEntry[]): Promise<RankedResult[]> {
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

  // Filter out extremely low similarity results and sort descending
  return results
    .filter(r => r.score > 0.15)
    .sort((a, b) => b.score - a.score);
}
