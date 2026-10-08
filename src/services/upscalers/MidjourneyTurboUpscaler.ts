import { type BaseUpscaler, type UpscaleResult, getImageDimensions } from './BaseUpscaler';
import { type AIConfig } from '../../stores/aiConfigStore';
import { cometApiService } from '../comet/CometApiService';
import { logger } from '../../utils/logger';

export async function ensurePublicImageUrl(rawImage: string, userId?: string): Promise<string> {
  let img = rawImage;
  // 1. Resolve IndexedDB
  if (img.startsWith('idb://')) {
    try {
      const { getLocalImage } = await import('../history/HistoryService');
      const cached = await getLocalImage(img);
      if (cached) img = cached;
    } catch {
      // Ignore idb resolution errors
    }
  }

  // If already a public HTTPS URL (and not localhost), return directly
  if (img.startsWith('https://') && !img.includes('localhost') && !img.includes('127.0.0.1')) {
    return img;
  }

  // 2. If it's a blob URL or localhost, convert to data URI first
  if (img.startsWith('blob:') || img.startsWith('http://localhost') || img.startsWith('http://127.0.0.1')) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const b64 = await invoke<string>('url_to_base64', { url: img });
      if (b64?.startsWith('data:')) img = b64;
    } catch {
      try {
        const res = await fetch(img);
        const blob = await res.blob();
        const { blobToDataURL } = await import('../history/HistoryService');
        const b64 = await blobToDataURL(blob);
        if (b64?.startsWith('data:')) img = b64;
      } catch {
        // Ignore conversion errors
      }
    }
  }

  // 3. If it's a data URI, upload it to obtain a public HTTPS URL
  if (img.startsWith('data:')) {
    // A) Priority 1: Supabase Storage bucket 'generated-images' (direct, reliable CDN)
    try {
      const { supabase, getCurrentUserId } = await import('../supabase/supabaseClient');
      const finalUid = userId || getCurrentUserId();
      const commaIdx = img.indexOf(',');
      if (commaIdx !== -1) {
        const meta = img.substring(0, commaIdx);
        const b64 = img.substring(commaIdx + 1);
        const mime = meta.match(/data:([^;]+)/)?.[1] || 'image/png';
        const ext = mime.includes('webp') ? 'webp' : mime.includes('jpeg') || mime.includes('jpg') ? 'jpg' : 'png';

        const byteStr = atob(b64);
        const bytes = new Uint8Array(byteStr.length);
        for (let i = 0; i < byteStr.length; i++) bytes[i] = byteStr.charCodeAt(i);
        const blob = new Blob([bytes], { type: mime });

        const storagePath = `${finalUid}/uploads/mj_src_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('generated-images')
          .upload(storagePath, blob, {
            contentType: mime,
            upsert: true,
          });

        if (!upErr) {
          const { data: pubData } = supabase.storage.from('generated-images').getPublicUrl(storagePath);
          if (pubData?.publicUrl && pubData.publicUrl.startsWith('https://')) {
            logger.log('[MidjourneyTurboUpscaler] Public image uploaded to Supabase Storage:', pubData.publicUrl);
            return pubData.publicUrl;
          }
        } else {
          logger.warn('[MidjourneyTurboUpscaler] Supabase storage upload notice:', upErr.message);
        }
      }
    } catch (supaErr) {
      logger.warn('[MidjourneyTurboUpscaler] Supabase storage upload exception:', supaErr);
    }


    // C) Priority 3: Native Tauri uploader with strict 4-second timeout
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const uploadPromise = invoke<string>('upload_image', { apiKey: '', _apiKey: '', dataUri: img });
      const timeoutPromise = new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error('Native upload timeout')), 4000)
      );
      const uploaded = await Promise.race([uploadPromise, timeoutPromise]);
      if (uploaded && uploaded.startsWith('https://')) {
        return uploaded;
      }
    } catch (tErr) {
      logger.warn('[MidjourneyTurboUpscaler] Native upload failed or timed out:', tErr);
    }
  }

  // If after all attempts we do not have a public HTTPS URL, throw so error handling & refunds work
  if (!img.startsWith('https://') || img.includes('localhost') || img.includes('127.0.0.1')) {
    throw new Error(
      'Midjourney requires a public image URL to upscale, but could not upload image to cloud storage. Please check your internet connection and try again.'
    );
  }

  return img;
}

export async function canvasSuperResolution(
  imageDataUriOrUrl: string,
  scaleFactor = 2,
  targetDimensions?: { width: number; height: number }
): Promise<{ imageUrl: string; width: number; height: number }> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { imageUrl: imageDataUriOrUrl, width: 1024 * scaleFactor, height: 1024 * scaleFactor };
  }

  return new Promise((resolve) => {
    const img = new Image();
    // Only set crossOrigin for remote http(s) URLs to prevent canvas taint issues on blob:/data: URIs
    if (imageDataUriOrUrl.startsWith('http://') || imageDataUriOrUrl.startsWith('https://')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      try {
        const naturalW = img.naturalWidth || 1024;
        const naturalH = img.naturalHeight || 1024;
        const targetW = targetDimensions?.width || Math.round(naturalW * scaleFactor);
        const targetH = targetDimensions?.height || Math.round(naturalH * scaleFactor);
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ imageUrl: imageDataUriOrUrl, width: targetW, height: targetH });
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, targetW, targetH);

        const dataUrl = canvas.toDataURL('image/png');
        resolve({ imageUrl: dataUrl, width: targetW, height: targetH });
      } catch {
        resolve({
          imageUrl: imageDataUriOrUrl,
          width: targetDimensions?.width || (img.naturalWidth || 1024) * scaleFactor,
          height: targetDimensions?.height || (img.naturalHeight || 1024) * scaleFactor,
        });
      }
    };
    img.onerror = () => {
      resolve({ imageUrl: imageDataUriOrUrl, width: 1024 * scaleFactor, height: 1024 * scaleFactor });
    };
    img.src = imageDataUriOrUrl;
  });
}

export class MidjourneyTurboUpscaler implements BaseUpscaler {
  private modelId: string;

  constructor(modelId: string = 'midjourney/mj-turbo-upscale') {
    this.modelId = modelId;
  }

  validateInputs(_config: AIConfig): void {
    // Inputs validated at form level or handled gracefully by CometApiService
  }

  buildPayload(config: AIConfig, image: string): Record<string, unknown> {
    return {
      image,
      taskId: (config as any).midjourneyTaskId,
      customId: (config as any).midjourneyCustomId,
      imageIndex: (config as any).midjourneyImageIndex,
    };
  }

  async execute(
    config: AIConfig,
    image: string,
    signal?: AbortSignal,
    onStatusChange?: (status: 'queued' | 'processing') => void
  ): Promise<UpscaleResult> {
    let resolvedImage = image;
    if (image.startsWith('idb://')) {
      try {
        const { getLocalImage } = await import('../history/HistoryService');
        const cached = await getLocalImage(image);
        if (cached) {
          resolvedImage = cached;
        }
      } catch {
        // Fall back to image string
      }
    }

    const dims = await getImageDimensions(resolvedImage);

    // Auto-detect Midjourney task ID if available in URL or config
    const mjMatch = resolvedImage.match(/\/mj\/image\/(\d+)/);
    const midjourneyTaskId =
      (config as any).midjourneyTaskId ||
      (config as any).taskId ||
      (config as any).sourceTaskId ||
      (mjMatch ? mjMatch[1] : undefined);
    const midjourneyCustomId = (config as any).midjourneyCustomId;
    const midjourneyImageIndex = (config as any).midjourneyImageIndex ?? 0;

    const activeModel = (config as any).model || this.modelId;

    try {
      const publicUrl = await ensurePublicImageUrl(resolvedImage, (config as any).userId);
      const result = await cometApiService.upscaleImageWithMidjourney(publicUrl, {
        taskId: midjourneyTaskId,
        customId: midjourneyCustomId,
        imageIndex: midjourneyImageIndex,
        userId: (config as any).userId,
        nodeId: (config as any).nodeId,
        workflowId: (config as any).workflowId,
        model: activeModel,
        prompt: (config as any).prompt,
        signal,
        onStatus: onStatusChange,
      });

      return {
        imageUrl: result.imageUrl,
        width: result.width || dims.width * 2,
        height: result.height || dims.height * 2,
        model: activeModel,
      };
    } catch (err: any) {
      logger.error('[MidjourneyTurboUpscaler] Midjourney upscale failed on CometAPI:', err);
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(msg || 'Midjourney upscale failed. Please check your CometAPI key and try again.');
    }
  }

  parseResult(response: any): UpscaleResult {
    return {
      imageUrl: response?.imageUrl || response?.output || '',
      model: this.modelId,
    };
  }
}

export default MidjourneyTurboUpscaler;

