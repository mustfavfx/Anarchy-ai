# المرحلة الأولى: مراجعة المعمارية (Phase 1: Architecture Review)

تحليل شامل لبنية ومعمارية برنامج **Anarchy AI** (تطبيق سطح مكتب هجين مبني باستخدام Tauri + React + Vite + TypeScript).

---

## 1. نظرة عامة على المعمارية (Architectural Overview)

يعتمد تطبيق **Anarchy AI** على نمط التطبيقات الهجينة (Hybrid Desktop Applications)، حيث يتم الفصل التام بين واجهة المستخدم (Frontend) والعمليات المحلية على النظام (Backend/OS-level):

```mermaid
graph TD
    subgraph UI Layer (Frontend - React/TS)
        App[App.tsx] --> AppShell[AppShell.tsx]
        AppShell --> Nav[NavRail / TitleBar]
        AppShell --> Pages[Pages / Features]
        Pages --> Builder[MultiBuilderPage - React Flow]
        Pages --> Generate[GeneratePage]
        Pages --> Library[LibraryPage]
        
        Zustand[Zustand Stores] -.-> Pages
        Services[Services layer] -.-> Pages
    end

    subgraph OS Wrapper Layer (Tauri / Rust)
        TauriCore[Tauri Rust Core]
        TauriCore --> IPC[IPC / Custom Commands]
        TauriCore --> Webview[Webview Window]
        TauriCore --> FileSys[Local File Storage]
    end

    subgraph External Services
        Supabase[Supabase Auth & Database]
        Stripe[Stripe Payments API]
        Replicate[Replicate AI Generation API]
    end

    AppShell -.-> Webview
    Services --> IPC
    Services --> Supabase
    Services --> Stripe
    Services --> Replicate
```

### المكونات الرئيسية:
1. **Frontend (React 18 & Vite):** المسؤول عن بناء الواجهات الرسومية، وإدارة الحالة المحيطية (Client-side State) وتدفق تدفقات العمل العقدية (Node-based Workflows) باستخدام `@xyflow/react`.
2. **Desktop Shell (Tauri v2):** يوفر بيئة التشغيل كبرنامج سطح مكتب مستقل، ويسيطر على النوافذ، ويتفاعل مع نظام الملفات المحلي بشكل آمن عبر أوامر Rust IPC.
3. **Cloud Backend (Supabase & Stripe):** يوفر آليات التحقق من الهوية (Authentication)، وإدارة رصيد النقاط (Credit/Billing)، ومعالجة المدفوعات (Stripe integration).
4. **AI Processing (Replicate API):** المحرك الرئيسي لتوليد الصور وتدريب النماذج (LoRA).

---

## 2. نقاط القوة المعمارية (Architectural Strengths)

* **حفظ حالة لوحة العمل (Canvas State Preservation):**
  في الملف `src/features/shell/AppShell.tsx` (الأسطر 135-141)، يتم تركيب صفحة ممر العمل `MultiBuilderPage` بشكل دائم داخل الـ DOM، ويتم إخفاؤها أو إظهارها باستخدام التنسيق `display: 'none'` عند التنقل بين الصفحات بدلاً من إلغاء تركيبها (unmounting). هذا قرار معماري ذكي جداً يمنع فقدان حالة الرسوم والاتصالات في مكتبة React Flow، ويزيد من سلاسة تجربة المستخدم.

* **تقسيم الميزات القائم على الوحدات (Feature-based Modular Structure):**
  التعليمات البرمجية مقسمة بوضوح داخل مجلد `src/features/` إلى وحدات مستقلة (Builder, Dashboard, Generate, Settings, Billing, Auth, etc.). هذا يسهل صيانة الكود وتطوير كل ميزة بشكل منفصل.

* **الوسيط التطويري المدمج لـ Replicate (Built-in Development Proxy):**
  في `vite.config.ts` (الأسطر 17-39)، تم إعداد proxy محلي لتمرير طلبات API الخاصة بـ Replicate (`/api/replicate`). هذا يحل مشاكل CORS أثناء التطوير المحلي ويسهل تتبع الطلبات عبر سجلات الـ console.

---

## 3. نقاط الضعف والفجوات المعمارية (Architectural Flaws & Risks)

* **الاعتماد المباشر على localStorage في الهيكل (Tight Coupling with localStorage in AppShell):**
  في `src/features/shell/AppShell.tsx` (الأسطر 21-32)، يتم قراءة البيانات مباشرة من `localStorage` للتحقق من وجود تبويبات غير محفوظة (`checkHasDirtyTabs`). هذا ينتهك مبدأ فصل المهام (Separation of Concerns). كان يجب أن تدار هذه الحالة من خلال Zustand Store (`aiConfigStore` أو `workflowStore`) بدلاً من الوصول المباشر واليدوي لوحدة التخزين المحلية داخل مكون الهيكل (Shell UI).

* **قيم Supabase الافتراضية الصلبة في ملف الإعداد (Hardcoded Fallback Credentials in Vite Configuration):**
  في `vite.config.ts` (الأسطر 43-49)، تم ترميز روابط ومفاتيح Supabase الافتراضية داخل خاصية `define`. هذا يشكل خطراً أمنياً كبيراً (Credentials Exposure) في حال تم نشر الكود على مستودع عام، كما يصعب عملية إدارة البيئات المتعددة (Production vs Staging).

* **عدم تناسق إدارة الحالة العامة (State Management Inconsistency):**
  هناك خلط بين استخدام Zustand ومستودعات التخزين المحلية (localStorage) والـ React Context (مثل `AuthContext`). يفتقر المشروع إلى معيار موحد لكيفية وخط سير تدفق البيانات (Data Flow Standard).

---

## 4. تحليل حدود تطبيق سطح المكتب (Tauri/React Boundary Analysis)

يمثل الفاصل بين بيئة الويب (Webview) وبيئة النظام المحلية (Rust/Tauri) أهمية بالغة للأمان والأداء:
1. **معالجة إغلاق التطبيق (Close Interception):** 
   يتم اعتراض إغلاق التطبيق في `AppShell.tsx` (الأسطر 45-93) للتحقق مما إذا كان هناك عمل غير محفوظ في الـ Builder. في حال عدم وجود عمل غير محفوظ، يتم استدعاء أمر Rust مخصص (`exit_app`) للخروج الآمن.
2. **اتصالات IPC:**
   يستخدم التطبيق استدعاءات `invoke` و `listen` بشكل متفرق داخل المكونات. يفضل نقل جميع اتصالات Tauri IPC إلى طبقة خدمات مخصصة (مثال: `src/services/native/`) لعزل تفاصيل Tauri عن مكونات React تماماً، مما يسهل تشغيل التطبيق في بيئة الويب العادية (Web Browser) للاختبار أو الاستعراض.

---

## 5. التوصيات وخطة العمل (Recommendations & Action Items)

1. **إنشاء طبقة وساطة لبيئة التشغيل (Runtime Abstraction Layer):**
   تجميع كل استدعاءات Tauri (`@tauri-apps/api/*`) داخل واجهة موحدة (e.g., `src/services/nativeService.ts`). هذا يسمح بتوفير Mock للـ Browser العادي ويسهل اختبار المكونات بدون الحاجة لبيئة Tauri.
2. **إزالة القيم الافتراضية الحساسة من ملف الإعداد:**
   يجب حذف مفاتيح Supabase الصلبة من `vite.config.ts` والاعتماد التام على متغيرات البيئة `.env` و رمي خطأ صريح عند غيابها أثناء عملية البناء (Build-time validation).
3. **توحيد فحص الحالة غير المحفوظة (Dirty States):**
   نقل وظيفة `checkHasDirtyTabs` إلى مستودع Zustand المخصص للمهام والـ tabs لتجنب الـ Parsing اليدوي لـ `localStorage` في كل تحديث للمكون الرسومي للهيكل.
