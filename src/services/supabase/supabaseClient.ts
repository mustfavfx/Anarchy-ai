import { createClient } from '@supabase/supabase-js';

// Retrieve environment variables
const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const rawSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Fallback to production credentials if environment variables are not available
export const supabaseUrl = rawSupabaseUrl && rawSupabaseUrl.trim() !== ''
  ? rawSupabaseUrl
  : 'https://ejzsbkxpqmhpjuqmszvd.supabase.co';

export const supabaseAnonKey = rawSupabaseAnonKey && rawSupabaseAnonKey.trim() !== ''
  ? rawSupabaseAnonKey
  : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqenNia3hwcW1ocGp1cW1zenZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MjEzNjIsImV4cCI6MjA5MzE5NzM2Mn0.lbKXt_BLTNXjTKpmqdPLvU6vC-mWNjbVRYjfSGFVZcc';


// Check if we have valid, non-placeholder keys
export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseUrl !== 'https://placeholder.supabase.co' &&
  supabaseUrl.trim() !== '' &&
  supabaseAnonKey &&
  supabaseAnonKey !== 'placeholder-anon-key' &&
  supabaseAnonKey.trim() !== ''
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
