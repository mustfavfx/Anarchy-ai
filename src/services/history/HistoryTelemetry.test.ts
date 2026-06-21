import { describe, it, expect, beforeEach } from 'vitest';
import { HistoryTelemetry } from './HistoryTelemetry';

describe('HistoryTelemetry', () => {
  beforeEach(() => {
    HistoryTelemetry.reset();
    localStorage.clear();
  });

  it('records and averages operation latencies correctly', async () => {
    HistoryTelemetry.recordLatency('imageSave', 100);
    HistoryTelemetry.recordLatency('imageSave', 200);
    HistoryTelemetry.recordLatency('imageSave', 300);

    HistoryTelemetry.recordLatency('search', 50);
    HistoryTelemetry.recordLatency('search', 150);

    const report = await HistoryTelemetry.getDiagnosticReport();

    expect(report.performance.averageImageSaveMs).toBe(200);
    expect(report.performance.averageSearchMs).toBe(100);
    expect(report.performance.averageImageLoadMs).toBe(0);
  });

  it('limits latency record history to MAX_LATENCY_RECORDS', async () => {
    // Fill up to 55 records
    for (let i = 1; i <= 55; i++) {
      HistoryTelemetry.recordLatency('imageLoad', i); // 1 to 55
    }

    const report = await HistoryTelemetry.getDiagnosticReport();
    // Average should be of items 6 to 55: (6+55)/2 = 30.5 => 31
    expect(report.performance.averageImageLoadMs).toBe(31);
  });

  it('calculates localStorage footprint size correctly', () => {
    const rawData = 'a'.repeat(1024); // 1 KB string
    localStorage.setItem('anarchy_history', rawData);

    const size = HistoryTelemetry.getLocalStorageSizeBytes();
    expect(size).toBe(1024);
  });

  it('computes correct health score and applies penalties', async () => {
    // 100 starting score
    let report = await HistoryTelemetry.getDiagnosticReport();
    expect(report.healthScore).toBe(100);

    // Apply database write/read errors (-10 points per error)
    HistoryTelemetry.recordError('idbWrite');
    HistoryTelemetry.recordError('idbRead');

    report = await HistoryTelemetry.getDiagnosticReport();
    expect(report.healthScore).toBe(80); // 100 - 20 = 80

    // Add search latency penalty (-15 points for search > 2000ms)
    HistoryTelemetry.recordLatency('search', 2500);
    report = await HistoryTelemetry.getDiagnosticReport();
    expect(report.healthScore).toBe(65); // 80 - 15 = 65

    // Add localStorage size penalty (5MB limit, let's write 4MB to localStorage to trigger > 75% penalty of -15 points)
    const heavyString = 'b'.repeat(4 * 1024 * 1024);
    localStorage.setItem('anarchy_history', heavyString);

    report = await HistoryTelemetry.getDiagnosticReport();
    expect(report.healthScore).toBe(50); // 65 - 15 = 50
  });
});
