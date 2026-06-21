import { logger } from '@/utils/logger';

export interface PerformanceStats {
  imageSaveDurations: number[];
  imageLoadDurations: number[];
  searchDurations: number[];
}

export interface ErrorStats {
  idbWriteErrors: number;
  idbReadErrors: number;
  indexingErrors: number;
}

export interface DiagnosticReport {
  healthScore: number;
  localStorage: {
    bytes: number;
    percentage: number;
  };
  indexedDb: {
    estimatedUsage: number;
    estimatedQuota: number;
  };
  performance: {
    averageImageSaveMs: number;
    averageImageLoadMs: number;
    averageSearchMs: number;
  };
  errors: ErrorStats;
}

const MAX_LATENCY_RECORDS = 50;

class HistoryTelemetryService {
  private latencies: PerformanceStats = {
    imageSaveDurations: [],
    imageLoadDurations: [],
    searchDurations: []
  };

  private errors: ErrorStats = {
    idbWriteErrors: 0,
    idbReadErrors: 0,
    indexingErrors: 0
  };

  /**
   * Record latency of an operation in milliseconds
   */
  public recordLatency(opType: 'imageSave' | 'imageLoad' | 'search', durationMs: number) {
    let list: number[];
    if (opType === 'imageSave') list = this.latencies.imageSaveDurations;
    else if (opType === 'imageLoad') list = this.latencies.imageLoadDurations;
    else list = this.latencies.searchDurations;

    list.push(durationMs);
    if (list.length > MAX_LATENCY_RECORDS) {
      list.shift();
    }
  }

  /**
   * Increment the error counter
   */
  public recordError(errorType: 'idbWrite' | 'idbRead' | 'indexing') {
    if (errorType === 'idbWrite') this.errors.idbWriteErrors++;
    else if (errorType === 'idbRead') this.errors.idbReadErrors++;
    else if (errorType === 'indexing') this.errors.indexingErrors++;
  }

  private getAverage(durations: number[]): number {
    if (durations.length === 0) return 0;
    const sum = durations.reduce((acc, v) => acc + v, 0);
    return Math.round(sum / durations.length);
  }

  /**
   * Get size of history metadata stored in localStorage (bytes)
   */
  public getLocalStorageSizeBytes(): number {
    try {
      const raw = localStorage.getItem('anarchy_history');
      return raw ? new Blob([raw]).size : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Estimates IndexedDB storage usage and quota
   */
  public async getIndexedDbUsageEstimate(): Promise<{ usage: number; quota: number }> {
    if (
      typeof navigator !== 'undefined' &&
      navigator.storage &&
      typeof navigator.storage.estimate === 'function'
    ) {
      try {
        const estimate = await navigator.storage.estimate();
        return {
          usage: estimate.usage || 0,
          quota: estimate.quota || 0
        };
      } catch (err) {
        logger.warn('[HistoryTelemetry] Failed to estimate storage:', err);
      }
    }
    return { usage: 0, quota: 0 };
  }

  /**
   * Computes a diagnostics report and a health score (0 - 100)
   */
  public async getDiagnosticReport(): Promise<DiagnosticReport> {
    const lsSize = this.getLocalStorageSizeBytes();
    const lsLimit = 5 * 1024 * 1024; // Standard 5MB limit
    const lsPercentage = Math.min(100, Math.round((lsSize / lsLimit) * 100 * 10) / 10);

    const idbEstimate = await this.getIndexedDbUsageEstimate();

    const avgSave = this.getAverage(this.latencies.imageSaveDurations);
    const avgLoad = this.getAverage(this.latencies.imageLoadDurations);
    const avgSearch = this.getAverage(this.latencies.searchDurations);

    // Calculate health score starting at 100
    let score = 100;

    // LocalStorage footprint penalty (heavy metadata)
    if (lsPercentage > 90) score -= 30;
    else if (lsPercentage > 75) score -= 15;
    else if (lsPercentage > 50) score -= 5;

    // Database error penalties
    const totalErrors = this.errors.idbWriteErrors + this.errors.idbReadErrors;
    score -= Math.min(30, totalErrors * 10);

    // Indexing error penalty
    score -= Math.min(15, this.errors.indexingErrors * 5);

    // Latency anomalies penalty
    if (avgSave > 1500) score -= 10; // Image saving > 1.5s
    if (avgLoad > 1000) score -= 10; // Image loading > 1.0s
    if (avgSearch > 2000) score -= 15; // Semantic search > 2.0s

    score = Math.max(0, score);

    return {
      healthScore: score,
      localStorage: {
        bytes: lsSize,
        percentage: lsPercentage
      },
      indexedDb: {
        estimatedUsage: idbEstimate.usage,
        estimatedQuota: idbEstimate.quota
      },
      performance: {
        averageImageSaveMs: avgSave,
        averageImageLoadMs: avgLoad,
        averageSearchMs: avgSearch
      },
      errors: { ...this.errors }
    };
  }

  /**
   * Log the health report diagnostics in dev environment
   */
  public async logDiagnostics() {
    try {
      const report = await this.getDiagnosticReport();
      logger.log('[HistoryTelemetry] Health Diagnostics Report:', report);
    } catch (err) {
      logger.error('[HistoryTelemetry] Failed to print diagnostics:', err);
    }
  }

  /**
   * Reset all telemetry counters and statistics (useful for cleanups / testing)
   */
  public reset() {
    this.latencies = {
      imageSaveDurations: [],
      imageLoadDurations: [],
      searchDurations: []
    };
    this.errors = {
      idbWriteErrors: 0,
      idbReadErrors: 0,
      indexingErrors: 0
    };
  }
}

export const HistoryTelemetry = new HistoryTelemetryService();
export default HistoryTelemetry;
