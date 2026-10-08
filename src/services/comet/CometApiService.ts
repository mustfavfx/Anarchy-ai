import { logger } from '../../utils/logger';
import { supabase, supabaseUrl, getCurrentUserId } from '../supabase/supabaseClient';

export { type CometModelSpec, COMET_MODELS } from './cometModels';
import { type CometModelSpec, COMET_MODELS } from './cometModels';

export interface CometChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

export interface CometChatRequest {
  model: string;
  messages: CometChatMessage[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  onChunk?: (delta: string, accumulated: string) => void;
}

export interface CometUsageStats {
  totalUsageUsd: number;
  hardLimit?: number;
  hasPaymentMethod: boolean;
  creditMultiplier?: number;
}

class CometApiService {
  private defaultApiKey = 'sk-kS1RMrcjP9wiss9WL54RRAiGraGGmB7LHaT5Hzb2efaGPmau';
  private baseUrl = 'https://api.cometapi.com/v1';

  public getApiKey(): string {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('anarchy_comet_api_key');
      if (stored && stored.trim().length > 10) return stored.trim();
    }
    return this.defaultApiKey;
  }

  public setApiKey(key: string): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('anarchy_comet_api_key', key.trim());
    }
  }

  public getWebhookUrl(metadata?: {
    userId?: string;
    nodeId?: string;
    model?: string;
    prompt?: string;
    workflowId?: string;
  }): string {
    const base = supabaseUrl && !supabaseUrl.includes('placeholder')
      ? `${supabaseUrl}/functions/v1/comet_webhook`
      : 'https://ejzsbkxpqmhpjuqmszvd.supabase.co/functions/v1/comet_webhook';

    if (!metadata) return base;
    const params = new URLSearchParams();
    if (metadata.userId) params.set('user_id', metadata.userId);
    if (metadata.nodeId) params.set('node_id', metadata.nodeId);
    if (metadata.model) params.set('model', metadata.model);
    if (metadata.prompt) params.set('prompt', metadata.prompt.slice(0, 500));
    if (metadata.workflowId) params.set('workflow_id', metadata.workflowId);

    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }

  public isCometModel(modelId: string): boolean {
    if (!modelId) return false;
    return (
      modelId.startsWith('comet/') ||
      modelId.startsWith('xai/') ||
      modelId.startsWith('minimax/') ||
      modelId.startsWith('midjourney/') ||
      COMET_MODELS.some((m) => m.id === modelId || m.cometId === modelId)
    );
  }

  public getModelSpec(modelId: string): CometModelSpec | undefined {
    const cleanId = modelId.replace(/^comet\//, '');
    return COMET_MODELS.find(
      (m) => m.id === cleanId || m.cometId === cleanId || m.id === modelId
    );
  }

  /**
   * Execute chat completion via CometAPI strictly with the user-selected model.
   * Never falls back or cascades to other models to prevent unintended token consumption & costs.
   */
  public async chatWithComet(request: CometChatRequest): Promise<string> {
    const apiKey = this.getApiKey();
    const spec = this.getModelSpec(request.model);
    const targetModel = spec?.cometId || request.model.replace(/^comet\//, '').split('/').pop() || request.model;

    // Build payload messages
    const formattedMessages: CometChatMessage[] = [];
    if (request.systemPrompt) {
      formattedMessages.push({
        role: 'system',
        content: request.systemPrompt,
      });
    }

    for (const msg of request.messages) {
      formattedMessages.push(msg);
    }

    logger.log(`[CometAPI] Sending completion request strictly to selected model: ${targetModel}`);
    const res = await this.executeSingleModelRequest(
      targetModel,
      formattedMessages,
      apiKey,
      request.temperature ?? 0.7,
      request.maxTokens ?? 4096,
      request.signal,
      request.onChunk
    );

    if (!res || res.trim().length === 0) {
      throw new Error(`CometAPI returned an empty response for model ${targetModel}`);
    }

    logger.log(`[CometAPI] Successfully received response from ${targetModel} (${res.length} chars)`);
    return res;
  }

  private async executeSingleModelRequest(
    model: string,
    messages: CometChatMessage[],
    apiKey: string,
    temperature: number,
    maxTokens: number,
    signal?: AbortSignal,
    onChunk?: (delta: string, accumulated: string) => void
  ): Promise<string> {
    const url = `${this.baseUrl}/chat/completions`;

    const controller = new AbortController();
    // 45s timeout for deep thinking models
    const timeoutTimer = setTimeout(() => controller.abort(), 45000);

    const onExternalAbort = () => controller.abort();
    if (signal) {
      signal.addEventListener('abort', onExternalAbort, { once: true });
    }

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
          stream: !!onChunk,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutTimer);

      if (!resp.ok) {
        const errorText = await resp.text().catch(() => '');
        throw new Error(`CometAPI HTTP ${resp.status}: ${errorText.slice(0, 300)}`);
      }

      // Handle streaming SSE if onChunk callback provided
      if (onChunk && resp.body && typeof resp.body.getReader === 'function') {
        const reader = resp.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let accumulated = '';
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const payload = trimmed.replace(/^data:\s*/, '');
            if (payload === '[DONE]') break;
            try {
              const json = JSON.parse(payload);
              const delta = json.choices?.[0]?.delta?.content || '';
              if (delta) {
                accumulated += delta;
                onChunk(delta, accumulated);
              }
            } catch {
              // Ignore partial JSON chunks
            }
          }
        }

        if (accumulated.trim().length > 0) {
          return accumulated;
        }
      }

      const data = await resp.json();
      const content = data.choices?.[0]?.message?.content;
      if (typeof content === 'string') {
        return content;
      }

      if (Array.isArray(content)) {
        return content
          .map((part: any) => (typeof part === 'string' ? part : part.text || ''))
          .join('\n');
      }

      throw new Error(`Invalid response structure from CometAPI: ${JSON.stringify(data).slice(0, 200)}`);
    } finally {
      clearTimeout(timeoutTimer);
      if (signal) {
        signal.removeEventListener('abort', onExternalAbort);
      }
    }
  }

  /**
   * Check balance and usage from CometAPI
   */
  public async getUsageStats(): Promise<CometUsageStats> {
    const apiKey = this.getApiKey();
    try {
      const usageResp = await fetch(
        `${this.baseUrl}/dashboard/billing/usage?start_date=2026-01-01&end_date=2026-10-02`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
        }
      );
      const usageData = await usageResp.json().catch(() => ({}));

      const subResp = await fetch(`${this.baseUrl}/dashboard/billing/subscription`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const subData = await subResp.json().catch(() => ({}));

      return {
        totalUsageUsd: usageData.total_usage ? usageData.total_usage / 100 : 0,
        hardLimit: subData.hard_limit_usd || 0,
        hasPaymentMethod: subData.has_payment_method || false,
      };
    } catch (err) {
      logger.error('[CometApiService] Failed to fetch usage stats:', err);
      return { totalUsageUsd: 0, hardLimit: 0, hasPaymentMethod: false };
    }
  }

  private async tauriPost<T = any>(url: string, headers: Record<string, string>, body: any): Promise<T | null> {
    if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI_IPC__' in window)) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const res = await invoke('http_post', { url, headers, body });
        return res as T;
      } catch (e) {
        logger.warn('[CometApiService] Tauri http_post failed, falling back:', e);
      }
    }
    return null;
  }

  private async tauriGet<T = any>(url: string, headers: Record<string, string>): Promise<T | null> {
    if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI_IPC__' in window)) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const res = await invoke('http_get', { url, headers });
        return res as T;
      } catch (e) {
        logger.warn('[CometApiService] Tauri http_get failed, falling back:', e);
      }
    }
    return null;
  }

  /**
   * Permanently saves a CometAPI generated/upscaled image into Supabase Storage
   * under the user's dedicated path: generated-images/${userId}/${nodeId}/${taskId}.${ext}
   * and synchronizes the record in replicate_predictions.
   */
  public async saveImageToSupabaseStorage(
    imageUrl: string,
    metadata: {
      userId?: string;
      nodeId?: string;
      taskId?: string;
      model?: string;
      prompt?: string;
      workflowId?: string;
    }
  ): Promise<string> {
    if (!imageUrl || imageUrl.includes('placeholder') || !supabaseUrl) {
      return imageUrl;
    }

    // Already archived in Supabase Storage
    if (imageUrl.includes('supabase.co/storage/v1/object/public/generated-images/')) {
      return imageUrl;
    }

    let effectiveUserId = metadata.userId;
    if (!effectiveUserId || effectiveUserId === 'user' || effectiveUserId === 'anonymous' || effectiveUserId === 'default_user') {
      try {
        const current = getCurrentUserId();
        if (current && current !== 'default_user') {
          effectiveUserId = current;
        }
      } catch {}
    }
    const finalUserId = effectiveUserId || 'default_user';
    const finalNodeId = metadata.nodeId || 'upscaler-node';
    const taskId = metadata.taskId || `comet_${Date.now()}`;

    // 0. Check if comet_webhook edge function already archived the permanent storage_url
    if (taskId && !taskId.startsWith('comet_')) {
      try {
        const { data: pred } = await supabase
          .from('replicate_predictions')
          .select('storage_url, output_url')
          .eq('replicate_id', taskId)
          .maybeSingle();

        if (pred?.storage_url && pred.storage_url.startsWith('https://') && !pred.storage_url.includes('discordapp')) {
          logger.log('[CometApiService] Retrieved permanent storage_url from Supabase record:', pred.storage_url);
          return pred.storage_url;
        }
      } catch (checkErr) {
        logger.debug('[CometApiService] Webhook record check notice:', checkErr);
      }
    }

    let blob: Blob | null = null;
    let base64Data: string | null = null;

    try {
      logger.log('[CometApiService] Archiving Comet image to Supabase Storage for user:', {
        userId: finalUserId,
        nodeId: finalNodeId,
        taskId,
      });

      // 1. Download image as Blob (Try Tauri url_to_base64 first to bypass CDN CORS / Referer blocks)
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const b64 = await invoke<string>('url_to_base64', { url: imageUrl });
        if (b64 && b64.startsWith('data:')) {
          base64Data = b64;
          const { dataURLtoBlob } = await import('../history/HistoryService');
          blob = dataURLtoBlob(b64);
        }
      } catch {
        // Fall back to fetch
      }

      if (!blob) {
        try {
          const res = await fetch(imageUrl, { headers: { Accept: 'image/*,*/*' }, referrerPolicy: 'no-referrer' });
          if (res.ok) {
            blob = await res.blob();
          }
        } catch (fetchErr) {
          logger.warn('[CometApiService] Client fetch blob failed:', fetchErr);
        }
      }

      // If client fetch failed and this is a Discord URL, check if comet_webhook edge function completed it
      if (!blob && !base64Data && (imageUrl.includes('discordapp') || imageUrl.includes('discord.com')) && taskId && !taskId.startsWith('comet_')) {
        for (let attempt = 0; attempt < 3; attempt++) {
          await new Promise((r) => setTimeout(r, 1200));
          try {
            const { data: pred } = await supabase
              .from('replicate_predictions')
              .select('storage_url')
              .eq('replicate_id', taskId)
              .maybeSingle();

            if (pred?.storage_url && pred.storage_url.startsWith('https://') && !pred.storage_url.includes('discordapp')) {
              logger.log('[CometApiService] Retrieved permanent storage_url from Supabase webhook retry:', pred.storage_url);
              return pred.storage_url;
            }
          } catch {}
        }
      }

      if (!blob && base64Data) {
        return base64Data;
      }

      if (!blob) {
        return imageUrl;
      }

      let ext = 'png';
      if (blob.type.includes('webp')) ext = 'webp';
      else if (blob.type.includes('jpeg') || blob.type.includes('jpg')) ext = 'jpg';

      const storagePath = `${finalUserId}/${finalNodeId}/${taskId}.${ext}`;

      // 2. Upload to Supabase Storage bucket 'generated-images'
      const { error: uploadErr } = await supabase.storage
        .from('generated-images')
        .upload(storagePath, blob, {
          contentType: blob.type || 'image/png',
          upsert: true,
        });

      if (uploadErr) {
        logger.warn('[CometApiService] Storage upload warning:', uploadErr.message);
        if (base64Data) {
          return base64Data;
        }
        if (blob) {
          try {
            const { blobToDataURL } = await import('../history/HistoryService');
            return await blobToDataURL(blob);
          } catch {}
        }
        return imageUrl;
      }

      // 3. Get public URL
      const { data: publicData } = supabase.storage
        .from('generated-images')
        .getPublicUrl(storagePath);

      const permanentUrl = publicData.publicUrl;
      logger.log('[CometApiService] Successfully archived to Supabase Storage:', permanentUrl);

      // 4. Upsert row into replicate_predictions for dashboard / vault sync
      try {
        const isValidUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
        await supabase.from('replicate_predictions').upsert({
          replicate_id: taskId,
          user_id: isValidUuid(finalUserId) ? finalUserId : null,
          node_id: finalNodeId,
          workflow_id: metadata.workflowId || null,
          model: metadata.model || 'mj-turbo-upscale',
          prompt: metadata.prompt || 'Midjourney Turbo Upscale',
          status: 'completed',
          output_url: permanentUrl,
          storage_url: permanentUrl,
          completed_at: new Date().toISOString(),
          metadata: {
            provider: 'cometapi',
            source_url: imageUrl,
          },
        }, { onConflict: 'replicate_id' });
      } catch (dbErr) {
        logger.warn('[CometApiService] replicate_predictions upsert notice:', dbErr);
      }

      return permanentUrl;
    } catch (err) {
      logger.warn('[CometApiService] saveImageToSupabaseStorage error, falling back to local base64:', err);
      if (base64Data) return base64Data;
      if (blob) {
        try {
          const { blobToDataURL } = await import('../history/HistoryService');
          return await blobToDataURL(blob);
        } catch {}
      }
      return imageUrl;
    }
  }

  /**
   * Submit a Midjourney imagine task with Webhook notification to Supabase
   */
  public async submitMidjourneyImagine(
    prompt: string,
    options?: {
      userId?: string;
      nodeId?: string;
      workflowId?: string;
      model?: string;
      notifyHook?: string;
      state?: string;
      prompt?: string;
    }
  ): Promise<string> {
    const apiKey = this.getApiKey();
    const url = `${this.baseUrl.replace(/\/v1$/, '')}/mj/submit/imagine`;
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    };

    const webhookUrl = options?.notifyHook || this.getWebhookUrl({
      userId: options?.userId,
      nodeId: options?.nodeId,
      workflowId: options?.workflowId,
      model: options?.model || 'midjourney',
      prompt,
    });

    const statePayload = options?.state || JSON.stringify({
      userId: options?.userId || getCurrentUserId(),
      nodeId: options?.nodeId || 'canvas-node',
      workflowId: options?.workflowId,
      model: options?.model || 'midjourney',
      prompt: prompt.slice(0, 500),
    });

    const body: Record<string, any> = {
      prompt,
      notifyHook: webhookUrl,
      hookUrl: webhookUrl,
      state: statePayload,
    };

    logger.log('[CometApiService] Submitting Midjourney Imagine with webhook:', {
      url,
      notifyHook: webhookUrl,
      userId: options?.userId,
      nodeId: options?.nodeId,
    });

    let data: any = await this.tauriPost(url, headers, body);
    if (!data) {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      data = await res.json().catch(() => ({}));
      if (!res.ok || (data.code !== 1 && !data.result)) {
        throw new Error(data.description || data.error?.message || `Midjourney Imagine failed (HTTP ${res.status})`);
      }
    } else {
      if (data.code !== 1 && !data.result) {
        throw new Error(data.description || data.error?.message || `Midjourney Imagine failed`);
      }
    }

    return String(data.result);
  }

  /**
   * Submit an upscale button action (U1, U2, U3, U4, or customId) with Webhook notification
   */
  public async submitMidjourneyAction(
    customId: string,
    taskId: string,
    options?: {
      userId?: string;
      nodeId?: string;
      workflowId?: string;
      model?: string;
      notifyHook?: string;
      state?: string;
    }
  ): Promise<string> {
    const apiKey = this.getApiKey();
    const url = `${this.baseUrl.replace(/\/v1$/, '')}/mj/submit/action`;
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    };

    const webhookUrl = options?.notifyHook || this.getWebhookUrl({
      userId: options?.userId,
      nodeId: options?.nodeId,
      workflowId: options?.workflowId,
      model: options?.model || 'mj-turbo-upscale',
      prompt: 'Midjourney Turbo Upscale',
    });

    const statePayload = options?.state || JSON.stringify({
      userId: options?.userId || getCurrentUserId(),
      nodeId: options?.nodeId || 'canvas-node',
      workflowId: options?.workflowId,
      model: options?.model || 'mj-turbo-upscale',
      taskId,
      customId,
    });

    const body: Record<string, any> = {
      customId,
      taskId,
      notifyHook: webhookUrl,
      hookUrl: webhookUrl,
      state: statePayload,
    };

    logger.log('[CometApiService] Submitting Midjourney Action with webhook:', {
      customId,
      taskId,
      notifyHook: webhookUrl,
    });

    let data: any = await this.tauriPost(url, headers, body);
    if (!data) {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      data = await res.json().catch(() => ({}));
      if (!res.ok || (data.code !== 1 && !data.result)) {
        throw new Error(data.description || data.error?.message || `Midjourney Action failed (HTTP ${res.status})`);
      }
    } else {
      if (data.code !== 1 && !data.result) {
        throw new Error(data.description || data.error?.message || `Midjourney Action failed`);
      }
    }

    return String(data.result);
  }

  /**
   * Poll a Midjourney task until completion
   */
  public async pollMidjourneyTask(
    taskId: string,
    timeoutMs = 120000,
    signal?: AbortSignal,
    onStatus?: (status: 'queued' | 'processing') => void
  ): Promise<{ imageUrl: string; taskId: string; buttons?: any[] }> {
    const apiKey = this.getApiKey();
    const startTime = Date.now();
    const url = `${this.baseUrl.replace(/\/v1$/, '')}/mj/task/${taskId}/fetch`;
    const headers = {
      Authorization: `Bearer ${apiKey}`,
    };

    while (Date.now() - startTime < timeoutMs) {
      if (signal?.aborted) {
        throw new Error('Midjourney upscale operation cancelled.');
      }

      try {
        let data: any = await this.tauriGet(url, headers);
        if (!data) {
          const res = await fetch(url, { headers });
          if (res.ok) {
            data = await res.json();
          }
        }

        if (data) {
          if (data.status === 'SUCCESS' && data.imageUrl) {
            return {
              imageUrl: data.imageUrl,
              taskId: data.id,
              buttons: data.buttons || [],
            };
          } else if (data.status === 'FAILED') {
            throw new Error(`Midjourney task failed: ${data.failReason || data.description || 'Unknown error'}`);
          } else if (data.status === 'IN_PROGRESS' || data.status === 'SUBMITTED') {
            onStatus?.('processing');
          }
        }
      } catch (err: any) {
        if (err.message && err.message.includes('Midjourney task failed')) throw err;
      }

      await new Promise((r) => setTimeout(r, 1500));
    }

    throw new Error(`Midjourney task timed out after ${Math.round(timeoutMs / 1000)}s`);
  }

  /**
   * High-level Midjourney Turbo / Fast Upscaler
   */
  public async upscaleImageWithMidjourney(
    image: string,
    options?: {
      taskId?: string;
      customId?: string;
      imageIndex?: number;
      userId?: string;
      nodeId?: string;
      workflowId?: string;
      model?: string;
      prompt?: string;
      signal?: AbortSignal;
      onStatus?: (status: 'queued' | 'processing') => void;
    }
  ): Promise<{ imageUrl: string; width?: number; height?: number }> {
    const rawModel = options?.model || 'midjourney/mj-turbo-upscale';
    const isFast = rawModel.includes('mj-fast') || rawModel.includes('fast');
    const isSubtle = rawModel.includes('subtle');
    const isCreative = rawModel.includes('creative');

    const metaOptions = {
      userId: options?.userId,
      nodeId: options?.nodeId,
      workflowId: options?.workflowId,
      model: rawModel,
    };

    const modelLabel = isCreative
      ? (isFast ? 'Midjourney Fast Upscale Creative' : 'Midjourney Turbo Upscale Creative')
      : isSubtle
      ? (isFast ? 'Midjourney Fast Upscale Subtle' : 'Midjourney Turbo Upscale Subtle')
      : (isFast ? 'Midjourney Fast Upscale' : 'Midjourney Turbo Upscale');

    // Auto-detect taskId from Midjourney image URL if not explicitly supplied
    let targetTaskId = options?.taskId;
    if (!targetTaskId) {
      const match = image.match(/\/mj\/image\/(\d+)/);
      if (match) {
        targetTaskId = match[1];
      }
    }

    // 1. If we already have a previous task and upscale action button, trigger it directly
    if (targetTaskId && options?.customId) {
      options.onStatus?.('queued');
      const actionTaskId = await this.submitMidjourneyAction(options.customId, targetTaskId, metaOptions);
      const result = await this.pollMidjourneyTask(actionTaskId, 120000, options.signal, options.onStatus);
      const storageUrl = await this.saveImageToSupabaseStorage(result.imageUrl, {
        ...metaOptions,
        taskId: result.taskId,
        prompt: modelLabel,
      });
      return { imageUrl: storageUrl };
    }

    // 2. If we have a taskId (or auto-detected from URL), fetch buttons and trigger upscale
    if (targetTaskId) {
      const idx = options?.imageIndex ?? 0;
      const apiKey = this.getApiKey();
      const taskUrl = `${this.baseUrl.replace(/\/v1$/, '')}/mj/task/${targetTaskId}/fetch`;
      const headers = { Authorization: `Bearer ${apiKey}` };
      let taskData: any = await this.tauriGet(taskUrl, headers);
      if (!taskData) {
        const taskRes = await fetch(taskUrl, { headers });
        if (taskRes.ok) taskData = await taskRes.json();
      }

      if (taskData) {
        const buttons = taskData.buttons || [];
        let targetButton: any = null;

        if (isCreative) {
          targetButton = buttons.find((b: any) =>
            b.label?.toLowerCase().includes('creative') || b.customId?.toLowerCase().includes('creative')
          );
        } else if (isSubtle) {
          targetButton = buttons.find((b: any) =>
            b.label?.toLowerCase().includes('subtle') || b.customId?.toLowerCase().includes('subtle')
          );
        }

        // Fallback to U1, U2, ... standard upscale button
        if (!targetButton) {
          targetButton = buttons.find(
            (b: any) => b.label === `U${idx + 1}` || b.customId?.includes(`::upsample::${idx + 1}::`)
          );
        }

        if (targetButton?.customId) {
          options?.onStatus?.('queued');
          const actionTaskId = await this.submitMidjourneyAction(targetButton.customId, targetTaskId, metaOptions);
          const result = await this.pollMidjourneyTask(actionTaskId, 120000, options?.signal, options?.onStatus);
          const storageUrl = await this.saveImageToSupabaseStorage(result.imageUrl, {
            ...metaOptions,
            taskId: result.taskId,
            prompt: modelLabel,
          });
          return { imageUrl: storageUrl };
        }
      }
    }

    // 3. For any direct image URL, submit as image prompt to Midjourney and upscale U1
    options?.onStatus?.('queued');
    const speedFlag = isFast ? '--fast' : '--turbo';
    const userPrompt = (options as any)?.prompt?.trim();
    const prompt = userPrompt
      ? `${image} ${userPrompt} photorealistic ultra-detailed 8k --v 6.1 ${speedFlag}`
      : `${image} photorealistic ultra-detailed 8k high-fidelity upscale --v 6.1 ${speedFlag}`;
    const initialTaskId = await this.submitMidjourneyImagine(prompt, {
      ...metaOptions,
      prompt,
    });
    options?.onStatus?.('processing');
    const initialResult = await this.pollMidjourneyTask(initialTaskId, 120000, options?.signal, options?.onStatus);

    // Now trigger appropriate upscale on the generated grid
    const buttons = initialResult.buttons || [];
    let uButton: any = null;

    if (isCreative) {
      uButton = buttons.find((b: any) =>
        b.label?.toLowerCase().includes('creative') || b.customId?.toLowerCase().includes('creative')
      );
    } else if (isSubtle) {
      uButton = buttons.find((b: any) =>
        b.label?.toLowerCase().includes('subtle') || b.customId?.toLowerCase().includes('subtle')
      );
    }

    if (!uButton) {
      uButton = buttons.find(
        (b: any) => b.label === 'U1' || b.customId?.includes('::upsample::1::')
      );
    }

    if (uButton?.customId) {
      const upscaleTaskId = await this.submitMidjourneyAction(uButton.customId, initialTaskId, metaOptions);
      const finalResult = await this.pollMidjourneyTask(upscaleTaskId, 120000, options?.signal, options?.onStatus);
      const storageUrl = await this.saveImageToSupabaseStorage(finalResult.imageUrl, {
        ...metaOptions,
        taskId: finalResult.taskId,
        prompt: modelLabel,
      });
      return { imageUrl: storageUrl };
    }

    // Fallback to first grid image or full grid
    const fallbackStorageUrl = await this.saveImageToSupabaseStorage(initialResult.imageUrl, {
      ...metaOptions,
      taskId: initialResult.taskId,
      prompt: modelLabel,
    });
    return { imageUrl: fallbackStorageUrl };
  }
}

export const cometApiService = new CometApiService();
