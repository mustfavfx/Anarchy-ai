-- Replicate Predictions Tracking Table
-- Stores prediction metadata for webhook handling

CREATE TABLE IF NOT EXISTS public.replicate_predictions (
  id              BIGSERIAL PRIMARY KEY,
  replicate_id    TEXT NOT NULL UNIQUE,      -- Replicate prediction ID
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  node_id         TEXT NOT NULL,              -- Builder node ID
  workflow_id     TEXT,                       -- Optional workflow ID
  model           TEXT NOT NULL,
  prompt          TEXT,
  status          TEXT NOT NULL DEFAULT 'pending' 
                  CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'canceled')),
  output_url      TEXT,                       -- Generated image/video URL (from Replicate - temporary)
  storage_url     TEXT,                       -- Permanent URL from Supabase Storage
  error           TEXT,                       -- Error message if failed
  credits_used    INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}'
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_replicate_predictions_user_id 
  ON public.replicate_predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_replicate_predictions_node_id 
  ON public.replicate_predictions(node_id);
CREATE INDEX IF NOT EXISTS idx_replicate_predictions_status 
  ON public.replicate_predictions(status);
CREATE INDEX IF NOT EXISTS idx_replicate_predictions_replicate_id 
  ON public.replicate_predictions(replicate_id);

-- RLS: Users can only see their own predictions
ALTER TABLE public.replicate_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own predictions"
  ON public.replicate_predictions FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can manage all (for webhook)
CREATE POLICY "Service role full access"
  ON public.replicate_predictions FOR ALL
  USING (auth.role() = 'service_role');

-- Function to get user's active predictions count
CREATE OR REPLACE FUNCTION public.get_active_predictions_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*) 
    FROM public.replicate_predictions 
    WHERE user_id = p_user_id 
    AND status IN ('pending', 'processing')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Storage bucket for generated images
-- Note: This should be created via Supabase Dashboard or Storage API
-- The webhook function will auto-create it if it doesn't exist
-- 
-- Manual creation via SQL (if needed):
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES (
--   'generated-images',
--   'generated-images',
--   true,
--   10485760, -- 10MB
--   ARRAY['image/png', 'image/jpeg', 'image/webp']
-- )
-- ON CONFLICT (id) DO NOTHING;
