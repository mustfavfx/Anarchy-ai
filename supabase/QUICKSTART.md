# ⚡ Quick Start — Auth & Billing

## 🎯 3 خطوات سريعة

### 1. نشر الـ Backend (5 دقائق)

```bash
# تسجيل الدخول
supabase login

# ربط المشروع
supabase link --project-ref YOUR_PROJECT_REF

# نشر Functions
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook
```

### 2. تشغيل SQL (3 دقائق)

افتح Supabase Dashboard → SQL Editor، والصق:

```sql
-- 1. جدول الرصيد
CREATE TABLE IF NOT EXISTS public.user_credits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INTEGER DEFAULT 0,
  total_purchased INTEGER DEFAULT 0,
  total_used INTEGER DEFAULT 0
);

-- 2. جدول المعاملات  
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('purchase','usage','refund','bonus')),
  amount INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RPC لإضافة رصيد
CREATE OR REPLACE FUNCTION public.add_credits(p_user_id UUID, p_credits INTEGER)
RETURNS void AS $$
BEGIN
  INSERT INTO public.user_credits (user_id, balance, total_purchased)
  VALUES (p_user_id, p_credits, p_credits)
  ON CONFLICT (user_id) DO UPDATE SET
    balance = user_credits.balance + p_credits,
    total_purchased = user_credits.total_purchased + p_credits;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 3. إعداد Stripe (5 دقائق)

```bash
# أضف Secrets
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set APP_URL=http://localhost:5173
```

---

## 🧪 اختبار سريع

### بيانات اختبار Stripe:
```
Card: 4242 4242 4242 4242
Expiry: 12/25
CVC: 123
```

### سير العمل:
1. افتح http://localhost:5173
2. سجّل حساب جديد
3. اذهب لـ Account → Billing
4. اضغط "Add Credit"
5. اختر $10 → Buy
6. ادخل بيانات البطاقة التجريبية
7. ✅ تحقق من الرصيد!

---

## 📁 الملفات المهمة

```
supabase/
├── functions/
│   ├── create-checkout-session/   ← إنشاء جلسة دفع
│   └── stripe-webhook/           ← استقبال تأكيد الدفع
├── migrations/
│   ├── 20240001_stripe_sessions.sql
│   └── 20260528_credit_system.sql
├── delete_current_user.sql       ← حذف الحساب
└── SETUP_GUIDE.md               ← الدليل الكامل
```

## 🆘 دعم سريع

| المشكلة | الحل |
|---------|------|
| "Unauthorized" | تحقق من `VITE_SUPABASE_ANON_KEY` |
| Webhook لا يعمل | تحقق من `STRIPE_WEBHOOK_SECRET` |
| الرصيد لا يضاف | شغّل SQL migrations |

**الدليل الكامل:** `supabase/SETUP_GUIDE.md` 🚀
