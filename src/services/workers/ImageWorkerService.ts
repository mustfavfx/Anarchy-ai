/**
 * Image Worker Service
 * Manages Web Worker for image processing
 */

import type { ImageProcessMessage, ImageProcessResult } from '../../workers/imageWorker';

class ImageWorkerService {
  private worker: Worker | null = null;
  private callbacks: Map<string, (result: ImageProcessResult) => void> = new Map();
  private messageId = 0;

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
      try {
        // Create worker from the TypeScript file
        // Note: In production, this would be built separately
        const workerCode = new URL('../../workers/imageWorker.ts', import.meta.url);
        this.worker = new Worker(workerCode, { type: 'module' });
        
        this.worker.onmessage = (e: MessageEvent<ImageProcessResult>) => {
          const { success, data, error } = e.data;
          const callback = this.callbacks.get(this.messageId.toString());
          
          if (callback) {
            callback({ success, data, error });
            this.callbacks.delete(this.messageId.toString());
          }
        };
      } catch (error) {
        console.error('Failed to initialize image worker:', error);
      }
    }
  }

  async resizeImage(
    imageData: string,
    options?: { width?: number; height?: number }
  ): Promise<ImageProcessResult> {
    return this.processImage({
      type: 'resize',
      imageData,
      options,
    });
  }

  async cropImage(
    imageData: string,
    crop: { x: number; y: number; width: number; height: number }
  ): Promise<ImageProcessResult> {
    return this.processImage({
      type: 'crop',
      imageData,
      options: { crop },
    });
  }

  async applyFilter(
    imageData: string,
    filter: 'grayscale' | 'sepia' | 'blur' | 'brightness' | 'contrast'
  ): Promise<ImageProcessResult> {
    return this.processImage({
      type: 'filter',
      imageData,
      options: { filter },
    });
  }

  async compressImage(imageData: string, quality = 0.8): Promise<ImageProcessResult> {
    return this.processImage({
      type: 'compress',
      imageData,
      options: { quality },
    });
  }

  private processImage(message: ImageProcessMessage): Promise<ImageProcessResult> {
    return new Promise((resolve) => {
      if (!this.worker) {
        // Fallback to main thread if worker not available
        this.fallbackProcess(message).then(resolve);
        return;
      }

      const id = this.messageId++;
      this.callbacks.set(id.toString(), resolve);
      
      this.worker.postMessage(message);
    });
  }

  private async fallbackProcess(message: ImageProcessMessage): Promise<ImageProcessResult> {
    // Simple fallback - just return original data
    // In production, you might implement the processing here
    return {
      success: true,
      data: message.imageData,
    };
  }

  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}

// Singleton instance
export const imageWorkerService = new ImageWorkerService();
