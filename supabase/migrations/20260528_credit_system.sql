-- ============================================================
-- Anarchy AI — Credit System Tables
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. user_credits
CREATE TABLE IF NOT EXISTS public.user_credits (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance          integer NOT NULL DEFAULT 0,
  total_purchased  integer NOT NULL DEFAULT 0,
  total_used       integer NOT NULL DEFAULT 0,
  last_purchase_at timestamptz,
  expires_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- 2. credit_transactions
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type         text NOT NULL CHECK (type IN ('purchase','usage','refund','bonus')),
  amount       integer NOT NULL,
  balance_after integer NOT NULL,
  description  text NOT NULL DEFAULT '',
  metadata     jsonb NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- 3. usage_events  
CREATE TABLE IF NOT EXISTS public.usage_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  credits    integer NOT NULL DEFAULT 0,
  metadata   jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id       ON public.user_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON public.credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created ON public.credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_user_id        ON public.usage_events(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_created        ON public.usage_events(created_at DESC);

-- ── Auto-update updated_at ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_credits_updated_at ON public.user_credits;
CREATE TRIGGER trg_user_credits_updated_at
  BEFORE UPDATE ON public.user_credits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS (Row Level Security) ───────────────────────────────
ALTER TABLE public.user_credits        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_events        ENABLE ROW LEVEL SECURITY;

-- Users can only see/edit their own rows
CREATE POLICY "user_credits_self" ON public.user_credits
  USING (auth.uid() = user_id);

CREATE POLICY "credit_transactions_self" ON public.credit_transactions
  USING (auth.uid() = user_id);

CREATE POLICY "usage_events_self" ON public.usage_events
  USING (auth.uid() = user_id);

-- ── RPC: add_credits (atomic) ──────────────────────────────
CREATE OR REPLACE FUNCTION public.add_credits(p_user_id uuid, p_credits integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_credits (user_id, balance, total_purchased)
    VALUES (p_user_id, p_credits, p_credits)
  ON CONFLICT (user_id) DO UPDATE SET
    balance         = public.user_credits.balance + p_credits,
    total_purchased = public.user_credits.total_purchased + p_credits,
    last_purchase_at = now(),
    updated_at      = now();
END;
$$;
