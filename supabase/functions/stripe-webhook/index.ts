// @ts-ignore: Deno ESM import
import Stripe from 'https://esm.sh/stripe@14?target=deno';
// @ts-ignore: Deno ESM import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

declare const Deno: any;

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight from Stripe
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  const signature = req.headers.get('stripe-signature') ?? '';
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error('[stripe-webhook] Invalid signature:', err);
    return new Response('Invalid signature', { status: 400 });
  }

  if (event.type !== 'checkout.session.completed') {
    return new Response('ok', { status: 200 });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  // Guard: only process paid sessions
  if (session.payment_status !== 'paid') {
    return new Response('ok', { status: 200 });
  }

  const userId   = session.metadata?.user_id;
  const credits  = Number(session.metadata?.credits ?? 0);
  const bonus    = Number(session.metadata?.bonus ?? 0);
  const totalCredits = credits + bonus;

  if (!userId || totalCredits <= 0) {
    console.error('[stripe-webhook] Missing metadata', session.metadata);
    return new Response('Missing metadata', { status: 400 });
  }

  // Idempotency & Replay Protection: Call the atomic process_stripe_payment RPC
  const { data: result, error: rpcError } = await supabase.rpc('process_stripe_payment', {
    p_session_id: session.id,
    p_user_id: userId,
    p_credits: totalCredits,
    p_description: `Stripe payment ${session.id} — ${totalCredits} credits`,
    p_amount_usd: (session.amount_total ?? 0) / 100,
    p_package_id: session.metadata?.package_id || 'unknown'
  });

  if (rpcError) {
    console.error('[stripe-webhook] process_stripe_payment RPC failed:', rpcError);
    return new Response('Database operation failed', { status: 500 });
  }

  if (result === 'already_processed') {
    console.log('[stripe-webhook] Already processed (idempotent guard):', session.id);
    return new Response('ok', { status: 200 });
  }

  console.log(`[stripe-webhook] ✅ Atomic credit addition completed for session ${session.id} and user ${userId}`);
  return new Response('ok', { status: 200 });
});
