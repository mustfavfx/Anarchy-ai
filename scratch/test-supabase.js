import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ejzsbkxpqmhpjuqmszvd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqenNia3hwcW1ocGp1cW1zenZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MjEzNjIsImV4cCI6MjA5MzE5NzM2Mn0.lbKXt_BLTNXjTKpmqdPLvU6vC-mWNjbVRYjfSGFVZcc';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log('Testing Supabase connection...');
  try {
    // Try to query any table or read auth config
    const { data: authData, error: authError } = await supabase.auth.getSession();
    console.log('Auth getSession result:', { authData, authError });

    const { data: usageData, error: usageError } = await supabase.from('usage_events').select('*').limit(1);
    console.log('Usage events query result:', { usageData, usageError });
  } catch (err) {
    console.error('Failed to run test:', err);
  }
}

test();
