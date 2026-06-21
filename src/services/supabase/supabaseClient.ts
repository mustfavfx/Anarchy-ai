import { createClient } from '@supabase/supabase-js';

// Retrieve environment variables
const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const rawSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Fallback to production credentials if environment variables are not available
export const supabaseUrl = rawSupabaseUrl && rawSupabaseUrl.trim() !== ''
  ? rawSupabaseUrl
  : 'https://placeholder.supabase.co';

export const supabaseAnonKey = rawSupabaseAnonKey && rawSupabaseAnonKey.trim() !== ''
  ? rawSupabaseAnonKey
  : 'placeholder-anon-key';


// Check if we have valid, non-placeholder keys
export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseUrl !== 'https://placeholder.supabase.co' &&
  supabaseAnonKey &&
  supabaseAnonKey !== 'placeholder-anon-key'
);

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
