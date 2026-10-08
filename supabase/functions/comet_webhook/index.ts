// CometAPI Webhook Handler for Supabase
// Receives task completion callbacks from CometAPI (Midjourney Imagine & Upscale)
// Downloads generated image and saves permanently in Supabase Storage: generated-images/${userId}/${nodeId}/${taskId}.${ext}
// Records prediction in replicate_predictions so Realtime updates and Admin Vault automatically work.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('FUNCTION_URL') ?? 'https://ejzsbkxpqmhpjuqmszvd.supabase.co';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? '';

const supabase = createClient(supabaseUrl, supabaseKey);

// Storage bucket name for generated images
const STORAGE_BUCKET = 'generated-images';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function isValidUuid(id: string | null | undefined): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

// Download image from CometAPI URL
async function downloadImage(url: string): Promise<Blob | null> {
  try {
    console.log('[comet-webhook] Downloading image from:', url.substring(0, 80) + '...');
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'image/*,*/*',
      },
    });

    if (!response.ok) {
      console.error('[comet-webhook] Failed to download image:', response.status, response.statusText);
      return null;
    }

    const blob = await response.blob();
    console.log('[comet-webhook] Downloaded image size:', blob.size, 'bytes, type:', blob.type);
    return blob;
  } catch (err) {
    console.error('[comet-webhook] Error downloading image:', err);
    return null;
  }
}

// Ensure the storage bucket exists
async function ensureBucketExists(): Promise<boolean> {
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some((bucket: { name: string }) => bucket.name === STORAGE_BUCKET);

    if (!exists) {
      console.log('[comet-webhook] Creating storage bucket:', STORAGE_BUCKET);
      const { error } = await supabase.storage.createBucket(STORAGE_BUCKET, {
        public: true,
        fileSizeLimit: 20971520, // 20MB limit
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/jpg'],
      });

      if (error) {
        console.error('[comet-webhook] Failed to create bucket:', error);
        return false;
      }
    }
    return true;
  } catch (err) {
    console.error('[comet-webhook] Error checking bucket:', err);
    return false;
  }
}

// Upload blob to Supabase Storage: ${userId}/${nodeId}/${taskId}.${ext}
async function uploadToStorage(
  blob: Blob,
  userId: string,
  nodeId: string,
  taskId: string
): Promise<string | null> {
  try {
    let ext = 'png';
    if (blob.type.includes('webp')) {
      ext = 'webp';
    } else if (blob.type.includes('jpeg') || blob.type.includes('jpg')) {
      ext = 'jpg';
    }

    const path = `${userId}/${nodeId}/${taskId}.${ext}`;
    console.log('[comet-webhook] Uploading to storage path:', path);

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, blob, {
        contentType: blob.type || 'image/png',
        upsert: true,
      });

    if (error) {
      console.error('[comet-webhook] Storage upload error:', error);
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(path);

    console.log('[comet-webhook] Uploaded successfully, public URL:', publicUrlData.publicUrl);
    return publicUrlData.publicUrl;
  } catch (err) {
    console.error('[comet-webhook] Error uploading to storage:', err);
    return null;
  }
}

interface CometWebhookPayload {
  id?: string | number;
  taskId?: string | number;
  action?: string;
  status?: string;
  progress?: string;
  imageUrl?: string;
  prompt?: string;
  promptEn?: string;
  description?: string;
  state?: string;
  failReason?: string;
  error?: any;
  buttons?: any[];
  [key: string]: any;
}

Deno.serve(async (req: Request) => {
  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Handle health check GET
  if (req.method === 'GET') {
    return new Response(JSON.stringify({ status: 'ok', service: 'comet_webhook' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    let payload: CometWebhookPayload = {};
    if (rawBody && rawBody.trim()) {
      try {
        payload = JSON.parse(rawBody);
      } catch (parseErr) {
        console.error('[comet-webhook] Failed to parse body as JSON:', parseErr);
        payload = {};
      }
    }

    // Try parsing state if passed as JSON string
    let stateMeta: any = {};
    if (typeof payload.state === 'string' && payload.state.trim().startsWith('{')) {
      try {
        stateMeta = JSON.parse(payload.state);
      } catch {}
    }

    // Extract query parameters & fallback to state metadata
    const url = new URL(req.url);
    const node_id = url.searchParams.get('node_id') || stateMeta.nodeId || stateMeta.node_id || 'canvas-node';
    const user_id = url.searchParams.get('user_id') || stateMeta.userId || stateMeta.user_id || 'default_user';
    const workflow_id = url.searchParams.get('workflow_id') || stateMeta.workflowId || stateMeta.workflow_id || null;
    const model = url.searchParams.get('model') || stateMeta.model || (payload.action === 'UPSCALE' ? 'mj-turbo-upscale' : 'midjourney');
    const urlPrompt = url.searchParams.get('prompt');
    const prompt = urlPrompt || stateMeta.prompt || payload.prompt || payload.description || 'Midjourney generation';

    const taskId = String(payload.id || payload.taskId || Date.now());
    const imageUrl = payload.imageUrl || payload.output || (payload.data && payload.data.imageUrl);

    console.log('[comet-webhook] Received task callback:', {
      taskId,
      status: payload.status,
      action: payload.action,
      node_id,
      user_id,
      model,
      hasImageUrl: !!imageUrl,
    });

    // Map CometAPI status to standardized database status
    const rawStatus = (payload.status || '').toUpperCase();
    const isSuccess = rawStatus === 'SUCCESS' || rawStatus === 'COMPLETED' || rawStatus === 'SUCCEEDED';
    const isFailed = rawStatus === 'FAILURE' || rawStatus === 'FAILED';
    const dbStatus = isSuccess ? 'completed' : isFailed ? 'failed' : 'processing';

    // Safe UUID check for database foreign key constraint
    const dbUserId = isValidUuid(user_id) ? user_id : null;

    // 1. Initial upsert to register task in replicate_predictions
    const { error: upsertError } = await supabase.from('replicate_predictions').upsert({
      replicate_id: taskId,
      user_id: dbUserId,
      node_id,
      workflow_id,
      model,
      prompt,
      input: { prompt, taskId, action: payload.action },
      status: dbStatus,
      created_at: new Date().toISOString(),
      metadata: {
        provider: 'cometapi',
        action: payload.action,
        progress: payload.progress,
        buttons: payload.buttons,
        raw_user_id: user_id,
      },
    }, { onConflict: 'replicate_id' });

    if (upsertError) {
      console.error('[comet-webhook] Failed to upsert prediction record:', upsertError);
    }

    let finalStorageUrl: string | null = null;

    // 2. Process image on SUCCESS
    if (isSuccess && imageUrl) {
      const bucketReady = await ensureBucketExists();
      if (!bucketReady) {
        console.warn('[comet-webhook] Storage bucket could not be verified, will record external URL');
      }

      const imageBlob = await downloadImage(imageUrl);
      if (imageBlob) {
        finalStorageUrl = await uploadToStorage(imageBlob, user_id, node_id, taskId);
      }

      const activeUrl = finalStorageUrl || imageUrl;

      await supabase.from('replicate_predictions').update({
        status: 'completed',
        output_url: activeUrl,
        storage_url: finalStorageUrl,
        prompt: prompt,
        completed_at: new Date().toISOString(),
      }).eq('replicate_id', taskId);

      console.log(`[comet-webhook] ✅ Task ${taskId} finished and saved to storage: ${activeUrl}`);
    } else if (isFailed) {
      await supabase.from('replicate_predictions').update({
        status: 'failed',
        error: payload.failReason || payload.error || 'CometAPI Midjourney task failed',
        completed_at: new Date().toISOString(),
      }).eq('replicate_id', taskId);

      console.error(`[comet-webhook] ❌ Task ${taskId} failed:`, payload.failReason || payload.error);
    }

    return new Response(
      JSON.stringify({
        received: true,
        id: taskId,
        status: dbStatus,
        storage_url: finalStorageUrl,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    console.error('[comet-webhook] Unhandled exception:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
