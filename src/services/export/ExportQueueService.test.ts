import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportQueue } from './ExportQueueService';

// Mock HistoryService
vi.mock('../history/HistoryService', () => ({
  loadEntries: vi.fn(() => [
    { id: 'entry-1', label: 'Entry 1', prompt: 'prompt 1', type: 'render' },
    { id: 'entry-2', label: 'Entry 2', prompt: 'prompt 2', type: 'render' }
  ]),
  loadRawData: vi.fn(() => Promise.resolve(new Blob(['image-data'], { type: 'image/png' }))),
  loadFullImage: vi.fn(() => Promise.resolve('blob:http://localhost/image-url'))
}));

// Mock pdfExport
vi.mock('../../utils/pdfExport', () => ({
  exportImagesToPDF: vi.fn(() => Promise.resolve('/path/to/exported.pdf'))
}));

// Mock JSZip
vi.mock('jszip', () => {
  const mockFolder = {
    file: vi.fn()
  };
  const mockZip = {
    folder: vi.fn(() => mockFolder),
    generateAsync: vi.fn(() => Promise.resolve(new Blob(['zip-content'])))
  };
  return {
    default: function() {
      return mockZip;
    }
  };
});

describe('BackgroundExportQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs a ZIP export job successfully', async () => {
    const jobId = await exportQueue.startExportJob({
      type: 'zip',
      entryIds: ['entry-1', 'entry-2']
    });

    const progress = exportQueue.getProgress(jobId);
    expect(progress).not.toBeNull();
    expect(progress?.status).toBe('processing');

    // Run active timeouts/promises
    await vi.runAllTimersAsync();

    const finalProgress = exportQueue.getProgress(jobId);
    expect(finalProgress?.status).toBe('completed');
    expect(finalProgress?.percentage).toBe(100);
  });

  it('runs a PDF export job successfully', async () => {
    const { exportImagesToPDF } = await import('../../utils/pdfExport');

    const jobId = await exportQueue.startExportJob({
      type: 'pdf',
      entryIds: ['entry-1']
    });

    await vi.runAllTimersAsync();

    const finalProgress = exportQueue.getProgress(jobId);
    expect(finalProgress?.status).toBe('completed');
    expect(exportImagesToPDF).toHaveBeenCalled();
  });

  it('handles job cancellation correctly', async () => {
    const jobId = await exportQueue.startExportJob({
      type: 'zip',
      entryIds: ['entry-1', 'entry-2']
    });

    // Request cancel immediately
    exportQueue.cancelJob(jobId);

    await vi.runAllTimersAsync();

    const finalProgress = exportQueue.getProgress(jobId);
    expect(finalProgress?.status).toBe('cancelled');
  });
});
