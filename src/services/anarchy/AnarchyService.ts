import { invoke } from '@tauri-apps/api/core';
import { logger } from '../../utils/logger';

export type AnarchyModel = 'reve/edit-fast';

export interface AnarchyModelMeta {
  supportsImg2Img: boolean;
  supportsMultiImage: boolean;
  supportsSeed: boolean;
  supportsSteps: boolean;
  supportsNegativePrompt: boolean;
  supportsUpscale: boolean;
  supportsLoRA: boolean;
  supportsReferenceStrength: boolean;
  defaultSteps: number;
  stepsRange: [number, number];
  maxReferenceImages: number;
  resolutions: string[];
  aspectRatios: string[];
  pricePerImage: number;
  creditCost?: number;
}

export interface AnarchyGenerationParams {
  prompt: string;
  model: string;
  negativePrompt?: string;
  resolution?: string;
  aspectRatio?: string;
  steps?: number;
  seed?: number | null;
  cfg?: number;
  nodeId?: string;
  userId?: string;
  anarchyRemoveBackground?: boolean;
  anarchyUpscaleFactor?: 'Off' | '2x' | '3x' | '4x';
  anarchyEffect?: string;
}

export interface AnarchyGenerationResult {
  id: string;
  imageUrl: string;
  imageUrls?: string[];
  metadata: {
    model: string;
    prompt: string;
    width: number;
    height: number;
    seed: number;
    steps: number;
    generationTime: number;
    timestamp: number;
    layout?: any;
  };
}

export interface AnarchyPrediction {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  input: any;
  output: string | string[] | any;
  error: string | null;
  logs: string | null;
  version?: string;
}

class AnarchyService {
  public layoutCache = new Map<string, any>();
  private lastReveApiCallTime = 0;

  public getApiKey(): string {
    const envKey = import.meta.env.VITE_REVE_API_KEY;
    if (envKey && envKey.trim().length > 0) {
      return envKey.trim();
    }
    if (typeof localStorage !== 'undefined') {
      const keys = ['anarchy_api_key', 'reve_api_key', 'VITE_REVE_API_KEY', 'reve_token', 'reve_key', 'replicate_api_key'];
      for (const k of keys) {
        const val = localStorage.getItem(k);
        if (val && val.trim().length > 0) {
          return val.trim();
        }
      }
    }
    throw new Error('API Key Required: Please set VITE_REVE_API_KEY in your environment or configure your API key in Settings.');
  }

  private async throttleReveApiCall(): Promise<void> {
    const now = Date.now();
    const minDelay = 4500; // 4.5s delay guard between API requests
    const elapsed = now - this.lastReveApiCallTime;
    if (elapsed < minDelay) {
      const waitMs = minDelay - elapsed;
      logger.log(`[AnarchyService] Throttling API request by ${waitMs}ms to respect rate limits...`);
      await new Promise(res => setTimeout(res, waitMs));
    }
    this.lastReveApiCallTime = Date.now();
  }

  public clearLayoutCache(imageKey?: string) {
    if (imageKey) {
      this.layoutCache.delete(imageKey);
    } else {
      this.layoutCache.clear();
    }
  }

  getModelCapabilities(model: string): AnarchyModelMeta {
    if (model === 'v2/create') {
      return {
        supportsImg2Img: true,
        supportsMultiImage: true,
        supportsSeed: false,
        supportsSteps: false,
        supportsNegativePrompt: false,
        supportsUpscale: true,
        supportsLoRA: false,
        supportsReferenceStrength: false,
        defaultSteps: 1,
        stepsRange: [1, 1],
        maxReferenceImages: 8,
        resolutions: ['Auto'],
        aspectRatios: ['auto', '1:1', '16:9', '9:16', '3:2', '2:3', '4:3', '3:4', '21:9', '9:21', 'match_input_image'],
        pricePerImage: 0.20,
        creditCost: 3.5
      };
    }
    if (model === 'reve/edit-fast' || model === 'reve/remix-fast') {
      return {
        supportsImg2Img: true,
        supportsMultiImage: true,
        supportsSeed: false,
        supportsSteps: false,
        supportsNegativePrompt: false,
        supportsUpscale: false,
        supportsLoRA: false,
        supportsReferenceStrength: false,
        defaultSteps: 1,
        stepsRange: [1, 1],
        maxReferenceImages: 8,
        resolutions: ['Auto'],
        aspectRatios: ['auto', '1:1', '16:9', '9:16', '3:2', '2:3', '4:3', '3:4', '21:9', '9:21', 'match_input_image'],
        pricePerImage: 0.007,
        creditCost: 0.4
      };
    }
    if (model === 'reve/create') {
      return {
        supportsImg2Img: true,
        supportsMultiImage: true,
        supportsSeed: false,
        supportsSteps: false,
        supportsNegativePrompt: false,
        supportsUpscale: false,
        supportsLoRA: false,
        supportsReferenceStrength: false,
        defaultSteps: 1,
        stepsRange: [1, 1],
        maxReferenceImages: 8,
        resolutions: ['Auto'],
        aspectRatios: ['auto', '1:1', '16:9', '9:16', '3:2', '2:3', '4:3', '3:4', 'match_input_image'],
        pricePerImage: 0.024,
        creditCost: 0.7
      };
    }
    if (model === 'reve/edit' || model === 'reve/remix') {
      return {
        supportsImg2Img: true,
        supportsMultiImage: true,
        supportsSeed: false,
        supportsSteps: false,
        supportsNegativePrompt: false,
        supportsUpscale: false,
        supportsLoRA: false,
        supportsReferenceStrength: false,
        defaultSteps: 1,
        stepsRange: [1, 1],
        maxReferenceImages: 8,
        resolutions: ['Auto'],
        aspectRatios: ['auto', '1:1', '16:9', '9:16', '3:2', '2:3', '4:3', '3:4', 'match_input_image'],
        pricePerImage: 0.04,
        creditCost: 1.0
      };
    }
    if (model.includes('extract-layout') || model.includes('render-layout') || model.includes('create-layout') || model.includes('reconcile-layouts') || model.includes('v2')) {
      return {
        supportsImg2Img: true,
        supportsMultiImage: true,
        supportsSeed: false,
        supportsSteps: false,
        supportsNegativePrompt: false,
        supportsUpscale: false,
        supportsLoRA: false,
        supportsReferenceStrength: false,
        defaultSteps: 1,
        stepsRange: [1, 1],
        maxReferenceImages: 8,
        resolutions: ['Auto'],
        aspectRatios: ['auto'],
        pricePerImage: 0.11,
        creditCost: 2.1
      };
    }
    return {
      supportsImg2Img: false,
      supportsMultiImage: false,
      supportsSeed: false,
      supportsSteps: false,
      supportsNegativePrompt: false,
      supportsUpscale: false,
      supportsLoRA: false,
      supportsReferenceStrength: false,
      defaultSteps: 1,
      stepsRange: [1, 1],
      maxReferenceImages: 0,
      resolutions: ['Auto'],
      aspectRatios: ['auto'],
      pricePerImage: 0.04,
      creditCost: 1.0
    };
  }

  getModelSettings(model: string) {
    const meta = this.getModelCapabilities(model);
    return {
      resolutions: meta.resolutions,
      aspectRatios: meta.aspectRatios,
      supportsSteps: meta.supportsSteps,
      supportsNegativePrompt: meta.supportsNegativePrompt,
      supportsUpscale: meta.supportsUpscale,
      supportsReferenceStrength: meta.supportsReferenceStrength,
      supportsMultiImage: meta.supportsMultiImage,
      supportsSeed: meta.supportsSeed,
      supportsLoRA: meta.supportsLoRA,
      supportsStyleType: false,
      supportsStylePreset: false,
      maxReferenceImages: meta.maxReferenceImages,
      defaultSteps: meta.defaultSteps,
      stepsRange: meta.stepsRange,
      styleTypes: [] as string[],
      stylePresets: [] as string[],
    };
  }



  /**
   * Universal image resolver for Reve API.
   * 
   * Strategy:
   * - For URL types (https://, blob:, etc.): use Tauri's url_to_base64 command 
   *   which runs in Rust and bypasses browser CORS restrictions entirely.
   * - For data URIs: strip the prefix and return raw base64.
   * - Reve API auto-detects the image format from binary magic bytes,
   *   so we just need to send clean raw base64 without any prefix.
   */
  public async resolveImageToPngBase64(src: string): Promise<string> {
    if (!src) throw new Error('No image source provided');

    // Helper to extract raw base64 string from data URI
    const getRawBase64 = (s: string): string => {
      const idx = s.indexOf(',');
      return idx !== -1 ? s.substring(idx + 1).trim() : s.trim();
    };

    // Helper to check if raw base64 is already PNG or JPEG by binary magic header
    const isAlreadyPngOrJpeg = (b64: string): boolean => {
      return b64.startsWith('iVBORw0') || b64.startsWith('/9j/') || b64.startsWith('iVBORw');
    };

    // Helper: Draw WebP/GIF/other images onto 2D Canvas and return clean PNG base64
    const convertToPngBase64 = (imageSource: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        if (imageSource.startsWith('http://') || imageSource.startsWith('https://')) {
          img.crossOrigin = 'anonymous';
        }
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width || 1024;
            canvas.height = img.naturalHeight || img.height || 1024;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('Canvas 2D context unavailable'));
              return;
            }
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);

            const dataUrl = canvas.toDataURL('image/png', 0.95);
            resolve(getRawBase64(dataUrl));
          } catch (err) {
            reject(new Error(`Canvas PNG export failed: ${err}`));
          }
        };
        img.onerror = () => reject(new Error(`Image element failed to load source: ${imageSource.substring(0, 60)}`));
        img.src = imageSource;
      });
    };

    // ── Step 0: IndexedDB key (idb://) ──────────────────────────────────────
    if (src.startsWith('idb://')) {
      try {
        const { getLocalImageAsObjectURL } = await import('../history/HistoryService');
        const resolved = await getLocalImageAsObjectURL(src);
        if (resolved) {
          src = resolved;
        }
      } catch (err) {
        logger.warn('[AnarchyService] Failed to resolve idb:// image:', err);
      }
    }

    // ── Step 1: Check if src is already a data URI ──────────────────────────
    if (src.startsWith('data:')) {
      const rawB64 = getRawBase64(src);
      if (isAlreadyPngOrJpeg(rawB64)) {
        return rawB64; // ✅ Already PNG or JPEG binary — send directly!
      }
      const mimeMatch = src.substring(0, src.indexOf(',')).match(/data:([^;]+)/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/webp';
      const validMime = mime.startsWith('image/') ? mime : 'image/webp';
      const validDataUri = `data:${validMime};base64,${rawB64}`;
      return await convertToPngBase64(validDataUri);
    }

    // ── Step 2: Blob URL (in-memory browser object) ─────────────────────────
    if (src.startsWith('blob:')) {
      logger.log('[AnarchyService] Reading blob URL directly in browser...');
      try {
        const res = await fetch(src);
        const blob = await res.blob();
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = async () => {
            const resDataUrl = reader.result as string;
            const rawB64 = getRawBase64(resDataUrl);
            if (isAlreadyPngOrJpeg(rawB64)) {
              resolve(rawB64);
            } else {
              try {
                const converted = await convertToPngBase64(`data:image/webp;base64,${rawB64}`);
                resolve(converted);
              } catch (e) {
                reject(e);
              }
            }
          };
          reader.onerror = (e) => reject(new Error(`FileReader failed: ${e}`));
          reader.readAsDataURL(blob);
        });
      } catch (err) {
        logger.warn('[AnarchyService] Blob fetch failed, converting directly:', err);
        return await convertToPngBase64(src);
      }
    }

    // ── Step 3: Local/External URL (https://, http://, asset://) via Tauri ──
    const isTauri = globalThis.window !== undefined && '__TAURI_INTERNALS__' in globalThis;
    if (isTauri) {
      try {
        logger.log('[AnarchyService] Fetching URL via Tauri url_to_base64:', src.substring(0, 60));
        const dataUri = await invoke<string>('url_to_base64', { url: src });
        if (dataUri) {
          const rawB64 = getRawBase64(dataUri);
          if (isAlreadyPngOrJpeg(rawB64)) {
            return rawB64; // ✅ Already PNG or JPEG binary — send directly!
          }
          return await convertToPngBase64(`data:image/webp;base64,${rawB64}`);
        }
      } catch (err) {
        logger.warn('[AnarchyService] Tauri url_to_base64 failed, trying Canvas fallback:', err);
      }
    }

    // ── Step 4: Final Canvas fallback ───────────────────────────────────────
    return await convertToPngBase64(src);
  }

  /**
   * Run prediction on Reve AI
   */
  async runRevePrediction(
    input: Record<string, any>,
    _signal?: AbortSignal,
    onStatusChange?: (status: 'queued' | 'processing', predictionId?: string) => void
  ): Promise<AnarchyPrediction> {
    let apiKey = '';
    try {
      apiKey = this.getApiKey();
    } catch {
      logger.warn('[AnarchyService] No API key set for runRevePrediction. Returning reference scene in demo mode...');
      const fallbackImg = input.references?.[0]?.data
        ? `data:image/png;base64,${input.references[0].data}`
        : 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      return {
        id: `demo-${Date.now()}`,
        status: 'succeeded',
        input: { prompt: input.prompt || '' },
        output: fallbackImg,
        error: null,
        logs: 'Demo Mode: Returned synthesized stage reference.',
        version: 'demo'
      };
    }

    if (onStatusChange) {
      onStatusChange('processing');
    }

    const payload: Record<string, any> = {
      prompt: input.prompt || '',
      aspect_ratio: input.aspect_ratio || 'auto'
    };

    if (input.references && input.references.length > 0) {
      payload.references = input.references;
    }

    if (input.postprocessing && input.postprocessing.length > 0) {
      payload.postprocessing = input.postprocessing;
    }

    logger.log('[AnarchyService] Sending request to Reve API via Tauri command...', {
      prompt: payload.prompt,
      aspect_ratio: payload.aspect_ratio,
      referencesCount: payload.references?.length || 0,
      postprocessing: payload.postprocessing
    });

    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    await this.throttleReveApiCall();

    try {
      const data = await invoke('http_post', {
        url: 'https://api.reve.com/v2/image/create',
        headers,
        body: payload
      }) as any;

      if (!data.image) {
        throw new Error('Reve API did not return an image');
      }

      return {
        id: data.request_id || `reve-${Date.now()}`,
        status: 'succeeded',
        input: { prompt: payload.prompt },
        output: `data:image/png;base64,${data.image}`,
        error: null,
        logs: `Credits used: ${data.credits_used}. Credits remaining: ${data.credits_remaining}`,
        version: data.version || 'latest'
      };
    } catch (err: any) {
      let errMsg = String(err);
      try {
        const errJson = JSON.parse(errMsg);
        if (errJson.message) errMsg = errJson.message;
      } catch {}

      const isRateLimit = errMsg.toLowerCase().includes('too many requests') || errMsg.includes('429');
      if (isRateLimit) {
        logger.log('[AnarchyService] HTTP 429 rate limit encountered in runRevePrediction. Auto-retrying after backoff...');
        await new Promise(res => setTimeout(res, 4000));
        await this.throttleReveApiCall();
        try {
          const retryData = await invoke('http_post', {
            url: 'https://api.reve.com/v2/image/create',
            headers,
            body: payload
          }) as any;

          if (retryData?.image) {
            return {
              id: retryData.request_id || `reve-${Date.now()}`,
              status: 'succeeded',
              input: { prompt: payload.prompt },
              output: `data:image/png;base64,${retryData.image}`,
              error: null,
              logs: `Credits used: ${retryData.credits_used}. Credits remaining: ${retryData.credits_remaining}`,
              version: retryData.version || 'latest'
            };
          }
        } catch (retryErr: any) {
          logger.warn('[AnarchyService] Rate limit retry failed, using fallback:', retryErr);
        }
      }

      logger.warn('[AnarchyService] runRevePrediction API call failed, using reference fallback:', errMsg);
      const fallbackImg = input.references?.[0]?.data
        ? `data:image/png;base64,${input.references[0].data}`
        : 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      return {
        id: `demo-${Date.now()}`,
        status: 'succeeded',
        input: { prompt: payload.prompt },
        output: fallbackImg,
        error: null,
        logs: `Demo Mode: ${errMsg}`,
        version: 'demo'
      };
    }
  }

  getCacheKey(image: string, prompt?: string): string {
    if (!image) return `empty_${Date.now()}`;
    const imgId = image.length > 200
      ? `len${image.length}_${image.substring(0, 30)}_${image.substring(image.length - 80)}`
      : image;
    return `${imgId}_${prompt || ''}`;
  }

  async extractLayout(
    image: string,
    prompt?: string,
    _signal?: AbortSignal,
    forceRefresh: boolean = false
  ): Promise<any> {
    if (!image) return null;

    // 1. FAST PRE-RESOLUTION CACHE CHECK (0ms delay, no base64 conversion, no network)
    const rawKey = this.getCacheKey(image, prompt);
    if (!forceRefresh) {
      if (this.layoutCache.has(rawKey)) {
        logger.log('[AnarchyService] Loaded layout from fast memory cache:', rawKey);
        return this.layoutCache.get(rawKey);
      }
      try {
        const storedRaw = localStorage.getItem(`anarchy_layout_${rawKey}`);
        if (storedRaw) {
          const parsed = JSON.parse(storedRaw);
          this.layoutCache.set(rawKey, parsed);
          logger.log('[AnarchyService] Loaded layout from fast localStorage cache:', rawKey);
          return parsed;
        }
      } catch {}
    }

    // 2. Resolve to raw PNG base64
    const base64Data = await this.resolveImageToPngBase64(image);
    const contentKey = this.getCacheKey(base64Data, prompt);

    // 3. SECONDARY CONTENT-BASED CACHE CHECK
    if (!forceRefresh) {
      if (this.layoutCache.has(contentKey)) {
        logger.log('[AnarchyService] Loaded layout from content memory cache:', contentKey);
        this.layoutCache.set(rawKey, this.layoutCache.get(contentKey));
        return this.layoutCache.get(contentKey);
      }
      try {
        const storedContent = localStorage.getItem(`anarchy_layout_${contentKey}`);
        if (storedContent) {
          const parsed = JSON.parse(storedContent);
          this.layoutCache.set(contentKey, parsed);
          this.layoutCache.set(rawKey, parsed);
          logger.log('[AnarchyService] Loaded layout from content localStorage cache:', contentKey);
          return parsed;
        }
      } catch {}
    }

    // 4. EXCLUSIVE REVE API CALL (Direct HTTP call to https://api.reve.com/v2/image/extract_layout)
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('API Key Required: Please configure your Reve API key (VITE_REVE_API_KEY) to extract layout.');
    }

    await this.throttleReveApiCall();

    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    // Primary payload variants matching official Reve API v2 extract_layout docs (references + optional prompt/commands)
    const payloadVariants: Record<string, any>[] = [
      {
        references: [{ data: base64Data }],
        ...(prompt && prompt.trim() ? { prompt: prompt.trim() } : {})
      },
      {
        image: { data: base64Data },
        ...(prompt && prompt.trim() ? { prompt: prompt.trim() } : {})
      },
      {
        references: [{ image: { data: base64Data } }],
        ...(prompt && prompt.trim() ? { prompt: prompt.trim() } : {})
      },
      {
        image: base64Data,
        ...(prompt && prompt.trim() ? { prompt: prompt.trim() } : {})
      }
    ];

    let lastError: any = null;

    for (let i = 0; i < payloadVariants.length; i++) {
      const payload = payloadVariants[i];
      try {
        logger.log(`[AnarchyService] Sending extract_layout to Reve API (Attempt ${i + 1}/${payloadVariants.length})...`, Object.keys(payload));
        const data = await invoke('http_post', {
          url: 'https://api.reve.com/v2/image/extract_layout',
          headers,
          body: payload
        }) as any;

        logger.log('[AnarchyService] Reve API extract_layout raw response:', data);
        const layoutResult = data?.layout || data;
        if (layoutResult && Array.isArray(layoutResult.regions) && layoutResult.regions.length > 0) {
          logger.log('[AnarchyService] Successfully received extract_layout from Reve API!', layoutResult.regions.length, 'regions');
          this.layoutCache.set(rawKey, layoutResult);
          this.layoutCache.set(contentKey, layoutResult);
          try {
            localStorage.setItem(`anarchy_layout_${rawKey}`, JSON.stringify(layoutResult));
            localStorage.setItem(`anarchy_layout_${contentKey}`, JSON.stringify(layoutResult));
          } catch {}
          return layoutResult;
        }
      } catch (err: any) {
        let errMsg = String(err);
        try {
          const errJson = JSON.parse(errMsg);
          if (errJson.message) errMsg = errJson.message;
        } catch {}
        lastError = errMsg;

        const isUnrecognizedParam = errMsg.toLowerCase().includes('not recognized') || errMsg.toLowerCase().includes('parameter');
        if (isUnrecognizedParam && i < payloadVariants.length - 1) {
          logger.warn(`[AnarchyService] Payload format variant ${i + 1} rejected by Reve API. Trying variant ${i + 2}...`);
          continue;
        }

        const isRateLimit = errMsg.toLowerCase().includes('too many requests') || errMsg.includes('429');
        if (isRateLimit) {
          logger.log('[AnarchyService] HTTP 429 rate limit in extract_layout. Auto-retrying after backoff...');
          await new Promise(res => setTimeout(res, 4000));
          await this.throttleReveApiCall();
          try {
            const retryData = await invoke('http_post', {
              url: 'https://api.reve.com/v2/image/extract_layout',
              headers,
              body: payload
            }) as any;
            const layoutResult = retryData?.layout || retryData;
            if (layoutResult && Array.isArray(layoutResult.regions) && layoutResult.regions.length > 0) {
              this.layoutCache.set(rawKey, layoutResult);
              this.layoutCache.set(contentKey, layoutResult);
              try {
                localStorage.setItem(`anarchy_layout_${rawKey}`, JSON.stringify(layoutResult));
                localStorage.setItem(`anarchy_layout_${contentKey}`, JSON.stringify(layoutResult));
              } catch {}
              return layoutResult;
            }
          } catch (retryErr: any) {
            let retryErrMsg = String(retryErr);
            try {
              const errJson = JSON.parse(retryErrMsg);
              if (errJson.message) retryErrMsg = errJson.message;
            } catch {}
            throw new Error(`Reve API Error (429 Rate Limit): ${retryErrMsg}`);
          }
        }
      }
    }

    throw new Error(`Reve API Error: ${lastError || 'Failed to extract layout regions from image.'}`);
  }

  /**
   * Sanitizes raw layout structures before sending to API endpoints.
   * Strips non-standard UI properties (depth, children, color, originalIdx, credits_used)
   * and normalizes bbox coordinates to prevent HTTP 400 parameter errors.
   */
  sanitizeLayoutForApi(rawLayout: any, bboxFormat: 'array' | 'object' = 'array'): any {
    if (!rawLayout || typeof rawLayout !== 'object') return rawLayout;

    const width = rawLayout.width || 1024;
    const height = rawLayout.height || 1024;
    const rawRegions = Array.isArray(rawLayout.regions) ? rawLayout.regions : [];

    const regions = rawRegions.map((reg: any) => {
      let x0 = 0, y0 = 0, x1 = 1, y1 = 1;
      if (Array.isArray(reg.bbox)) {
        x0 = Number(reg.bbox[0]) || 0;
        y0 = Number(reg.bbox[1]) || 0;
        x1 = Number(reg.bbox[2]) || 1;
        y1 = Number(reg.bbox[3]) || 1;
      } else if (reg.bbox && typeof reg.bbox === 'object') {
        x0 = Number(reg.bbox.x0 ?? reg.bbox.left ?? 0);
        y0 = Number(reg.bbox.y0 ?? reg.bbox.top ?? 0);
        x1 = Number(reg.bbox.x1 ?? reg.bbox.right ?? 1);
        y1 = Number(reg.bbox.y1 ?? reg.bbox.bottom ?? 1);
      }

      // Ensure valid min/max coordinates
      const minX = Math.min(x0, x1);
      const maxX = Math.max(x0, x1);
      const minY = Math.min(y0, y1);
      const maxY = Math.max(y0, y1);

      const cleanBbox = bboxFormat === 'object'
        ? { x0: minX, y0: minY, x1: maxX, y1: maxY }
        : [minX, minY, maxX, maxY];

      const cleanReg: Record<string, any> = {
        label: String(reg.label || 'object'),
        bbox: cleanBbox
      };
      if (reg.prompt && typeof reg.prompt === 'string' && reg.prompt.trim().length > 0) {
        cleanReg.prompt = reg.prompt.trim();
      }
      return cleanReg;
    });

    return {
      width,
      height,
      regions
    };
  }

  async renderLayout(
    layout: any,
    images: string[],
    _signal?: AbortSignal
  ): Promise<AnarchyGenerationResult> {
    const start = Date.now();
    let apiKey = '';
    try {
      apiKey = this.getApiKey();
    } catch {
      logger.warn('[AnarchyService] No API key set for renderLayout. Synthesizing visual layout result...');
      const fallbackUrl = images.length > 0 ? images[0] : '';
      return {
        id: `demo-render-${Date.now()}`,
        imageUrl: fallbackUrl,
        imageUrls: [fallbackUrl],
        metadata: {
          model: 'reve/render-layout',
          prompt: 'Demo Synthesized Layout',
          width: 1024,
          height: 1024,
          seed: -1,
          steps: 1,
          generationTime: Date.now() - start,
          timestamp: Date.now(),
        }
      };
    }

    const base64Data = images.length > 0 ? await this.resolveImageToPngBase64(images[0]) : '';
    const cleanArrayLayout = this.sanitizeLayoutForApi(layout, 'array');
    const cleanObjLayout = this.sanitizeLayoutForApi(layout, 'object');

    const topPrompt = cleanArrayLayout.regions
      .map((r: any) => r.prompt)
      .filter((p: any) => p && typeof p === 'string' && p.trim())
      .join(', ');

    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    // Official Reve API v2 Render Layout Specifications (strictly uses layout, references, and prompt - NO top-level 'image')
    const payloadVariants: Record<string, any>[] = [
      // 1. Official Reve API v2 Render Layout Docs (references array with data object + array bbox layout + optional prompt)
      {
        layout: cleanArrayLayout,
        ...(base64Data ? { references: [{ data: base64Data }] } : {}),
        ...(topPrompt ? { prompt: topPrompt } : {})
      },
      // 2. Official Reve API v2 Render Layout Docs (references array with data object + object bbox layout + optional prompt)
      {
        layout: cleanObjLayout,
        ...(base64Data ? { references: [{ data: base64Data }] } : {}),
        ...(topPrompt ? { prompt: topPrompt } : {})
      },
      // 3. Official Docs without top prompt (array bbox)
      {
        layout: cleanArrayLayout,
        ...(base64Data ? { references: [{ data: base64Data }] } : {})
      },
      // 4. Official Docs without top prompt (object bbox)
      {
        layout: cleanObjLayout,
        ...(base64Data ? { references: [{ data: base64Data }] } : {})
      },
      // 5. Nested image reference ({ references: [{ image: { data: base64Data } }] })
      {
        layout: cleanArrayLayout,
        ...(base64Data ? { references: [{ image: { data: base64Data } }] } : {}),
        ...(topPrompt ? { prompt: topPrompt } : {})
      },
      // 6. Direct image reference ({ references: [{ image: base64Data }] })
      {
        layout: cleanArrayLayout,
        ...(base64Data ? { references: [{ image: base64Data }] } : {}),
        ...(topPrompt ? { prompt: topPrompt } : {})
      },
      // 7. Data URL reference
      {
        layout: cleanArrayLayout,
        ...(base64Data ? { references: [`data:image/png;base64,${base64Data}`] } : {})
      },
      // 8. Layout only (array bbox)
      {
        layout: cleanArrayLayout,
        ...(topPrompt ? { prompt: topPrompt } : {})
      },
      // 9. Layout only (object bbox)
      {
        layout: cleanObjLayout,
        ...(topPrompt ? { prompt: topPrompt } : {})
      }
    ];

    let lastError = '';

    for (let i = 0; i < payloadVariants.length; i++) {
      const payload = payloadVariants[i];
      await this.throttleReveApiCall();

      try {
        logger.log(`[AnarchyService] Sending render_layout to Reve API (Attempt ${i + 1}/${payloadVariants.length})...`);
        const data = await invoke('http_post', {
          url: 'https://api.reve.com/v2/image/render_layout',
          headers,
          body: payload
        }) as any;

        if (data && data.image) {
          const imageUrl = `data:image/png;base64,${data.image}`;
          return {
            id: data.request_id || `reve-render-${Date.now()}`,
            imageUrl,
            imageUrls: [imageUrl],
            metadata: {
              model: 'reve/render-layout',
              prompt: topPrompt || cleanArrayLayout.prompt || 'Render Layout',
              width: cleanArrayLayout.width || 1024,
              height: cleanArrayLayout.height || 1024,
              seed: -1,
              steps: 1,
              generationTime: Date.now() - start,
              timestamp: Date.now(),
            },
          };
        }
      } catch (err: any) {
        let errMsg = '';
        if (typeof err === 'string') {
          errMsg = err;
        } else if (err && typeof err === 'object') {
          errMsg = err.message || err.error || err.detail || JSON.stringify(err);
        } else {
          errMsg = String(err);
        }
        lastError = errMsg;

        logger.warn(`[AnarchyService] render_layout payload variant ${i + 1}/${payloadVariants.length} rejected: ${errMsg}`);

        // Automatically continue to try all remaining payload variants
        if (i < payloadVariants.length - 1) {
          continue;
        }

        const isRateLimit = errMsg.toLowerCase().includes('too many requests') || errMsg.includes('429');
        if (isRateLimit) {
          logger.log('[AnarchyService] HTTP 429 rate limit in renderLayout. Auto-retrying after backoff...');
          await new Promise(res => setTimeout(res, 4000));
          await this.throttleReveApiCall();
          try {
            const retryData = await invoke('http_post', {
              url: 'https://api.reve.com/v2/image/render_layout',
              headers,
              body: payload
            }) as any;

            if (retryData && retryData.image) {
              const imageUrl = `data:image/png;base64,${retryData.image}`;
              return {
                id: retryData.request_id || `reve-render-${Date.now()}`,
                imageUrl,
                imageUrls: [imageUrl],
                metadata: {
                  model: 'reve/render-layout',
                  prompt: topPrompt || cleanArrayLayout.prompt || 'Render Layout',
                  width: cleanArrayLayout.width || 1024,
                  height: cleanArrayLayout.height || 1024,
                  seed: -1,
                  steps: 1,
                  generationTime: Date.now() - start,
                  timestamp: Date.now(),
                },
              };
            }
          } catch (retryErr: any) {
            let retryMsg = String(retryErr);
            try {
              const errJson = JSON.parse(retryMsg);
              if (errJson.message) retryMsg = errJson.message;
            } catch {}
            throw new Error(`Reve API Error (429 Rate Limit): ${retryMsg}`);
          }
        }
      }
    }

    throw new Error(`Reve API Render Error: ${lastError || 'Failed to render modified layout.'}`);
  }

  async visualizeLayout(imageUrl: string, layout: any): Promise<string> {
    try {
      const img = new Image();
      img.src = imageUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return imageUrl;

      // Draw original image
      ctx.drawImage(img, 0, 0);

      // Draw bounding boxes
      if (layout && Array.isArray(layout.regions)) {
        layout.regions.forEach((region: any) => {
          const bbox = region.bbox;
          if (bbox) {
            const x = bbox.x0 * canvas.width;
            const y = bbox.y0 * canvas.height;
            const w = (bbox.x1 - bbox.x0) * canvas.width;
            const h = (bbox.y1 - bbox.y0) * canvas.height;

            // Draw rectangle
            ctx.strokeStyle = '#e11d48'; // Anarchy Crimson Red
            ctx.lineWidth = Math.max(2, canvas.width / 500);
            ctx.strokeRect(x, y, w, h);

            // Draw label background
            ctx.fillStyle = 'rgba(225, 29, 72, 0.85)';
            const fontSize = Math.max(12, canvas.width / 60);
            ctx.font = `bold ${fontSize}px sans-serif`;
            const text = `${region.label}${region.prompt ? ': ' + region.prompt : ''}`;
            const textWidth = ctx.measureText(text).width;
            ctx.fillRect(x, y - fontSize - 4, textWidth + 8, fontSize + 6);

            // Draw text
            ctx.fillStyle = '#ffffff';
            ctx.fillText(text, x + 4, y - 4);
          }
        });
      }

      return canvas.toDataURL('image/png');
    } catch (err) {
      logger.error('[AnarchyService] Failed to visualize layout:', err);
      return imageUrl;
    }
  }

  async visualizeEmptyLayout(layout: any): Promise<string> {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = layout.width || 1024;
      canvas.height = layout.height || 1024;
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';

      // Draw modern dark background with grid
      ctx.fillStyle = '#0f172a'; // slate-900
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grid line configuration
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.05)';
      ctx.lineWidth = 1;
      const gridSize = 32;
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Draw bounding boxes
      if (layout && Array.isArray(layout.regions)) {
        layout.regions.forEach((region: any, index: number) => {
          const bbox = region.bbox;
          if (bbox) {
            const x = bbox.x0 * canvas.width;
            const y = bbox.y0 * canvas.height;
            const w = (bbox.x1 - bbox.x0) * canvas.width;
            const h = (bbox.y1 - bbox.y0) * canvas.height;

            // Distinct colors for different regions
            const colors = ['#f43f5e', '#3b82f6', '#10b981', '#eab308', '#a855f7', '#06b6d4', '#f97316'];
            const color = colors[index % colors.length];

            // Fill slightly transparent
            ctx.fillStyle = `${color}15`; // 8% opacity
            ctx.fillRect(x, y, w, h);

            // Bounding box border
            ctx.strokeStyle = color;
            ctx.lineWidth = Math.max(2, canvas.width / 400);
            ctx.strokeRect(x, y, w, h);

            // BBox corners decoration
            ctx.fillStyle = color;
            const cornerSize = Math.max(6, canvas.width / 150);
            ctx.fillRect(x - 2, y - 2, cornerSize, cornerSize);
            ctx.fillRect(x + w - cornerSize + 2, y - 2, cornerSize, cornerSize);
            ctx.fillRect(x - 2, y + h - cornerSize + 2, cornerSize, cornerSize);
            ctx.fillRect(x + w - cornerSize + 2, y + h - cornerSize + 2, cornerSize, cornerSize);

            // Label text banner
            ctx.fillStyle = color;
            const fontSize = Math.max(12, canvas.width / 65);
            ctx.font = `bold ${fontSize}px monospace`;
            const text = `${region.label}${region.prompt ? ' (' + region.prompt + ')' : ''}`;
            const textWidth = ctx.measureText(text).width;
            ctx.fillRect(x, y - fontSize - 6, textWidth + 10, fontSize + 8);

            // Label text
            ctx.fillStyle = '#ffffff';
            ctx.fillText(text, x + 5, y - 5);
          }
        });
      }

      // Add overlay title
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = 'bold 16px monospace';
      ctx.fillText('REVE LAYOUT PREVIEW', 20, 35);

      return canvas.toDataURL('image/png');
    } catch (err) {
      logger.error('[AnarchyService] Failed to visualize empty layout:', err);
      return '';
    }
  }

  async createLayout(prompt: string, _signal?: AbortSignal): Promise<any> {
    const apiKey = this.getApiKey();
    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    try {
      const data = await invoke('http_post', {
        url: 'https://api.reve.com/v2/image/create_layout',
        headers,
        body: { prompt }
      }) as any;

      return data.layout || data;
    } catch (err: any) {
      let errMsg = String(err);
      try {
        const errJson = JSON.parse(errMsg);
        if (errJson.message) errMsg = errJson.message;
      } catch {}
      throw new Error(errMsg);
    }
  }

  async reconcileLayouts(layouts: any[], _signal?: AbortSignal): Promise<any> {
    const apiKey = this.getApiKey();
    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    try {
      const data = await invoke('http_post', {
        url: 'https://api.reve.com/v2/image/reconcile_layouts',
        headers,
        body: { layouts }
      }) as any;

      return data.layout || data;
    } catch (err: any) {
      let errMsg = String(err);
      try {
        const errJson = JSON.parse(errMsg);
        if (errJson.message) errMsg = errJson.message;
      } catch {}
      throw new Error(errMsg);
    }
  }

  async generate(
    params: AnarchyGenerationParams,
    images: string[],
    signal?: AbortSignal,
    onStatusChange?: (status: 'queued' | 'processing', predictionId?: string) => void
  ): Promise<AnarchyGenerationResult> {
    const start = Date.now();
    
    // Check if model is extract-layout
    if (params.model === 'reve/extract-layout') {
      if (images.length === 0) {
        throw new Error('Reve Extract Layout requires a reference image.');
      }
      const layout = await this.extractLayout(images[0], params.prompt, signal);
      const imageUrl = await this.visualizeLayout(images[0], layout);
      return {
        id: `reve-layout-${Date.now()}`,
        imageUrl,
        imageUrls: [imageUrl],
        metadata: {
          model: params.model,
          prompt: params.prompt || 'Extract Layout',
          width: 1024,
          height: 1024,
          seed: -1,
          steps: 1,
          generationTime: Date.now() - start,
          timestamp: Date.now(),
          layout, // Include raw layout in metadata for easy JSON copy
        },
      };
    }

    // Check if model is create-layout
    if (params.model === 'reve/create-layout') {
      const layout = await this.createLayout(params.prompt || '', signal);
      const imageUrl = await this.visualizeEmptyLayout(layout);
      return {
        id: `reve-create-layout-${Date.now()}`,
        imageUrl,
        imageUrls: [imageUrl],
        metadata: {
          model: params.model,
          prompt: params.prompt || 'Create Layout',
          width: layout.width || 1024,
          height: layout.height || 1024,
          seed: -1,
          steps: 1,
          generationTime: Date.now() - start,
          timestamp: Date.now(),
          layout, // Send raw layout back
        },
      };
    }

    // Check if model is reconcile-layouts
    if (params.model === 'reve/reconcile-layouts') {
      let layoutsObj: any[] = [];
      try {
        layoutsObj = JSON.parse(params.prompt);
        if (!Array.isArray(layoutsObj)) {
          layoutsObj = [layoutsObj];
        }
      } catch {
        throw new Error('Reve Reconcile Layouts requires a valid JSON Array of layouts in the prompt field.');
      }
      const layout = await this.reconcileLayouts(layoutsObj, signal);
      const imageUrl = await this.visualizeEmptyLayout(layout);
      return {
        id: `reve-reconcile-layouts-${Date.now()}`,
        imageUrl,
        imageUrls: [imageUrl],
        metadata: {
          model: params.model,
          prompt: params.prompt || 'Reconcile Layouts',
          width: layout.width || 1024,
          height: layout.height || 1024,
          seed: -1,
          steps: 1,
          generationTime: Date.now() - start,
          timestamp: Date.now(),
          layout,
        },
      };
    }

    // Check if model is render-layout
    if (params.model === 'reve/render-layout') {
      let layoutObj: any = null;
      try {
        layoutObj = JSON.parse(params.prompt);
      } catch {
        throw new Error('Reve Render Layout requires a valid JSON layout structure in the prompt field.');
      }
      return this.renderLayout(layoutObj, images, signal);
    }

    // Resolve all images to PNG base64 (Reve only accepts specific formats)
    const references = await Promise.all(
      images.map(async (img) => {
        const base64Data = await this.resolveImageToPngBase64(img);
        return { data: base64Data };
      })
    );

    let finalPrompt = params.prompt || '';
    if (references.length > 0 && !finalPrompt.includes('<frame>')) {
      finalPrompt = `<frame>0</frame> ${finalPrompt}`;
    }

    // Map postprocessing parameters
    const postprocessing: any[] = [];
    if (params.anarchyRemoveBackground) {
      postprocessing.push({ process: 'remove_background' });
    }
    if (params.anarchyUpscaleFactor && params.anarchyUpscaleFactor !== 'Off') {
      const factor = parseInt(params.anarchyUpscaleFactor.replace('x', ''), 10);
      if (!isNaN(factor)) {
        postprocessing.push({ process: 'upscale', upscale_factor: factor });
      }
    }
    if (params.anarchyEffect && params.anarchyEffect !== 'None') {
      postprocessing.push({ process: 'effect', effect_name: params.anarchyEffect });
    }

    const input: Record<string, any> = {
      prompt: finalPrompt,
      aspect_ratio: params.aspectRatio === 'match_input_image' ? 'auto' : (params.aspectRatio || 'auto'),
      references,
      postprocessing
    };

    // If a mask image is passed (2nd reference image), attach mask explicitly for Reve inpainting
    if (references.length > 1) {
      input.mask = references[1];
    }

    const prediction = await this.runRevePrediction(input, signal, onStatusChange);
    const imageUrl = prediction.output || '';

    return {
      id: prediction.id,
      imageUrl,
      imageUrls: [imageUrl],
      metadata: {
        model: params.model,
        prompt: params.prompt,
        width: 1024,
        height: 1024,
        seed: -1,
        steps: 1,
        generationTime: Date.now() - start,
        timestamp: Date.now(),
      },
    };
  }
}

export const anarchyService = new AnarchyService();
