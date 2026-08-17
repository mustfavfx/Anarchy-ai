import { useMemo } from 'react';
import type { HistoryEntry } from '@/types/history';

export interface HistoryMetrics {
  /** Total number of generations */
  totalGenerations: number;
  /** Total number of upscales */
  totalUpscales: number;
  /** Total number of edits/variations */
  totalEdits: number;
  /** Average generation time in ms */
  avgDurationMs: number;
  /** Fastest generation time in ms */
  fastestMs: number;
  /** Slowest generation time in ms */
  slowestMs: number;
  /** Total generation time in ms */
  totalDurationMs: number;
  /** Most used model */
  topModel: string;
  /** Model usage counts */
  modelUsage: Record<string, number>;
  /** Generations today */
  todayCount: number;
  /** Generations this week */
  weekCount: number;
  /** Estimated credits used (if duration-based) */
  estimatedCreditsUsed: number;
  /** Average snapshot size in nodes */
  avgNodeCount: number;
  /** Peak node count in any snapshot */
  peakNodeCount: number;
}

/**
 * useHistoryMetrics — Computes rich analytics from history entries.
 *
 * Returns metrics including:
 * - Generation counts by type
 * - Duration stats (avg, min, max, total)
 * - Model usage rankings
 * - Temporal stats (today, this week)
 * - Graph complexity stats (avg/peak node count)
 */
export function useHistoryMetrics(entries: HistoryEntry[]): HistoryMetrics {
  return useMemo(() => {
    if (entries.length === 0) {
      return {
        totalGenerations: 0,
        totalUpscales: 0,
        totalEdits: 0,
        avgDurationMs: 0,
        fastestMs: 0,
        slowestMs: 0,
        totalDurationMs: 0,
        topModel: '',
        modelUsage: {},
        todayCount: 0,
        weekCount: 0,
        estimatedCreditsUsed: 0,
        avgNodeCount: 0,
        peakNodeCount: 0,
      };
    }

    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = now - 7 * 24 * 60 * 60 * 1000;

    let totalDurationMs = 0;
    let fastestMs = Infinity;
    let slowestMs = 0;
    let durationCount = 0;
    let totalGenerations = 0;
    let totalUpscales = 0;
    let totalEdits = 0;
    let todayCount = 0;
    let weekCount = 0;
    let totalNodeCount = 0;
    let peakNodeCount = 0;
    let nodeCountEntries = 0;
    const modelUsage: Record<string, number> = {};

    for (const entry of entries) {
      // Type counts
      if (entry.type === 'upscale') totalUpscales++;
      else if (entry.type === 'edit' || entry.type === 'variation') totalEdits++;
      else totalGenerations++;

      // Duration stats
      if (entry.duration && entry.duration > 0) {
        totalDurationMs += entry.duration;
        fastestMs = Math.min(fastestMs, entry.duration);
        slowestMs = Math.max(slowestMs, entry.duration);
        durationCount++;
      }

      // Model usage
      if (entry.model) {
        const shortModel = entry.model.split('/').pop() || entry.model;
        modelUsage[shortModel] = (modelUsage[shortModel] || 0) + 1;
      }

      // Temporal stats
      if (entry.timestamp >= todayStart.getTime()) todayCount++;
      if (entry.timestamp >= weekStart) weekCount++;

      // Graph complexity
      const nodeCount = entry.nodeTree?.nodes?.length || 0;
      if (nodeCount > 0) {
        totalNodeCount += nodeCount;
        peakNodeCount = Math.max(peakNodeCount, nodeCount);
        nodeCountEntries++;
      }
    }

    // Top model
    const topModel = Object.entries(modelUsage)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || '';

    // Estimated credits (rough: 1 credit per ~15 seconds)
    const estimatedCreditsUsed = Math.round(totalDurationMs / 15000);

    return {
      totalGenerations,
      totalUpscales,
      totalEdits,
      avgDurationMs: durationCount > 0 ? Math.round(totalDurationMs / durationCount) : 0,
      fastestMs: fastestMs === Infinity ? 0 : fastestMs,
      slowestMs,
      totalDurationMs,
      topModel,
      modelUsage,
      todayCount,
      weekCount,
      estimatedCreditsUsed,
      avgNodeCount: nodeCountEntries > 0 ? Math.round(totalNodeCount / nodeCountEntries) : 0,
      peakNodeCount,
    };
  }, [entries]);
}
