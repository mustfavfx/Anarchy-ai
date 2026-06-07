import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

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

Deno.serve(async (req) => {
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

  // Idempotency: check if already processed
  const { data: existing } = await supabase
    .from('stripe_sessions')
    .select('status')
    .eq('session_id', session.id)
    .single();

  if (existing?.status === 'completed') {
    console.log('[stripe-webhook] Already processed:', session.id);
    return new Response('ok', { status: 200 });
  }

  // Add credits via RPC
  const { error: rpcError } = await supabase.rpc('add_credits', {
    p_user_id: userId,
    p_credits: totalCredits,
  });

  if (rpcError) {
    console.error('[stripe-webhook] add_credits RPC failed:', rpcError);
    // Fallback: direct update
    const { data: creditRow } = await supabase
      .from('user_credits')
      .select('balance, total_purchased')
      .eq('user_id', userId)
      .single();

    if (creditRow) {
      await supabase
        .from('user_credits')
        .update({
          balance:         creditRow.balance + totalCredits,
          total_purchased: creditRow.total_purchased + totalCredits,
          last_purchase_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
    }
  }

  // Record transaction
  await supabase.from('credit_transactions').insert({
    user_id:     userId,
    type:        'purchase',
    amount:      totalCredits,
    description: `Stripe payment ${session.id} — ${totalCredits} credits`,
    metadata: {
      stripe_session_id: session.id,
      amount_usd: (session.amount_total ?? 0) / 100,
      package_id: session.metadata?.package_id,
    },
  });

  // Mark session completed
  await supabase
    .from('stripe_sessions')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('session_id', session.id);

  console.log(`[stripe-webhook] ✅ Added ${totalCredits} credits to user ${userId}`);
  return new Response('ok', { status: 200 });
});
