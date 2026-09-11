import { logger } from '../../../utils/logger';
import type {
  ReplicateGenerationParams,
  ReplicateGenerationResult,
  ModelMeta,
  ReplicateModel
} from './replicateTypes';
import {
  MODEL_META,
  arToSize,
  resolutionToPixels
} from './replicateConstants';

export function getModelCapabilities(model: ReplicateModel): ModelMeta {
  return MODEL_META[model] ?? MODEL_META['google/nano-banana-2'];
}

// ── Extract first image URL from prediction output ──────────────────────────
export function extractImageUrl(output: unknown): string {
  const urls = extractImageUrls(output);
  if (urls.length > 0) return urls[0];
  throw new Error(`No valid image URL found in prediction output: ${JSON.stringify(output)}`);
}

// ── Extract all image URLs from prediction output ───────────────────────────
export function extractImageUrls(output: unknown): string[] {
  if (!output) return [];

  const urls: string[] = [];

  const extractFromValue = (val: unknown) => {
    if (!val) return;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
        urls.push(trimmed);
      } else if (trimmed.length > 10 && !trimmed.includes(' ') && (trimmed.includes('/') || trimmed.includes('.'))) {
        urls.push(trimmed);
      }
      return;
    }
    if (Array.isArray(val)) {
      val.forEach(extractFromValue);
      return;
    }
    if (typeof val === 'object') {
      const obj = val as Record<string, unknown>;
      if (typeof obj.url === 'string') extractFromValue(obj.url);
      else if (typeof obj.href === 'string') extractFromValue(obj.href);
      else if (typeof obj.file === 'string') extractFromValue(obj.file);
      else if (typeof obj.image === 'string') extractFromValue(obj.image);
      else {
        Object.values(obj).forEach(v => extractFromValue(v));
      }
    }
  };

  extractFromValue(output);
  return urls;
}

// ── Build input payload for Nano Banana models (image_input field) ───────────
export function buildNanoBananaInput(
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

// ── Build input payload for FLUX models ─────────────────────────────────────
export function buildFluxInput(
  params: ReplicateGenerationParams,
  images: string[]
): Record<string, any> {
  const meta = getModelCapabilities(params.model);
  const input: Record<string, any> = { prompt: params.prompt };

  const mpMap: Record<string, string> = {
    '0.5K': '0.5 MP',
    '1K': '1 MP',
    '2K': '2 MP',
    '4K': '4 MP',
  };
  input.resolution = mpMap[params.resolution ?? '1K'] ?? '1 MP';

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
  return input;
}

// ── Build input for general/fallback models ─────────────────────────────────
export function buildGeneralInput(
  params: ReplicateGenerationParams
): Record<string, any> {
  const meta = getModelCapabilities(params.model);
  const input: Record<string, any> = { prompt: params.prompt };

  if (params.aspectRatio && params.aspectRatio !== 'Auto') {
    input.aspect_ratio = params.aspectRatio;
  } else {
    input.aspect_ratio = '1:1';
  }

  if (meta.supportsSeed && params.seed != null) input.seed = params.seed;
  if (meta.supportsNegativePrompt && params.negativePrompt) {
    input.negative_prompt = params.negativePrompt;
  }
  if (meta.supportsSteps && params.steps != null) {
    input.num_inference_steps = params.steps;
  }
  // Krea-specific: creativity level ('raw' | 'low' | 'medium' | 'high')
  if (params.model === 'krea/krea-2-large') {
    input.creativity = (params as any).kreaCreativity || (params as any).creativity || 'medium';
  }
  return input;
}

// ── Build input for Seedream 4.5 ───────────────────────────────────────────
export function buildSeedreamInput(
  params: ReplicateGenerationParams,
  images: string[]
): Record<string, any> {
  const input: Record<string, any> = { prompt: params.prompt };
  if (images.length > 0) {
    input.image_input = images;
  }
  if (params.model === 'bytedance/seedream-5-pro') {
    input.size = params.resolution === '2K' ? '2K' : '1K';
  } else {
    if (params.resolution === 'custom') {
      input.size = 'custom';
      input.width = params.width ?? 2048;
      input.height = params.height ?? 2048;
    } else {
      input.size = params.resolution === '4K' ? '4K' : '2K';
    }
  }
  if (params.aspectRatio && params.aspectRatio !== 'Auto') {
    input.aspect_ratio = params.aspectRatio;
  } else if (images.length > 0) {
    input.aspect_ratio = 'match_input_image';
  }

  // Support sequential generation parameters (only for seedream-4.5)
  if (params.sequentialImageGeneration) {
    input.sequential_image_generation = params.sequentialImageGeneration;
  }
  if (params.maxImages != null) {
    input.max_images = params.maxImages;
  }
  return input;
}

// ── Build input for GPT Image 2 / 2.5 ──────────────────────────────────────
export function buildGptImageInput(
  params: ReplicateGenerationParams,
  images: string[]
): Record<string, any> {
  const input: Record<string, any> = { prompt: params.prompt };

  if (images.length >= 1) {
    input.input_images = images;
  }

  const qualityVal = (params as any).gptQuality || (params as any).qualityVariant || params.resolution;
  if (qualityVal && qualityVal !== 'auto') {
    input.quality = String(qualityVal).toLowerCase();
  } else {
    input.quality = 'auto';
  }

  if (params.aspectRatio && params.aspectRatio !== 'Auto') {
    input.aspect_ratio = params.aspectRatio;
  } else if (params.aspectRatio === 'Auto' || params.aspectRatio === 'auto') {
    input.aspect_ratio = 'auto';
  }

  return input;
}

// ── Build input payload for Stable Diffusion 3.5 ────────────────────────────
export function buildStableDiffusionInput(
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

// ── Build input payload for Video models ────────────────────────────────────
export function buildVideoInput(
  params: ReplicateGenerationParams,
  images: string[]
): Record<string, any> {
  const m = params.model;
  const input: Record<string, any> = { prompt: params.prompt };

  // Default image mapping (except for models with specialized structures)
  if (images.length > 0 && m !== 'bytedance/seedance-2.0' && m !== 'kwaivgi/kling-v3-omni-video') {
    input.image = images[0];
  }

  if (params.seed != null) {
    input.seed = params.seed;
  }

  if (params.aspectRatio && params.aspectRatio !== 'Auto' && m !== 'bytedance/seedance-2.0') {
    input.aspect_ratio = params.aspectRatio;
  }

  if (m === 'kwaivgi/kling-v3-omni-video') {
    input.duration = params.videoDuration ? parseInt(params.videoDuration.replace('s', ''), 10) : 5;
    if (params.cfg != null) {
      input.cfg_scale = params.cfg;
    }
    
    // Mode (standard, pro, 4k)
    input.mode = params.resolution || 'pro';

    // Separate images and videos from connected parent nodes
    const parentImages = images.filter(url => {
      const lower = url.toLowerCase();
      return !(lower.includes('.mp4') || lower.includes('.webm') || lower.includes('.ogg') || lower.includes('.mov') || lower.includes('.avi') || lower.includes('data:video/'));
    });
    const parentVideos = images.filter(url => {
      const lower = url.toLowerCase();
      return lower.includes('.mp4') || lower.includes('.webm') || lower.includes('.ogg') || lower.includes('.mov') || lower.includes('.avi') || lower.includes('data:video/');
    });

    // Start image (first connected node image)
    if (parentImages.length > 0) {
      input.start_image = parentImages[0];
    }

    // End image (manually uploaded in the sidebar)
    if (params.klingEndImage) {
      input.end_image = params.klingEndImage;
    }

    // Reference images (all subsequent connected node images)
    if (parentImages.length > 1) {
      input.reference_images = parentImages.slice(1);
    }

    // Reference video (manually uploaded in sidebar or first connected video node)
    if (params.klingReferenceVideo) {
      input.reference_video = params.klingReferenceVideo;
    } else if (parentVideos.length > 0) {
      input.reference_video = parentVideos[0];
    }

    // Video reference type
    if (params.klingVideoReferenceType) {
      input.video_reference_type = params.klingVideoReferenceType;
    }

    // Keep original sound
    input.keep_original_sound = params.klingKeepOriginalSound !== false;

    // Generate audio
    input.generate_audio = params.klingGenerateAudio === true;
  } else if (m === 'google/veo-3.1-fast') {
    input.duration = params.videoDuration ? parseInt(params.videoDuration.replace('s', ''), 10) : 8;
    if (params.veoLastFrame) {
      input.last_frame = params.veoLastFrame;
    }
    input.generate_audio = params.veoGenerateAudio !== false;
    if (params.aspectRatio && params.aspectRatio !== 'Auto') {
      input.aspect_ratio = params.aspectRatio;
    }
    if (params.resolution && params.resolution !== 'Auto') {
      input.resolution = params.resolution;
    }
  } else if (m === 'openai/sora-2-pro') {
    if (params.soraInputReference) {
      input.input_reference = params.soraInputReference;
    }
    input.seconds = params.videoDuration ? parseInt(params.videoDuration.replace('s', ''), 10) : 4;
    if (params.aspectRatio && params.aspectRatio !== 'Auto') {
      input.aspect_ratio = params.aspectRatio;
    }
    if (params.resolution && params.resolution !== 'Auto') {
      input.resolution = params.resolution;
    }
  } else if (m === 'xai/grok-imagine-video-1.5') {
    input.duration = params.videoDuration ? parseInt(params.videoDuration.replace('s', ''), 10) : 5;
    if (params.resolution && params.resolution !== 'Auto') {
      input.resolution = params.resolution;
    }
  } else if (m === 'pixverse/pixverse-v6') {
    if (params.pixverseLastFrameImage) {
      input.last_frame_image = params.pixverseLastFrameImage;
    }
    if (params.resolution && params.resolution !== 'Auto') {
      input.quality = params.resolution;
    }
    if (params.aspectRatio && params.aspectRatio !== 'Auto') {
      input.aspect_ratio = params.aspectRatio;
    }
    input.duration = params.videoDuration ? parseInt(params.videoDuration.replace('s', ''), 10) : 15;
    input.generate_audio_switch = params.pixverseGenerateAudioSwitch === true;
    input.generate_multi_clip_switch = params.pixverseGenerateMultiClipSwitch === true;
  } else if (m === 'prunaai/p-video') {
    if (params.prunaQuality != null) {
      input.quality = params.prunaQuality;
    }
    if (params.prunaLastFrameImage) {
      input.last_frame_image = params.prunaLastFrameImage;
    }
    if (params.prunaAudio) {
      input.audio = params.prunaAudio;
    }
    input.duration = params.videoDuration ? parseInt(params.videoDuration.replace('s', ''), 10) : 5;
    if (params.aspectRatio && params.aspectRatio !== 'Auto') {
      input.aspect_ratio = params.aspectRatio;
    }
    if (params.resolution && params.resolution !== 'Auto') {
      input.resolution = params.resolution;
    }
    input.fps = params.prunaFps ?? 24;
  } else if (m === 'bytedance/seedance-2.0') {
    const parentImages = images.filter(url => {
      const lower = url.toLowerCase();
      return !(lower.includes('.mp4') || lower.includes('.webm') || lower.includes('.ogg') || lower.includes('.mov') || lower.includes('.avi') || lower.includes('data:video/'));
    });
    const parentVideos = images.filter(url => {
      const lower = url.toLowerCase();
      return lower.includes('.mp4') || lower.includes('.webm') || lower.includes('.ogg') || lower.includes('.mov') || lower.includes('.avi') || lower.includes('data:video/');
    });

    // 1. First image goes to image (first frame)
    if (parentImages.length > 0) {
      input.image = parentImages[0];
    }

    // 2. Second image goes to last_frame_image
    if (parentImages.length > 1) {
      input.last_frame_image = parentImages[1];
    } else if (params.seedanceLastFrameImage) {
      input.last_frame_image = params.seedanceLastFrameImage;
    }

    // 3. Any additional parent images go to reference_images
    if (parentImages.length > 2) {
      input.reference_images = parentImages.slice(2);
    }

    // 4. Any connected videos go to reference_videos
    if (parentVideos.length > 0) {
      input.reference_videos = parentVideos;
    }

    // 5. duration (integer, min -1, max 15, default 5)
    if (params.videoDuration) {
      const parsedDur = parseInt(params.videoDuration.replace('s', ''), 10);
      input.duration = isNaN(parsedDur) ? 5 : parsedDur;
    } else {
      input.duration = 5;
    }

    // 6. resolution (string, choices: "720p", "1080p", "2K", "4K")
    input.resolution = params.resolution && params.resolution !== 'Auto' ? params.resolution : '720p';

    // 7. aspect_ratio (string, choices: adaptive, 16:9, etc.)
    input.aspect_ratio = params.aspectRatio && params.aspectRatio !== 'Auto' ? params.aspectRatio : 'adaptive';

    // 8. generate_audio (boolean, default true)
    input.generate_audio = params.seedanceGenerateAudio !== false;
  }

  return input;
}

// ── Route input building per model family ───────────────────────────────────
export function buildInput(
  params: ReplicateGenerationParams,
  images: string[]
): Record<string, any> {
  const m = params.model;
  if (m.startsWith('google/nano-banana')) return buildNanoBananaInput(params, images);
  if (m.startsWith('black-forest-labs/flux')) return buildFluxInput(params, images);
  if (m === 'bytedance/seedream-5-pro') return buildSeedreamInput(params, images);
  if (m === 'openai/gpt-image-2' || m === 'openai/gpt-image-2.5-flare' || m === 'openai/gpt-image-2.5-sunburst') return buildGptImageInput(params, images);
  if (m === 'stability-ai/stable-diffusion-3.5-large') return buildStableDiffusionInput(params, images);
  // Video models routing
  if (
    m === 'bytedance/seedance-2.0' ||
    m === 'kwaivgi/kling-v3-omni-video' ||
    m === 'xai/grok-imagine-video-1.5' ||
    m === 'prunaai/p-video' ||
    m === 'google/veo-3.1-fast' ||
    m === 'pixverse/pixverse-v6' ||
    m === 'openai/sora-2-pro' ||
    m.startsWith('wavespeedai/wan')
  ) {
    return buildVideoInput(params, images);
  }

  return buildGeneralInput(params);
}

// ── Build standardised result ───────────────────────────────────────────────
export function buildResult(
  params: ReplicateGenerationParams,
  imageUrl: string,
  body: Record<string, any>,
  start: number
): ReplicateGenerationResult {
  const meta = getModelCapabilities(params.model);
  const base = resolutionToPixels(params.resolution ?? 'Auto');
  const dims = arToSize(params.aspectRatio ?? '1:1', base);
  return {
    id: `replicate-${Date.now()}`,
    imageUrl,
    metadata: {
      model: params.model,
      prompt: params.prompt,
      negativePrompt: params.negativePrompt,
      width: params.width ?? dims.width,
      height: params.height ?? dims.height,
      seed: body.seed ?? -1,
      steps: body.num_inference_steps ?? meta.defaultSteps,
      generationTime: Date.now() - start,
      timestamp: Date.now(),
    },
  };
}
