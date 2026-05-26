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
  | 'black-forest-labs/flux-kontext-pro' // FLUX Kontext Pro - character consistency
  | 'stability-ai/stable-diffusion-3.5'; // Stable Diffusion 3.5

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
  styleType?: string;
  stylePreset?: string;
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
  // ── 9. Stable Diffusion 3.5 ──────────────────────────────────────────────
  'stability-ai/stable-diffusion-3.5': {
    supportsImg2Img: true,
    supportsMultiImage: false,
    supportsSeed: true,
    supportsSteps: true,
    supportsNegativePrompt: true,
    supportsUpscale: false,
    supportsLoRA: false,
    supportsReferenceStrength: true, // Uses strength for img2img
    defaultSteps: 28,
    stepsRange: [20, 50],
    maxReferenceImages: 1,
    resolutions: ['Auto'],
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9', '9:21'],
    pricePerImage: 0.035, // ~$0.035 per image
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
  const n = Number.parseInt(res);
  return isNaN(n) ? 1024 : n;
}

// ── Detect Tauri runtime ─────────────────────────────────────────────────────
function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  // withGlobalTauri:true sets window.__TAURI__; fallback to __TAURI_INTERNALS__
  return !!(window as any).__TAURI__ || !!(window as any).__TAURI_INTERNALS__;
}

// ── Supabase proxy URL (only when NOT inside Tauri) ──────────────────────────
function getProxyUrl(): string | null {
  // Inside Tauri we use invoke('http_post') directly — no proxy needed/wanted
  if (isTauriRuntime()) return null;
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
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      return res.json();
    } catch (fetchErr: any) {
      // Detect CORS errors and provide helpful message
      if (fetchErr?.message?.includes('Failed to fetch') || fetchErr?.message?.includes('CORS')) {
        const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        if (isLocalhost) {
          throw new Error(
            'CORS Error: Cannot connect to Replicate API directly from browser. ' +
            'Please use one of these options:\n' +
            '1. Run in Tauri mode: npm run tauri dev\n' +
            '2. Configure Supabase proxy in .env\n' +
            '3. Check that Vite dev proxy is working (/api/replicate)'
          );
        }
      }
      throw fetchErr;
    }
  }
}

async function apiGet(url: string, headers: Record<string,string>): Promise<any> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('http_get', { url, headers });
  } catch (invokeErr) {
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
    // Detect environment
    const isDev = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const inTauri = isTauriRuntime();
    
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
    
    // Determine base URL:
    // - In Tauri: use real API (Tauri handles CORS via Rust backend)
    // - In browser dev: use Vite proxy (/api/replicate -> https://api.replicate.com/v1)
    // - In browser production: use real API (will need Supabase proxy or similar)
    let baseUrl: string;
    if (inTauri) {
      baseUrl = 'https://api.replicate.com/v1';
    } else if (isDev) {
      baseUrl = '/api/replicate'; // Vite dev proxy
    } else {
      baseUrl = 'https://api.replicate.com/v1';
    }
    
    this.config = {
      apiKey,
      baseUrl,
      timeout:    120_000,
      maxRetries: 3,
    };
    
    // Debug logging in dev mode
    if (isDev) {
      console.log('[ReplicateService] Mode:', inTauri ? 'Tauri' : 'Browser', '| Base URL:', baseUrl);
    }
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
      // Wait to respect rate limit
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

  // ── Upload a base64 data URI to Replicate Files API and return serving URL ──
  async uploadToReplicate(dataUri: string): Promise<string> {
    // Parse data URI
    const commaIdx = dataUri.indexOf(',');
    if (commaIdx === -1) throw new Error('Invalid data URI');
    const meta = dataUri.substring(0, commaIdx);
    const b64 = dataUri.substring(commaIdx + 1);
    const mime = meta.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
    const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      // Send base64 string to Rust (not byte array — avoids huge JSON serialization)
      const result: string = await invoke('upload_to_replicate', {
        apiKey: this.config.apiKey,
        b64Data: b64,
        filename: `upload.${ext}`,
        contentType: mime,
      });
      return result;
    } catch {
      // Fallback: use fetch directly (browser dev mode)
      const byteStr = atob(b64);
      const bytes = new Uint8Array(byteStr.length);
      for (let i = 0; i < byteStr.length; i++) bytes[i] = byteStr.charCodeAt(i);
      const blob = new Blob([bytes], { type: mime });
      const formData = new FormData();
      formData.append('content', blob, `upload.${ext}`);
      const res = await fetch('https://api.replicate.com/v1/files', {
        method: 'POST',
        headers: { 'Authorization': `Token ${this.config.apiKey}` },
        body: formData,
      });
      if (!res.ok) throw new Error(`Replicate upload failed: ${res.status}`);
      const json = await res.json();
      return json.urls?.get || json.url;
    }
  }

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


    const maxRetries = 3;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await this.throttle();
        const prediction = proxy
          ? await proxyPost(proxy, path, body)
          : await apiPost(url, headers, body);

        if (prediction.status === 'succeeded') return prediction;
        if (prediction.status === 'failed') {
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
          const waitSec = retryMatch ? Number.parseInt(retryMatch[1], 10) + 1 : (attempt + 1) * 15;
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
    // Add resolution (512, 1K, 2K, 4K)
    if (params.resolution && params.resolution !== 'Auto') {
      input.resolution = params.resolution;
    }
    // Only add aspect_ratio for text-to-image (no images)
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
    this.updateApiKey();
    const start = Date.now();
    const input = this.buildInput(params, []);

    const prediction = await this.runPrediction(params.model, input);
    const imageUrl   = this.extractImageUrl(prediction.output);

    return this.buildResult(params, imageUrl, {}, start);
  }

  // ── Image-to-Image (with multiple reference images) ───────────────────────
  async generateImg2Img(
    params: ReplicateGenerationParams,
    images: string | string[]
  ): Promise<ReplicateGenerationResult> {
    this.updateApiKey();
    const start     = Date.now();
    const meta      = this.getModelCapabilities(params.model);
    const imageList = Array.isArray(images) ? images : [images];

    // Respect model's maxReferenceImages limit
    const maxImgs  = meta.maxReferenceImages > 0 ? meta.maxReferenceImages : 14;
    const imgSlice = imageList.slice(0, maxImgs);

    const input = this.buildInput(params, imgSlice);

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
    return input;
  }

  // ── Build input for GPT Image 2 ───────────────────────────────────────────
  private buildGptImageInput(
    params: ReplicateGenerationParams,
    images: string[]
  ): Record<string, any> {
    const input: Record<string, any> = { prompt: params.prompt };
    
    if (images.length >= 1) {
      // GPT Image 2 uses 'input_images' for all reference images
      input.input_images = images;
    }
    
    // GPT Image 2 uses 'quality' param for resolution (low, medium, high, auto)
    if (params.resolution && params.resolution !== 'auto') {
      input.quality = params.resolution.toLowerCase(); // low / medium / high
    }
    
    // GPT Image 2 uses 'aspect_ratio' not 'aspectRatio'
    if (params.aspectRatio && params.aspectRatio !== 'Auto') {
      input.aspect_ratio = params.aspectRatio; // 1:1, 3:2, 2:3
    }
    
    return input;
  }

  // ── Build input payload for Stable Diffusion 3.5 ────────────────────────────
  private buildStableDiffusionInput(
    params: ReplicateGenerationParams,
    images: string[]
  ): Record<string, any> {
    const input: Record<string, any> = { prompt: params.prompt };
    
    // SD 3.5 uses 'image' for img2img
    if (images.length > 0) {
      input.image = images[0];
      // strength: how much to change (0.0 = same, 1.0 = complete change)
      input.strength = params.referenceStrength ?? 0.75;
    }
    
    // SD 3.5 supports 'aspect_ratio' for text-to-image
    if (!images.length && params.aspectRatio && params.aspectRatio !== 'Auto') {
      input.aspect_ratio = params.aspectRatio;
    }
    
    // SD 3.5 supports negative_prompt
    if (params.negativePrompt) {
      input.negative_prompt = params.negativePrompt;
    }
    
    // SD 3.5 supports steps (20-50)
    if (params.steps != null) {
      input.num_inference_steps = params.steps;
    }
    
    // SD 3.5 supports seed
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
    if (m === 'stability-ai/stable-diffusion-3.5') return this.buildStableDiffusionInput(params, images);
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
      topazUpscaleFactor?: string;  // "None" | "2x" | "4x" | "6x"
      topazSubjectDetection?: string; // "None" | "Foreground" | "Sky" | "Product" | "Person" | "Portrait" | "Architecture" | "Landscape" | "Macro" | "Document" | "Food" | "Subject"
      topazOutputFormat?: string; // "jpg" | "png" | "webp"
      faceEnhancement?: boolean;
      faceEnhancementCreativity?: number;
      faceEnhancementStrength?: number;
      // Clarity Upscaler settings
      clarityScale?: number;
      clarityDynamic?: number;
      clarityCreativity?: number;
      clarityResemblance?: number;
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
      clarityOutputFormat?: string;
      // Pruna AI settings
      prunaMode?: 'target' | 'factor';
      prunaTarget?: number;
      prunaFactor?: number;
      prunaEnhanceDetails?: boolean;
      prunaEnhanceRealism?: boolean;
      prunaQuality?: number;
      prunaOutputFormat?: string;
    }
  ): Promise<string> {
    
    let input: Record<string, any> = {};
    
    // Build model-specific input
    switch (model) {
      case 'topazlabs/image-upscale': {
        // upscale_factor is a STRING enum: "None" | "2x" | "4x" | "6x"
        const topazFactor = options?.topazUpscaleFactor
          ?? (scale === 1 ? 'None' : scale === 2 ? '2x' : scale === 6 ? '6x' : '4x');
        input = {
          image:             imageUrl,
          upscale_factor:    topazFactor,
          enhance_model:     options?.enhanceModel ?? 'Low Resolution V2',
          subject_detection: options?.topazSubjectDetection ?? 'None',
          output_format:     options?.topazOutputFormat ?? 'jpg',
          face_enhancement:  options?.faceEnhancement ?? false,
        };
        if (options?.faceEnhancement) {
          input.face_enhancement_creativity = options.faceEnhancementCreativity ?? 0;
          input.face_enhancement_strength   = options.faceEnhancementStrength   ?? 0.8;
        }
        break;
      }
        
      case 'nightmareai/real-esrgan':
        // Real-ESRGAN supports 1x-10x
        input = {
          image: imageUrl,
          scale: Math.min(Math.max(scale, 1), 10), // Clamp 1-10
        };
        break;
        
      case 'philz1337x/clarity-upscaler': {
        // Clarity model maxes out at 2x per pass.
        // For higher scales (4x, 8x, 12x) we chain multiple 2x passes.
        const targetScale = options?.clarityScale ?? scale;
        const passes = targetScale <= 2 ? 1 : Math.ceil(Math.log2(targetScale)); // 4x=2, 8x=3, 12x=4

        const buildClarityInput = (img: string) => ({
          image: img,
          prompt: options?.prompt || 'masterpiece, best quality, highres, <lora:more_details:0.5> <lora:SDXLrender_v2.0:1>',
          negative_prompt: options?.negativePrompt || '(worst quality, low quality, normal quality:2) JuggernautNegative-neg',
          scale_factor: 2,
          dynamic: options?.clarityDynamic ?? 6,
          creativity: options?.clarityCreativity ?? 0.35,
          resemblance: options?.clarityResemblance ?? 0.6,
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
          output_format: options?.clarityOutputFormat ?? 'png',
        });

        // Chain: run 2x passes sequentially, feeding output into next input
        let currentImageUrl = imageUrl;
        for (let pass = 0; pass < passes; pass++) {
          const passInput = buildClarityInput(currentImageUrl);
          const prediction = await this.runPrediction(model, passInput);
          currentImageUrl = this.extractImageUrl(prediction.output);
        }
        return currentImageUrl;
      }
        
      case 'prunaai/p-image-upscale':
        input = {
          image: imageUrl,
          upscale_mode: options?.prunaMode ?? 'target',
          enhance_details: options?.prunaEnhanceDetails ?? false,
          enhance_realism: options?.prunaEnhanceRealism ?? true,
          output_format: options?.prunaOutputFormat ?? 'png',
          output_quality: options?.prunaQuality ?? 80,
        };
        if (options?.prunaMode === 'factor') {
          input.factor = options.prunaFactor ?? 2;
        } else {
          input.target = options?.prunaTarget ?? 4;
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
