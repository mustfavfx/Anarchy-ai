import { invoke } from '@tauri-apps/api/core';
import { STORAGE_KEYS } from '../../../utils/storageKeys';
import { logger } from '../../../utils/logger';
import { getCurrentUserId } from '../../../services/supabase/supabaseClient';
import { getLocalImage } from '../../../services/history/HistoryService';
import type { ReplicateImageModel, ReplicateUpscaleModel } from '../../../services/replicate';
import type { 
  ProcessingType, BuilderNodeData, DataPacket, BuilderNode,
  NodeLineage, NodeType, NodeState, WorkflowStats 
} from '../types';
import type { Edge } from '@xyflow/react';

export const getAutosaveKey = (tabId?: string) => {
  const uid = getCurrentUserId();
  const base = uid && uid !== 'default_user' ? `${STORAGE_KEYS.BUILDER_AUTOSAVE}_${uid}` : STORAGE_KEYS.BUILDER_AUTOSAVE;
  return tabId ? `${base}_${tabId}` : base;
};

// ── Upload helper: converts local/data-URI images ─────────────────────────────
async function uploadToSupabaseStorage(dataUri: string): Promise<string | null> {
  try {
    const { supabase, getCurrentUserId } = await import('../../../services/supabase/supabaseClient');
    const commaIdx = dataUri.indexOf(',');
    if (commaIdx === -1) return null;
    const meta = dataUri.substring(0, commaIdx);
    const b64 = dataUri.substring(commaIdx + 1);
    const mime = meta.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
    const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';

    const byteStr = atob(b64);
    const bytes = new Uint8Array(byteStr.length);
    for (let i = 0; i < byteStr.length; i++) bytes[i] = byteStr.charCodeAt(i);
    const blob = new Blob([bytes], { type: mime });

    const uid = getCurrentUserId() || 'public';
    const path = `${uid}/inputs/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from('generated-images').upload(path, blob, {
      contentType: mime,
      upsert: true,
    });
    if (!error) {
      const { data } = supabase.storage.from('generated-images').getPublicUrl(path);
      if (data?.publicUrl && data.publicUrl.startsWith('https://')) {
        return data.publicUrl;
      }
    }
  } catch (err) {
    logger.warn('[uploadToSupabaseStorage] Notice:', err);
  }
  return null;
}

/**
 * Downscale and compress large base64 image data URIs to a safe size (max 1536px, JPEG 0.85)
 * so payloads never choke HTTP gateways, Supabase proxy, or Edge Functions.
 */
export async function optimizeDataUriForInput(dataUri: string, maxDimension = 1536): Promise<string> {
  if (!dataUri || !dataUri.startsWith('data:image')) return dataUri;
  // If already under 350KB, safe to pass as is
  if (dataUri.length < 350 * 1024) return dataUri;
  if (typeof window === 'undefined' || typeof document === 'undefined') return dataUri;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = setTimeout(() => resolve(dataUri), 4000); // 4s fallback timeout
    img.onload = () => {
      clearTimeout(timer);
      let w = img.naturalWidth || img.width;
      let h = img.naturalHeight || img.height;
      if (!w || !h) {
        resolve(dataUri);
        return;
      }
      if (w > maxDimension || h > maxDimension) {
        if (w >= h) {
          h = Math.round((h * maxDimension) / w);
          w = maxDimension;
        } else {
          w = Math.round((w * maxDimension) / h);
          h = maxDimension;
        }
      }
      try {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUri);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL('image/jpeg', 0.85);
        logger.log(`[optimizeDataUriForInput] Compressed payload from ${(dataUri.length / 1024).toFixed(0)}KB to ${(compressed.length / 1024).toFixed(0)}KB (${w}x${h})`);
        resolve(compressed.length < dataUri.length ? compressed : dataUri);
      } catch {
        resolve(dataUri);
      }
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(dataUri);
    };
    img.src = dataUri;
  });
}

// Nano Banana models accept base64 data URIs directly (best quality, zero network latency, no remote disconnects)
// Other models prefer public HTTPS URLs via Supabase Storage or Replicate Files API
export async function uploadImageIfLocal(url: string, _model?: string): Promise<string> {
  if (!url) return url;
  // Public HTTPS URL (not localhost or catbox.moe) - safe to use directly
  if (url.startsWith('https://') && !url.includes('catbox.moe')) return url;

  // Resolve IndexedDB-backed images first
  if (url.startsWith('idb://')) {
    try {
      const { getLocalImage } = await import('../../../services/history/HistoryService');
      const cached = await getLocalImage(url);
      if (cached) {
        // Nano Banana natively accepts data: URIs directly
        if (_model?.startsWith('google/nano-banana') || _model === 'black-forest-labs/flux-3-image') {
          return await optimizeDataUriForInput(cached);
        }
        const supaUrl = await uploadToSupabaseStorage(cached);
        if (supaUrl) return supaUrl;

        try {
          const { replicateService } = await import('../../../services/replicate');
          return await replicateService.uploadToReplicate(cached);
        } catch (err) {
          logger.warn('[uploadImageIfLocal] Replicate upload failed, using optimized inline data URI:', err);
          return await optimizeDataUriForInput(cached);
        }
      }
    } catch (err) {
      logger.error('[uploadImageIfLocal] Failed to resolve idb image:', err);
    }
    return url;
  }

  // Already a data URI (base64)
  if (url.startsWith('data:')) {
    // Nano Banana & FLUX 3 Image natively accept data: URIs directly without any remote fetch
    if (_model?.startsWith('google/nano-banana') || _model === 'black-forest-labs/flux-3-image') {
      return await optimizeDataUriForInput(url);
    }
    const supaUrl = await uploadToSupabaseStorage(url);
    if (supaUrl) return supaUrl;

    try {
      const { replicateService } = await import('../../../services/replicate');
      return await replicateService.uploadToReplicate(url);
    } catch (err) {
      logger.warn('[uploadImageIfLocal] Upload failed, sending optimized inline data URI:', err);
      return await optimizeDataUriForInput(url);
    }
  }

  // Localhost / blob / file / asset / catbox.moe URLs: convert to base64 first
  if (
    url.startsWith('http://') ||
    url.startsWith('blob:') ||
    url.startsWith('file://') ||
    url.startsWith('asset://') ||
    url.startsWith('tauri://') ||
    url.includes('catbox.moe') ||
    /^[a-zA-Z]:[\\/]/.test(url)
  ) {
    try {
      let b64: string | null = null;
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        b64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch {
        const { invoke } = await import('@tauri-apps/api/core');
        b64 = await invoke<string>('url_to_base64', { url });
      }

      if (b64 && b64.startsWith('data:')) {
        const optimized = await optimizeDataUriForInput(b64);
        if (_model?.startsWith('google/nano-banana') || _model === 'black-forest-labs/flux-3-image') {
          return optimized;
        }
        const supaUrl = await uploadToSupabaseStorage(optimized);
        if (supaUrl) return supaUrl;

        try {
          const { replicateService } = await import('../../../services/replicate');
          return await replicateService.uploadToReplicate(optimized);
        } catch {
          return optimized;
        }
      }
    } catch (err) {
      logger.error('[uploadImageIfLocal] Failed to convert local URL to base64:', err);
    }
    return url;
  }
  return url;
}

export async function persistImageLocally(url: string): Promise<string> {
  if (!url || url.startsWith('data:') || url.startsWith('blob:')) return url;

  // If already an IDB cache key, resolve its cached data URI or object URL
  if (url.startsWith('idb://')) {
    try {
      const cached = await getLocalImage(url);
      if (cached) return cached;
    } catch {
      // Fall through
    }
  }

  // 1. Try Tauri Rust command first (bypasses CORS and Hotlink blocks)
  try {
    const base64Data: string = await invoke('url_to_base64', { url });
    if (base64Data && base64Data.startsWith('data:')) {
      return base64Data;
    }
  } catch (tauriErr) {
    logger.warn('[persistImageLocally] Tauri url_to_base64 notice:', tauriErr);
  }

  // 2. Browser fallback: fetch image with no-referrer
  try {
    const response = await fetch(url, { referrerPolicy: 'no-referrer' });
    if (response.ok) {
      const blob = await response.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
  } catch {
    // Cannot convert — return original URL as last resort
  }

  return url;
}

export async function resolveImageIfCached(url: string | undefined): Promise<string | undefined> {
  if (url && url.startsWith('idb://')) {
    const cached = await getLocalImage(url);
    if (cached) return cached;
  }
  return url;
}

/**
 * Resolves the true natural pixel dimensions (width & height) of an image.
 */
export async function getImageDimensions(url: string): Promise<{ width: number; height: number }> {
  if (!url) return { width: 1024, height: 1024 };

  let resolvedUrl = url;
  if (url.startsWith('idb://')) {
    try {
      const cached = await getLocalImage(url);
      if (cached) resolvedUrl = cached;
    } catch {
      // Fall back to original url
    }
  }

  if (typeof window === 'undefined' || typeof Image === 'undefined') {
    return { width: 1024, height: 1024 };
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    const timer = setTimeout(() => resolve({ width: 1024, height: 1024 }), 4000);
    img.onload = () => {
      clearTimeout(timer);
      resolve({
        width: img.naturalWidth || img.width || 1024,
        height: img.naturalHeight || img.height || 1024,
      });
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve({ width: 1024, height: 1024 });
    };
    img.src = resolvedUrl;
  });
}

/**
 * Resamples and resizes an image to exact targetWidth and targetHeight using HTML5 Canvas.
 */
export async function resizeImageToDimensions(
  imageUrl: string,
  targetWidth: number,
  targetHeight: number,
  mimeType: string = 'image/png'
): Promise<string> {
  if (!imageUrl || !targetWidth || !targetHeight || targetWidth <= 0 || targetHeight <= 0) {
    return imageUrl;
  }
  if (typeof window === 'undefined' || typeof document === 'undefined' || typeof Image === 'undefined') {
    return imageUrl;
  }

  let resolvedUrl = imageUrl;
  if (imageUrl.startsWith('idb://')) {
    try {
      const cached = await getLocalImage(imageUrl);
      if (cached) resolvedUrl = cached;
    } catch {
      // Fall back
    }
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (img.naturalWidth === targetWidth && img.naturalHeight === targetHeight) {
        resolve(imageUrl);
        return;
      }
      try {
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(imageUrl);
          return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        const dataUrl = canvas.toDataURL(mimeType, 0.95);
        resolve(dataUrl);
      } catch (err) {
        logger.warn('[ImageResize] Canvas resize error, using original:', err);
        resolve(imageUrl);
      }
    };
    img.onerror = () => {
      resolve(imageUrl);
    };
    img.src = resolvedUrl;
  });
}

// AI generation config passed to executeNode
export interface GenerationConfig {
  model: ReplicateImageModel | ReplicateUpscaleModel;
  resolution?: string;
  aspectRatio?: string;
  steps?: number;
  cfg?: number;
  seed?: number | null;
  strength?: number;
  referenceStrength?: number;
  disableSafetyChecker?: boolean;
  upscaleFactor?: number;
  negativePrompt?: string;
  // Watermark settings
  enableWatermark?: boolean;
  watermarkText?: string;
  watermarkPosition?: import('../../../stores/aiConfigStore').WatermarkPosition;
  watermarkOpacity?: number;
  watermarkFontSize?: number;
  // Topaz Labs settings
  enhanceModel?: string;
  topazUpscaleFactor?: string;
  topazSubjectDetection?: string;
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
  // Seedream sequential settings
  sequentialImageGeneration?: string;
  maxImages?: number;
  // Pruna AI settings
  prunaMode?: 'target' | 'factor';
  prunaTarget?: number;
  prunaFactor?: number;
  prunaEnhanceDetails?: boolean;
  prunaEnhanceRealism?: boolean;
  prunaQuality?: number;
  prunaOutputFormat?: string;
  // Anarchy Upscale settings
  anarchyUpscaleScale?: number;
  anarchyUpscaleCreativity?: number;
  sourceImage?: string;
  sourceWidth?: number;
  sourceHeight?: number;
}

// Re-export types for backward compatibility
export type { ProcessingType, BuilderNodeData, DataPacket, NodeLineage, NodeType, NodeState, WorkflowStats };

// ============================================================================
// CONSTANTS
// ============================================================================

export const HORIZONTAL_SPACING = 300;
export const VERTICAL_SPACING = 210;

// Type labels for UI
export const TYPE_LABELS: Record<ProcessingType, string> = {
  source: 'Source',
  render: 'AI Render',
  detail: 'Detail Edit',
  upscale: 'Upscale',
  people: 'Add People',
  daynight: 'Day to Night',
  lighting: 'Lighting',
  material: 'Materials',
  local: 'Local Edit',
  video: 'Video',
  variation: 'Variation'
};

export const MODEL_DISPLAY_NAMES: Record<string, string> = {
  'google/nano-banana-2':             'Nano Banana 2',
  'google/nano-banana-2.1':           'Nano Banana 2.1',
  'google/nano-banana-2-lite':        'Nano Banana 2 Lite',
  'google/nano-banana-pro':           'Nano Banana Pro',
  'bytedance/seedream-4.5':           'Seedream 4.5',
  'bytedance/seedream-5-pro':         'Seedream 5 Pro',
  'black-forest-labs/flux-3-image':   'FLUX 3 Image',
  'black-forest-labs/flux-2-pro':     'FLUX 2 Pro',
  'openai/gpt-image-2':               'GPT Image 2',
  'openai/gpt-image-2.5-flare':       'GPT Image 2.5 (Flare)',
  'openai/gpt-image-2.5-sunburst':    'GPT Image 2.5 (Sunburst)',
  'bytedance/seedance-2.0':           'Seedance 2',
  'black-forest-labs/flux-kontext-pro':'FLUX Kontext Pro',
  'xai/grok-imagine-image':           'Grok Imagine',
  'stability-ai/stable-diffusion-3.5-large': 'Stable Diffusion 3.5',
  'reve/edit-fast':                   'Anarchy Edit Fast',
  'reve/create':                      'Anarchy Create (v2)',
  'reve/extract-layout':              'Anarchy Analysis (v2)',
  'reve/render-layout':               'Anarchy Render Layout (v2)',
  'reve/create-layout':               'Anarchy Create Layout (v2)',
  'reve/reconcile-layouts':           'Anarchy Reconcile Layouts (v2)',
  'philz1337x/clarity-upscaler':      'Clarity Upscaler',
  'kwaivgi/kling-v3-omni-video':      'Kling v3 Omni Video',
  'xai/grok-imagine-video-1.5':       'Grok Imagine Video 1.5',
  'prunaai/p-video':                  'Pruna AI P-Video',
  'google/veo-3.1-fast':              'Google Veo 3.1 Fast',
  'pixverse/pixverse-v6':              'PixVerse v6',
  'openai/sora-2-pro':                'Sora 2 Pro',
  // ── Upscalers ──
  'midjourney/mj-turbo-upscale':          'Midjourney Turbo',
  'mj-turbo-upscale':                     'Midjourney Turbo',
  'midjourney/mj-turbo-upscale-subtle':   'MJ Turbo Subtle',
  'midjourney/mj-turbo-upscale-creative': 'MJ Turbo Creative',
  'midjourney/mj-fast-upscale':           'Midjourney Fast',
  'midjourney/mj-fast-upscale-subtle':    'MJ Fast Subtle',
  'midjourney/mj-fast-upscale-creative':  'MJ Fast Creative',
  'nightmareai/real-esrgan':              'Fast AI Upscale',
  'philz1337x/clarity-pro-upscaler':      'Anarchy Upscale',
  'topazlabs/image-upscale':              'Topaz Upscale',
  'prunaai/p-image-upscale':              'Pruna AI Upscale',
};

// ============================================================================
// DATA PACKET UTILITIES
// ============================================================================

export const createDataPacket = (
  image: string | undefined,
  prompt: string | undefined,
  operationType: ProcessingType,
  dimensions?: { width: number; height: number },
  model?: string,
  isVideo?: boolean,
  thumbnail?: string
): DataPacket => ({
  image,
  thumbnail,
  prompt,
  metadata: {
    timestamp: Date.now(),
    operationType,
    format: 'png',
    width: dimensions?.width,
    height: dimensions?.height,
    model,
    isVideo
  },
  dimensions
});

// ============================================================================
// EDGE FACTORY - Data carrying edges
// ============================================================================

export interface EdgeOptions {
  animated?: boolean;
  isDataFlow?: boolean;
  packet?: DataPacket;
  targetHandleIndex?: number; // For multi-input nodes (ghost-target-0, ghost-target-1, etc.)
}

export const createEdge = (
  sourceId: string, 
  targetId: string, 
  options: EdgeOptions = {}
): Edge => {
  const { animated = false, packet, targetHandleIndex = 0 } = options;
  
  return {
    id: `e-${sourceId}-${targetId}-${targetHandleIndex}`,
    source: sourceId,
    target: targetId,
    sourceHandle: 'source', // Explicit source handle for proper positioning
    targetHandle: `ghost-target-${targetHandleIndex}`, // Dynamic handle for multi-input
    type: 'default', // Bezier curves for smooth flowing lines
    animated,
    label: null, // No label on edge - must be null not undefined
    style: { 
      strokeWidth: 2,
      stroke: '#e11d48', // Brand red
      opacity: 0.8,
      strokeDasharray: '5 5', // Dashed line
      strokeLinecap: 'round'
    },
    data: {
      packet,
      isActive: !!packet,
      lastUpdate: Date.now()
    }
  };
};

// ============================================================================
// MAIN HOOK - AI Processing Graph Engine
// ============================================================================

// Validate workflow schema to prevent crashes from corrupted localStorage data
export function validateWorkflowData(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  if (!Array.isArray(data.nodes)) return false;
  for (const node of data.nodes) {
    if (!node || typeof node !== 'object') return false;
    if (typeof node.id !== 'string' || !node.id) return false;
    if (typeof node.type !== 'string') return false;
    if (!node.position || typeof node.position !== 'object') return false;
    if (typeof node.position.x !== 'number' || typeof node.position.y !== 'number') return false;
    if (!node.data || typeof node.data !== 'object') return false;
  }
  if (data.edges && !Array.isArray(data.edges)) return false;
  return true;
}

// Snapshot type for undo/redo
export interface HistorySnapshot { nodes: BuilderNode[]; edges: Edge[]; }

export const MAX_HISTORY = 50;

