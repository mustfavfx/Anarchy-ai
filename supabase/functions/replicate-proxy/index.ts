/**
 * Supabase Edge Function: replicate-proxy
 * Proxies requests to Replicate API, injecting the secret API key server-side.
 * The client never sees REPLICATE_API_TOKEN.
 *
 * Deploy: supabase functions deploy replicate-proxy --no-verify-jwt
 * Env:    supabase secrets set REPLICATE_API_TOKEN=r8_...
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const REPLICATE_BASE = 'https://api.replicate.com/v1';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-replicate-path, x-replicate-method',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req: Request) => {
  // Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  const apiKey = Deno.env.get('REPLICATE_API_TOKEN');
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'REPLICATE_API_TOKEN not configured on server' }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }

  // The client passes the Replicate sub-path via header: e.g. "/models/google/nano-banana-2/predictions"
  const replicatePath = req.headers.get('x-replicate-path') ?? '';
  const method        = req.headers.get('x-replicate-method') ?? req.method;

  const targetUrl = `${REPLICATE_BASE}${replicatePath}`;

  const body = method !== 'GET' ? await req.text() : undefined;

  const upstreamRes = await fetch(targetUrl, {
    method,
    headers: {
      'Authorization': `Token ${apiKey}`,
      'Content-Type':  'application/json',
      'Prefer':        'wait=5',
    },
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
