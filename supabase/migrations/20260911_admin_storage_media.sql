-- ==============================================================================
-- Anarchy AI — Admin Storage Media & Production Explorer
-- Run this script in your Supabase Dashboard > SQL Editor
-- ==============================================================================

-- 1. Function to retrieve all generated images & videos across users
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
  -- Security check: Allow service_role key OR authorized admin accounts
  caller_email := auth.jwt() ->> 'email';
  caller_role := coalesce(auth.jwt() ->> 'role', '');
  
  IF caller_role != 'service_role' 
     AND (caller_email IS NULL OR caller_email NOT IN ('mustfahusham979@gmail.com', 'anarchy.lat@gmail.com')) THEN
    RAISE EXCEPTION 'Access denied: User % is not authorized as an administrator.', coalesce(caller_email, 'anonymous');
  END IF;

  -- Query storage.objects directly with metadata
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', o.id,
        'bucket_id', o.bucket_id,
        'name', o.name,
        'created_at', o.created_at,
        'updated_at', o.updated_at,
        'size', coalesce((o.metadata ->> 'size')::bigint, 0),
        'mimetype', coalesce(o.metadata ->> 'mimetype', 'image/jpeg')
      )
      ORDER BY o.created_at DESC
    ),
    '[]'::jsonb
  ) INTO result
  FROM storage.objects o
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

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.get_admin_storage_media(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_storage_media(text) TO service_role;

-- 2. Function to delete a media file by admin
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

-- 3. Enable Storage RLS policy so standard storage listing works as well
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
END $$;
