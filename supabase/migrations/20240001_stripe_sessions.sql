-- Stripe checkout sessions tracking
CREATE TABLE IF NOT EXISTS public.stripe_sessions (
  id              BIGSERIAL PRIMARY KEY,
  session_id      TEXT NOT NULL UNIQUE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_id      TEXT NOT NULL,
  amount_cents    INTEGER NOT NULL,
  credits         INTEGER NOT NULL,
  bonus           INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_stripe_sessions_user_id   ON public.stripe_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_stripe_sessions_session_id ON public.stripe_sessions(session_id);

-- RLS: users can only see their own sessions
ALTER TABLE public.stripe_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions"
  ON public.stripe_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can do everything (for webhook)
CREATE POLICY "Service role full access"
  ON public.stripe_sessions FOR ALL
  USING (auth.role() = 'service_role');

-- Credit transactions table (if not exists)
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK (type IN ('purchase', 'usage', 'refund', 'bonus')),
  amount       INTEGER NOT NULL,
  description  TEXT,
  metadata     JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON public.credit_transactions(user_id);

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions"
  ON public.credit_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on transactions"
  ON public.credit_transactions FOR ALL
  USING (auth.role() = 'service_role');
