import { logger } from '@/utils/logger';
import type { HistoryEntry } from '@/types/history';
import { loadEntries, loadRawData, loadFullImage } from '../history/HistoryService';

export interface ExportJob {
  id: string;
  type: 'zip' | 'pdf' | 'individual';
  entryIds: string[];
  options?: {
    format?: 'png' | 'jpg' | 'webp';
    quality?: number;
    title?: string;
  };
}

export interface ExportProgress {
  jobId: string;
  total: number;
  processed: number;
  currentItemName: string;
  status: 'idle' | 'processing' | 'completed' | 'failed' | 'cancelled';
  percentage: number;
  error?: string;
}

class BackgroundExportQueue {
  private activeJob: ExportJob | null = null;
  private cancelRequested = false;
  private progressMap = new Map<string, ExportProgress>();

  /**
   * Start a new background export job
   */
  public async startExportJob(job: Omit<ExportJob, 'id'>): Promise<string> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const fullJob: ExportJob = { ...job, id: jobId };
    
    this.progressMap.set(jobId, {
      jobId,
      total: job.entryIds.length,
      processed: 0,
      currentItemName: 'Starting...',
      status: 'processing',
      percentage: 0
    });

    this.broadcast(jobId);

    // Run job asynchronously in the background
    this.runJob(fullJob).catch(err => {
      logger.error(`[ExportQueue] Job ${jobId} failed:`, err);
    });

    return jobId;
  }

  /**
   * Cancel an active export job
   */
  public cancelJob(jobId: string) {
    if (this.activeJob && this.activeJob.id === jobId) {
      this.cancelRequested = true;
      logger.log(`[ExportQueue] Cancellation requested for job: ${jobId}`);
    } else {
      const prog = this.progressMap.get(jobId);
      if (prog) {
        prog.status = 'cancelled';
        this.broadcast(jobId);
      }
    }
  }

  /**
   * Get progress for a specific job
   */
  public getProgress(jobId: string): ExportProgress | null {
    return this.progressMap.get(jobId) || null;
  }

  private broadcast(jobId: string) {
    const progress = this.progressMap.get(jobId);
    if (!progress) return;

    const event = new CustomEvent('anarchy:export:progress', { detail: progress });
    if (typeof window !== 'undefined') window.dispatchEvent(event);
  }

  private async runJob(job: ExportJob) {
    this.activeJob = job;
    this.cancelRequested = false;
    const progress = this.progressMap.get(job.id)!;

    try {
      const entries = loadEntries();
      const selectedEntries = entries.filter(e => job.entryIds.includes(e.id));

      if (job.type === 'zip') {
        await this.runZipExport(job, selectedEntries, progress);
      } else if (job.type === 'pdf') {
        await this.runPdfExport(job, selectedEntries, progress);
      } else {
        await this.runIndividualExport(job, selectedEntries, progress);
      }
      
      if (this.cancelRequested) {
        progress.status = 'cancelled';
        progress.currentItemName = 'Export cancelled by user';
      } else {
        progress.status = 'completed';
        progress.currentItemName = 'Export finished successfully';
        progress.percentage = 100;
      }
    } catch (err: any) {
      progress.status = 'failed';
      progress.error = err?.message || String(err);
      progress.currentItemName = `Export failed: ${progress.error}`;
    } finally {
      this.activeJob = null;
      this.cancelRequested = false;
      this.broadcast(job.id);
    }
  }

  private async runZipExport(job: ExportJob, entries: HistoryEntry[], progress: ExportProgress) {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    const folder = zip.folder('anarchy-export')!;

    for (let i = 0; i < entries.length; i++) {
      if (this.cancelRequested) return;

      const entry = entries[i];
      progress.currentItemName = `Zipping: ${entry.label || entry.id}`;
      progress.processed = i;
      progress.percentage = Math.round((i / job.entryIds.length) * 90); // reserve 10% for zip generation
      this.broadcast(job.id);

      const blob = await loadRawData(`${entry.id}_output`) || await loadRawData(`${entry.id}_input`);
      if (blob && blob instanceof Blob) {
        const safeName = (entry.label || entry.id).replace(/[^a-zA-Z0-9_-]/g, '_');
        folder.file(`${safeName}.png`, blob);
      }

      // Yield to the main thread
      await new Promise(r => setTimeout(r, 40));
    }

    if (this.cancelRequested) return;

    progress.currentItemName = 'Compiling ZIP archive...';
    progress.percentage = 95;
    this.broadcast(job.id);

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    
    if (this.cancelRequested) return;

    const blobUrl = URL.createObjectURL(zipBlob);
    
    // Save/Download file
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `anarchy-export-${Date.now()}.zip`;
    a.click();

    setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
  }

  private async runPdfExport(job: ExportJob, entries: HistoryEntry[], progress: ExportProgress) {
    const { exportImagesToPDF } = await import('../../utils/pdfExport');
    const images: Array<{ url: string; name: string; prompt?: string }> = [];

    for (let i = 0; i < entries.length; i++) {
      if (this.cancelRequested) return;

      const entry = entries[i];
      progress.currentItemName = `Preparing PDF: ${entry.label || entry.id}`;
      progress.processed = i;
      progress.percentage = Math.round((i / job.entryIds.length) * 80); // reserve 20% for pdf compile
      this.broadcast(job.id);

      const url = await loadFullImage(entry.id, 'output') || await loadFullImage(entry.id, 'input');
      if (url) {
        images.push({
          url,
          name: entry.label || entry.id,
          prompt: entry.prompt || undefined
        });
      }

      await new Promise(r => setTimeout(r, 40));
    }

    if (this.cancelRequested) return;

    if (images.length > 0) {
      progress.currentItemName = 'Generating PDF document...';
      progress.percentage = 90;
      this.broadcast(job.id);

      await exportImagesToPDF(images, { title: job.options?.title || 'Anarchy AI — History Export' });
    }
  }

  private async runIndividualExport(job: ExportJob, entries: HistoryEntry[], progress: ExportProgress) {
    const { exportImageWithDialog } = await import('./ExportService');
    const format = job.options?.format || 'jpg';
    const quality = job.options?.quality || 0.92;

    for (let i = 0; i < entries.length; i++) {
      if (this.cancelRequested) return;

      const entry = entries[i];
      progress.currentItemName = `Exporting: ${entry.label || entry.id}`;
      progress.processed = i;
      progress.percentage = Math.round((i / job.entryIds.length) * 100);
      this.broadcast(job.id);

      const url = await loadFullImage(entry.id, 'output') || await loadFullImage(entry.id, 'input');
      if (url) {
        try {
          await exportImageWithDialog(url, entry.label || entry.id, { format, quality });
        } catch (err) {
          logger.error(`[ExportQueue] Individual export failed for entry ${entry.id}:`, err);
        }
      }

      await new Promise(r => setTimeout(r, 40));
    }
  }
}

export const exportQueue = new BackgroundExportQueue();
export default exportQueue;
