/**
 * Replicate API Integration Service
 * Unified image / upscale / video / 3D / chat generation
 * Docs: https://replicate.com/docs
 *
 * SECURITY: All API calls go through Supabase Edge Function "replicate-proxy".
 * The Replicate API key is NEVER stored in the frontend.
 */

import { logger } from '../../utils/logger';
import { supabaseUrl, supabaseAnonKey } from '../supabase/supabaseClient';

// ── Image Models ──────────────────────────────────────────────────────────────
export type ReplicateImageModel =
  | 'google/nano-banana-2'              // Nano Banana 2 (Gemini 3.1 Flash)
  | 'bytedance/seedream-4.5'            // Seedream 4.5 - ByteDance
  | 'black-forest-labs/flux-2-pro'      // FLUX 2 Pro - img2img + 8 ref images
  | 'openai/gpt-image-2'                // GPT Image 2 - OpenAI
  | 'google/nano-banana-pro'            // Nano Banana Pro (Gemini 3 Pro)
  | 'bytedance/seedance-2.0'            // Seedance 2.0 - video (used via generateVideo)
  | 'xai/grok-imagine-image'            // Grok Imagine Image - xAI
  | 'black-forest-labs/flux-kontext-pro' // FLUX Kontext Pro - character consistency
  | 'stability-ai/stable-diffusion-3.5-large'; // Stable Diffusion 3.5 Large

// ── Upscale Models ────────────────────────────────────────────────────────────
export type ReplicateUpscaleModel =
  | 'topazlabs/image-upscale'              // Topaz Labs Image Upscale
  | 'philz1337x/clarity-upscaler'          // Clarity Upscaler
  | 'prunaai/p-image-upscale';             // Pruna AI P-Image Upscale

// ── Video Models ──────────────────────────────────────────────────────────────
export type ReplicateVideoModel =
  | 'wavespeedai/wan-2.1-i2v-480p'        // Wan 2.1 i2v 480p
  | 'wavespeedai/wan-2.1-i2v-720p';       // Wan 2.1 i2v 720p

// ── 3D Models ─────────────────────────────────────────────────────────────────
export type Replicate3DModel =
  | 'zsxkib/tripo3d';                      // Tripo3D image-to-3D

// ── Chat Models ───────────────────────────────────────────────────────────────
export type ReplicateChatModel =
  | 'meta/meta-llama-3-70b-instruct'
  | 'anthropic/claude-3.7-sonnet'
  | 'deepseek-ai/deepseek-r1';

export type ReplicateModel =
  | ReplicateImageModel
  | ReplicateUpscaleModel
  | ReplicateVideoModel
  | Replicate3DModel
  | ReplicateChatModel;

// ── Parameter Interfaces ──────────────────────────────────────────────────────
export interface ReplicateGenerationParams {
  prompt: string;
  negativePrompt?: string;
  model: ReplicateImageModel;
  aspectRatio?: string;
  width?: number;
  height?: number;
  steps?: number;
  seed?: number | null;
  strength?: number;
  referenceStrength?: number;
  results?: number;
  disableSafetyChecker?: boolean;
  upscaleFactor?: number;
  resolution?: string;
  loraUrl?: string;
  loraScale?: number;
  styleType?: string;
  stylePreset?: string;
  cfg?: number; // Guidance scale for SD 3.5 (range 1-10, default 5)
  nodeId?: string;
  userId?: string;
}

export interface ReplicateChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ReplicateChatResult {
  content: string;
  model: ReplicateChatModel;
}

export interface ReplicateGenerationResult {
  id: string;
  imageUrl: string;
  metadata: {
    model: ReplicateImageModel;
    prompt: string;
    negativePrompt?: string;
    width: number;
    height: number;
    seed: number;
    steps: number;
    generationTime: number;
    timestamp: number;
  };
}

export interface ReplicatePrediction {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output: unknown;
  error?: any;
  logs?: string;
  version?: string;
  input?: Record<string, unknown>;
}

export interface ReplicateApiConfig {
  baseUrl: string;
  timeout: number;
  maxRetries: number;
}

// ── Model Metadata ────────────────────────────────────────────────────────────
interface ModelMeta {
  supportsImg2Img: boolean;
  supportsMultiImage: boolean;
  supportsSeed: boolean;
  supportsSteps: boolean;
  supportsNegativePrompt: boolean;
  supportsUpscale: boolean;
  supportsLoRA: boolean;
  supportsReferenceStrength: boolean;
  supportsStyleType?: boolean;
  supportsStylePreset?: boolean;
  defaultSteps: number;
  stepsRange: [number, number];    // [min, max]
  maxReferenceImages: number;
  aspectRatios: string[];
  resolutions: string[];
  styleTypes?: string[];
  stylePresets?: string[];
  pricePerImage: number;
}

const MODEL_META: Record<ReplicateModel, ModelMeta> = {
  // ── 1. Nano Banana 2 (Gemini 3.1 Flash Image) ──────────────────────────────
  'google/nano-banana-2': {
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
    maxReferenceImages: 14,
    resolutions: ['1K', '2K', '4K'],
    aspectRatios: ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'],
    pricePerImage: 0.003,
  },
  // ── 2. Seedream 4.5 ─────────────────────────────────────────────────────────
  'bytedance/seedream-4.5': {
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
    maxReferenceImages: 14,
    resolutions: ['2K', '4K'],
    aspectRatios: ['match_input_image', '1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '21:9'],
    pricePerImage: 0.016,
  },
  // ── 3. FLUX 2 Pro ────────────────────────────────────────────────────────────
  'black-forest-labs/flux-2-pro': {
    supportsImg2Img: true,
    supportsMultiImage: true,
    supportsSeed: true,
    supportsSteps: false,
    supportsNegativePrompt: false,
    supportsUpscale: false,
    supportsLoRA: false,
    supportsReferenceStrength: true,
    defaultSteps: 28,
    stepsRange: [1, 50],
    maxReferenceImages: 8,
    resolutions: ['0.5K', '1K', '2K', '4K'],
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'],
    pricePerImage: 0.05,
  },
  // ── 4. GPT Image 2 ──────────────────────────────────────────────────────────
  'openai/gpt-image-2': {
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
    maxReferenceImages: 10,
    resolutions: ['auto', 'low', 'medium', 'high'],
    aspectRatios: ['1:1', '3:2', '2:3'],
    pricePerImage: 0.04,
  },
  // ── 5. Nano Banana Pro (Gemini 3 Pro Image) ──────────────────────────────────
  'google/nano-banana-pro': {
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
    maxReferenceImages: 14,
    resolutions: ['1K', '2K', '4K'],
    aspectRatios: ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'],
    pricePerImage: 0.015,
  },
  // ── 6. Seedance 2.0 (video) ──────────────────────────────────────────────────
  'bytedance/seedance-2.0': {
    supportsImg2Img: true,
    supportsMultiImage: false,
    supportsSeed: true,
    supportsSteps: false,
    supportsNegativePrompt: false,
    supportsUpscale: false,
    supportsLoRA: false,
    supportsReferenceStrength: false,
    defaultSteps: 1,
    stepsRange: [1, 1],
    maxReferenceImages: 1,
    resolutions: ['480p', '720p', '1080p'],
    aspectRatios: ['adaptive', '1:1', '16:9', '9:16', '4:3', '3:4'],
    pricePerImage: 0.08,
  },
  // ── 7. FLUX Kontext Pro ───────────────────────────────────────────────
  'black-forest-labs/flux-kontext-pro': {
    supportsImg2Img: true,
    supportsMultiImage: false,
    supportsSeed: true,
    supportsSteps: false,
    supportsNegativePrompt: false,
    supportsUpscale: false,
    supportsLoRA: false,
    supportsReferenceStrength: false,
    defaultSteps: 1,
    stepsRange: [1, 1],
    maxReferenceImages: 1,
    resolutions: ['Auto'],
    aspectRatios: ['match_input_image', '1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '21:9'],
    pricePerImage: 0.05,
  },
  // ── 8. Grok Imagine Image ──────────────────────────────────────────────────
  'xai/grok-imagine-image': {
    supportsImg2Img: true,
    supportsMultiImage: false,
    supportsSeed: false,
    supportsSteps: false,
    supportsNegativePrompt: false,
    supportsUpscale: false,
    supportsLoRA: false,
    supportsReferenceStrength: false,
    defaultSteps: 1,
    stepsRange: [1, 1],
    maxReferenceImages: 1,
    resolutions: ['Auto'],
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'],
    pricePerImage: 0.03,
  },
  // ── 9. Stable Diffusion 3.5 Large ────────────────────────────────────────
  'stability-ai/stable-diffusion-3.5-large': {
    supportsImg2Img: true,
    supportsMultiImage: false,
    supportsSeed: true,
    supportsSteps: true,
    supportsNegativePrompt: true,
    supportsUpscale: false,
    supportsLoRA: false,
    supportsReferenceStrength: true,
    defaultSteps: 28,
    stepsRange: [20, 50],
    maxReferenceImages: 1,
    resolutions: ['Auto'],
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9', '9:21'],
    pricePerImage: 0.065, // $0.065 per image (official Replicate price)
  },
  // ── 10. Topaz Labs Image Upscale ──────────────────────────────────────────
  'topazlabs/image-upscale': {
    supportsImg2Img: false,
    supportsMultiImage: false,
    supportsSeed: false,
    supportsSteps: false,
    supportsNegativePrompt: false,
    supportsUpscale: true,
    supportsLoRA: false,
    supportsReferenceStrength: false,
    defaultSteps: 1,
    stepsRange: [1, 1],
    maxReferenceImages: 0,
    resolutions: ['2x', '4x'],
    aspectRatios: [],
    pricePerImage: 0.005,
  },
  // ── 11. Pruna AI P-Image Upscale ───────────────────────────────────────────
  'prunaai/p-image-upscale': {
    supportsImg2Img: false,
    supportsMultiImage: false,
    supportsSeed: false,
    supportsSteps: false,
    supportsNegativePrompt: false,
    supportsUpscale: true,
    supportsLoRA: false,
    supportsReferenceStrength: false,
    defaultSteps: 1,
    stepsRange: [1, 1],
    maxReferenceImages: 0,
    resolutions: ['1x', '2x', '4x', '8x', '16x'],
    aspectRatios: [],
    pricePerImage: 0.01,
  },

  // ── 12. Clarity Upscaler ─────────────────────────────────────────────────
  'philz1337x/clarity-upscaler': {
    supportsImg2Img: false,
    supportsMultiImage: false,
    supportsSeed: true,
    supportsSteps: true,
    supportsNegativePrompt: true,
    supportsUpscale: true,
    supportsLoRA: true,
    supportsReferenceStrength: false,
    defaultSteps: 20,
    stepsRange: [1, 100],
    maxReferenceImages: 0,
    resolutions: ['1x', '2x', '4x'],
    aspectRatios: [],
    pricePerImage: 0.01,
  },
  // ── 13. Wan 2.1 i2v 480p ────────────────────────────────────────────────
  'wavespeedai/wan-2.1-i2v-480p': {
    supportsImg2Img: true,
    supportsMultiImage: false,
    supportsSeed: true,
    supportsSteps: false,
    supportsNegativePrompt: false,
    supportsUpscale: false,
    supportsLoRA: false,
    supportsReferenceStrength: false,
    defaultSteps: 1,
    stepsRange: [1, 1],
    maxReferenceImages: 1,
    resolutions: ['480p'],
    aspectRatios: [],
    pricePerImage: 0.04,
  },
  // ── 14. Wan 2.1 i2v 720p ────────────────────────────────────────────────
  'wavespeedai/wan-2.1-i2v-720p': {
    supportsImg2Img: true,
    supportsMultiImage: false,
    supportsSeed: true,
    supportsSteps: false,
    supportsNegativePrompt: false,
    supportsUpscale: false,
    supportsLoRA: false,
    supportsReferenceStrength: false,
    defaultSteps: 1,
    stepsRange: [1, 1],
    maxReferenceImages: 1,
    resolutions: ['720p'],
    aspectRatios: [],
    pricePerImage: 0.08,
  },
  // ── 15. Tripo3D ───────────────────────────────────────────────────────────
  'zsxkib/tripo3d': {
    supportsImg2Img: true,
    supportsMultiImage: false,
    supportsSeed: false,
    supportsSteps: false,
    supportsNegativePrompt: false,
    supportsUpscale: false,
    supportsLoRA: false,
    supportsReferenceStrength: false,
    defaultSteps: 1,
    stepsRange: [1, 1],
    maxReferenceImages: 1,
    resolutions: [],
    aspectRatios: [],
    pricePerImage: 0.03,
  },
  // ── 16-18. Chat Models ──────────────────────────────────────────────────
  'meta/meta-llama-3-70b-instruct': {
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
    resolutions: [],
    aspectRatios: [],
    pricePerImage: 0,
  },
  'anthropic/claude-3.7-sonnet': {
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
    resolutions: [],
    aspectRatios: [],
    pricePerImage: 0,
  },
  'deepseek-ai/deepseek-r1': {
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
    resolutions: [],
    aspectRatios: [],
    pricePerImage: 0,
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function arToSize(ar: string, base: number): { width: number; height: number } {
  const map: Record<string, { width: number; height: number }> = {
    '1:1':  { width: base,        height: base },
    '16:9': { width: base,        height: Math.round(base * 9 / 16) },
    '9:16': { width: Math.round(base * 9 / 16), height: base },
    '4:3':  { width: base,        height: Math.round(base * 3 / 4) },
    '3:4':  { width: Math.round(base * 3 / 4), height: base },
    '3:2':  { width: base,        height: Math.round(base * 2 / 3) },
    '2:3':  { width: Math.round(base * 2 / 3), height: base },
  };
  return map[ar] ?? { width: base, height: base };
}

function resolutionToPixels(res: string): number {
  if (res === '2K') return 1536;
  const n = Number.parseInt(res);
  return isNaN(n) ? 1024 : n;
}

// ── Supabase proxy URL ───────────────────────────────────────────────────────
function getProxyUrl(): string {
  const url = supabaseUrl;
  const key = supabaseAnonKey;
  if (!url || !key || url.includes('placeholder')) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env. ' +
      'All Replicate API calls require the Supabase Edge Function proxy.'
    );
  }
  return `${url}/functions/v1/replicate-proxy`;
}

// ── Proxy fetch: all API calls go through Supabase Edge Function ──────────────
async function proxyPost(proxyUrl: string, replicatePath: string, body: unknown, signal?: AbortSignal): Promise<ReplicatePrediction> {
  const anonKey = supabaseAnonKey;
  const res = await fetch(proxyUrl, {
    method: 'POST',
    headers: {
      'Content-Type':       'application/json',
      'apikey':             anonKey,
      'Authorization':      `Bearer ${anonKey}`,
      'x-replicate-path':   replicatePath,
      'x-replicate-method': 'POST',
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(`Proxy ${res.status}: ${await res.text()}`);
  return res.json();
}

async function proxyGet(proxyUrl: string, replicatePath: string, signal?: AbortSignal): Promise<ReplicatePrediction> {
  const anonKey = supabaseAnonKey;
  const res = await fetch(proxyUrl, {
    method: 'POST',
    headers: {
      'Content-Type':       'application/json',
      'apikey':             anonKey,
      'Authorization':      `Bearer ${anonKey}`,
      'x-replicate-path':   replicatePath,
      'x-replicate-method': 'GET',
    },
    signal,
  });
  if (!res.ok) throw new Error(`Proxy ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── Service Class ─────────────────────────────────────────────────────────────
class ReplicateService {
  private lastRequestTime = 0;
  private readonly minRequestInterval = 12_000; // 12s between requests (5 req/min safe)
  private webhookUrl: string = '';

  constructor() {
    // Webhook URL auto-constructed from Supabase URL
    if (supabaseUrl && !supabaseUrl.includes('placeholder')) {
      this.webhookUrl = `${supabaseUrl}/functions/v1/replicate_webhook`;
    }
    
    logger.log('[ReplicateService] Webhook URL:', this.webhookUrl || '(empty - webhook disabled)');
    logger.log('[ReplicateService] Mode: Proxy-only (server-side API key)');
  }

  // Wait if needed to respect rate limit
  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minRequestInterval) {
      const waitMs = this.minRequestInterval - elapsed;
      await new Promise(r => setTimeout(r, waitMs));
    }
    this.lastRequestTime = Date.now();
  }

  getModelCapabilities(model: ReplicateModel): ModelMeta {
    return MODEL_META[model] ?? MODEL_META['google/nano-banana-2'];
  }

  getModelSettings(model: ReplicateModel) {
    const meta = this.getModelCapabilities(model);
    return {
      resolutions:               meta.resolutions,
      aspectRatios:              meta.aspectRatios,
      supportsSteps:             meta.supportsSteps,
      supportsNegativePrompt:    meta.supportsNegativePrompt,
      supportsUpscale:           meta.supportsUpscale,
      supportsReferenceStrength: meta.supportsReferenceStrength,
      supportsMultiImage:        meta.supportsMultiImage,
      supportsSeed:              meta.supportsSeed,
      supportsLoRA:              meta.supportsLoRA,
      supportsStyleType:         meta.supportsStyleType,
      supportsStylePreset:       meta.supportsStylePreset,
      maxReferenceImages:        meta.maxReferenceImages,
      defaultSteps:              meta.defaultSteps,
      stepsRange:                meta.stepsRange,
      styleTypes:                meta.styleTypes,
      stylePresets:              meta.stylePresets,
    };
  }

  getAvailableModels(): ReplicateImageModel[] {
    return Object.keys(MODEL_META) as ReplicateImageModel[];
  }

  // ── Poll a prediction until SUCCEEDED or FAILED ──────────────────────────────
  private async pollPrediction(
    predictionId: string,
    signal?: AbortSignal,
    onStatusChange?: (status: 'queued' | 'processing', predictionId?: string) => void
  ): Promise<ReplicatePrediction> {
    const proxy = getProxyUrl();
    const path  = `/predictions/${predictionId}`;
    const maxAttempts = 120;
    let hasNotifiedProcessing = false;
    let consecutiveErrors = 0;

    for (let i = 0; i < maxAttempts; i++) {
      if (signal?.aborted) {
        throw new Error('Prediction polling aborted');
      }

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(resolve, 2000);
        if (signal) {
          const onAbort = () => {
            clearTimeout(timeout);
            reject(new Error('Prediction polling aborted'));
          };
          signal.addEventListener('abort', onAbort, { once: true });
        }
      });

      if (signal?.aborted) {
        throw new Error('Prediction polling aborted');
      }

      let data: ReplicatePrediction;
      try {
        data = await proxyGet(proxy, path, signal);
        consecutiveErrors = 0; // Reset error count on successful query
      } catch (err: any) {
        if (signal?.aborted) {
          throw new Error('Prediction polling aborted');
        }
        consecutiveErrors++;
        logger.warn(`[ReplicateService] Prediction polling failed (${consecutiveErrors}/5):`, err?.message || err);
        if (consecutiveErrors >= 5) {
          throw new Error(`Prediction polling failed after 5 consecutive attempts: ${err?.message || err}`);
        }
        continue; // Retry on next iteration
      }
      
      // Update status when prediction transitions to processing status
      if (data.status === 'processing' && !hasNotifiedProcessing) {
        hasNotifiedProcessing = true;
        if (onStatusChange) {
          onStatusChange('processing', predictionId);
        }
      }

      if (data.status === 'succeeded') return data;
      if (data.status === 'failed' || data.status === 'canceled') {
        logger.error('[ReplicateService] Prediction failed:', {
          status: data.status,
          error: data.error,
          logs: data.logs,
          input: data.input,
          model: data.version,
        });
        throw new Error(`Prediction ${data.status}: ${JSON.stringify(data.error ?? data.logs ?? 'unknown error')}`);
      }
    }
    throw new Error('Prediction timed out after 4 minutes');
  }

  // Community models need version-based endpoint instead of /models/
  private static readonly MODEL_VERSIONS: Record<string, string> = {
    'philz1337x/clarity-upscaler': 'dfad41707589d68ecdccd1dfa600d55a208f9310748e44bfe35b4a6291453d5e',
  };

  // ── Upload a base64 data URI to Replicate Files API via proxy ──────────────
  async uploadToReplicate(dataUri: string): Promise<string> {
    // Parse data URI
    const commaIdx = dataUri.indexOf(',');
    if (commaIdx === -1) throw new Error('Invalid data URI');
    const meta = dataUri.substring(0, commaIdx);
    const b64 = dataUri.substring(commaIdx + 1);
    const mime = meta.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
    const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';

    const proxy = getProxyUrl();
    logger.log('[ReplicateService] Uploading image via proxy...');
    const byteStr = atob(b64);
    const bytes = new Uint8Array(byteStr.length);
    for (let i = 0; i < byteStr.length; i++) bytes[i] = byteStr.charCodeAt(i);
    const blob = new Blob([bytes], { type: mime });
    const formData = new FormData();
    formData.append('content', blob, `upload.${ext}`);
    
    const anonKey = supabaseAnonKey;
    const res = await fetch(proxy, {
      method: 'POST',
      headers: {
        'apikey':             anonKey,
        'Authorization':      `Bearer ${anonKey}`,
        'x-replicate-path':   '/files',
        'x-replicate-method': 'POST',
      },
      body: formData,
    });
    if (!res.ok) throw new Error(`Replicate upload via proxy failed: ${res.status} - ${await res.text()}`);
    const json = await res.json();
    return json.urls?.get || json.url;
  }

  // ── Submit a prediction and wait for result (with rate-limit retry) ──────
  public async runPrediction(
    modelId: string,
    input: Record<string, unknown>,
    nodeId?: string,
    userId?: string,
    signal?: AbortSignal,
    onStatusChange?: (status: 'queued' | 'processing', predictionId?: string) => void
  ): Promise<ReplicatePrediction> {
    const proxy = getProxyUrl();
    logger.log("Model:", modelId, "Payload:", input);

    // Use version-based endpoint for community models
    const version = ReplicateService.MODEL_VERSIONS[modelId];
    const path = version ? '/predictions' : `/models/${modelId}/predictions`;
    const body: Record<string, unknown> = version ? { version, input } : { input };
    
    // Add webhook URL if configured
    if (this.webhookUrl) {
      const finalNodeId = (nodeId || input.node_id || input.nodeId || 'unknown') as string;
      const finalUserId = (userId || input.user_id || input.userId || 'anonymous') as string;
      let webhookWithParams = `${this.webhookUrl}?node_id=${encodeURIComponent(finalNodeId)}&user_id=${encodeURIComponent(finalUserId)}&model=${encodeURIComponent(modelId)}`;
      const workflowIdVal = (input.workflow_id || input.workflowId) as string | undefined;
      if (workflowIdVal) {
        webhookWithParams += `&workflow_id=${encodeURIComponent(workflowIdVal)}`;
      }
      body.webhook = webhookWithParams;
      body.webhook_events_filter = ['completed'];
      
      logger.log('[ReplicateService] Including webhook:', webhookWithParams);
    }
    
    logger.log('[ReplicateService] Submitting prediction:', {
      model: modelId,
      path,
      inputKeys: Object.keys(input),
      hasImages: input.image_input || input.image || input.input_images ? 'yes' : 'no',
      hasWebhook: !!this.webhookUrl,
    });

    const maxRetries = 4;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (signal?.aborted) {
        throw new Error('Prediction aborted');
      }

      try {
        await this.throttle();
        const prediction = await proxyPost(proxy, path, body, signal);

        // Notify that the prediction has been successfully created (queued)
        if (onStatusChange) {
          onStatusChange('queued', prediction.id);
        }

        if (prediction.status === 'succeeded') {
          logger.log("Replicate response:", prediction);
          return prediction;
        }
        if (prediction.status === 'failed') {
          logger.error('[ReplicateService] Immediate prediction failure:', {
            model: modelId,
            error: prediction.error,
            logs: prediction.logs,
            input: prediction.input,
          });
          throw new Error(`Prediction failed: ${JSON.stringify(prediction.error ?? prediction)}`);
        }
        const response = await this.pollPrediction(prediction.id, signal, onStatusChange);
        logger.log("Replicate response:", response);
        return response;
      } catch (err: any) {
        if (signal?.aborted) {
          throw new Error('Prediction aborted');
        }

        const errMsg = err?.message || String(err);
        const isHighDemand = errMsg.includes('E003')
          || errMsg.includes('high demand')
          || errMsg.includes('currently unavailable')
          || errMsg.includes('422');
        const isRetryable = isHighDemand
          || errMsg.includes('429')
          || errMsg.includes('Connection aborted')
          || errMsg.includes('RemoteDisconnected')
          || errMsg.includes('Remote end closed')
          || errMsg.includes('502')
          || errMsg.includes('503');
        if (isRetryable && attempt < maxRetries) {
          const retryMatch = errMsg.match(/"retry_after"\s*:\s*(\d+)/);
          const waitSec = retryMatch
            ? Number.parseInt(retryMatch[1], 10) + 1
            : isHighDemand ? (attempt + 1) * 20 : (attempt + 1) * 15;
          logger.log(`[ReplicateService] Retryable error (attempt ${attempt + 1}/${maxRetries}), waiting ${waitSec}s...`, errMsg.substring(0, 120));
          
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(resolve, waitSec * 1000);
            if (signal) {
              signal.addEventListener('abort', () => {
                clearTimeout(timeout);
                reject(new Error('Prediction aborted'));
              }, { once: true });
            }
          });
          continue;
        }
        throw err;
      }
    }
    throw new Error('Max retries exceeded — Replicate service is currently under high demand. Please try again in a few minutes.');
  }

  // ── Submit prediction with webhook (async, no polling) ────────────────────
  private async submitPredictionWithWebhook(
    model: string,
    input: Record<string, any>,
    metadata: { nodeId: string; userId: string; workflowId?: string }
  ): Promise<{ id: string; status: string }> {
    const proxy = getProxyUrl();
    const version = ReplicateService.MODEL_VERSIONS[model];
    const path = version ? '/predictions' : `/models/${model}/predictions`;
    
    let webhookWithParams = this.webhookUrl;
    if (this.webhookUrl) {
      const finalNodeId = metadata.nodeId || 'unknown';
      const finalUserId = metadata.userId || 'anonymous';
      webhookWithParams = `${this.webhookUrl}?node_id=${encodeURIComponent(finalNodeId)}&user_id=${encodeURIComponent(finalUserId)}&model=${encodeURIComponent(model)}`;
      if (metadata.workflowId) {
        webhookWithParams += `&workflow_id=${encodeURIComponent(metadata.workflowId)}`;
      }
    }

    const baseBody = {
      input,
      webhook: webhookWithParams,
      webhook_events_filter: ['start', 'completed'],
      metadata: {
        node_id: metadata.nodeId,
        user_id: metadata.userId,
        workflow_id: metadata.workflowId,
        app: 'anarchy-ai',
      },
    };

    const body = version ? { version, ...baseBody } : baseBody;

    logger.log('[ReplicateService] Submitting with webhook:', {
      model,
      webhook: this.webhookUrl,
      nodeId: metadata.nodeId,
      path,
    });

    const data = await proxyPost(proxy, path, body);

    logger.log('[ReplicateService] Prediction submitted:', {
      id: data.id,
      status: data.status,
    });

    return { id: data.id, status: data.status };
  }

  // ── Extract first image URL from prediction output ────────────────────────
  public extractImageUrl(output: unknown): string {
    if (typeof output === 'string') return output;
    if (Array.isArray(output) && output.length > 0 && typeof output[0] === 'string') return output[0];
    if (output && typeof output === 'object' && 'url' in output) {
      const urlVal = (output as Record<string, unknown>).url;
      if (typeof urlVal === 'string') return urlVal;
    }
    throw new Error('No image URL in Replicate response');
  }

  // ── Build input payload for Nano Banana models (image_input field) ─────────
  private buildNanoBananaInput(
    params: ReplicateGenerationParams,
    images: string[]
  ): Record<string, any> {
    const promptText = images.length > 0
      ? params.prompt
      : params.prompt;
    const input: Record<string, any> = { prompt: promptText };
    if (images.length > 0) {
      input.image_input = images;
    }
    const resolutionMap: Record<string, string> = {
      '1K': '1K',
      '2K': '2K',
      '4K': '4K',
    };
    
    logger.log('[NanoBanana] Original resolution param:', params.resolution);
    
    if (params.resolution && params.resolution !== 'Auto') {
      const mappedResolution = resolutionMap[params.resolution] || params.resolution;
      input.resolution = mappedResolution;
      logger.log('[NanoBanana] Mapped resolution:', mappedResolution);
    } else {
      input.resolution = '1K';
      logger.log('[NanoBanana] Using default resolution: 1K');
    }
    
    logger.log('[NanoBanana] Final input:', JSON.stringify(input, null, 2));
    
    if (images.length === 0 && params.aspectRatio && params.aspectRatio !== 'Auto') {
      input.aspect_ratio = params.aspectRatio;
    }
    return input;
  }

  // ── Build input payload for FLUX models ───────────────────────────────────
  private buildFluxInput(
    params: ReplicateGenerationParams,
    images: string[]
  ): Record<string, any> {
    const meta = this.getModelCapabilities(params.model);
    const input: Record<string, any> = { prompt: params.prompt };

    if (params.model === 'black-forest-labs/flux-kontext-pro') {
      if (images.length > 0) {
        input.input_image = images[0];
      }
      if (params.aspectRatio && params.aspectRatio !== 'Auto') {
        input.aspect_ratio = params.aspectRatio;
      } else if (images.length > 0) {
        input.aspect_ratio = 'match_input_image';
      }
      if (meta.supportsSeed && params.seed != null) input.seed = params.seed;
      return input;
    }

    if (params.model === 'black-forest-labs/flux-2-pro') {
      const mpMap: Record<string, string> = {
        '0.5K': '0.5 MP',
        '1K':   '1 MP',
        '2K':   '2 MP',
        '4K':   '4 MP',
      };
      input.resolution   = mpMap[params.resolution ?? '1K'] ?? '1 MP';
      
      if (images.length > 0) {
        if (!params.aspectRatio || params.aspectRatio === 'Auto' || params.aspectRatio === 'Match Input') {
          input.aspect_ratio = 'match_input_image';
        } else {
          input.aspect_ratio = params.aspectRatio;
        }
        input.input_images = images;
        if (meta.supportsReferenceStrength && params.strength != null) {
          input.prompt_strength = params.strength;
        }
      } else {
        input.aspect_ratio = params.aspectRatio ?? '1:1';
      }
      
      if (meta.supportsSeed && params.seed != null) input.seed = params.seed;
    } else {
      const base = resolutionToPixels(params.resolution ?? 'Auto');
      const dims = arToSize(params.aspectRatio ?? '1:1', base);
      input.width  = dims.width;
      input.height = dims.height;
      if (meta.supportsSteps)             input.num_inference_steps = params.steps ?? meta.defaultSteps;
      if (meta.supportsSeed && params.seed != null) input.seed = params.seed;
      if (meta.supportsNegativePrompt && params.negativePrompt) {
        input.negative_prompt = params.negativePrompt;
      }
      if (images.length > 0) {
        input.image = images[0];
        if (meta.supportsReferenceStrength && params.strength != null) {
          input.prompt_strength = params.strength;
        }
      }
      if (meta.supportsLoRA && params.loraUrl) {
        input.extra_lora       = params.loraUrl;
        input.extra_lora_scale = params.loraScale ?? 0.8;
      }
    }
    return input;
  }

  // ── Build input for general/fallback models ───────────────────────────────
  private buildGeneralInput(
    params: ReplicateGenerationParams
  ): Record<string, any> {
    const meta = this.getModelCapabilities(params.model);
    const input: Record<string, any> = { prompt: params.prompt };

    const base = resolutionToPixels(params.resolution ?? 'Auto');
    const dims = arToSize(params.aspectRatio ?? '1:1', base);
    input.width  = dims.width;
    input.height = dims.height;

    if (meta.supportsSeed && params.seed != null) input.seed = params.seed;
    if (meta.supportsNegativePrompt && params.negativePrompt) {
      input.negative_prompt = params.negativePrompt;
    }
    return input;
  }

  // ── Text-to-Image ─────────────────────────────────────────────────────────
  async generate(
    params: ReplicateGenerationParams,
    signal?: AbortSignal,
    onStatusChange?: (status: 'queued' | 'processing', predictionId?: string) => void
  ): Promise<ReplicateGenerationResult> {
    const start = Date.now();
    const input = this.buildInput(params, []);

    const prediction = await this.runPrediction(params.model, input, params.nodeId, params.userId, signal, onStatusChange);
    const imageUrl   = this.extractImageUrl(prediction.output);

    return this.buildResult(params, imageUrl, {}, start);
  }

  // ── Async Generation with Webhook (no waiting) ────────────────────────────
  async generateWithWebhook(
    params: ReplicateGenerationParams,
    metadata: { nodeId: string; userId: string; workflowId?: string }
  ): Promise<{ predictionId: string; status: string }> {
    if (!this.webhookUrl) {
      throw new Error('Webhook URL not configured. Ensure VITE_SUPABASE_URL is set correctly.');
    }

    const input = this.buildInput(params, []);
    
    const prediction = await this.submitPredictionWithWebhook(params.model, input, metadata);
    
    return {
      predictionId: prediction.id,
      status: prediction.status,
    };
  }

  // ── Image-to-Image (with multiple reference images) ───────────────────────
  async generateImg2Img(
    params: ReplicateGenerationParams,
    images: string | string[],
    signal?: AbortSignal,
    onStatusChange?: (status: 'queued' | 'processing', predictionId?: string) => void
  ): Promise<ReplicateGenerationResult> {
    const start     = Date.now();
    const meta      = this.getModelCapabilities(params.model);
    const imageList = Array.isArray(images) ? images : [images];

    const maxImgs  = meta.maxReferenceImages > 0 ? meta.maxReferenceImages : 14;
    const imgSlice = imageList.slice(0, maxImgs);

    const input = this.buildInput(params, imgSlice);

    const prediction = await this.runPrediction(params.model, input, params.nodeId, params.userId, signal, onStatusChange);
    const imageUrl   = this.extractImageUrl(prediction.output);

    return this.buildResult(params, imageUrl, input, start);
  }

  // ── Build input for Seedream 4.5 ─────────────────────────────────────────
  private buildSeedreamInput(
    params: ReplicateGenerationParams,
    images: string[]
  ): Record<string, any> {
    const input: Record<string, any> = { prompt: params.prompt };
    if (images.length > 0) {
      input.image_input = images;
    }
    input.size = params.resolution === '4K' ? '4K' : '2K';
    if (params.aspectRatio && params.aspectRatio !== 'Auto') {
      input.aspect_ratio = params.aspectRatio;
    } else if (images.length > 0) {
      input.aspect_ratio = 'match_input_image';
    }
    return input;
  }

  // ── Build input for Grok Imagine Image ──────────────────────────────────
  private buildGrokInput(
    params: ReplicateGenerationParams,
    images: string[]
  ): Record<string, any> {
    const input: Record<string, any> = { prompt: params.prompt };
    if (images.length > 0) {
      input.image = images[0];
    }
    if (params.aspectRatio && params.aspectRatio !== 'Auto') {
      input.aspect_ratio = params.aspectRatio;
    }
    return input;
  }

  // ── Build input for GPT Image 2 ───────────────────────────────────────────
  private buildGptImageInput(
    params: ReplicateGenerationParams,
    images: string[]
  ): Record<string, any> {
    const input: Record<string, any> = { prompt: params.prompt };
    
    if (images.length >= 1) {
      input.input_images = images;
    }
    
    if (params.resolution && params.resolution !== 'auto') {
      input.quality = params.resolution.toLowerCase();
    }
    
    if (params.aspectRatio && params.aspectRatio !== 'Auto') {
      input.aspect_ratio = params.aspectRatio;
    }
    
    return input;
  }

  // ── Build input payload for Stable Diffusion 3.5 ────────────────────────────
  private buildStableDiffusionInput(
    params: ReplicateGenerationParams,
    images: string[]
  ): Record<string, any> {
    const input: Record<string, any> = { prompt: params.prompt };
    
    if (images.length > 0) {
      input.image = images[0];
      input.prompt_strength = params.strength ?? 0.45;
    } else if (params.aspectRatio && params.aspectRatio !== 'Auto') {
      input.aspect_ratio = params.aspectRatio;
    }
    
    if (params.cfg != null) {
      input.cfg = params.cfg;
    }
    
    if (params.negativePrompt) {
      input.negative_prompt = params.negativePrompt;
    }
    
    if (params.steps != null) {
      input.num_inference_steps = params.steps;
    }
    
    if (params.seed != null) input.seed = params.seed;
    
    return input;
  }

  // ── Route input building per model family ─────────────────────────────────
  private buildInput(
    params: ReplicateGenerationParams,
    images: string[]
  ): Record<string, any> {
    const m = params.model;
    if (m.startsWith('google/nano-banana'))    return this.buildNanoBananaInput(params, images);
    if (m.startsWith('black-forest-labs/flux')) return this.buildFluxInput(params, images);
    if (m === 'bytedance/seedream-4.5')         return this.buildSeedreamInput(params, images);
    if (m === 'openai/gpt-image-2')             return this.buildGptImageInput(params, images);
    if (m === 'bytedance/seedance-2.0')         return this.buildSeedreamInput(params, images); // same structure
    if (m === 'xai/grok-imagine-image')          return this.buildGrokInput(params, images);
    if (m === 'stability-ai/stable-diffusion-3.5-large') return this.buildStableDiffusionInput(params, images);
    return this.buildGeneralInput(params);
  }

  // ── Build standardised result ─────────────────────────────────────────────
  private buildResult(
    params: ReplicateGenerationParams,
    imageUrl: string,
    body: Record<string, any>,
    start: number
  ): ReplicateGenerationResult {
    const meta = this.getModelCapabilities(params.model);
    const base = resolutionToPixels(params.resolution ?? 'Auto');
    const dims = arToSize(params.aspectRatio ?? '1:1', base);
    return {
      id:       `replicate-${Date.now()}`,
      imageUrl,
      metadata: {
        model:          params.model,
        prompt:         params.prompt,
        negativePrompt: params.negativePrompt,
        width:          params.width  ?? dims.width,
        height:         params.height ?? dims.height,
        seed:           body.seed     ?? -1,
        steps:          body.num_inference_steps ?? meta.defaultSteps,
        generationTime: Date.now() - start,
        timestamp:      Date.now(),
      },
    };
  }


  // ── Video Generation ──────────────────────────────────────────────────────
  async generateVideo(
    imageUrl: string,
    prompt: string,
    model: ReplicateVideoModel = 'wavespeedai/wan-2.1-i2v-480p',
    signal?: AbortSignal
  ): Promise<string> {
    const prediction = await this.runPrediction(model, {
      image:  imageUrl,
      prompt,
    }, undefined, undefined, signal);
    const output = prediction.output;
    if (typeof output === 'string') return output;
    if (Array.isArray(output))      return output[0];
    throw new Error('No video URL in response');
  }

  // ── 3D Generation ─────────────────────────────────────────────────────────
  async generate3D(
    imageUrl: string,
    model: Replicate3DModel = 'zsxkib/tripo3d',
    signal?: AbortSignal
  ): Promise<string> {
    const prediction = await this.runPrediction(model, { image: imageUrl }, undefined, undefined, signal);
    const output = prediction.output;
    if (typeof output === 'string') return output;
    if (output && typeof output === 'object' && 'mesh_url' in output) {
      const meshUrl = (output as Record<string, unknown>).mesh_url;
      if (typeof meshUrl === 'string') return meshUrl;
    }
    if (Array.isArray(output) && output.length > 0 && typeof output[0] === 'string') return output[0];
    throw new Error('No 3D model URL in response');
  }

  // ── Chat Completion ───────────────────────────────────────────────────────
  async chatCompletion(
    messages: ReplicateChatMessage[],
    model: ReplicateChatModel = 'meta/meta-llama-3-70b-instruct',
    signal?: AbortSignal
  ): Promise<ReplicateChatResult> {
    const systemMsg = messages.find(m => m.role === 'system')?.content ?? '';
    const userMsg   = messages.filter(m => m.role !== 'system').map(m => `${m.role}: ${m.content}`).join('\n');

    const prediction = await this.runPrediction(model, {
      system_prompt: systemMsg,
      prompt:        userMsg,
    }, undefined, undefined, signal);

    const output = prediction.output;
    const content = Array.isArray(output) ? output.join('') : String(output ?? '');
    return { content, model };
  }

  // ── Warm-up Connection Ping ───────────────────────────────────────────────
  async pingProxy(): Promise<boolean> {
    try {
      const url = getProxyUrl();
      const anonKey = supabaseAnonKey;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type':       'application/json',
          'apikey':             anonKey,
          'Authorization':      `Bearer ${anonKey}`,
          'x-replicate-path':   '/ping',
          'x-replicate-method': 'GET',
        },
        body: JSON.stringify({ ping: true }),
      });
      return res.ok;
    } catch (err) {
      logger.warn('[ReplicateService] Warm-up ping failed:', err);
      return false;
    }
  }

}

// Singleton
export const replicateService = new ReplicateService();
export default ReplicateService;
