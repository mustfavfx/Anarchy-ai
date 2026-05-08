/**
 * Replicate API Integration Service
 * Unified image / upscale / video / 3D / chat generation
 * Docs: https://replicate.com/docs
 */

// ── Image Models ──────────────────────────────────────────────────────────────
export type ReplicateImageModel =
  | 'google/nano-banana-2'              // Nano Banana 2 (Gemini 3.1 Flash)
  | 'bytedance/seedream-4.5'            // Seedream 4.5 - ByteDance
  | 'black-forest-labs/flux-2-pro'      // FLUX 2 Pro - img2img + 8 ref images
  | 'openai/gpt-image-2'                // GPT Image 2 - OpenAI
  | 'google/nano-banana-pro'            // Nano Banana Pro (Gemini 3 Pro)
  | 'bytedance/seedance-2.0'            // Seedance 2.0 - video (used via generateVideo)
  | 'xai/grok-imagine-image'            // Grok Imagine Image - xAI
  | 'black-forest-labs/flux-kontext-pro'; // FLUX Kontext Pro - character consistency

// ── Upscale Models ────────────────────────────────────────────────────────────
export type ReplicateUpscaleModel =
  | 'topazlabs/image-upscale'              // Topaz Labs Image Upscale
  | 'nightmareai/real-esrgan'              // Real-ESRGAN x4
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

export interface ReplicateApiConfig {
  apiKey: string;
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
  defaultSteps: number;
  stepsRange: [number, number];    // [min, max]
  maxReferenceImages: number;
  aspectRatios: string[];
  resolutions: string[];
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
    resolutions: ['512', '1K', '2K', '4K'],
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
    resolutions: ['Match Input', '0.5K', '1K', '2K', '4K'],
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
    resolutions: ['512', '1K', '2K', '4K'],
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
  // ── 8. Topaz Labs Image Upscale ────────────────────────────────────────────
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
  // ── 9. Pruna AI P-Image Upscale ───────────────────────────────────────────
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
  // ── 10. Real-ESRGAN ────────────────────────────────────────────────────────
  'nightmareai/real-esrgan': {
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
    pricePerImage: 0.002,
  },
  // ── 11. Clarity Upscaler ─────────────────────────────────────────────────
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
  // ── 12. Wan 2.1 i2v 480p ────────────────────────────────────────────────
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
  // ── 13. Wan 2.1 i2v 720p ────────────────────────────────────────────────
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
  // ── 14. Tripo3D ───────────────────────────────────────────────────────────
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
  // ── 15-17. Chat Models ──────────────────────────────────────────────────
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
  const n = parseInt(res);
  return isNaN(n) ? 1024 : n;
}

// ── Supabase proxy URL (used when Supabase is configured) ────────────────────
function getProxyUrl(): string | null {
  const url  = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key  = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key || url.includes('placeholder')) return null;
  return `${url}/functions/v1/replicate-proxy`;
}

// ── Proxy fetch: strips API key from client, sends via Edge Function ──────────
async function proxyPost(proxyUrl: string, replicatePath: string, body: unknown): Promise<any> {
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
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
  });
  if (!res.ok) throw new Error(`Proxy ${res.status}: ${await res.text()}`);
  return res.json();
}

async function proxyGet(proxyUrl: string, replicatePath: string): Promise<any> {
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  const res = await fetch(proxyUrl, {
    method: 'POST',
    headers: {
      'Content-Type':       'application/json',
      'apikey':             anonKey,
      'Authorization':      `Bearer ${anonKey}`,
      'x-replicate-path':   replicatePath,
      'x-replicate-method': 'GET',
    },
  });
  if (!res.ok) throw new Error(`Proxy ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── Tauri / direct fetch helpers (used when no proxy configured) ──────────────
async function apiPost(url: string, headers: Record<string,string>, body: unknown): Promise<any> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('http_post', { url, headers, body });
  } catch (invokeErr) {
    console.warn('[apiPost] Tauri invoke failed, trying fetch:', invokeErr);
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    return res.json();
  }
}

async function apiGet(url: string, headers: Record<string,string>): Promise<any> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('http_get', { url, headers });
  } catch (invokeErr) {
    console.warn('[apiGet] Tauri invoke failed, trying fetch:', invokeErr);
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    return res.json();
  }
}

// ── Service Class ─────────────────────────────────────────────────────────────
class ReplicateService {
  private config: ReplicateApiConfig;
  private lastRequestTime = 0;
  private readonly minRequestInterval = 12_000; // 12s between requests (5 req/min safe)

  constructor() {
    // Use proxy in development to avoid CORS
    const isDev = typeof window !== 'undefined' && window.location.hostname === 'localhost';
    
    // Try to get API key from localStorage settings first, then env
    let apiKey = import.meta.env.VITE_REPLICATE_API_TOKEN ?? '';
    try {
      const settings = localStorage.getItem('anarchy_settings');
      if (settings) {
        const parsed = JSON.parse(settings);
        if (parsed.apiKey) apiKey = parsed.apiKey;
      }
    } catch {
      // Ignore parse errors
    }
    
    this.config = {
      apiKey,
      baseUrl:    isDev ? '/api/replicate' : 'https://api.replicate.com/v1',
      timeout:    120_000,
      maxRetries: 3,
    };
  }

  // Update API key from settings
  updateApiKey(): void {
    try {
      const settings = localStorage.getItem('anarchy_settings');
      if (settings) {
        const parsed = JSON.parse(settings);
        if (parsed.apiKey) this.config.apiKey = parsed.apiKey;
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Wait if needed to respect rate limit
  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minRequestInterval) {
      const waitMs = this.minRequestInterval - elapsed;
      console.log(`[Replicate] Throttling: waiting ${Math.round(waitMs/1000)}s before next request...`);
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
      maxReferenceImages:        meta.maxReferenceImages,
      defaultSteps:              meta.defaultSteps,
      stepsRange:                meta.stepsRange,
    };
  }

  getAvailableModels(): ReplicateImageModel[] {
    return Object.keys(MODEL_META) as ReplicateImageModel[];
  }

  // ── Poll a prediction until SUCCEEDED or FAILED ──────────────────────────────
  private async pollPrediction(predictionId: string): Promise<any> {
    const proxy = getProxyUrl();
    const path  = `/predictions/${predictionId}`;
    const headers = {
      'Authorization': `Token ${this.config.apiKey}`,
      'Content-Type':  'application/json',
    };
    const maxAttempts = 120;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const data = proxy
        ? await proxyGet(proxy, path)
        : await apiGet(`${this.config.baseUrl}${path}`, headers);
      console.log('[Replicate] poll status:', data.status, 'error:', JSON.stringify(data.error ?? null));
      if (data.status === 'succeeded') return data;
      if (data.status === 'failed' || data.status === 'canceled') {
        throw new Error(`Prediction ${data.status}: ${JSON.stringify(data.error ?? data.logs ?? 'unknown error')}`);
      }
    }
    throw new Error('Prediction timed out after 4 minutes');
  }

  // Community models need version-based endpoint instead of /models/
  private static readonly MODEL_VERSIONS: Record<string, string> = {
    'philz1337x/clarity-upscaler': 'dfad41707589d68ecdccd1dfa600d55a208f9310748e44bfe35b4a6291453d5e',
    'nightmareai/real-esrgan':     'b3ef194191d13140337468c916c2c5b96dd0cb06dffc032a022a31807f6a5ea8',
  };

  // ── Submit a prediction and wait for result (with rate-limit retry) ──────
  private async runPrediction(
    modelId: string,
    input: Record<string, any>
  ): Promise<any> {
    const proxy = getProxyUrl();
    const headers = {
      'Authorization': `Token ${this.config.apiKey}`,
      'Content-Type':  'application/json',
      'Prefer':        'wait=5',
    };

    // Use version-based endpoint for community models
    const version = ReplicateService.MODEL_VERSIONS[modelId];
    const path = version ? '/predictions' : `/models/${modelId}/predictions`;
    const url  = `${this.config.baseUrl}${path}`;
    const body = version ? { version, input } : { input };

    if (proxy) {
      console.log('[Replicate] → Supabase proxy (API key hidden from client)');
    }

    const maxRetries = 3;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await this.throttle();
        const prediction = proxy
          ? await proxyPost(proxy, path, body)
          : await apiPost(url, headers, body);

        console.log('[Replicate] Prediction created:', prediction.id, 'status:', prediction.status);

        if (prediction.status === 'succeeded') return prediction;
        if (prediction.status === 'failed') {
          console.error('[Replicate] Prediction failed immediately:', JSON.stringify(prediction.error ?? prediction, null, 2));
          throw new Error(`Prediction failed: ${JSON.stringify(prediction.error ?? prediction)}`);
        }
        return this.pollPrediction(prediction.id);
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        const isRetryable = errMsg.includes('429')
          || errMsg.includes('Connection aborted')
          || errMsg.includes('RemoteDisconnected')
          || errMsg.includes('Remote end closed')
          || errMsg.includes('502')
          || errMsg.includes('503');
        if (isRetryable && attempt < maxRetries) {
          const retryMatch = errMsg.match(/"retry_after"\s*:\s*(\d+)/);
          const waitSec = retryMatch ? parseInt(retryMatch[1], 10) + 1 : (attempt + 1) * 15;
          console.warn(`[Replicate] Retryable error, retrying in ${waitSec}s (attempt ${attempt + 1}/${maxRetries}):`, errMsg.substring(0, 120));
          await new Promise(r => setTimeout(r, waitSec * 1000));
          continue;
        }
        throw err;
      }
    }
    throw new Error('Max retries exceeded for rate limiting');
  }

  // ── Extract first image URL from prediction output ────────────────────────
  private extractImageUrl(output: any): string {
    if (typeof output === 'string') return output;
    if (Array.isArray(output) && output.length > 0) return output[0];
    if (output?.url) return output.url;
    throw new Error('No image URL in Replicate response');
  }

  // ── Build input payload for Nano Banana models (image_input field) ─────────
  private buildNanoBananaInput(
    params: ReplicateGenerationParams,
    images: string[]
  ): Record<string, any> {
    // Minimal valid input for Nano Banana 2 - only prompt + image_input
    const promptText = images.length > 0
      ? params.prompt  // Gemini understands edit context from image_input presence
      : params.prompt;
    const input: Record<string, any> = { prompt: promptText };
    if (images.length > 0) {
      input.image_input = images; // array format forces edit mode
    }
    // Only add aspect_ratio for text-to-image (no images)
    if (images.length === 0 && params.aspectRatio && params.aspectRatio !== 'Auto') {
      input.aspect_ratio = params.aspectRatio;
    }
    console.log('[NanoBanana] input:', JSON.stringify(input, null, 2));
    return input;
  }

  // ── Build input payload for FLUX models ───────────────────────────────────
  private buildFluxInput(
    params: ReplicateGenerationParams,
    images: string[]
  ): Record<string, any> {
    const meta = this.getModelCapabilities(params.model);
    const input: Record<string, any> = { prompt: params.prompt };

    // FLUX Kontext Pro: input_image (singular) + aspect_ratio + seed
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
      console.log('[Replicate] Kontext Pro input:', JSON.stringify(input, null, 2));
      return input;
    }

    // FLUX 2 Pro uses megapixels + aspect_ratio instead of width/height
    if (params.model === 'black-forest-labs/flux-2-pro') {
      const mpMap: Record<string, string> = {
        'Match Input': 'match_input_image',
        '0.5K': '0.5 MP',
        '1K':   '1 MP',
        '2K':   '2 MP',
        '4K':   '4 MP',
      };
      input.resolution   = mpMap[params.resolution ?? '1K'] ?? '1 MP';
      input.aspect_ratio = params.aspectRatio ?? '1:1';
      if (meta.supportsSeed && params.seed != null) input.seed = params.seed;
      if (images.length > 0) {
        input.input_images = images;
        if (meta.supportsReferenceStrength && params.strength != null) {
          input.prompt_strength = params.strength;
        }
      }
    } else {
      // Other FLUX models (dev, schnell) use width/height
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

  // ── Build input for general/fallback models (Recraft, etc) ───────────────
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
  async generate(params: ReplicateGenerationParams): Promise<ReplicateGenerationResult> {
    const start = Date.now();
    const input = this.buildInput(params, []);
    console.log('[Replicate] generate →', params.model, input);

    const prediction = await this.runPrediction(params.model, input);
    const imageUrl   = this.extractImageUrl(prediction.output);

    return this.buildResult(params, imageUrl, {}, start);
  }

  // ── Image-to-Image (with multiple reference images) ───────────────────────
  async generateImg2Img(
    params: ReplicateGenerationParams,
    images: string | string[]
  ): Promise<ReplicateGenerationResult> {
    const start     = Date.now();
    const meta      = this.getModelCapabilities(params.model);
    const imageList = Array.isArray(images) ? images : [images];

    // Respect model's maxReferenceImages limit
    const maxImgs  = meta.maxReferenceImages > 0 ? meta.maxReferenceImages : 14;
    const imgSlice = imageList.slice(0, maxImgs);

    console.log('[Replicate] generateImg2Img:', params.model, {
      images:            imgSlice.length,
      seed:              params.seed,
      steps:             params.steps,
      referenceStrength: params.referenceStrength,
      negativePrompt:    params.negativePrompt,
      resolution:        params.resolution,
      aspectRatio:       params.aspectRatio,
    });

    const input      = this.buildInput(params, imgSlice);
    console.log('[Replicate] request body:', JSON.stringify(input, null, 2));

    const prediction = await this.runPrediction(params.model, input);
    const imageUrl   = this.extractImageUrl(prediction.output);

    return this.buildResult(params, imageUrl, input, start);
  }

  // ── Build input for Seedream 4.5 ─────────────────────────────────────────
  private buildSeedreamInput(
    params: ReplicateGenerationParams,
    images: string[]
  ): Record<string, any> {
    const input: Record<string, any> = { prompt: params.prompt };
    // image_input: array of URIs (1-14 images)
    if (images.length > 0) {
      input.image_input = images;
    }
    // size: 2K (default) or 4K
    input.size = params.resolution === '4K' ? '4K' : '2K';
    // aspect_ratio
    if (params.aspectRatio && params.aspectRatio !== 'Auto') {
      input.aspect_ratio = params.aspectRatio;
    } else if (images.length > 0) {
      input.aspect_ratio = 'match_input_image';
    }
    console.log('[Replicate] Seedream input:', JSON.stringify(input, null, 2));
    return input;
  }

  // ── Build input for Grok Imagine Image ──────────────────────────────────
  private buildGrokInput(
    params: ReplicateGenerationParams,
    images: string[]
  ): Record<string, any> {
    const input: Record<string, any> = { prompt: params.prompt };
    // image: single URI for editing
    if (images.length > 0) {
      input.image = images[0];
    }
    // aspect_ratio (ignored when editing)
    if (params.aspectRatio && params.aspectRatio !== 'Auto') {
      input.aspect_ratio = params.aspectRatio;
    }
    console.log('[Replicate] Grok input:', JSON.stringify(input, null, 2));
    return input;
  }

  // ── Build input for GPT Image 2 ───────────────────────────────────────────
  private buildGptImageInput(
    params: ReplicateGenerationParams,
    images: string[]
  ): Record<string, any> {
    const input: Record<string, any> = { prompt: params.prompt };
    
    console.log('[Replicate] GPT Image 2 - images received:', images.length, 'first image:', images[0]?.substring(0, 100));
    
    if (images.length >= 1) {
      // GPT Image 2 uses 'input_images' for all reference images
      input.input_images = images;
      console.log('[Replicate] GPT Image 2 - using input_images:', images.length);
    }
    
    // GPT Image 2 uses 'quality' param for resolution (low, medium, high, auto)
    if (params.resolution && params.resolution !== 'auto') {
      input.quality = params.resolution.toLowerCase(); // low / medium / high
    }
    
    // GPT Image 2 uses 'aspect_ratio' not 'aspectRatio'
    if (params.aspectRatio && params.aspectRatio !== 'Auto') {
      input.aspect_ratio = params.aspectRatio; // 1:1, 3:2, 2:3
    }
    
    console.log('[Replicate] GPT Image 2 - final input:', JSON.stringify({ ...input, input_images: `[${images.length} images]` }, null, 2));
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

  // ── Image Upscaling ───────────────────────────────────────────────────────
  async upscaleImage(
    imageUrl: string,
    model: ReplicateUpscaleModel = 'nightmareai/real-esrgan',
    scale: number = 4,
    options?: {
      prompt?: string;
      negativePrompt?: string;
      steps?: number;
      seed?: number;
      // Topaz Labs settings
      enhanceModel?: string;
      faceEnhancement?: boolean;
      faceEnhancementCreativity?: number;
      faceEnhancementStrength?: number;
      // Clarity Upscaler settings
      clarityScale?: number;
      clarityDynamic?: number;
      clarityCreativity?: number;
      clarityTilingWidth?: number;
      clarityTilingHeight?: number;
      claritySdModel?: string;
      clarityScheduler?: string;
      claritySteps?: number;
      claritySeed?: number | null;
      clarityDownscaling?: boolean;
      clarityDownscalingRes?: number;
      claritySharpen?: number;
      clarityHandfix?: string;
      clarityPattern?: boolean;
      // Pruna AI settings
      prunaMode?: 'target' | 'factor';
      prunaTarget?: number;
      prunaFactor?: number;
      prunaEnhanceDetails?: boolean;
      prunaEnhanceRealism?: boolean;
      prunaQuality?: number;
    }
  ): Promise<string> {
    console.log('[Replicate] upscale →', model, 'scale:', scale, 'options:', options);
    
    let input: Record<string, any> = {};
    
    // Build model-specific input
    switch (model) {
      case 'topazlabs/image-upscale':
        input = {
          image: imageUrl,
          scale: scale === 2 ? 2 : 4, // 2x or 4x only
        };
        // Topaz Labs advanced settings
        if (options?.enhanceModel) {
          input.enhance_model = options.enhanceModel;
        }
        if (options?.faceEnhancement !== undefined) {
          input.face_enhancement = options.faceEnhancement;
        }
        if (options?.faceEnhancement && options?.faceEnhancementCreativity !== undefined) {
          input.face_enhancement_creativity = options.faceEnhancementCreativity;
        }
        if (options?.faceEnhancement && options?.faceEnhancementStrength !== undefined) {
          input.face_enhancement_strength = options.faceEnhancementStrength;
        }
        break;
        
      case 'nightmareai/real-esrgan':
        // Real-ESRGAN supports 1x-10x
        input = {
          image: imageUrl,
          scale: Math.min(Math.max(scale, 1), 10), // Clamp 1-10
        };
        break;
        
      case 'philz1337x/clarity-upscaler':
        input = {
          image: imageUrl,
          prompt: options?.prompt || 'masterpiece, best quality, highres, <lora:more_details:0.5> <lora:SDXLrender_v2.0:1>',
          negative_prompt: options?.negativePrompt || '(worst quality, low quality, normal quality:2) JuggernautNegative-neg',
          scale_factor: options?.clarityScale ?? scale,
          dynamic: options?.clarityDynamic ?? 6,
          creativity: options?.clarityCreativity ?? 0.35,
          resemblance: 0.6,
          tiling_width: options?.clarityTilingWidth ?? 112,
          tiling_height: options?.clarityTilingHeight ?? 144,
          sd_model: options?.claritySdModel ?? 'juggernaut_reborn.safetensors [338b85bc4f]',
          scheduler: options?.clarityScheduler ?? 'DPM++ 3M SDE Karras',
          num_inference_steps: options?.claritySteps ?? 18,
          seed: options?.claritySeed ?? 1337,
          downscaling: options?.clarityDownscaling ?? false,
          downscaling_resolution: options?.clarityDownscalingRes ?? 768,
          sharpen: options?.claritySharpen ?? 0,
          handfix: options?.clarityHandfix ?? 'disabled',
          pattern: options?.clarityPattern ?? false,
          output_format: 'png',
        };
        break;
        
      case 'prunaai/p-image-upscale':
        input = {
          image: imageUrl,
          upscale_mode: options?.prunaMode ?? 'target',
        };
        if (options?.prunaMode === 'factor') {
          input.factor = options.prunaFactor ?? 2;
        } else {
          input.target = options?.prunaTarget ?? 4;
        }
        input.output_quality = options?.prunaQuality ?? 80;
        if (options?.prunaEnhanceDetails) {
          input.enhance_details = options.prunaEnhanceDetails;
        }
        if (options?.prunaEnhanceRealism) {
          input.enhance_realism = options.prunaEnhanceRealism;
        }
        break;
        
      default:
        input = { image: imageUrl, scale };
    }
    
    const prediction = await this.runPrediction(model, input);
    return this.extractImageUrl(prediction.output);
  }

  // ── Video Generation ──────────────────────────────────────────────────────
  async generateVideo(
    imageUrl: string,
    prompt: string,
    model: ReplicateVideoModel = 'wavespeedai/wan-2.1-i2v-480p'
  ): Promise<string> {
    console.log('[Replicate] video →', model);
    const prediction = await this.runPrediction(model, {
      image:  imageUrl,
      prompt,
    });
    const output = prediction.output;
    if (typeof output === 'string') return output;
    if (Array.isArray(output))      return output[0];
    throw new Error('No video URL in response');
  }

  // ── 3D Generation ─────────────────────────────────────────────────────────
  async generate3D(
    imageUrl: string,
    model: Replicate3DModel = 'zsxkib/tripo3d'
  ): Promise<string> {
    console.log('[Replicate] 3D →', model);
    const prediction = await this.runPrediction(model, { image: imageUrl });
    const output = prediction.output;
    if (typeof output === 'string') return output;
    if (output?.mesh_url)           return output.mesh_url;
    if (Array.isArray(output))      return output[0];
    throw new Error('No 3D model URL in response');
  }

  // ── Chat Completion ───────────────────────────────────────────────────────
  async chatCompletion(
    messages: ReplicateChatMessage[],
    model: ReplicateChatModel = 'meta/meta-llama-3-70b-instruct'
  ): Promise<ReplicateChatResult> {
    const systemMsg = messages.find(m => m.role === 'system')?.content ?? '';
    const userMsg   = messages.filter(m => m.role !== 'system').map(m => `${m.role}: ${m.content}`).join('\n');

    const prediction = await this.runPrediction(model, {
      system_prompt: systemMsg,
      prompt:        userMsg,
    });

    const output = prediction.output;
    const content = Array.isArray(output) ? output.join('') : String(output ?? '');
    return { content, model };
  }

}

// Singleton
export const replicateService = new ReplicateService();
export default ReplicateService;
