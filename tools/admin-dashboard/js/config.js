// Anarchy AI Admin Dashboard - Configuration & Shared State
// Supabase Configuration
    const SUPABASE_URL = 'https://ejzsbkxpqmhpjuqmszvd.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqenNia3hwcW1ocGp1cW1zenZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MjEzNjIsImV4cCI6MjA5MzE5NzM2Mn0.lbKXt_BLTNXjTKpmqdPLvU6vC-mWNjbVRYjfSGFVZcc';
    
    let activeClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    let rawData = null;
    let currentFilter = 'all';

// Vault State Variables
let cachedVaultFiles = [];
let currentVaultUser = 'all';
let currentVaultModel = 'all';
let currentVaultType = 'all';
let currentLightboxItem = null;
let currentPromptModalItem = null;
let isVaultLoading = false;
window.vaultPredictionsMap = new Map();
window.vaultTransactionsMap = new Map();
window.currentUserModalFiles = [];

const STORAGE_SQL_SCRIPT = `-- ==============================================================================
-- Anarchy AI — Admin Storage Media & Production Explorer
-- Run this script in your Supabase Dashboard > SQL Editor
-- ==============================================================================

-- 1. Function to retrieve all generated images & videos across users (with model & prompt joins)
CREATE OR REPLACE FUNCTION public.get_admin_storage_media(p_user_id text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage, auth
AS $$
DECLARE
  caller_email text;
  caller_role text;
  result jsonb;
BEGIN
  caller_email := auth.jwt() ->> 'email';
  caller_role := coalesce(auth.jwt() ->> 'role', '');
  
  IF caller_role != 'service_role' 
     AND (caller_email IS NULL OR caller_email NOT IN ('mustfahusham979@gmail.com', 'anarchy.lat@gmail.com')) THEN
    RAISE EXCEPTION 'Access denied: User % is not authorized as an administrator.', coalesce(caller_email, 'anonymous');
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', o.id,
        'bucket_id', o.bucket_id,
        'name', o.name,
        'created_at', o.created_at,
        'updated_at', o.updated_at,
        'size', coalesce((o.metadata ->> 'size')::bigint, 0),
        'mimetype', coalesce(o.metadata ->> 'mimetype', 'image/jpeg'),
        'model', rp.model,
        'prompt', coalesce(rp.prompt, rp.input ->> 'prompt'),
        'input', rp.input,
        'credits_used', coalesce(rp.credits_used, abs(ct.amount))
      )
      ORDER BY o.created_at DESC
    ),
    '[]'::jsonb
  ) INTO result
  FROM storage.objects o
  LEFT JOIN public.replicate_predictions rp 
    ON (rp.replicate_id = split_part(split_part(o.name, '/', 3), '.', 1) 
        OR rp.node_id = split_part(o.name, '/', 2))
  LEFT JOIN public.credit_transactions ct
    ON (ct.metadata ->> 'replicate_id' = rp.replicate_id 
        OR ct.metadata ->> 'node_id' = rp.node_id)
  WHERE o.bucket_id = 'generated-images'
    AND (
      p_user_id IS NULL 
      OR p_user_id = '' 
      OR p_user_id = 'all' 
      OR o.name LIKE (p_user_id || '/%')
      OR o.name = p_user_id
    );

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_storage_media(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_storage_media(text) TO service_role;

-- 2. Function to retrieve predictions for admin bypassing RLS
CREATE OR REPLACE FUNCTION public.get_admin_predictions(p_limit integer DEFAULT 5000)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  caller_email text;
  caller_role text;
  result jsonb;
BEGIN
  caller_email := auth.jwt() ->> 'email';
  caller_role := coalesce(auth.jwt() ->> 'role', '');
  
  IF caller_role != 'service_role' 
     AND (caller_email IS NULL OR caller_email NOT IN ('mustfahusham979@gmail.com', 'anarchy.lat@gmail.com')) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', rp.id,
        'replicate_id', rp.replicate_id,
        'node_id', rp.node_id,
        'user_id', rp.user_id,
        'model', rp.model,
        'prompt', rp.prompt,
        'input', rp.input,
        'status', rp.status,
        'credits_used', rp.credits_used,
        'created_at', rp.created_at
      )
      ORDER BY rp.created_at DESC
    ),
    '[]'::jsonb
  ) INTO result
  FROM public.replicate_predictions rp
  LIMIT coalesce(p_limit, 5000);

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_predictions(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_predictions(integer) TO service_role;

-- 3. Function to delete a media file by admin
CREATE OR REPLACE FUNCTION public.delete_admin_storage_file(p_file_path text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage, auth
AS $$
DECLARE
  caller_email text;
  caller_role text;
BEGIN
  caller_email := auth.jwt() ->> 'email';
  caller_role := coalesce(auth.jwt() ->> 'role', '');
  
  IF caller_role != 'service_role' 
     AND (caller_email IS NULL OR caller_email NOT IN ('mustfahusham979@gmail.com', 'anarchy.lat@gmail.com')) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  DELETE FROM storage.objects
  WHERE bucket_id = 'generated-images' AND name = p_file_path;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_admin_storage_file(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_admin_storage_file(text) TO service_role;

-- 4. Enable Storage RLS & Admin Read Access Policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
      AND tablename = 'objects' 
      AND policyname = 'Admin Full Access To generated-images'
  ) THEN
    CREATE POLICY "Admin Full Access To generated-images" 
      ON storage.objects 
      FOR ALL 
      TO authenticated 
      USING (bucket_id = 'generated-images');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'replicate_predictions' 
      AND policyname = 'Admin Read Access To replicate_predictions'
  ) THEN
    CREATE POLICY "Admin Read Access To replicate_predictions" 
      ON public.replicate_predictions 
      FOR SELECT 
      TO authenticated 
      USING (auth.jwt() ->> 'email' IN ('mustfahusham979@gmail.com', 'anarchy.lat@gmail.com'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'credit_transactions' 
      AND policyname = 'Admin Read Access To credit_transactions'
  ) THEN
    CREATE POLICY "Admin Read Access To credit_transactions" 
      ON public.credit_transactions 
      FOR SELECT 
      TO authenticated 
      USING (auth.jwt() ->> 'email' IN ('mustfahusham979@gmail.com', 'anarchy.lat@gmail.com'));
  END IF;
END $$;
`;

