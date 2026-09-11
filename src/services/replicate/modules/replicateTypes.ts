// ── Image Models ──────────────────────────────────────────────────────────────
export type ReplicateImageModel =
  | 'google/nano-banana-2'              // Nano Banana 2 (Gemini 3.1 Flash)
  | 'google/nano-banana-2-lite'         // Nano Banana 2 Lite (Gemini 3.1 Flash Lite)
  | 'bytedance/seedream-5-pro'          // Seedream 5 Pro - ByteDance
  | 'black-forest-labs/flux-2-pro'      // FLUX 2 Pro - img2img + 8 ref images
  | 'openai/gpt-image-2'                // GPT Image 2 - OpenAI
  | 'openai/gpt-image-2.5-flare'        // GPT Image 2.5 Flare - OpenAI
  | 'openai/gpt-image-2.5-sunburst'     // GPT Image 2.5 Sunburst - OpenAI
  | 'google/nano-banana-pro'            // Nano Banana Pro (Gemini 3 Pro)
  | 'prunaai/p-image'                    // Pruna AI P-Image
  | 'krea/krea-2-large'                  // Krea 2 Large
  | 'stability-ai/stable-diffusion-3.5-large' // Stable Diffusion 3.5 Large
  | 'reve/edit-fast'                     // Edit Fast - Reve AI
  | 'reve/create'                        // Create - Reve AI v2
  | 'reve/extract-layout'                // Extract Layout - Reve AI v2
  | 'reve/render-layout'                 // Render Layout - Reve AI v2
  | 'reve/create-layout'                 // Create Layout - Reve AI v2
  | 'reve/reconcile-layouts';            // Reconcile Layouts - Reve AI v2

// ── Upscale Models ────────────────────────────────────────────────────────────
export type ReplicateUpscaleModel =
  | 'topazlabs/image-upscale'              // Topaz Labs Image Upscale
  | 'philz1337x/clarity-upscaler'          // Clarity Upscaler
  | 'prunaai/p-image-upscale'             // Pruna AI P-Image Upscale
  | 'philz1337x/clarity-pro-upscaler';     // Anarchy Upscale (Clarity Pro)

// ── Video Models ──────────────────────────────────────────────────────────────
export type ReplicateVideoModel =
  | 'wavespeedai/wan-2.1-i2v-480p'        // Wan 2.1 i2v 480p
  | 'wavespeedai/wan-2.1-i2v-720p'        // Wan 2.1 i2v 720p
  | 'bytedance/seedance-2.0'              // Seedance 2.0 - video
  | 'kwaivgi/kling-v3-omni-video'         // Kling v3 Omni Video
  | 'xai/grok-imagine-video-1.5'          // Grok Imagine Video 1.5
  | 'prunaai/p-video'                     // Pruna AI P-Video
  | 'google/veo-3.1-fast'                 // Google Veo 3.1 Fast
  | 'pixverse/pixverse-v6'                 // PixVerse v6
  | 'openai/sora-2-pro';                  // OpenAI Sora 2 Pro

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
  model: ReplicateImageModel | ReplicateVideoModel;
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
  sequentialImageGeneration?: string;
  maxImages?: number;
  videoDuration?: string;
  videoQuality?: string;
  motionStrength?: number;
  videoFps?: number;
  prunaQuality?: number;
  seedanceLastFrameImage?: string | null;
  seedanceGenerateAudio?: boolean;
  klingStartImage?: string | null;
  klingEndImage?: string | null;
  klingReferenceImages?: string[] | null;
  klingReferenceVideo?: string | null;
  klingVideoReferenceType?: string;
  klingKeepOriginalSound?: boolean;
  klingGenerateAudio?: boolean;
  klingMode?: string;
  prunaLastFrameImage?: string | null;
  prunaAudio?: string | null;
  prunaFps?: number;
  veoLastFrame?: string | null;
  veoGenerateAudio?: boolean;
  pixverseLastFrameImage?: string | null;
  pixverseGenerateAudioSwitch?: boolean;
  pixverseGenerateMultiClipSwitch?: boolean;
  soraInputReference?: string | null;
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
  imageUrls?: string[];
  metadata: {
    model: ReplicateImageModel | ReplicateVideoModel;
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

export interface ModelMeta {
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
