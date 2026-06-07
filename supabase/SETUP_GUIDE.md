# 🚀 دليل إعداد Supabase Backend

## الخطوة 1: تثبيت Supabase CLI

```bash
# Windows (PowerShell as Admin)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# أو استخدم npm
npm install -g supabase

# verify
supabase --version
```

## الخطوة 2: تسجيل الدخول لـ Supabase

```bash
supabase login
```

## الخطوة 3: ربط المشروع

```bash
# انتقل لمجلد المشروع
cd "E:\New folder (5)\Anarchy Ai 0.07"

# ربط بمشروع Supabase
supabase link --project-ref YOUR_PROJECT_REF
```

> احصل على `PROJECT_REF` من: Supabase Dashboard → Settings → API

## الخطوة 4: إنشاء الجداول (SQL Migrations)

### الطريقة A: عبر Supabase Dashboard (أسهل)

1. اذهب لـ https://supabase.com/dashboard
2. اختر مشروعك
3. اذهب لـ SQL Editor
4. انسخ والصق محتويات هذه الملفات بالترتيب:

```
1. supabase/migrations/20240001_stripe_sessions.sql
2. supabase/migrations/20260528_credit_system.sql
3. supabase/delete_current_user.sql
```

5. اضغط "Run" لكل ملف

### الطريقة B: عبر CLI

```bash
supabase db push
```

## الخطوة 5: نشر Edge Functions

```bash
# 1. create-checkout-session
supabase functions deploy create-checkout-session

# 2. stripe-webhook
supabase functions deploy stripe-webhook

# 3. التحقق من النشر
supabase functions list
```

## الخطوة 6: إعداد Stripe

### 6.1 إنشاء حساب Stripe
1. اذهب لـ https://stripe.com
2. أنشئ حساب (مجاني للاختبار)

### 6.2 الحصول على API Keys
1. Stripe Dashboard → Developers → API Keys
2. انسخ `Secret key` (يبدأ بـ sk_test_... للتجربة)

### 6.3 إعداد Webhook
1. Stripe Dashboard → Developers → Webhooks
2. Add endpoint:
   - URL: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook`
   - Events: `checkout.session.completed`
3. انسخ `Signing secret` (يبدأ بـ whsec_...)

### 6.4 إضافة Secrets لـ Supabase

```bash
# أضف المتغيرات
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set APP_URL=http://localhost:5173  # أو https://yourdomain.com

# للإنتاج غيّر APP_URL
supabase secrets set APP_URL=https://yourdomain.com
```

## الخطوة 7: إعداد ملف .env للواجهة الأمامية

```bash
# انسخ الملف
 cp .env.example .env
```

ثم عدّل القيم:

```env
# Supabase
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY

# Replicate (اختياري)
VITE_REPLICATE_API_TOKEN=your_token_here
```

> احصل على القيم من: Supabase Dashboard → Settings → API

## الخطوة 8: اختبار النظام

### 8.1 تشغيل الواجهة الأمامية
```bash
npm run dev
```

### 8.2 اختبار Auth
1. افتح http://localhost:5173
2. سجّل حساب جديد
3. تأكد من ظهور صفحة Account

### 8.3 اختبار الشراء (وضع التجربة)
1. اذهب لـ /add-credit
2. اختر باقة ($10)
3. اضغط "Buy Credit"
4. استخدم بيانات اختبار Stripe:
   - Card: `4242 4242 4242 4242`
   - Expiry: أي تاريخ مستقبلي (مثل 12/25)
   - CVC: أي 3 أرقام (مثل 123)
5. اكتمل الدفع! 🎉
6. تحقق من الرصيد في صفحة Account

## 🔧 استكشاف الأخطاء

### خطأ: "Unauthorized" في create-checkout-session
- تأكد من تسجيل الدخول
- تأكد من صحة `VITE_SUPABASE_ANON_KEY`

### خطأ: "Invalid signature" في webhook
- تأكد من صحة `STRIPE_WEBHOOK_SECRET`
- تأكد من عدم وجود مسافات في الـ secret

### الرصيد لا يضاف بعد الشراء
- تحقق من logs: `supabase functions logs stripe-webhook`
- تأكد من وجود جدول `stripe_sessions`
- تأكد من وجود RPC function `add_credits`

### خطأ CORS
- تأكد من وجود headers في الـ Edge Function
- `Access-Control-Allow-Origin: *`

## 📊 هيكل الجداول

```
auth.users                    ← المستخدمين (Supabase Auth)
├── user_credits              ← رصيد كل مستخدم
│   ├── balance              ← الرصيد الحالي
│   ├── total_purchased      ← إجمالي المشتريات
│   └── total_used           ← إجمالي المستخدم
├── credit_transactions       ← سجل المعاملات
│   ├── type (purchase/usage/refund/bonus)
│   ├── amount               ← الكمية
│   └── description          ← الوصف
├── stripe_sessions          ← جلسات الدفع
│   ├── session_id           ← ID من Stripe
│   ├── status (pending/completed/expired)
│   └── credits              ← عدد الـ credits
└── usage_events             ← أحداث الاستخدام
```

## ✅ قائمة التحقق

- [ ] Supabase CLI مثبت
- [ ] المشروع مربوط بـ Supabase
- [ ] SQL migrations تم تشغيلها
- [ ] Edge Functions منشورة
- [ ] Stripe account نشأت
- [ ] Stripe API Keys تم الحصول عليها
- [ ] Stripe Webhook مُعد
- [ ] Secrets تم إضافتها لـ Supabase
- [ ] ملف .env مُعد للواجهة الأمامية
- [ ] اختبار Auth ناجح
- [ ] اختبار شراء ناجح (ببيانات تجريبية)

## 🎉 مبروك!

الآن نظام Auth/Billing جاهز بالكامل! 💰🔐
