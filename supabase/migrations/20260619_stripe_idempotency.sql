-- ============================================================
-- Anarchy AI — Stripe Webhook Idempotency & Replay Protection
-- public.process_stripe_payment RPC Function
-- ============================================================

CREATE OR REPLACE FUNCTION public.process_stripe_payment(
  p_session_id TEXT,
  p_user_id UUID,
  p_credits INTEGER,
  p_description TEXT,
  p_amount_usd NUMERIC,
  p_package_id TEXT
)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_status TEXT;
  v_balance_after INTEGER;
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
