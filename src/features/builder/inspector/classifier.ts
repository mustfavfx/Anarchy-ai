/**
 * classifier.ts
 * Two-stage semantic classifier: free local heuristic first, Gemini vision
 * call only when confidence is low. Results are cached by region+image hash.
 */

import type { ClassificationResult, SurfaceCategory, SurfaceFeatures } from './types';

const classificationCache = new Map<string, ClassificationResult>();

export function classifyHeuristic(features: SurfaceFeatures): ClassificationResult {
  if (features.specularHighlights > 0.6 && features.colorVariance < 0.3) {
    return { category: 'glass_facade', confidence: 0.85, source: 'heuristic' };
  }
  if (features.greenDominance > 0.5) {
    return { category: 'landscape', confidence: 0.8, source: 'heuristic' };
  }
  if (features.edgeOrthogonality > 0.7) {
    return { category: 'structural', confidence: 0.75, source: 'heuristic' };
  }
  return { category: 'unknown', confidence: 0.3, source: 'heuristic' };
}

/**
 * `callEngine` is your existing Replicate/Gemini dispatch function
 * (the same one EnginesViewModel already uses for generation calls).
 */
export async function classifyWithVisionModel(
  cropDataUrl: string,
  callEngine: (engineId: string, input: Record<string, unknown>) => Promise<{ text: string }>,
  downscale: (dataUrl: string, maxSize: number) => string
): Promise<SurfaceCategory> {
  const result = await callEngine('gemini-classify', {
    image: downscale(cropDataUrl, 256),
    prompt:
      'Classify this architectural region: glass_facade | landscape | structural | interior_detail | material. Return JSON only, e.g. {"category":"glass_facade"}.',
  });
  try {
    const parsed = JSON.parse(result.text) as { category: SurfaceCategory };
    return parsed.category;
  } catch {
    return 'unknown';
  }
}

export async function classifyRegion(
  cacheKey: string,
  features: SurfaceFeatures,
  cropDataUrl: string,
  deps: {
    callEngine: (engineId: string, input: Record<string, unknown>) => Promise<{ text: string }>;
    downscale: (dataUrl: string, maxSize: number) => string;
  }
): Promise<ClassificationResult> {
  const cached = classificationCache.get(cacheKey);
  if (cached) return cached;

  const heuristic = classifyHeuristic(features);
  if (heuristic.confidence >= 0.5) {
    classificationCache.set(cacheKey, heuristic);
    return heuristic;
  }

  const category = await classifyWithVisionModel(cropDataUrl, deps.callEngine, deps.downscale);
  const result: ClassificationResult = { category, confidence: 0.65, source: 'vision_model' };
  classificationCache.set(cacheKey, result);
  return result;
}
