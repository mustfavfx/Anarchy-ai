import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ejzsbkxpqmhpjuqmszvd.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqenNia3hwcW1ocGp1cW1zenZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MjEzNjIsImV4cCI6MjA5MzE5NzM2Mn0.lbKXt_BLTNXjTKpmqdPLvU6vC-mWNjbVRYjfSGFVZcc';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function run() {
  const { data: rootFolders, error: storageErr } = await supabase.storage
    .from('generated-images')
    .list('', { limit: 20 });
  console.log('storage list root:', JSON.stringify({ rootFolders, storageErr }, null, 2));

  if (rootFolders && rootFolders.length > 0) {
    const firstUserId = rootFolders[0].name;
    const { data: userSubfolders, error: subErr } = await supabase.storage
      .from('generated-images')
      .list(firstUserId, { limit: 10 });
    console.log(`storage subfolders for ${firstUserId}:`, JSON.stringify({ userSubfolders, subErr }, null, 2));
  }
}

run().catch(console.error);
