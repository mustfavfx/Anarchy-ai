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
// Nano Banana models accept base64 data URIs directly (best quality, no expiry)
// Other models (FLUX, GPT, etc.) need public URLs via upload service
export async function uploadImageIfLocal(url: string, _model?: string): Promise<string> {
  if (!url) return url;
  // Public HTTPS URL (not localhost) - safe to use directly
  if (url.startsWith('https://')) return url;
  
  // Resolve IndexedDB-backed images first
  if (url.startsWith('idb://')) {
    try {
      const { getLocalImage } = await import('../../../services/history/HistoryService');
      const cached = await getLocalImage(url);
      if (cached) {
        try {
          const { replicateService } = await import('../../../services/replicate');
          return await replicateService.uploadToReplicate(cached);
        } catch (err) {
          logger.error('[uploadImageIfLocal] Replicate upload failed (idb resolution), falling back to inline:', err);
          return cached;
        }
      }
    } catch (err) {
      logger.error('[uploadImageIfLocal] Failed to resolve idb image:', err);
    }
    return url;
  }

  // Already a data URI — upload to Replicate Files API to get a serving URL
  // This is more reliable than sending huge base64 inline in JSON body
  if (url.startsWith('data:')) {
    try {
      const { replicateService } = await import('../../../services/replicate');
      return await replicateService.uploadToReplicate(url);
    } catch (err) {
      logger.error('[uploadImageIfLocal] Replicate upload failed (data URI), falling back to inline:', err);
      return url; // fallback: send data URI inline (works for small images)
    }
  }
  // localhost / blob URLs are not reachable by Replicate — convert to base64 first, then upload
  if (url.startsWith('http://') || url.startsWith('blob:')) {
    try {
      const b64: string = await invoke('url_to_base64', { url });
      if (b64?.startsWith('data:')) {
        try {
          const { replicateService } = await import('../../../services/replicate');
          return await replicateService.uploadToReplicate(b64);
        } catch (err) {
          logger.error('[uploadImageIfLocal] Replicate upload failed (blob/local), falling back to inline:', err);
          return b64; // fallback: send data URI inline
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

  // Try Tauri Rust command first (bypasses CORS)
  try {
    const base64Data: string = await invoke('url_to_base64', { url });
    if (base64Data?.startsWith('data:')) return base64Data;
  } catch {
    // Tauri unavailable — fall through to browser fetch
  }

  // Browser fallback: fetch image and convert to base64
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
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
  'google/nano-banana-2-lite':        'Nano Banana 2 Lite',
  'google/nano-banana-pro':           'Nano Banana Pro',
  'bytedance/seedream-4.5':           'Seedream 4.5',
  'bytedance/seedream-5-pro':         'Seedream 5 Pro',
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
  isVideo?: boolean
): DataPacket => ({
  image,
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

