/**
 * Supabase Edge Function: replicate-proxy
 * Proxies requests to Replicate API, injecting the secret API key server-side.
 * The client never sees REPLICATE_API_TOKEN.
 *
 * Deploy: supabase functions deploy replicate-proxy --no-verify-jwt
 * Env:    supabase secrets set REPLICATE_API_TOKEN=r8_...
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const REPLICATE_BASE = 'https://api.replicate.com/v1';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-replicate-path, x-replicate-method',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_ANON_KEY') ?? '',
);

serve(async (req: Request) => {
  // Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  // Verify JWT
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized: Invalid or missing authentication token' }),
      { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }

  const apiKey = Deno.env.get('REPLICATE_API_TOKEN');
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'REPLICATE_API_TOKEN not configured on server' }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }

  // The client passes the Replicate sub-path via header: e.g. "/models/google/nano-banana-2/predictions"
  let replicatePath = req.headers.get('x-replicate-path') ?? '';
  const method        = req.headers.get('x-replicate-method') ?? req.method;

  // Normalize path to ensure it has a leading slash
  if (replicatePath && !replicatePath.startsWith('/')) {
    replicatePath = `/${replicatePath}`;
  }

  // Intercept warm-up ping requests directly to avoid Replicate 404s
  if (replicatePath === '/ping') {
    return new Response(
      JSON.stringify({ status: 'ok', message: 'proxy is active' }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }

  const targetUrl = `${REPLICATE_BASE}${replicatePath}`;

  // Forward the Content-Type header from client if present, default to application/json
  const contentType = req.headers.get('content-type') || 'application/json';

  const headers = new Headers();
  headers.set('Authorization', `Token ${apiKey}`);
  headers.set('Content-Type', contentType);

  const prefer = req.headers.get('prefer');
  if (prefer) {
    headers.set('prefer', prefer);
  }

  // Read body as arrayBuffer to preserve binary data (e.g. for file uploads)
  let body: ArrayBuffer | undefined = undefined;
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    body = await req.arrayBuffer();
  }

  const upstreamRes = await fetch(targetUrl, {
    method,
    headers,
    body,
  });

  const responseBody = await upstreamRes.text();

  return new Response(responseBody, {
    status:  upstreamRes.status,
    headers: {
      ...CORS,
      'Content-Type': upstreamRes.headers.get('Content-Type') ?? 'application/json',
    },
  });
});
