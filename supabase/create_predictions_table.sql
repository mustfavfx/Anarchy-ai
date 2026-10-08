-- Create replicate_predictions table for tracking AI generation jobs
-- Run this in Supabase SQL Editor

-- 1. Create the table
CREATE TABLE IF NOT EXISTS replicate_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  replicate_id TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  node_id TEXT,
  model TEXT,
  status TEXT DEFAULT 'starting',
  input JSONB,
  output JSONB,
  output_url TEXT,
  storage_url TEXT,
  error TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_replicate_predictions_user_id ON replicate_predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_replicate_predictions_node_id ON replicate_predictions(node_id);
CREATE INDEX IF NOT EXISTS idx_replicate_predictions_status ON replicate_predictions(status);
CREATE INDEX IF NOT EXISTS idx_replicate_predictions_replicate_id ON replicate_predictions(replicate_id);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE replicate_predictions ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies
CREATE POLICY "Users can view own predictions" 
  ON replicate_predictions FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own predictions" 
  ON replicate_predictions FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own predictions" 
  ON replicate_predictions FOR UPDATE 
  USING (auth.uid() = user_id);

-- 5. Enable Realtime
BEGIN;
  -- Drop if exists to avoid conflicts
  DROP PUBLICATION IF EXISTS supabase_realtime;
  -- Create fresh publication
  CREATE PUBLICATION supabase_realtime;
COMMIT;

-- Add table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE replicate_predictions;

-- 6. Create function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 7. Create trigger
DROP TRIGGER IF EXISTS update_replicate_predictions_updated_at ON replicate_predictions;
CREATE TRIGGER update_replicate_predictions_updated_at
  BEFORE UPDATE ON replicate_predictions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Success message
SELECT 'replicate_predictions table created successfully!' as status;
