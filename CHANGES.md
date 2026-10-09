# Anarchy AI — سجل التحديثات والتعديلات (Release 0.3.97)

## إصدار 0.3.97 (Trimble SketchUp AI Integration Suite & Compact Integrations) - 2026-10-09

### 1. إضافة وتكامل سكتش اب الرسمي (Trimble SketchUp Integration Suite):
- **بناء إضافة رسمية بلغة Ruby (`anarchy_sketchup.rb` و `main.rb`)** تدعم جميع إصدارات SketchUp من 2020 إلى 2027 عبر معمارية SketchUp Extension API القياسية.
- **حزمة أدوات متكاملة (4-Tool Suite) بشريط أدوات عائم وقائمة Extensions**:
  1. **Send Viewport (إرسال المنظور النشط)**: التقاط فوري لزاوية الكاميرا الحالية مع الحفاظ التام على أبعاد المنفذ وإرسالها لخادم Anarchy AI المحلي (`127.0.0.1:14400/upload-view`).
  2. **Instant AI Render (الرندر الفوري بالذكاء الاصطناعي)**: التقاط عالي الدقة (2560px UHD) وتوليد إظهار معماري واقعي بلمسة واحدة.
  3. **Batch Scenes Export (تصدير كل المشاهد دفعة واحدة)**: المرور التلقائي على جميع تبويبات المشاهد (`Scenes / Pages`) في الموديل وتصديرها مباشرة إلى كانفس الـ Builder.
  4. **Plugin Settings & Status (إعدادات الربط وحالة الاتصال)**: نافذة تبيّن حالة اتصال الإضافة بالخادم وتوثيق التوكن الأمني المشفر.
- **مزامنة بيانات الكاميرا والـ BIM**: بث زاوية الرؤية (FOV)، المنظور، نقطة الكاميرا (Eye) ونقطة الهدف (Target) إلى خادم الربط.

### 2. محرك التثبيت الذكي في الخلفية (Rust / Tauri Backend):
- إضافة أمرين أصليين في Tauri: `detect_sketchup_installs` و `install_sketchup_plugin`.
- كشف تلقائي لملفات مستخدمي SketchUp عبر جميع أقراص التخزين (C, D, E, F) ومجلدات AppData و Program Files.
- دعم كامل لاختيار مجلد تثبيت مخصص (**Custom Folder**) لمن قام بتثبيت البرنامج في مسارات خاصة.
- دعم الإزالة النظيفة للإضافة بنقرة واحدة عبر `remove_old_autodesk_plugins`.
- مزامنة وتخزين نصوص الإضافة في `%APPDATA%\com.anarchyai.app\sketchup\`.

### 3. تحسينات واجهة التكاملات (Integrations Page):
- تفعيل SketchUp وإتاحته للتثبيت المباشر بعد إزالة شارة Coming Soon.
- تصميم مضغوط وفائق الترتيب لشبكة خيارات الإصدارات (4 أعمدة مع نقطة خضراء تبيّن الإصدارات المكتشفة).
- دليل استخدام مدمج وقابل للطي يشرح تشغيل شريط الأدوات داخل SketchUp.
- تحديث نافذة التحديثات (What's New Modal) وسجل التغييرات الكامل للنسخة v0.3.97.

---

## إصدار 0.3.96 (ArchVision AI Agent Studio 2.0 & WebGL 3D Viewport) - 2026-10-08

### 1. عارض كتل معمارية ثلاثي الأبعاد تفاعلي (Interactive Three.js WebGL Viewport):
- تضمين عارض 3D تفاعلي مدمج مباشرة داخل شاشة مخرجات الوكيل المعماري باستخدام Three.js وWebGL (`EmbeddedModelViewer.tsx`).
- دعم تدوير الكاميرا والتحريك المداري (Orbit Controls)، والتقريب والانتقال السلس.
- محاكاة إضاءة شمسية متقدمة مع أوضاع اليوم، الساعة الذهبية (Golden Hour)، والليل (Night).
- إمكانية التبديل بين وضع الخطوط الهندسية (Wireframe) والمواد التكتونية الواقعية مع الدوران التلقائي.
- دعم حفظ والتقاط صور عالية الدقة (PNG) للمنظور ثلاثي الأبعاد مباشرة من العارض.
- إمكانية التبديل بين عارض الكتل والنموذج الكامل Speckle BIM WebGL بنقرة واحدة.

### 2. سلسلة استدلال وتدقيق معماري عميق (Deep Architectural Chain-of-Thought):
- إضافة مكون `DeepThinkingTrace.tsx` لإظهار مسار التفكير المنطقي والرياضي للوكيل المعماري عبر 5 مراحل دقيقة:
  1. **Phase 1: Site Constraints & Spatial Program**: حساب المساحة الإجمالية للموقع، نسبة التغطية (45–60%)، والارتدادات النظامية.
  2. **Phase 2: Building Code & FAR Compliance**: تدقيق معامل البناء FAR 1.25، مطابقة كود البناء SBC / IBC، وفحص مسافات الانتقال ومواقف السيارات.
  3. **Phase 3: 3D Volumetric Massing & Cantilever Strategy**: تشكيل الكتل، البروز الطائر (3.2م)، ونظام الواجهات الزجاجية البانورامية.
  4. **Phase 4: Environmental Solar Orientation & Shading Logic**: توجيه الفتحات شمالي وشمالي-شرقي، كواسر الشمس الغربية، وزاوية السقوط 42°.
  5. **Phase 5: Autonomous CUA 3ds Max Scripting & Automation**: تحضير أوامر MaxScript ومزامنة الكاميرا ثنائية النقاط وخامات PBR.
- أزرار إجراءات تشغيلية سريعة ومباشرة:
  - **إرسال للكانفس (Send to Canvas)**: لتطبيق البرومبت المعماري فائق الجودة على العقدة المحددة فوراً.
  - **تنفيذ في 3ds Max**: بناء الكتل وضبط الإضاءة والكاميرا عبر CUA.
  - **مزامنة الكاميرا**: تحديث منظور العرض في 3ds Max ليتطابق مع الاستوديو.
  - **تصدير جدول الكميات (Export BOQ)**: توليد وتنزيل ملف Excel متكامل لحساب مساحات البناء والكميات.

### 3. إدارة جلسات المحادثة المعمارية المتعددة (Multi-Session Sidebar):
- تصميم شريط جانبي قابل للطي (`AgentSessionsSidebar.tsx`) لإدارة جلسات الوكيل بأسلوب أنظمة الذكاء الاصطناعي العالمية (ChatGPT / Claude).
- تصنيف الجلسات حسب التوقيت الزمني: (Today، Yesterday، Last 7 Days، Older).
- ميزة البحث الفوري في الجلسات مع إمكانية إعادة التسمية وحذف الجلسات الفردية أو مسح السجل والبدء من جديد.
- حفظ الجلسات والرسائل ومقاسات الأراضي والطرز المعمارية محلياً بشكل دائم على جهاز المستخدم (`localStorage`).

### 4. واجهة الوكيل بالكامل باللغة الإنجليزية المتخصصة (100% English UI):
- تحويل كافة عناصر واجهة الوكيل المعماري (AI Agent Studio) بما في ذلك التسميات، التلميحات (Tooltips)، البطاقات، القوائم المنسدلة، شريط الأدوات، والإشعارات إلى اللغة الإنجليزية التخصصية الدقيقة.

---

# Anarchy AI Agent — سجل الإصلاحات (الدفعة الأولى)

كل إصلاح له تست يغطيه. طريقة التشغيل في آخر الملف.

## الأولويات 1–6 (مُنفَّذة)

| # | المشكلة | الإصلاح | الملفات |
|---|---------|---------|---------|
| 1 | توليد/تنفيذ كود Python: الفلتر يمرّر `__builtins__['ex'+'ec']` و`pathlib`، والكود يتنفذ لحظة الإنشاء، واسم الـ skill يقدر يستبدل `skill_engine.py` | allowlist للـ imports + منع أي dunder وأي reflection (`getattr`..) + أسماء محجوزة + رفض الكتابة فوق ملف غير مسجّل + التنفيذ بعملية `python -I` منفصلة (مهلة 15ث، بيئة بدون مفاتيح، حد للمخرجات) + إعادة فحص الكود قبل كل تنفيذ + `file` في الـ registry لا يُثق به | `src/skills/skill_engine.py`, `_skill_runner.py` (جديد) |
| 2 | الـ API مفتوح (`CORS *`)، الـ frontend ما يرسل `X-API-Key`، `GET /api/memory` و`/api/skills` بدون حماية | CORS افتراضي محصور (localhost + Tauri)، مقارنة ثابتة الزمن للمفتاح، حماية الـ GET، و`/api/skills/*` **تفشل مغلقة** بدون مفتاح، وتوليد الـ skills مطفأ ما لم يُفعَّل بـ `ARCHVISION_ENABLE_SKILL_GENERATION=1`، والـ frontend يرسل المفتاح | `api_server.py`, `.env.example`, `ArchVisionAgentService.ts` |
| 3 | الـ connector يبني **فيلا ثابتة** ويرجع `success:true` لما تفشل الأداة، ويحقن `name` بنص MaxScript، و`)` تكسر غلاف الـ undo | حذف الـ fallback الوهمي (الفشل يُبلَّغ كفشل)، و`pymxs.undo` كـ context manager بدل تغليف نصي | `AnarchyConnector.ms` |
| 3b | فلتر MAXScript بالـ Rust ضعيف (`python.run`, `System.IO.File`, `createFile`, `fileIn`, `execute(...)`) | توسيع القائمة + حد حجم 20KB + 4 اختبارات Rust + إصلاح `contains("max")` | `tauri_cua_rust/cua.rs` |
| 4 | لا موافقة بشرية بمسار TS: `send_keys`, `launch_app`, skills, memory write, سكربت حر | طبقة مخاطر (safe/approval/blocked)، السياسة الافتراضية `prompt` وبدون handler = **رفض**، `win+r` و`ctrl+alt+del` محظورة حتى بـ `auto`، وتوقف المهمة بعد رفضين متتاليين | `ComputerUseAgentService.ts` |
| 4b | واجهة الموافقة | مودال داخل `ArchitectCopilotDock` عبر `setApprovalHandler` (يرفض عند الإغلاق/الإيقاف، والطلب بدون جواب خلال 120ث = رفض). **تحققت من الـ syntax فقط، ما رندرته** | `ArchitectCopilotDock.tsx/.css` |
| 5 | "التحقق" = نجاح الـ IPC فقط، والـ sub-goal يتقدم مع أي نجاح، ورسالة "visually verified" غير صادقة | مقارنة لقطة الشاشة قبل/بعد للإجراءات المفترض تغيّرها (UNVERIFIED إذا ما تغيّرت)، تقدّم الـ sub-goal فقط عند مطابقة `targetTool`، ولا يُقبل `complete` بعد خطوة فاشلة، ورسالة الإكمال الافتراضية صارت صادقة | `ComputerUseAgentService.ts` |
| 6 | `NameError` بـ `refine-fast`، `async def` يجمّد الخادم، ملف مفتوح يُغلق قبل الرفع بـ Replicate، حقول بديلة تُتجاهل، رفع بدون تحقق | كلها مصلحة + حد 25MB وامتداد صور فقط + كشف mime حقيقي + تحذير `warnings` للـ negative prompt المُهمل + تحميل الصورة بـ `requests` مع timeout | `api_server.py`, `replicate_renderer.py`, `render_executor.py` |

## جزء من الأولوية 7 (مُنفَّذ)
- لا فول-باك صامت لنموذج الـ Demo: يرجع خطأ بدل تدقيق مزيف (`ARCHVISION_ALLOW_DEMO_FALLBACK=1` لإعادته)، ومخرجاته تحمل وسم `[DEMO MODE]`.
- الوصول لحد المراجعات **لا يُسمّى امتثالاً**: `compliance_forced=true` + تحذير "غير معتمد" بالتقرير.
- `solar_analyzer`: يتعرف على "مسقط/بغداد/..." بالعربي، ويحذّر إذا المدينة غير معروفة بدل ما يستخدم الرياض بصمت.
- تسريب الذاكرة بين العملاء (استعلام بدون `client_id`) مسدود.

## الدفعة الثانية: حل جميع الملاحظات والمسائل المعلقة (مُنفَّذة بالكامل ✅)

| # | البند | الإصلاح الهندسي المُنفَّذ | الملفات المُعدلة |
|---|-------|---------------------------|-------------------|
| 1 | **التدقيق المعماري الحقيقي بالأرقام وأكواد بغداد/مسقط/السعودية** | - إضافة حسابات الارتدادات البلدية الدقيقة لبغداد ومسقط والرياض وعام.<br>- إضافة `deterministic_numerical_audit` يحسب رياضياً نسب البناء الأرضي والـ BUA الإجمالي ومطابقة المساحات الصافية للغرف والمناور.<br>- تحويل `space_topology` إلى محلل ديناميكي ينشئ شبكة العلاقات وحسابات الخصوصية بناءً على البرنامج المعماري الحقيقي.<br>- توسيع قاعدة الـ RAG لتشمل اشتراطات أمانة بغداد وبلدية مسقط وكود البناء السعودي. | `zoning_calculator.py`, `code_compliance.py`, `space_topology.py`, `code_rag.py`, `spatial_planner.py` |
| 2 | **توسيع أدوات النمذجة `PymxsTools` بالماكس** | - إضافة دوال نمذجة معمارية BIM حقيقية:<br>  * `create_wall` (جدار بين نقطتين مع زاوية وسماكة وارتفاع ومادة)<br>  * `create_walls` (سلسلة جدران متصلة من مسار مضلع)<br>  * `create_slab` (بلاطة أرضية أو سقف بسماكة ومنسوب ومادة)<br>  * `create_opening` (فتحة شباك أو باب مع الفريم والزجاج ومقدار الجلسة)<br>  * `create_roof` (أسقف فلات/بارابيت مع سترة أو أسقف مائلة مع زاوية ميلان وبروز)<br>  * `create_column` (أعمدة إنشائية مستطيلة ودائرية بتموضع ثلاثي الأبعاد)<br>- تسجيل كافة الأدوات في `tool_map` لدعم الاستدعاء الآلي. | `src-tauri/resources/PymxsTools.py` |
| 3 | **حصر نقرات الماوس داخل نافذة التطبيق الهدف (CUA Boundary Guard)** | - Rust: إضافة `clamp_to_target_window` في `cua.rs` مع دعم `target_window` و`target_bounds`. تُحصر الإحداثيات إجبارياً داخل مستطيل النافذة (مع هامش 2px) لمنع النقر خارج نافذة الماكس أو التطبيق الهدف.<br>- TypeScript: تحديث `transformCoordinates` و`mouse_click` و`mouse_move` و`mouse_drag` لتقييد الإحداثيات وتمرير `targetWindow` للطبقة الأصلية. | `src-tauri/src/commands/cua.rs`, `ComputerUseAgentService.ts`, `ComputerUseAgentService.safety.test.ts` |
| 4 | **استقرار الذاكرة وإندبوينت الرؤية البصرية** | - استبدال `MemorySaver` المؤقت بـ `SqliteSaver` دائم متصل بـ `agent_memory.db`.<br>- الحفاظ على `thread_id` وإعادة استخدام معرف الجلسة `session_id` بدلاً من إنشاء UUID عشوائي يمسح الذاكرة كل طلب.<br>- إضافة وتفعيل إندبوينت `POST /api/vision/analyze-structured` في `api_server.py` مع محلل متعدد الوسائط يُرجع تصنيف الكتل والمواد والإضاءة والتقييم المعماري الدقيق. | `src/graph.py`, `api_server.py`, `vision_analyzer.py` |
| 5 | **خادم المنفذ 14400 والتحقق الكامل** | - خادم `127.0.0.1:14400` يعمل عبر `src-tauri/src/server/viewport.rs` مع نظام التوكنات الآمنة، وتم ربط أوامر النبض والمزامنة مع الماكس بدقة. | `src-tauri/src/server/viewport.rs`, `cua.rs` |

## نتائج الاختبارات المؤتمتة بعد التحديث
```bash
# Python Backend Tests (44 اختبار - نجاح بنسبة 100%):
E:\Agent\.venv\Scripts\python.exe -m pytest E:\Agent\tests -q
# Output: 44 passed in 7.80s

# Frontend Agent Tests (70 اختبار - نجاح بنسبة 100%):
npx vitest run src/services/agent/ --pool=threads
# Output: 6 test suites, 70 passed in 35.44s

# Rust Cargo Verification:
cargo check --manifest-path src-tauri/Cargo.toml
# Output: Finished dev profile in 8.21s (0 errors)
```

