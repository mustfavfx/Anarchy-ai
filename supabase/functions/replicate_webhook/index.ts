// Replicate Webhook Handler
// Receives predictions when generation completes
// Downloads image from Replicate, compresses it, and uploads to Cloudflare R2 / Supabase Storage

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';
import { Image } from 'https://deno.land/x/imagescript@v1.3.0/mod.ts';
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20';

const supabaseUrl = Deno.env.get('FUNCTION_URL') ?? Deno.env.get('SUPABASE_URL') ?? 'https://ejzsbkxpqmhpjuqmszvd.supabase.co';
const supabaseKey = Deno.env.get('SERVICE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? '';

const supabase = createClient(supabaseUrl, supabaseKey);

// Storage bucket name for generated images
const STORAGE_BUCKET = 'generated-images';

// Webhook signing key from Replicate (set in Supabase Edge Function secrets)
// Get from: https://replicate.com/account/webhooks
const WEBHOOK_SIGNING_KEY = Deno.env.get('REPLICATE_WEBHOOK_SIGNING_KEY') ?? '';

// Cloudflare R2 Configuration (Optional - if set, uploads directly to R2)
const R2_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_R2_ACCOUNT_ID') || Deno.env.get('R2_ACCOUNT_ID') || '';
const R2_ACCESS_KEY_ID = Deno.env.get('CLOUDFLARE_R2_ACCESS_KEY_ID') || Deno.env.get('R2_ACCESS_KEY_ID') || '';
const R2_SECRET_ACCESS_KEY = Deno.env.get('CLOUDFLARE_R2_SECRET_ACCESS_KEY') || Deno.env.get('R2_SECRET_ACCESS_KEY') || '';
const R2_BUCKET = Deno.env.get('CLOUDFLARE_R2_BUCKET') || Deno.env.get('R2_BUCKET') || 'anarchy-images';
const R2_PUBLIC_DOMAIN = Deno.env.get('CLOUDFLARE_R2_PUBLIC_DOMAIN') || Deno.env.get('R2_PUBLIC_DOMAIN') || '';

// Helper: Verify webhook signature from Replicate
async function verifyWebhookSignature(
  body: string,
  signature: string
): Promise<boolean> {

  if (!WEBHOOK_SIGNING_KEY) {
    console.warn('[replicate-webhook] No signing key configured, skipping verification');
    return true; // Allow in development if no key set
  }

  try {
    // Replicate uses HMAC-SHA256 with the signing key
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(WEBHOOK_SIGNING_KEY),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const expectedSig = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(body)
    );

    // Convert to hex string for comparison
    const expectedSigHex = Array.from(new Uint8Array(expectedSig))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Replicate signatures are prefixed with "sha256="
    const providedSig = signature.replace('sha256=', '');

    // Constant-time comparison to prevent timing attacks
    if (expectedSigHex.length !== providedSig.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < expectedSigHex.length; i++) {
      result |= expectedSigHex.charCodeAt(i) ^ providedSig.charCodeAt(i);
    }

    return result === 0;
  } catch (err) {
    console.error('[replicate-webhook] Signature verification error:', err);
    return false;
  }
}

// Helper: Download image from URL and return as Blob
async function downloadImage(url: string): Promise<Blob | null> {
  try {
    console.log('[replicate-webhook] Downloading image from:', url.substring(0, 60) + '...');
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'image/*,*/*',
      },
    });
    
    if (!response.ok) {
      console.error('[replicate-webhook] Failed to download image:', response.status, response.statusText);
      return null;
    }
    
    const blob = await response.blob();
    console.log('[replicate-webhook] Downloaded image size:', blob.size, 'bytes, type:', blob.type);
    return blob;
  } catch (err) {
    console.error('[replicate-webhook] Error downloading image:', err);
    return null;
  }
}

// Helper: Compress image to JPEG (quality 82) to reduce size by ~80%
async function compressImageIfNeeded(
  rawBlob: Blob,
  targetQuality = 82
): Promise<{ blob: Blob; ext: string; contentType: string }> {
  const type = (rawBlob.type || '').toLowerCase();

  // If video or svg, do not process with ImageScript
  if (type.includes('video') || type.includes('mp4') || type.includes('webm') || type.includes('svg')) {
    const ext = type.includes('mp4') ? 'mp4' : (type.includes('webm') ? 'webm' : 'bin');
    return { blob: rawBlob, ext, contentType: rawBlob.type };
  }

  // If already WebP and reasonably sized (under 750 KB), keep as is
  if (type.includes('webp') && rawBlob.size <= 750 * 1024) {
    return { blob: rawBlob, ext: 'webp', contentType: 'image/webp' };
  }

  try {
    const originalSizeKb = (rawBlob.size / 1024).toFixed(1);
    console.log(`[replicate-webhook] Compressing image (Original: ${originalSizeKb} KB, Type: ${type})...`);

    const arrayBuffer = await rawBlob.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    // Decode image
    const image = await Image.decode(uint8);

    // Resize if excessive resolution (e.g. over 2048px on longest side)
    const MAX_DIM = 2048;
    if (image.width > MAX_DIM || image.height > MAX_DIM) {
      if (image.width >= image.height) {
        image.resize(MAX_DIM, Image.RESIZE_AUTO);
      } else {
        image.resize(Image.RESIZE_AUTO, MAX_DIM);
      }
    }

    // Encode as high-quality compressed JPEG (quality 82 provides crystal clarity with 75-90% reduction from PNG)
    const compressedBytes = await image.encodeJPEG(targetQuality);
    const compressedBlob = new Blob([compressedBytes], { type: 'image/jpeg' });
    const compressedSizeKb = (compressedBlob.size / 1024).toFixed(1);
    const savedPercent = (((rawBlob.size - compressedBlob.size) / rawBlob.size) * 100).toFixed(1);

    console.log(`[replicate-webhook] ✅ Compression done: ${originalSizeKb} KB -> ${compressedSizeKb} KB (Saved ${savedPercent}%)`);
    return { blob: compressedBlob, ext: 'jpg', contentType: 'image/jpeg' };
  } catch (err) {
    console.warn('[replicate-webhook] ⚠️ Compression failed, fallback to original:', err);
    let fallbackExt = 'jpg';
    if (type.includes('png')) fallbackExt = 'png';
    else if (type.includes('webp')) fallbackExt = 'webp';
    return { blob: rawBlob, ext: fallbackExt, contentType: rawBlob.type || 'image/jpeg' };
  }
}

// Helper: Upload to Cloudflare R2
async function uploadToCloudflareR2(
  blob: Blob,
  path: string,
  contentType: string
): Promise<string | null> {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    return null;
  }

  try {
    const aws = new AwsClient({
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
      service: 's3',
      region: 'auto',
    });

    const endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${path}`;
    const res = await aws.fetch(endpoint, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      body: blob,
    });

    if (!res.ok) {
      console.error('[replicate-webhook] R2 upload failed with status:', res.status, await res.text());
      return null;
    }

    if (R2_PUBLIC_DOMAIN) {
      const base = R2_PUBLIC_DOMAIN.endsWith('/') ? R2_PUBLIC_DOMAIN.slice(0, -1) : R2_PUBLIC_DOMAIN;
      return `${base}/${path}`;
    }

    return `https://${R2_BUCKET}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${path}`;
  } catch (err) {
    console.error('[replicate-webhook] R2 upload exception:', err);
    return null;
  }
}

// Helper: Upload image to Cloudflare R2 or Supabase Storage
async function uploadToStorage(
  rawBlob: Blob,
  userId: string,
  nodeId: string,
  predictionId: string
): Promise<string | null> {
  try {
    // 1. Compress image if needed
    const { blob, ext, contentType } = await compressImageIfNeeded(rawBlob);

    // Create path: user_id/node_id/prediction_id.ext
    const path = `${userId}/${nodeId}/${predictionId}.${ext}`;

    // 2. Check if Cloudflare R2 is configured
    if (R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY) {
      console.log('[replicate-webhook] Uploading to Cloudflare R2:', path);
      const r2Url = await uploadToCloudflareR2(blob, path, contentType);
      if (r2Url) {
        console.log('[replicate-webhook] Uploaded to R2 successfully:', r2Url);
        return r2Url;
      }
      console.warn('[replicate-webhook] R2 upload failed, falling back to Supabase Storage...');
    }

    // 3. Fallback: Upload to Supabase Storage
    console.log('[replicate-webhook] Uploading to Supabase Storage:', path);
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, blob, {
        contentType,
        upsert: true,
      });

    if (error) {
      console.error('[replicate-webhook] Storage upload error:', error);
      return null;
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(path);

    console.log('[replicate-webhook] Uploaded successfully, public URL:', publicUrlData.publicUrl.substring(0, 60) + '...');
    return publicUrlData.publicUrl;
  } catch (err) {
    console.error('[replicate-webhook] Error uploading to storage:', err);
    return null;
  }
}

// Helper: Ensure storage bucket exists
async function ensureBucketExists(): Promise<boolean> {
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some((bucket: { name: string }) => bucket.name === STORAGE_BUCKET);
    
    if (!exists) {
      console.log('[replicate-webhook] Creating storage bucket:', STORAGE_BUCKET);
      const { error } = await supabase.storage.createBucket(STORAGE_BUCKET, {
        public: true,
        fileSizeLimit: 10485760, // 10MB limit
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/jpg'],
      });
      
      if (error) {
        console.error('[replicate-webhook] Failed to create bucket:', error);
        return false;
      }
    }
    return true;
  } catch (err) {
    console.error('[replicate-webhook] Error checking bucket:', err);
    return false;
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
};

interface ReplicateWebhookPayload {
  id: string;
  status: 'succeeded' | 'failed' | 'canceled' | 'processing';
  output?: string | string[];
  error?: string;
  input?: {
    prompt?: string;
    [key: string]: any;
  };
  // Custom metadata we send with prediction
  metadata?: {
    node_id?: string;
    user_id?: string;
    workflow_id?: string;
    app?: string;
    [key: string]: any;
  };
  webhook_events_filter?: string[];
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only accept POST
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    // Get raw body for signature verification
    const rawBody = await req.text();
    
    // Verify webhook signature
    const signature = req.headers.get('Replicate-Signature') ?? '';
    const isValid = await verifyWebhookSignature(rawBody, signature);
    
    if (!isValid) {
      console.error('[replicate-webhook] Invalid signature');
      return new Response('Invalid signature', { status: 401, headers: corsHeaders });
    }
    
    // Parse the body after verification
    const payload = JSON.parse(rawBody) as ReplicateWebhookPayload;
    
    // Extract node_id and user_id from URL query parameters
    // (Replicate API doesn't support metadata, so we encode them in webhook URL)
    const url = new URL(req.url);
    const node_id = url.searchParams.get('node_id');
    const user_id = url.searchParams.get('user_id');
    const workflow_id = url.searchParams.get('workflow_id');
    const model = url.searchParams.get('model') || 'unknown';
    const urlPrompt = url.searchParams.get('prompt') || null;
    const prompt = urlPrompt || payload.input?.prompt || (typeof payload.input?.prompt_template === 'string' ? payload.input?.prompt_template : null) || null;
    
    console.log('[replicate-webhook] Received (verified):', {
      id: payload.id,
      status: payload.status,
      hasOutput: !!payload.output,
      node_id,
      user_id,
      model,
      hasPrompt: !!prompt,
    });

    if (!node_id || !user_id) {
      console.error('[replicate-webhook] Missing node_id or user_id in query params:', req.url);
      return new Response('Missing node_id or user_id', { status: 400, headers: corsHeaders });
    }

    // Upsert prediction record (insert or update)
    const { error: upsertError } = await supabase.from('replicate_predictions').upsert({
      replicate_id: payload.id,
      user_id,
      node_id,
      workflow_id,
      model,
      prompt,
      input: payload.input || (prompt ? { prompt } : null),
      status: payload.status,
      created_at: new Date().toISOString(),
    }, { onConflict: 'replicate_id' });

    if (upsertError) {
      console.error('[replicate-webhook] Failed to upsert prediction:', upsertError);
    }

    // Handle different statuses
    if (payload.status === 'succeeded') {
      // Extract image URL from output
      let imageUrl: string | null = null;
      
      if (typeof payload.output === 'string') {
        imageUrl = payload.output;
      } else if (Array.isArray(payload.output) && payload.output.length > 0) {
        imageUrl = payload.output[0];
      }

      if (!imageUrl) {
        console.error('[replicate-webhook] No output URL:', payload);
        return new Response('No output', { status: 400, headers: corsHeaders });
      }

      // Ensure storage bucket exists
      const bucketReady = await ensureBucketExists();
      if (!bucketReady) {
        console.error('[replicate-webhook] Storage bucket not ready');
        return new Response('Storage error', { status: 500, headers: corsHeaders });
      }

      // Download image from Replicate (temporary URL)
      const imageBlob = await downloadImage(imageUrl);
      if (!imageBlob) {
        console.error('[replicate-webhook] Failed to download image');
        // Still mark as completed but with original URL as fallback
        await supabase.from('replicate_predictions').update({
          status: 'completed',
          output_url: imageUrl,
          prompt: prompt,
          completed_at: new Date().toISOString(),
        }).eq('replicate_id', payload.id);
        console.log(`[replicate-webhook] ⚠️ Completed (no storage): ${node_id}`);
      } else {
        // Upload to Supabase Storage
        const permanentUrl = await uploadToStorage(imageBlob, user_id, node_id, payload.id);
        
        if (permanentUrl) {
          // Update with permanent Supabase Storage URL
          await supabase.from('replicate_predictions').update({
            status: 'completed',
            output_url: permanentUrl,
            storage_url: permanentUrl,
            prompt: prompt,
            completed_at: new Date().toISOString(),
          }).eq('replicate_id', payload.id);
          console.log(`[replicate-webhook] ✅ Completed with storage: ${node_id}`);
        } else {
          // Fallback: use original URL if upload fails
          await supabase.from('replicate_predictions').update({
            status: 'completed',
            output_url: imageUrl,
            prompt: prompt,
            completed_at: new Date().toISOString(),
          }).eq('replicate_id', payload.id);
          console.log(`[replicate-webhook] ⚠️ Completed (upload failed): ${node_id}`);
        }
      }

    } else if (payload.status === 'failed') {
      await supabase.from('replicate_predictions').update({
        status: 'failed',
        error: payload.error || 'Generation failed',
        completed_at: new Date().toISOString(),
      }).eq('replicate_id', payload.id);

      console.error(`[replicate-webhook] ❌ Failed: ${node_id} - ${payload.error}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[replicate-webhook] Error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
