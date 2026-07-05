-- ============================================================
-- Anarchy AI — Support Decimal Credits & 35% Margin Scale
-- Migration to convert credit fields from INTEGER to NUMERIC(12, 2)
-- And update corresponding RPC functions.
-- ============================================================

-- 1. Alter table columns to NUMERIC(12, 2)
ALTER TABLE public.user_credits 
  ALTER COLUMN balance TYPE NUMERIC(12, 2) USING balance::NUMERIC(12, 2),
  ALTER COLUMN total_purchased TYPE NUMERIC(12, 2) USING total_purchased::NUMERIC(12, 2),
  ALTER COLUMN total_used TYPE NUMERIC(12, 2) USING total_used::NUMERIC(12, 2);

ALTER TABLE public.credit_transactions 
  ALTER COLUMN amount TYPE NUMERIC(12, 2) USING amount::NUMERIC(12, 2),
  ALTER COLUMN balance_after TYPE NUMERIC(12, 2) USING balance_after::NUMERIC(12, 2);

-- ALTER TABLE public.usage_events 
--   ALTER COLUMN credits TYPE NUMERIC(12, 2) USING credits::NUMERIC(12, 2);

ALTER TABLE public.stripe_sessions 
  ALTER COLUMN credits TYPE NUMERIC(12, 2) USING credits::NUMERIC(12, 2),
  ALTER COLUMN bonus TYPE NUMERIC(12, 2) USING bonus::NUMERIC(12, 2);

-- Alter balance column default value to 20.00 for new signups
ALTER TABLE public.user_credits ALTER COLUMN balance SET DEFAULT 20.00;

-- Update RLS insert policy for user_credits to require balance = 20.00, total_purchased = 0.00, total_used = 0.00
DROP POLICY IF EXISTS "user_credits_insert_self" ON public.user_credits;
CREATE POLICY "user_credits_insert_self" ON public.user_credits
  FOR INSERT WITH CHECK (auth.uid() = user_id AND balance = 20.00 AND total_purchased = 0.00 AND total_used = 0.00);

-- 2. Drop old integer-based functions
DROP FUNCTION IF EXISTS public.add_credits(uuid, integer, text);
DROP FUNCTION IF EXISTS public.deduct_credits(uuid, integer, text);
DROP FUNCTION IF EXISTS public.refund_credits(uuid, integer, text);
DROP FUNCTION IF EXISTS public.process_stripe_payment(text, uuid, integer, text, numeric, text);

-- 3. Create new numeric-based functions

-- RPC: add_credits (atomic with numeric)
CREATE OR REPLACE FUNCTION public.add_credits(p_user_id uuid, p_credits numeric, p_description text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_balance numeric(12, 2);
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

-- RPC: deduct_credits (atomic with numeric)
CREATE OR REPLACE FUNCTION public.deduct_credits(p_user_id uuid, p_amount numeric, p_description text DEFAULT '')
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_balance numeric(12, 2);
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

-- RPC: refund_credits (atomic with numeric)
CREATE OR REPLACE FUNCTION public.refund_credits(p_user_id uuid, p_amount numeric, p_description text DEFAULT '')
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_balance numeric(12, 2);
BEGIN
  -- Verify record exists
  IF NOT EXISTS (SELECT 1 FROM public.user_credits WHERE user_id = p_user_id) THEN
    INSERT INTO public.user_credits (user_id, balance, total_purchased, total_used)
    VALUES (p_user_id, p_amount, 0, 0);
  ELSE
    UPDATE public.user_credits
    SET balance = balance + p_amount,
        total_used = GREATEST(0.00, total_used - p_amount),
        updated_at = now()
    WHERE user_id = p_user_id;
  END IF;

  SELECT balance INTO v_balance FROM public.user_credits WHERE user_id = p_user_id;

  INSERT INTO public.credit_transactions (user_id, type, amount, balance_after, description)
  VALUES (p_user_id, 'refund', p_amount, v_balance, p_description);

  RETURN v_balance;
END;
$$;

-- RPC: process_stripe_payment (atomic with numeric)
CREATE OR REPLACE FUNCTION public.process_stripe_payment(
  p_session_id TEXT,
  p_user_id UUID,
  p_credits NUMERIC,
  p_description TEXT,
  p_amount_usd NUMERIC,
  p_package_id TEXT
)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_status TEXT;
  v_balance_after NUMERIC(12, 2);
BEGIN
  -- 1. Lock the session row to prevent any concurrent execution/replay attacks
  SELECT status INTO v_status
  FROM public.stripe_sessions
  WHERE session_id = p_session_id
  FOR UPDATE;

  -- 2. If session doesn't exist, insert it as pending first (handling webhooks fast-path)
  IF v_status IS NULL THEN
    INSERT INTO public.stripe_sessions (session_id, user_id, package_id, amount_cents, credits, bonus, status)
    VALUES (
      p_session_id, 
      p_user_id, 
      COALESCE(p_package_id, 'unknown'), 
      (p_amount_usd * 100)::integer, 
      p_credits, 
      0, 
      'pending'
    )
    ON CONFLICT (session_id) DO NOTHING;
    
    -- Re-select with lock
    SELECT status INTO v_status
    FROM public.stripe_sessions
    WHERE session_id = p_session_id
    FOR UPDATE;
  END IF;

  -- 3. If already processed, return early and do not modify credits
  IF v_status = 'completed' THEN
    RETURN 'already_processed';
  END IF;

  -- 4. Add credits to the user_credits table atomically
  INSERT INTO public.user_credits (user_id, balance, total_purchased)
    VALUES (p_user_id, p_credits, p_credits)
  ON CONFLICT (user_id) DO UPDATE SET
    balance         = public.user_credits.balance + p_credits,
    total_purchased = public.user_credits.total_purchased + p_credits,
    last_purchase_at = now(),
    updated_at      = now();

  -- 5. Fetch balance_after to log in transaction
  SELECT balance INTO v_balance_after
  FROM public.user_credits
  WHERE user_id = p_user_id;

  -- 6. Record credit transaction
  INSERT INTO public.credit_transactions (user_id, type, amount, balance_after, description, metadata)
  VALUES (
    p_user_id,
    'purchase',
    p_credits,
    COALESCE(v_balance_after, p_credits),
    p_description,
    jsonb_build_object(
      'stripe_session_id', p_session_id,
      'amount_usd', p_amount_usd,
      'package_id', p_package_id
    )
  );

  -- 7. Mark session as completed
  UPDATE public.stripe_sessions
  SET status = 'completed', completed_at = now()
  WHERE session_id = p_session_id;

  RETURN 'success';
END;
$$;
