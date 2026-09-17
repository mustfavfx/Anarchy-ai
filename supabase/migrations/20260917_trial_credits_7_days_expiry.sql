-- ============================================================
-- Anarchy AI — 20 Free Trial Credits Valid for 7 Days
-- Automatically expire unconsumed trial credits after 7 days
-- ============================================================

-- 1. Default balance = 20.00 and expires_at = now() + 7 days
ALTER TABLE public.user_credits ALTER COLUMN balance SET DEFAULT 20.00;
ALTER TABLE public.user_credits ALTER COLUMN expires_at SET DEFAULT (now() + interval '7 days');

-- 2. Backfill existing users: assign 7-day expiry from creation date if missing
UPDATE public.user_credits
SET expires_at = created_at + interval '7 days'
WHERE total_purchased = 0 AND expires_at IS NULL;

-- 3. Zero out credits for anyone who subscribed or registered more than 7 days ago
UPDATE public.user_credits
SET balance = 0.00,
    expires_at = COALESCE(expires_at, created_at + interval '7 days'),
    updated_at = now()
WHERE total_purchased = 0
  AND (
    created_at < (now() - interval '7 days')
    OR (expires_at IS NOT NULL AND expires_at < now())
  )
  AND balance > 0;

-- Also cross-reference auth.users creation date: zero out if user joined > 7 days ago
UPDATE public.user_credits c
SET balance = 0.00,
    expires_at = COALESCE(c.expires_at, u.created_at + interval '7 days'),
    updated_at = now()
FROM auth.users u
WHERE c.user_id = u.id
  AND c.total_purchased = 0
  AND u.created_at < (now() - interval '7 days')
  AND c.balance > 0;

-- 4. Update deduct_credits RPC to enforce 7-day expiration for trial users
CREATE OR REPLACE FUNCTION public.deduct_credits(p_user_id uuid, p_amount numeric, p_description text DEFAULT '')
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_balance numeric(12, 2);
  v_total_purchased numeric(12, 2);
  v_expires_at timestamptz;
BEGIN
  -- Read current credit status
  SELECT balance, total_purchased, expires_at 
  INTO v_balance, v_total_purchased, v_expires_at 
  FROM public.user_credits 
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User credit record not found';
  END IF;

  -- Enforce 7-day trial expiration
  IF v_total_purchased = 0 AND v_expires_at IS NOT NULL AND v_expires_at < now() THEN
    UPDATE public.user_credits
    SET balance = 0, updated_at = now()
    WHERE user_id = p_user_id;
    RAISE EXCEPTION 'Trial credits expired (7 days)';
  END IF;

  -- Check sufficiency
  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient credit balance (needed %, available %)', p_amount, v_balance;
  END IF;

  -- Deduct atomically
  UPDATE public.user_credits
  SET balance = balance - p_amount,
      total_used = total_used + p_amount,
      updated_at = now()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_balance;

  -- Record transaction
  INSERT INTO public.credit_transactions (user_id, type, amount, balance_after, description)
  VALUES (p_user_id, 'usage', -p_amount, v_balance, p_description);

  RETURN v_balance;
END;
$$;

-- 5. Helper function to periodically expire unconsumed trial credits
CREATE OR REPLACE FUNCTION public.expire_unconsumed_trial_credits()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count integer;
BEGIN
  WITH expired_rows AS (
    UPDATE public.user_credits
    SET balance = 0.00, updated_at = now()
    WHERE total_purchased = 0
      AND expires_at IS NOT NULL
      AND expires_at < now()
      AND balance > 0
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM expired_rows;
  
  RETURN v_count;
END;
$$;
