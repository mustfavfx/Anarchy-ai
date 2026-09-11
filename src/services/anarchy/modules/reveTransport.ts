import { invoke } from '@tauri-apps/api/core';
import { logger } from '../../../utils/logger';
import type { AnarchyPrediction } from './anarchyTypes';

export function getApiKey(): string {
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

let lastReveApiCallTime = 0;

export async function throttleReveApiCall(): Promise<void> {
  const now = Date.now();
  const minDelay = 4500; // 4.5s delay guard between API requests
  const elapsed = now - lastReveApiCallTime;
  if (elapsed < minDelay) {
    const waitMs = minDelay - elapsed;
    logger.log(`[AnarchyService] Throttling API request by ${waitMs}ms to respect rate limits...`);
    await new Promise(res => setTimeout(res, waitMs));
  }
  lastReveApiCallTime = Date.now();
}

/**
 * Run prediction on Reve AI
 */
export async function runRevePrediction(
  input: Record<string, any>,
  _signal?: AbortSignal,
  onStatusChange?: (status: 'queued' | 'processing', predictionId?: string) => void
): Promise<AnarchyPrediction> {
  let apiKey = '';
  try {
    apiKey = getApiKey();
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

  await throttleReveApiCall();

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
      await throttleReveApiCall();
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
