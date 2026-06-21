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

// Must match CREDIT_PACKAGES in creditService.ts
const PACKAGES: Record<string, { amountCents: number; credits: number; bonus: number; label: string }> = {
  p10:   { amountCents: 1000,   credits: 100,  bonus: 5,    label: '105 Credits' },
  p20:   { amountCents: 2000,   credits: 200,  bonus: 15,   label: '215 Credits' },
  p50:   { amountCents: 5000,   credits: 500,  bonus: 50,   label: '550 Credits' },
  p100:  { amountCents: 10000,  credits: 1000, bonus: 150,  label: '1,150 Credits' },
  p1000: { amountCents: 100000, credits: 10000,bonus: 2000, label: '12,000 Credits' },
};

type PackageResult = { amountCents: number; credits: number; bonus: number; lineLabel: string };

function getCustomBonusPct(usd: number): number {
  if (usd >= 100) return 0.15;
  if (usd >= 50)  return 0.10;
  if (usd >= 20)  return 0.075;
  if (usd >= 5)   return 0.05;
  return 0;
}

function buildCustomPackage(customAmountUsd?: number): PackageResult | null {
  const usd = Number(customAmountUsd ?? 0);
  if (usd < 5) return null;
  const amountCents = Math.round(usd * 100);
  const base        = Math.floor(usd * 10);
  const bonus       = Math.floor(base * getCustomBonusPct(usd));
  const credits     = base + bonus;
  const bonusPart   = bonus > 0 ? ` (+${bonus} bonus)` : '';
  const lineLabel   = `${credits.toLocaleString()} Credits${bonusPart}`;
  return { amountCents, credits, bonus, lineLabel };
}

function buildFixedPackage(packageId: string): PackageResult | null {
  const pkg = PACKAGES[packageId];
  if (!pkg) return null;
  const bonusPart = pkg.bonus > 0 ? ` (+${pkg.bonus} bonus)` : '';
  return {
    amountCents: pkg.amountCents,
    credits:     pkg.credits,
    bonus:       pkg.bonus,
    lineLabel:   `${pkg.label}${bonusPart}`,
  };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify JWT
    const authHeader = req.headers.get('Authorization') ?? '';
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { packageId, customAmountUsd } = await req.json() as {
      packageId: string;
      customAmountUsd?: number;
    };

    let amountCents: number;
    let credits: number;
    let bonus: number;
    let lineLabel: string;

    if (packageId === 'custom') {
      const result = buildCustomPackage(customAmountUsd);
      if (!result) {
        return new Response(JSON.stringify({ error: 'Minimum $5' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      ({ amountCents, credits, bonus, lineLabel } = result);
    } else {
      const result = buildFixedPackage(packageId);
      if (!result) {
        return new Response(JSON.stringify({ error: 'Invalid package' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      ({ amountCents, credits, bonus, lineLabel } = result);
    }

    const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:5173';

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Anarchy AI Credits',
            description: lineLabel,
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      }],
      mode: 'payment',
      customer_email: user.email,
      success_url: `${appUrl}/add-credit?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${appUrl}/add-credit?canceled=true`,
      metadata: {
        user_id:    user.id,
        package_id: packageId,
        credits:    String(credits),
        bonus:      String(bonus),
      },
    });

    // Record pending session in DB
    await supabase.from('stripe_sessions').insert({
      session_id:  session.id,
      user_id:     user.id,
      package_id:  packageId,
      amount_cents: amountCents,
      credits,
      bonus,
      status:      'pending',
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[create-checkout-session]', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
