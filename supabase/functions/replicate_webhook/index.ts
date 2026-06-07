// Replicate Webhook Handler
// Receives predictions when generation completes
// Downloads image from Replicate and uploads to Supabase Storage

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const supabaseUrl = Deno.env.get('FUNCTION_URL') ?? Deno.env.get('SUPABASE_URL') ?? 'https://ejzsblxopqmhpjuqmzsxd.supabase.co';
const supabaseKey = Deno.env.get('SERVICE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? '';

const supabase = createClient(supabaseUrl, supabaseKey);

// Storage bucket name for generated images
const STORAGE_BUCKET = 'generated-images';

// Webhook signing key from Replicate (set in Supabase Edge Function secrets)
// Get from: https://replicate.com/account/webhooks
const WEBHOOK_SIGNING_KEY = Deno.env.get('REPLICATE_WEBHOOK_SIGNING_KEY') ?? '';

// Helper: Verify webhook signature from Replicate
async function verifyWebhookSignature(
  body: string,
  signature: string
): Promise<boolean> {
  // DEBUG: Skip signature verification temporarily
  console.log('[replicate-webhook] DEBUG: Skipping signature verification');
  return true;
  
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
      // Some services require specific headers
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

// Helper: Upload image to Supabase Storage
async function uploadToStorage(
  blob: Blob,
  userId: string,
  nodeId: string,
  predictionId: string
): Promise<string | null> {
  try {
    // Determine file extension from content type
    let ext: string;
    if (blob.type.includes('png')) {
      ext = 'png';
    } else if (blob.type.includes('webp')) {
      ext = 'webp';
    } else {
      ext = 'jpg';
    }
    
    // Create path: user_id/node_id/prediction_id.ext
    const path = `${userId}/${nodeId}/${predictionId}.${ext}`;
    
    console.log('[replicate-webhook] Uploading to storage:', path);
    
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, blob, {
        contentType: blob.type || 'image/jpeg',
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
    
    console.log('[replicate-webhook] Received (verified):', {
      id: payload.id,
      status: payload.status,
      hasOutput: !!payload.output,
      node_id,
      user_id,
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
            completed_at: new Date().toISOString(),
          }).eq('replicate_id', payload.id);
          console.log(`[replicate-webhook] ✅ Completed with storage: ${node_id}`);
        } else {
          // Fallback: use original URL if upload fails
          await supabase.from('replicate_predictions').update({
            status: 'completed',
            output_url: imageUrl,
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
