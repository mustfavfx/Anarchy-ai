import { logger } from '../../../utils/logger';
import { supabaseAnonKey, supabaseUrl } from '../../supabase/supabaseClient';
import type { ReplicatePrediction } from './replicateTypes';

// ── Supabase proxy URL ───────────────────────────────────────────────────────
export function getProxyUrl(): string {
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
export async function proxyPost(
  proxyUrl: string,
  replicatePath: string,
  body: unknown,
  signal?: AbortSignal
): Promise<ReplicatePrediction> {
  const anonKey = supabaseAnonKey;
  const res = await fetch(proxyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': anonKey,
      'Authorization': `Bearer ${anonKey}`,
      'x-replicate-path': replicatePath,
      'x-replicate-method': 'POST',
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(`Proxy ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function proxyGet(
  proxyUrl: string,
  replicatePath: string,
  signal?: AbortSignal
): Promise<ReplicatePrediction> {
  const anonKey = supabaseAnonKey;
  const res = await fetch(proxyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': anonKey,
      'Authorization': `Bearer ${anonKey}`,
      'x-replicate-path': replicatePath,
      'x-replicate-method': 'GET',
    },
    signal,
  });
  if (!res.ok) throw new Error(`Proxy ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── Upload a base64 data URI to Replicate Files API via proxy ──────────────
export async function uploadToReplicate(dataUri: string): Promise<string> {
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
      'apikey': anonKey,
      'Authorization': `Bearer ${anonKey}`,
      'x-replicate-path': '/files',
      'x-replicate-method': 'POST',
    },
    body: formData,
  });
  if (!res.ok) throw new Error(`Replicate upload via proxy failed: ${res.status} - ${await res.text()}`);
  const json = await res.json();
  return json.urls?.get || json.url;
}

// ── Poll a prediction until SUCCEEDED or FAILED ──────────────────────────────
export async function pollPrediction(
  predictionId: string,
  signal?: AbortSignal,
  onStatusChange?: (status: 'queued' | 'processing', predictionId?: string) => void
): Promise<ReplicatePrediction> {
  const proxy = getProxyUrl();
  const path = `/predictions/${predictionId}`;
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
