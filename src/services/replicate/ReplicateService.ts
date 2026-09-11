/**
 * Replicate API Integration Service
 * Unified image / upscale / video / 3D / chat generation
 * Docs: https://replicate.com/docs
 *
 * SECURITY: All API calls go through Supabase Edge Function "replicate-proxy".
 * The Replicate API key is NEVER stored in the frontend.
 */

import { logger } from '../../utils/logger';
import { supabase, supabaseUrl } from '../supabase/supabaseClient';

// Re-export all types
export type {
  ReplicateImageModel,
  ReplicateUpscaleModel,
  ReplicateVideoModel,
  Replicate3DModel,
  ReplicateChatModel,
  ReplicateModel,
  ReplicateGenerationParams,
  ReplicateChatMessage,
  ReplicateChatResult,
  ReplicateGenerationResult,
  ReplicatePrediction,
  ReplicateApiConfig,
  ModelMeta,
} from './modules/replicateTypes';

import type {
  ReplicateImageModel,
  ReplicateVideoModel,
  Replicate3DModel,
  ReplicateChatModel,
  ReplicateModel,
  ReplicateGenerationParams,
  ReplicateChatMessage,
  ReplicateChatResult,
  ReplicateGenerationResult,
  ReplicatePrediction,
  ModelMeta,
} from './modules/replicateTypes';

// Re-export all constants & utilities
export {
  MODEL_META,
  MODEL_VERSIONS,
  arToSize,
  resolutionToPixels,
} from './modules/replicateConstants';

import {
  MODEL_META,
  MODEL_VERSIONS,
} from './modules/replicateConstants';

// Re-export transport functions
export {
  getProxyUrl,
  proxyPost,
  proxyGet,
  uploadToReplicate,
  pollPrediction,
} from './modules/replicateTransport';

import {
  getProxyUrl,
  proxyPost,
  uploadToReplicate,
  pollPrediction,
} from './modules/replicateTransport';

// Re-export payload builders
export {
  getModelCapabilities,
  extractImageUrl,
  extractImageUrls,
  buildNanoBananaInput,
  buildFluxInput,
  buildGeneralInput,
  buildSeedreamInput,
  buildGptImageInput,
  buildStableDiffusionInput,
  buildVideoInput,
  buildInput,
  buildResult,
} from './modules/replicatePayloadBuilders';

import {
  getModelCapabilities,
  extractImageUrl,
  extractImageUrls,
  buildInput,
  buildResult,
} from './modules/replicatePayloadBuilders';

// ── Service Class ─────────────────────────────────────────────────────────────
export class ReplicateService {
  public static readonly MODEL_VERSIONS = MODEL_VERSIONS;

  private lastRequestTime = 0;
  private readonly minRequestInterval = 12_000; // 12s between requests (5 req/min safe)
  private webhookUrl: string = '';

  public getWebhookUrl(): string {
    if (this.webhookUrl && !this.webhookUrl.includes('placeholder')) return this.webhookUrl;
    if (supabaseUrl && !supabaseUrl.includes('placeholder')) {
      return `${supabaseUrl}/functions/v1/replicate_webhook`;
    }
    return 'https://ejzsbkxpqmhpjuqmszvd.supabase.co/functions/v1/replicate_webhook';
  }

  constructor() {
    this.webhookUrl = this.getWebhookUrl();
    logger.log('[ReplicateService] Webhook URL active:', this.webhookUrl);
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
    return getModelCapabilities(model);
  }

  getModelSettings(model: ReplicateModel) {
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
      supportsStyleType: meta.supportsStyleType,
      supportsStylePreset: meta.supportsStylePreset,
      maxReferenceImages: meta.maxReferenceImages,
      defaultSteps: meta.defaultSteps,
      stepsRange: meta.stepsRange,
      styleTypes: meta.styleTypes,
      stylePresets: meta.stylePresets,
    };
  }

  getAvailableModels(): (ReplicateImageModel | ReplicateVideoModel)[] {
    return Object.keys(MODEL_META) as (ReplicateImageModel | ReplicateVideoModel)[];
  }

  private async pollPrediction(
    predictionId: string,
    signal?: AbortSignal,
    onStatusChange?: (status: 'queued' | 'processing', predictionId?: string) => void
  ): Promise<ReplicatePrediction> {
    return pollPrediction(predictionId, signal, onStatusChange);
  }

  async uploadToReplicate(dataUri: string): Promise<string> {
    return uploadToReplicate(dataUri);
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
    logger.log('Model:', modelId, 'Payload:', input);

    // Use version-based endpoint for community models
    const version = ReplicateService.MODEL_VERSIONS[modelId];
    const path = version ? '/predictions' : `/models/${modelId}/predictions`;
    const body: Record<string, unknown> = version ? { version, input } : { input };

    // Add webhook URL to all Replicate predictions
    const activeWebhookUrl = this.getWebhookUrl();
    if (activeWebhookUrl) {
      // Auto-resolve authenticated user from active Supabase session if omitted or generic
      let effectiveUserId = (userId || input.user_id || input.userId) as string | undefined;
      if (!effectiveUserId || effectiveUserId === 'user' || effectiveUserId === 'anonymous') {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData?.session?.user?.id) {
            effectiveUserId = sessionData.session.user.id;
          }
        } catch {
          // Ignore and fallback
        }
      }
      const finalUserId = effectiveUserId || 'user';
      const finalNodeId = (nodeId || input.node_id || input.nodeId || 'canvas-node') as string;
      let webhookWithParams = `${activeWebhookUrl}?node_id=${encodeURIComponent(finalNodeId)}&user_id=${encodeURIComponent(finalUserId)}&model=${encodeURIComponent(modelId)}`;
      const workflowIdVal = (input.workflow_id || input.workflowId) as string | undefined;
      if (workflowIdVal) {
        webhookWithParams += `&workflow_id=${encodeURIComponent(workflowIdVal)}`;
      }
      body.webhook = webhookWithParams;
      body.webhook_events_filter = ['start', 'output', 'completed'];

      logger.log('[ReplicateService] Enforcing prediction webhook:', webhookWithParams);
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
          logger.log('Replicate response:', prediction);
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
        logger.log('Replicate response:', response);
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
    let effectiveUserId = metadata.userId;
    if (!effectiveUserId || effectiveUserId === 'user' || effectiveUserId === 'anonymous') {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.user?.id) {
          effectiveUserId = sessionData.session.user.id;
        }
      } catch {
        // Ignore and fallback
      }
    }
    const finalUserId = effectiveUserId || 'anonymous';
    const finalNodeId = metadata.nodeId || 'unknown';

    if (this.webhookUrl) {
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
        node_id: finalNodeId,
        user_id: finalUserId,
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

  public extractImageUrl(output: unknown): string {
    return extractImageUrl(output);
  }

  public extractImageUrls(output: unknown): string[] {
    return extractImageUrls(output);
  }

  // ── Text-to-Image ─────────────────────────────────────────────────────────
  async generate(
    params: ReplicateGenerationParams,
    signal?: AbortSignal,
    onStatusChange?: (status: 'queued' | 'processing', predictionId?: string) => void
  ): Promise<ReplicateGenerationResult> {
    const start = Date.now();
    const input = buildInput(params, []);

    const prediction = await this.runPrediction(params.model, input, params.nodeId, params.userId, signal, onStatusChange);
    const imageUrls = this.extractImageUrls(prediction.output);
    if (imageUrls.length === 0 || !imageUrls[0]) {
      logger.error('[ReplicateService] Prediction completed but returned no valid image output:', prediction);
      throw new Error(`Model returned output without valid image URL: ${JSON.stringify(prediction.output ?? prediction)}`);
    }
    const imageUrl = imageUrls[0];

    const result = buildResult(params, imageUrl, {}, start);
    result.imageUrls = imageUrls;
    return result;
  }

  // ── Async Generation with Webhook (no waiting) ────────────────────────────
  async generateWithWebhook(
    params: ReplicateGenerationParams,
    metadata: { nodeId: string; userId: string; workflowId?: string }
  ): Promise<{ predictionId: string; status: string }> {
    if (!this.webhookUrl) {
      throw new Error('Webhook URL not configured. Ensure VITE_SUPABASE_URL is set correctly.');
    }

    const input = buildInput(params, []);

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
    const start = Date.now();
    const meta = this.getModelCapabilities(params.model);
    const imageList = Array.isArray(images) ? images : [images];

    const maxImgs = meta.maxReferenceImages > 0 ? meta.maxReferenceImages : 14;
    const imgSlice = imageList.slice(0, maxImgs);

    const input = buildInput(params, imgSlice);

    const prediction = await this.runPrediction(params.model, input, params.nodeId, params.userId, signal, onStatusChange);
    const imageUrls = this.extractImageUrls(prediction.output);
    if (imageUrls.length === 0 || !imageUrls[0]) {
      logger.error('[ReplicateService] Img2Img prediction completed but returned no valid image output:', prediction);
      throw new Error(`Model returned output without valid image URL: ${JSON.stringify(prediction.output ?? prediction)}`);
    }
    const imageUrl = imageUrls[0];

    const result = buildResult(params, imageUrl, input, start);
    result.imageUrls = imageUrls;
    return result;
  }

  // ── Video Generation ──────────────────────────────────────────────────────
  async generateVideo(
    imageUrl: string,
    prompt: string,
    model: ReplicateVideoModel = 'wavespeedai/wan-2.1-i2v-480p',
    signal?: AbortSignal
  ): Promise<string> {
    const prediction = await this.runPrediction(model, {
      image: imageUrl,
      prompt,
    }, undefined, undefined, signal);
    const output = prediction.output;
    if (typeof output === 'string') return output;
    if (Array.isArray(output)) return output[0];
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
    const userMsg = messages.filter(m => m.role !== 'system').map(m => `${m.role}: ${m.content}`).join('\n');

    const prediction = await this.runPrediction(model, {
      system_prompt: systemMsg,
      prompt: userMsg,
    }, undefined, undefined, signal);

    const output = prediction.output;
    const content = Array.isArray(output) ? output.join('') : String(output ?? '');
    return { content, model };
  }

  // ── Warm-up Connection Ping ───────────────────────────────────────────────
  async pingProxy(): Promise<boolean> {
    try {
      const url = getProxyUrl();
      const res = await proxyPost(url, '/ping', { ping: true });
      return !!res;
    } catch (err) {
      logger.warn('[ReplicateService] Warm-up ping failed:', err);
      return false;
    }
  }
}

// Singleton
export const replicateService = new ReplicateService();
export default ReplicateService;
