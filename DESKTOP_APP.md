# Anarchy AI - Desktop Application

تم تحويل التطبيق لتطبيق سطح مكتب باستخدام **Tauri** - تقنية حديثة وخفيفة

## متطلبات التشغيل

### Windows
1. **Rust** - تحميل من: https://rustup.rs/
2. **Node.js** - تحميل من: https://nodejs.org/

### macOS
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
brew install node
```

### Linux (Ubuntu/Debian)
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libssl-dev libgtk-3-dev libappindicator3-dev librsvg2-dev
```

---

## خطوات التشغيل

### 1. تثبيت dependencies
```bash
npm install
```

### 2. تشغيل وضع التطوير (مع hot reload)
```bash
npm run tauri:dev
```

### 3. بناء نسخة الإنتاج
```bash
npm run tauri:build
```

بعد البناء، ستجد الملفات في:
- **Windows**: `src-tauri/target/release/Anarchy AI.exe`
- **macOS**: `src-tauri/target/release/bundle/dmg/Anarchy AI.dmg`
- **Linux**: `src-tauri/target/release/bundle/deb/Anarchy AI.deb`

---

## الأوامر المتاحة

| الأمر | الوصف |
|-------|--------|
| `npm run dev` | تشغيل ويب عادي |
| `npm run tauri:dev` | تشغيل تطبيق سطح مكتب (dev) |
| `npm run tauri:build` | بناء نسخة الإنتاج |
| `npm run build` | بناء الويب فقط |

---

## مميزات النسخة المكتبية

- ⚡ **أسرع** - يعمل على Webview النظام (أخف من Electron)
- 🔒 **أكثر أماناً** - CSP محدد وفصل واضح بين Frontend و Backend
- 📦 **حجم أصغر** - الحجم النهائي ~5-10MB بدلاً من 100MB+
- 🖥️ **نافذة أصلية** - شريط عنوان، أيقونة taskbar، notifications
- 🚀 **أداء أفضل** - استخدام موارد النظام بكفاءة

---

## هيكل المشروع

```
Anarchy Ai 0.07/
├── src/                 # كود React
├── src-tauri/          # كود Rust (Backend)
│   ├── src/main.rs     # نقطة الدخول
│   ├── Cargo.toml      # dependencies
│   └── tauri.conf.json # إعدادات التطبيق
├── public/             # الأصول الثابتة
└── index.html          # نقطة دخول الويب
```

---

## حل المشاكل الشائعة

### خطأ: "cargo not found"
أعد تشغيل الطرفية بعد تثبيت Rust أو شغل:
```bash
source $HOME/.cargo/env
```

### خطأ: "tauri not found"
```bash
npm install
```

### خطأ: "failed to run custom build"
تأكد من تثبيت متطلبات البناء للنظام (انظر قسم المتطلبات)

---

## دعم اللغة العربية

التطبيق يدعم اللغة العربية بالكامل في الواجهة. للحصول على أفضل تجربة:
- استخدم خط يدعم العربية
- فعّل RTL في الإعدادات إذا لزم الأمر
