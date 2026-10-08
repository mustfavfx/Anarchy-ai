/**
 * سكربت تفريغ مساحة Supabase Storage بحذف الملفات والتوليدات القديمة
 * Clean Old Files from Supabase Storage (Freed up ~500 MB)
 *
 * الاستخدام:
 *   node scripts/clean-old-storage.mjs <SERVICE_ROLE_KEY> [TARGET_MB]
 * أو:
 *   $env:SUPABASE_SERVICE_ROLE_KEY="your_service_role_key"
 *   node scripts/clean-old-storage.mjs
 */

import { createClient } from '@supabase/supabase-js';
import * as readline from 'readline';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ejzsbkxpqmhpjuqmszvd.supabase.co';
const DEFAULT_BUCKET = process.env.STORAGE_BUCKET || 'generated-images';

// قراءة مفتاح service_role من المعاملات أو البيئة
let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.argv[2] || '';
let targetMB = parseFloat(process.argv[3] || process.env.TARGET_MB || '500');

function promptUser(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    })
  );
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function main() {
  console.log('========================================================');
  console.log('   🧹 أداة تنظيف مساحة التخزين في Supabase Storage');
  console.log('   Anarchy AI - Storage Auto Cleaner');
  console.log('========================================================\n');

  if (!serviceRoleKey || serviceRoleKey === '--yes') {
    serviceRoleKey = await promptUser('🔑 أدخل مفتاح service_role secret key من Supabase: ');
  }

  if (!serviceRoleKey) {
    console.error('❌ خطأ: مفتاح service_role مطلوب للوصول إلى الملفات وحذفها.');
    console.log('👉 يمكنك نسخه من: Supabase Dashboard > Project Settings > API > service_role (secret)');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, serviceRoleKey, {
    auth: { persistSession: false },
  });

  console.log(`🌐 الاتصال بمشروع: ${SUPABASE_URL}`);
  console.log(`🎯 الهدف: تحرير ${targetMB} ميجابايت من الملفات الأقدم.\n`);

  // 1. التحقق من الـ Buckets المتاحة
  console.log('🔍 جاري استكشاف مستودعات التخزين (Buckets)...');
  const { data: buckets, error: bucketsErr } = await supabase.storage.listBuckets();
  if (bucketsErr) {
    console.error('❌ فشل الاتصال بـ Supabase Storage:', bucketsErr.message);
    process.exit(1);
  }

  const targetBuckets = buckets && buckets.length > 0
    ? buckets.map(b => b.name)
    : [DEFAULT_BUCKET];

  console.log(`📁 المستودعات الموجودة: ${targetBuckets.join(', ')}`);

  // 2. فحص جميع الملفات بشكل تكراري (Recursive Listing)
  const allFiles = [];

  for (const bucket of targetBuckets) {
    console.log(`\n⏳ جاري مسح محتويات المستودع: [${bucket}]...`);
    await scanFolder(supabase, bucket, '', allFiles);
  }

  if (allFiles.length === 0) {
    console.log('⚠️ لم يتم العثور على أي ملفات في التخزين.');
    return;
  }

  // حساب الحجم الإجمالي
  const totalSizeBytes = allFiles.reduce((acc, f) => acc + f.size, 0);
  console.log(`\n📊 إحصائيات المستودع:`);
  console.log(`- إجمالي الملفات المكتشفة: ${allFiles.length} ملف`);
  console.log(`- الحجم الإجمالي المستهلك: ${formatBytes(totalSizeBytes)}`);

  // 3. ترتيب الملفات من الأقدم إلى الأحدث (FIFO)
  allFiles.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // 4. اختيار الملفات المراد حذفها للوصول إلى الحجم المطلوب
  const targetBytes = targetMB * 1024 * 1024;
  let accumulatedBytes = 0;
  const filesToDelete = [];

  for (const file of allFiles) {
    filesToDelete.push(file);
    accumulatedBytes += file.size;
    if (accumulatedBytes >= targetBytes) {
      break;
    }
  }

  const selectedMB = (accumulatedBytes / (1024 * 1024)).toFixed(2);
  console.log(`\n🎯 خطة الحذف المقترحة:`);
  console.log(`- عدد الملفات المرشحة للحذف: ${filesToDelete.length} ملف`);
  console.log(`- المساحة التي سيتم تحريرها: ${selectedMB} MB (${formatBytes(accumulatedBytes)})`);
  console.log(`- أقدم ملف مرشح للحذف: ${filesToDelete[0]?.createdAt} (${filesToDelete[0]?.path})`);
  console.log(`- أحدث ملف مرشح للحذف: ${filesToDelete[filesToDelete.length - 1]?.createdAt}`);

  // طلب تأكيد المستخدم
  const isAutoConfirm = process.argv.includes('--yes') || process.argv.includes('-y');
  if (!isAutoConfirm) {
    const confirm = await promptUser(`\n⚠️ هل أنت متأكد من حذف هذه الملفات نهائياً لتحرير ${selectedMB} MB؟ (اكتب yes للمتابعة): `);
    if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
      console.log('🚫 تم إلغاء العملية بناءً على طلبك.');
      return;
    }
  }

  // 5. تنفيذ الحذف على دفعات (Batches of 50)
  console.log('\n🗑️ جاري حذف الملفات القديمة...');
  const BATCH_SIZE = 50;
  let deletedCount = 0;

  // تجميع حسب الـ Bucket
  const filesByBucket = {};
  for (const file of filesToDelete) {
    if (!filesByBucket[file.bucket]) filesByBucket[file.bucket] = [];
    filesByBucket[file.bucket].push(file.path);
  }

  for (const [bucket, paths] of Object.entries(filesByBucket)) {
    for (let i = 0; i < paths.length; i += BATCH_SIZE) {
      const chunk = paths.slice(i, i + BATCH_SIZE);
      const { error: delErr } = await supabase.storage.from(bucket).remove(chunk);
      if (delErr) {
        console.error(`⚠️ خطأ أثناء حذف دفعة من [${bucket}]:`, delErr.message);
      } else {
        deletedCount += chunk.length;
        process.stdout.write(`\r   تم حذف: ${deletedCount}/${filesToDelete.length} ملف...`);
      }
    }
  }

  console.log(`\n\n🎉 اكتمل الحذف بنجاح!`);
  console.log(`✅ تم حذف ${deletedCount} ملف قديم.`);
  console.log(`💾 تم توفير حوالي ${selectedMB} MB بنجاح.`);
  console.log(`📉 المساحة التقديرية الحالية بعد الحذف: ${formatBytes(Math.max(0, totalSizeBytes - accumulatedBytes))}`);
  console.log('========================================================\n');
}

/**
 * فحص المجلد والملفات تكرارياً
 */
async function scanFolder(supabase, bucket, folderPath, results) {
  const { data: items, error } = await supabase.storage.from(bucket).list(folderPath, {
    limit: 100,
    sortBy: { column: 'name', order: 'asc' },
  });

  if (error || !items) return;

  for (const item of items) {
    const fullPath = folderPath ? `${folderPath}/${item.name}` : item.name;

    // إذا كان مجلداً (id فارغ أو بدون metadata size)
    if (!item.id || item.id === null || !item.metadata || !item.metadata.size) {
      // تفحص المجلد الداخلي
      await scanFolder(supabase, bucket, fullPath, results);
    } else {
      // ملف
      results.push({
        bucket,
        path: fullPath,
        size: item.metadata?.size || 0,
        createdAt: item.created_at || item.updated_at || new Date().toISOString(),
      });
    }
  }
}

main().catch((err) => {
  console.error('\n❌ خطأ غير متوقع:', err);
  process.exit(1);
});
