# دليل ربط Cloudflare R2 بالتطبيق والـ Webhook (تخزين مجاني 10GB)

Cloudflare R2 هي خدمة تخزين سحابي متوافقة بنسبة 100% مع Amazon S3، وتمنحك:
- **10 جيجابايت مساحة تخزين مجانية شهرياً**.
- **0$ رسوم نقل بيانات (Zero Egress Fees)** مهما تم استعراض الصور أو تحميلها.

---

## الخطوة 1: إنشاء الـ Bucket في Cloudflare

1. سجّل الدخول إلى [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. من القائمة الجانبية، اضغط على **R2** (أو **R2 Object Storage**).
3. اضغط على زر **Create bucket**.
4. حدد اسم الـ Bucket: `anarchy-images` (أو أي اسم تفضله).
5. اضغط **Create bucket**.

---

## الخطوة 2: تفعيل الوصول العام للصور (Public Access)

لكي تظهر الصور في تطبيقك وفي المتصفح للمستخدمين، نحتاج تفعيل الرابط العام:

### الطريقة السريعة (رابط مجاني من Cloudflare `r2.dev`):
1. داخل صفحة الـ Bucket الذي أنشأته (`anarchy-images`)، اضغط على تبويب **Settings**.
2. انزل إلى قسم **Public Access**.
3. أمام خيار **R2.dev subdomain**، اضغط على **Allow Access**.
4. سيظهر لك رابط عام مثل:
   ```
   https://pub-xxxxxxxxxxxxxxxxxxxxxxxx.r2.dev
   ```
   احتفظ بهذا الرابط (هذا هو `CLOUDFLARE_R2_PUBLIC_DOMAIN`).

*(اختياري)* يمكنك ربط دومين مخصص مثل `images.yourdomain.com` عبر خيار **Custom Domains**.

---

## الخطوة 3: إنشاء مفاتيح الاتصال (API Tokens)

1. من القائمة الجانبية لـ R2، اضغط على **Manage R2 API Tokens**.
2. اضغط على **Create API token**.
3. اختر الصلاحيات:
   * **Permissions:** `Object Read & Write`.
   * **Specify bucket:** اختر `anarchy-images` (أو All buckets).
   * **TTL:** اتركه فارغاً أو اختر فترة طويلة (Forever).
4. اضغط **Create API Token**.
5. ستظهر لك القيم التالية (احفظها فوراً لأنها لن تظهر ثانية):
   * **Access Key ID:** (مثال: `a1b2c3d4e5f6...`)
   * **Secret Access Key:** (مثال: `9876543210abcdef...`)
   * **Endpoint:** ستجد رابطاً مثل `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` (الـ Account ID هو الرقم الطويل المذكور في الرابط).

---

## الخطوة 4: تفعيل التخزين في الـ Webhook (Supabase Edge Function)

قمنا بالفعل بتحديث كود `supabase/functions/replicate_webhook/index.ts` ليتعرف تلقائياً على Cloudflare R2!

كل ما عليك هو إرسال المتغيرات إلى Supabase عبر الأمر التالي في الـ Terminal:

```bash
supabase secrets set CLOUDFLARE_R2_ACCOUNT_ID="ضع_الـ_Account_ID_هنا" CLOUDFLARE_R2_ACCESS_KEY_ID="ضع_الـ_Access_Key_هنا" CLOUDFLARE_R2_SECRET_ACCESS_KEY="ضع_الـ_Secret_Key_هنا" CLOUDFLARE_R2_BUCKET="anarchy-images" CLOUDFLARE_R2_PUBLIC_DOMAIN="https://pub-xxxxxxxxxxxxxxxxxxxxxxxx.r2.dev"
```

ثم قم برفع الـ Edge Function المحدثة:

```bash
supabase functions deploy replicate_webhook --no-verify-jwt
```

---

## النتيجة بعد التفعيل:
1. عند اكتمال توليد أي صورة في Replicate، سيقوم الـ Webhook بتحميلها.
2. يتم ضغط الصورة فوراً (تقليل حجمها بنسبة 80% بجودة عالية 82%).
3. يتم رفعها مباشرة إلى **Cloudflare R2** وتخزين رابطها العام في قاعدة البيانات.
4. **توفير 100% من مساحة Supabase Storage** ولن تتجاوز خطة Supabase المجانية أبداً!
