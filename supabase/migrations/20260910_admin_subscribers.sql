-- ==============================================================================
-- Anarchy AI — Admin Subscribers & Revenue Aggregator
-- Run this script in your Supabase Dashboard > SQL Editor
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_admin_subscribers()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  caller_email text;
  result jsonb;
BEGIN
  -- 1. Security check: Allow service_role key OR authorized admin accounts
  caller_email := auth.jwt() ->> 'email';
  
  IF coalesce(auth.jwt() ->> 'role', '') != 'service_role' 
     AND (caller_email IS NULL OR caller_email NOT IN ('mustfahusham979@gmail.com', 'anarchy.lat@gmail.com')) THEN
    RAISE EXCEPTION 'Access denied: User % is not authorized as an administrator.', coalesce(caller_email, 'anonymous');
  END IF;

  -- 2. Build aggregated stats and subscriber rows
  SELECT jsonb_build_object(
    'stats', jsonb_build_object(
      'total_users', (SELECT count(*) FROM auth.users),
      'paying_users', (
        SELECT count(DISTINCT user_id) 
        FROM public.stripe_sessions 
        WHERE status = 'completed'
      ),
      'total_revenue_usd', coalesce((
        SELECT round((sum(amount_cents) / 100.0)::numeric, 2)
        FROM public.stripe_sessions 
        WHERE status = 'completed'
      ), 0),
      'total_credits_balance', coalesce((
        SELECT sum(balance) 
        FROM public.user_credits
      ), 0),
      'total_credits_purchased', coalesce((
        SELECT sum(total_purchased) 
        FROM public.user_credits
      ), 0),
      'total_credits_used', coalesce((
        SELECT sum(total_used) 
        FROM public.user_credits
      ), 0)
    ),
    'subscribers', (
      SELECT coalesce(
        jsonb_agg(
          jsonb_build_object(
            'user_id', sub.user_id,
            'email', sub.email,
            'created_at', sub.created_at,
            'last_sign_in_at', sub.last_sign_in_at,
            'balance', sub.balance,
            'total_purchased', sub.total_purchased,
            'total_used', sub.total_used,
            'total_paid_usd', sub.total_paid_usd,
            'payments_count', sub.payments_count,
            'last_purchase_at', sub.last_purchase_at
          )
          ORDER BY sub.total_paid_usd DESC, sub.created_at DESC
        ),
        '[]'::jsonb
      )
      FROM (
        SELECT 
          u.id AS user_id,
          coalesce(u.email, 'No email') AS email,
          u.created_at,
          u.last_sign_in_at,
          coalesce(c.balance, 0) AS balance,
          coalesce(c.total_purchased, 0) AS total_purchased,
          coalesce(c.total_used, 0) AS total_used,
          coalesce(round((sum(s.amount_cents) / 100.0)::numeric, 2), 0) AS total_paid_usd,
          count(s.id) FILTER (WHERE s.status = 'completed') AS payments_count,
          coalesce(max(s.completed_at), c.last_purchase_at) AS last_purchase_at
        FROM auth.users u
        LEFT JOIN public.user_credits c ON c.user_id = u.id
        LEFT JOIN public.stripe_sessions s ON s.user_id = u.id AND s.status = 'completed'
        GROUP BY u.id, u.email, u.created_at, u.last_sign_in_at, c.balance, c.total_purchased, c.total_used, c.last_purchase_at
      ) sub
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- Grant execution permission to authenticated users (security check inside function protects it)
GRANT EXECUTE ON FUNCTION public.get_admin_subscribers() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_subscribers() TO service_role;
