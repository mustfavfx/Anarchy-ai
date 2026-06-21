-- ============================================================
-- Anarchy AI — Replicate Pipeline & Credit System Hardening
-- Migration Date: 2026-06-19
-- ============================================================

-- 1. Drop insecure client-side policies on replicate_predictions (if they exist)
-- Force all inserts and updates to go through the Edge Function (service_role)
DROP POLICY IF EXISTS "Users can insert own predictions" ON public.replicate_predictions;
DROP POLICY IF EXISTS "Users can update own predictions" ON public.replicate_predictions;

-- 2. Drop insecure client-side INSERT policy on credit_transactions
-- Makes transaction history read-only for clients, preventing log tampering
DROP POLICY IF EXISTS "credit_transactions_insert_self" ON public.credit_transactions;

-- 3. Harden add_credits RPC to automatically write transactions
DROP FUNCTION IF EXISTS public.add_credits(uuid, integer);

CREATE OR REPLACE FUNCTION public.add_credits(
  p_user_id uuid,
  p_credits integer,
  p_description text DEFAULT 'bonus'
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_balance integer;
BEGIN
  -- Insert or update user credit balance
  INSERT INTO public.user_credits (user_id, balance, total_purchased)
    VALUES (p_user_id, p_credits, p_credits)
  ON CONFLICT (user_id) DO UPDATE SET
    balance         = public.user_credits.balance + p_credits,
    total_purchased = public.user_credits.total_purchased + p_credits,
    last_purchase_at = now(),
    updated_at      = now();

  -- Get updated balance
  SELECT balance INTO v_balance FROM public.user_credits WHERE user_id = p_user_id;

  -- Log transaction server-side
  INSERT INTO public.credit_transactions (user_id, type, amount, balance_after, description, metadata)
  VALUES (
    p_user_id,
    'bonus',
    p_credits,
    v_balance,
    COALESCE(p_description, 'bonus'),
    '{}'::jsonb
  );
END;
$$;

-- 4. Harden deduct_credits RPC to automatically write transactions
DROP FUNCTION IF EXISTS public.deduct_credits(uuid, integer);

CREATE OR REPLACE FUNCTION public.deduct_credits(
  p_user_id uuid,
  p_amount integer,
  p_description text DEFAULT 'usage'
)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_balance integer;
BEGIN
  -- Obtain transactional lock on the balance record
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

  -- Update balance
  UPDATE public.user_credits
  SET balance = balance - p_amount,
      total_used = total_used + p_amount,
      updated_at = now()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_balance;

  -- Atomically log transaction server-side
  INSERT INTO public.credit_transactions (user_id, type, amount, balance_after, description, metadata)
  VALUES (
    p_user_id,
    'usage',
    -p_amount,
    v_balance,
    COALESCE(p_description, 'usage'),
    '{}'::jsonb
  );

  RETURN v_balance;
END;
$$;

-- 5. Harden refund_credits RPC to automatically write transactions
DROP FUNCTION IF EXISTS public.refund_credits(uuid, integer);

CREATE OR REPLACE FUNCTION public.refund_credits(
  p_user_id uuid,
  p_amount integer,
  p_description text DEFAULT 'refund'
)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_balance integer;
BEGIN
  -- Verify record exists or create if not
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

  -- Select current balance
  SELECT balance INTO v_balance FROM public.user_credits WHERE user_id = p_user_id;

  -- Atomically log transaction server-side
  INSERT INTO public.credit_transactions (user_id, type, amount, balance_after, description, metadata)
  VALUES (
    p_user_id,
    'refund',
    p_amount,
    v_balance,
    COALESCE(p_description, 'refund'),
    '{}'::jsonb
  );

  RETURN v_balance;
END;
$$;
