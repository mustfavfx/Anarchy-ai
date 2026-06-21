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

-- Ensure all columns exist for existing tables (backwards compatibility upgrades)
ALTER TABLE public.user_credits ADD COLUMN IF NOT EXISTS balance integer NOT NULL DEFAULT 0;
ALTER TABLE public.user_credits ADD COLUMN IF NOT EXISTS total_purchased integer NOT NULL DEFAULT 0;
ALTER TABLE public.user_credits ADD COLUMN IF NOT EXISTS total_used integer NOT NULL DEFAULT 0;
ALTER TABLE public.user_credits ADD COLUMN IF NOT EXISTS last_purchase_at timestamptz;
ALTER TABLE public.user_credits ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE public.user_credits ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.user_credits ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.credit_transactions ADD COLUMN IF NOT EXISTS balance_after integer NOT NULL DEFAULT 0;
ALTER TABLE public.credit_transactions ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';
ALTER TABLE public.credit_transactions ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}';



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

-- Restrict RLS to SELECT only for users; updates and inserts must go through restricted API controls
CREATE POLICY "user_credits_select_self" ON public.user_credits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_credits_insert_self" ON public.user_credits
  FOR INSERT WITH CHECK (auth.uid() = user_id AND balance = 0 AND total_purchased = 0 AND total_used = 0);

CREATE POLICY "credit_transactions_select_self" ON public.credit_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "credit_transactions_insert_self" ON public.credit_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "usage_events_select_self" ON public.usage_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "usage_events_insert_self" ON public.usage_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── Drop Old Functions ─────────────────────────────────────
DROP FUNCTION IF EXISTS public.add_credits(uuid, integer);
DROP FUNCTION IF EXISTS public.deduct_credits(uuid, integer);
DROP FUNCTION IF EXISTS public.refund_credits(uuid, integer);

-- ── RPC: add_credits (atomic) ──────────────────────────────
CREATE OR REPLACE FUNCTION public.add_credits(p_user_id uuid, p_credits integer, p_description text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_balance integer;
BEGIN
  INSERT INTO public.user_credits (user_id, balance, total_purchased)
    VALUES (p_user_id, p_credits, p_credits)
  ON CONFLICT (user_id) DO UPDATE SET
    balance         = public.user_credits.balance + p_credits,
    total_purchased = public.user_credits.total_purchased + p_credits,
    last_purchase_at = now(),
    updated_at      = now()
  RETURNING balance INTO v_balance;

  INSERT INTO public.credit_transactions (user_id, type, amount, balance_after, description)
  VALUES (p_user_id, 'purchase', p_credits, v_balance, p_description);
END;
$$;

-- ── RPC: deduct_credits (atomic with transaction lock) ─────────────────────
CREATE OR REPLACE FUNCTION public.deduct_credits(p_user_id uuid, p_amount integer, p_description text DEFAULT '')
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_balance integer;
BEGIN
  SELECT balance INTO v_balance
  FROM public.user_credits
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'User credit record not found';
  END IF;

  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient credits';
  END IF;

  UPDATE public.user_credits
  SET balance = balance - p_amount,
      total_used = total_used + p_amount,
      updated_at = now()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_balance;

  INSERT INTO public.credit_transactions (user_id, type, amount, balance_after, description)
  VALUES (p_user_id, 'usage', -p_amount, v_balance, p_description);

  RETURN v_balance;
END;
$$;

-- ── RPC: refund_credits (atomic) ───────────────────────────
CREATE OR REPLACE FUNCTION public.refund_credits(p_user_id uuid, p_amount integer, p_description text DEFAULT '')
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_balance integer;
BEGIN
  -- Verify record exists
  IF NOT EXISTS (SELECT 1 FROM public.user_credits WHERE user_id = p_user_id) THEN
    INSERT INTO public.user_credits (user_id, balance, total_purchased, total_used)
    VALUES (p_user_id, p_amount, 0, 0);
  ELSE
    UPDATE public.user_credits
    SET balance = balance + p_amount,
        total_used = GREATEST(0, total_used - p_amount),
        updated_at = now()
    WHERE user_id = p_user_id;
  END IF;

  SELECT balance INTO v_balance FROM public.user_credits WHERE user_id = p_user_id;

  INSERT INTO public.credit_transactions (user_id, type, amount, balance_after, description)
  VALUES (p_user_id, 'refund', p_amount, v_balance, p_description);

  RETURN v_balance;
END;
$$;

