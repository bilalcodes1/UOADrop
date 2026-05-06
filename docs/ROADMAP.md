<div dir="rtl">

# خارطة الطريق

خطة التنفيذ الكاملة من الصفر إلى الإنتاج. الإجمالي: **~3 أسابيع عمل** أو **أسبوع واحد** للـ MVP offline.

---

## Phase 0 — التوثيق ✅ (الحالية)

**المدة**: يوم واحد.
**الحالة**: ✅ مكتمل.

### المنجز
- [x] `README.md` — نظرة عامة
- [x] `docs/ARCHITECTURE.md` — المعمارية الكاملة
- [x] `docs/SETUP.md` — دليل إعداد صاحب المكتب
- [x] `docs/RISKS.md` — المخاطر والاستجابة
- [x] `docs/ROADMAP.md` — هذا الملف
- [x] `docs/GLOSSARY.md` — المصطلحات

---

## Phase 1 — MVP Offline ✅ (مكتمل ~98%)

**الحالة**: مكتمل عملياً. المتبقي فقط اختبار يدوي أوسع داخل بيئة الاستخدام الفعلية.

### 1.1 — Monorepo Setup ✅
- [x] `pnpm-workspace.yaml` + `turbo.json` + `package.json`
- [x] `apps/web`, `apps/desktop`, `packages/shared`, `packages/db-schema`, `packages/ui`
- [x] TypeScript config موحّد (`tsconfig.base.json`)
- [x] ESLint + Prettier + Husky pre-commit hooks
- [x] `.gitignore` + GitHub repo + initial commit
- [x] `@electron/rebuild` + `postinstall` لبناء `better-sqlite3` لـ Electron ABI

### 1.2 — Shared Package ✅
- [x] Types المشتركة (`PrintRequest`, `RequestFile`, `PrintOptions`)
- [x] Constants وحدود الرفع وأنواع الملفات المسموحة
- [x] Validation helpers للامتدادات و `magic bytes`
- [x] Types + exports من `index.ts`

### 1.3 — DB Schema ✅
- [x] SQLite schema runtime داخل `apps/desktop/src/main/db.ts`
- [x] Runtime migrations لحقول `pages` و `pickup_pin` و `options_json`
- [x] تخزين إعدادات مستقلة لكل ملف داخل `request_files`

### 1.4 — Electron Shell ✅
- [x] `main/index.ts` مع BrowserWindow + security hardening
- [x] `preload/index.ts` — IPC bridge مع whitelist
- [x] Single-instance lock
- [x] Window-open handler + navigation guard

### 1.5 — Fastify Server داخل Electron ✅
- [x] Fastify على port 3737 + WebSocket
- [x] better-sqlite3 + WAL mode
- [x] `POST /api/requests`, `POST /api/requests/:id/files`
- [x] `GET /api/requests` مع pagination + filter + search
- [x] `PATCH /api/requests/:id/status`
- [x] WebSocket `/ws` للتحديث اللحظي
- [x] Magic-byte verification + SHA-256 dedup
- [x] حساب تلقائي لعدد الصفحات للأنواع المدعومة
- [x] خدمة `student.html` والشعارات من `resources/` عبر نفس الخادم المحلي
- [x] ربط الخادم على `0.0.0.0` ليتاح عبر الشبكة المحلية داخل المكتب

### 1.6 — صفحة رفع الطالب `/` ✅
- [x] HTML standalone في `apps/desktop/resources/student.html`
- [x] Drag & drop + file list + حالات (pending/uploading/done/error)
- [x] Progress bar لكل ملف عبر XHR
- [x] Auto-retry مع exponential backoff
- [x] صفحة نجاح بتذكرة + PIN + أزرار نسخ
- [x] RTL + responsive
- [x] إعدادات طباعة افتراضية للطلب
- [x] **إعدادات مستقلة لكل ملف** داخل قائمة الرفع
- [x] حفظ اسم الطالب والإعدادات الافتراضية محلياً
- [x] قسم `عن UOADrop` مع شعارات الجامعة والكلية وبطاقات الاعتمادات الأكاديمية

### 1.6.5 — Cleanup cron للملفات المهجورة ✅
- [x] `cleanup.ts` — حذف طلبات `abandoned` > 24 ساعة
- [x] Runs on startup + daily interval

### 1.7 — Dashboard المكتب ✅
- [x] React + Vite renderer
- [x] WebSocket للتحديث اللحظي + **native OS Notification** (نظام) عند وصول طلب/ملف
- [x] Counters وفلاتر وحالات `pending/printing/ready/done/canceled/blocked`
- [x] Filters (الكل/pending/printing/ready/done) + search + pagination
- [x] **Lock screen** — يبدأ مقفل + يقفل بعد 15 دقيقة idle + PIN + قفل 30 دقيقة بعد 5 محاولات فاشلة
- [x] الأزرار: عرض / طباعة / جاهز / حذف
- [x] عرض `pickupPin` داخل البطاقة
- [x] drawer لعرض ملفات الطلب وتعديل إعدادات كل ملف
- [x] إدخال السعر يدوياً قبل تحويل الطلب إلى `ready`
- [x] تبويب منفصل `معلومات المشروع` بدل دفع المحتوى الرئيسي للأسفل
- [x] بطاقات المطور والعميد ورئيس القسم والمشرفات وروابط الصفحات الرسمية

### 1.8 — QR Generator + ملصق الحائط ✅
- [x] `qr.ts` — توليد QR عبر `qrcode`
- [x] `/wall-sign` route في Fastify — A4 HTML جاهز للطباعة
- [x] زر 🧾 "طباعة ملصق الحائط" في Dashboard

### 1.9 — Printer integration ✅
- [x] **Root-cause fix**: `shell.openPath` للطباعة عبر التطبيق الافتراضي على كل الأنظمة
- [x] Printer status polling + cache + WS broadcast
- [x] CUPS state mapping (3=idle, 4=printing, 5=error)

### 1.10 — Notifications ✅
- [x] **Native OS Notification** (macOS/Windows/Linux) مع system sound عند طلب جديد أو ملف جديد
- [x] In-app toast "📩 طلب جديد وصل"

### 1.11 — Polish + اختبار يدوي 🟡
- [x] typecheck + build نظيفين (0 errors)
- [x] ESLint/Prettier
- [x] تحسين الهوية البصرية العربية في صفحة الطالب والدشبورد بدون الاعتماد على موارد خارجية
- [x] التحقق من عمل الشعارات محلياً بعد إعادة التشغيل وعلى الشبكة المحلية
- [ ] اختبار مع iOS + Android حقيقي داخل شبكة مكتب فعلية
- [ ] اختبار سيناريو طلب متعدد الملفات بإعدادات مختلفة لكل ملف

**مخرجات Phase 1**: الطالب يرفع الملفات محلياً من المتصفح، ولكل ملف إعداداته الخاصة، وتظهر له واجهة محلية مكتملة الهوية البصرية، وصاحب المكتب يدير الطلب من لوحة شغالة بالكامل داخل Electron.

---

## Phase 2 — Online Integration 🌐 ✅

**الحالة**: منفّذ عملياً عبر Next.js/Vercel + Supabase + Desktop intake.
**الهدف**: الطالب يرفع من خارج المكتب، وصاحب المكتب يرى طلبات Online داخل نفس الدشبورد مع مزامنة السعر والحالة والدفع.

### 2.1 — Supabase + Vercel Setup ✅
- [x] Supabase Postgres + Storage bucket `print-files`
- [x] Web app online على `https://uoadrop.vercel.app`
- [x] متغيرات Supabase في Vercel والديسكتوب
- [x] دعم تشفير اختياري لملفات Online قبل الرفع

### 2.2 — Online Upload ✅
- [x] صفحة رفع Online داخل `apps/web`
- [x] حفظ `student_email`, `notify_preferences`, وبيانات الدفع/التتبع
- [x] رفع الملفات إلى Supabase Storage
- [x] تتبع حالة الطلب في صفحة النجاح
- [x] السعر النهائي يبقى من الديسكتوب فقط؛ الويب لا يصبح مصدر السعر النهائي

### 2.3 — Desktop Online Intake ✅
- [x] استيراد طلبات Online من Supabase داخل الديسكتوب
- [x] تنزيل الملفات محلياً وفك التشفير عند وجود metadata ومفتاح خاص
- [x] تحديث Mirror في Supabase عند السعر، الحالة، الدفع، الطباعة، والحذف
- [x] تمييز المصدر `online` داخل الدشبورد

### 2.4 — Notifications + Announcements ✅
**تفاصيل كاملة في [`NOTIFICATIONS.md`](./NOTIFICATIONS.md).**

- [x] Email عبر SMTP/Nodemailer داخل Next.js API
- [x] Telegram Bot API وربط `telegram_chat_id`
- [x] تنبيه تأخير للطلبات الأونلاين
- [x] إعلان جماعي للأونلاين فقط من الديسكتوب
- [x] عدّ مباشر للمستلمين عبر Desktop Gateway (`student_email`, `telegram_chat_id`)
- [x] API الإعلان يعمل عبر activation token بدون مفاتيح Supabase داخل الديسكتوب

### 2.5 — Deploy + Operations ✅
- [x] Vercel production deployment
- [x] إعدادات runtime للديسكتوب عبر `runtime-config.json`
- [x] توثيق متغيرات البيئة في `.env.example` و`docs/SETUP.md`

**مخرجات Phase 2**: الطالب يقدر يرفع من خارج المكتب. صاحب المكتب يشوف طلبات Online وLocal في واجهة واحدة، والإعلانات الجماعية تعمل لمستلمي Online فقط.

---

## Phase 3 — Dashboard hardening + validation ✅

**الحالة**: منفّذ كتحسينات عملية على الدشبورد.

### 3.1 — Workflow actions ✅
- [x] `طباعة` يضيف الطلب لطابور الطباعة ويفتح الملف/الملفات للتنفيذ
- [x] `جاهز` ينقل الطلب إلى `ready` ويفتح تبويب الجاهز مع مسح الفلاتر المخفية
- [x] `تم التسليم` ينقل الطلب إلى `done` ويفتح الأرشيف
- [x] حذف طلب Online يلغي Mirror في Supabase أولاً

### 3.2 — Filters + stats ✅
- [x] فلاتر المصدر والدفع والحالة والبحث
- [x] إحصائيات أعلى الدشبورد للجاهز، الأونلاين، المحلي، المدفوعات، والملفات التي تحتاج إصلاح
- [x] معالجة الصفحات الفارغة عند تغير الفلاتر أو العدد

### 3.3 — Online announcement UI ✅
- [x] عرض أخطاء واضحة في واجهة الإعلان
- [x] منع إرسال إعلان بلا مستلمين
- [x] عدّ Email/Telegram من Supabase حتى لو تعذر Web API preview

**مخرجات Phase 3**: أزرار الدشبورد ومسارات Online/Local موثقة ومختبرة TypeScript/build.

---

## Phase 4 — Packaging & Operations ✅

**الحالة**: تسليم أول جاهز بالإصدارات اليدوية على GitHub Releases.
**الهدف**: installer جاهز + إصدارات macOS/Windows + تشغيل متعدد المكاتب.

### 4.1 — Installer (يوم)
- [x] `electron-builder` config
- [x] Build `.dmg` و `.zip` للـ Mac Apple Silicon وIntel
- [x] Build `.exe` للـ Windows x64 بنسخة Installer وPortable
- [x] App icon + splash screen
- [ ] Code signing / notarization رسمي

### 4.2 — Auto-Update (نصف يوم)
- [ ] `electron-updater` + GitHub Releases
- [ ] Staged rollout: 10% → 50% → 100%
- [ ] Rollback button للـ admin
- [ ] Changelog في الـ release notes

### 4.3 — Auto-Cleanup (نصف يوم)
- [ ] Cron داخل التطبيق يحذف ملفات > 7 أيام من الاكتمال
- [ ] Supabase Edge Function لنفس الشي على Storage
- [ ] تنبيه قبل الحذف (24 ساعة)

### 4.4 — Backup & Sync (يوم)
- [ ] Daily backup لـ SQLite → مجلد منفصل
- [ ] Sync الطلبات المكتملة Offline → `archive_offline` في Supabase
- [ ] تشغيل يدوي من Dashboard لحالات الطوارئ

### 4.5 — الاختبار النهائي (نصف يوم)
- [ ] اختبار كامل في بيئة مكتب فعلية
- [ ] اختبار مع 10+ أجهزة مختلفة
- [ ] stress test: 20 طلب متزامن
- [ ] اختبار sleep/wake/restart scenarios

**مخرجات Phase 4**: منتج جاهز للتسليم الأولي لكل مكتب طباعة/مكتبة مسجلة، مع إصدارات desktop يدوية عبر GitHub Releases.

---

## المعالم الزمنية

| المعلم | بعد نهاية Phase |
|--------|-----------------|
| Offline يشتغل داخل المكتب | Phase 1 |
| Online يشتغل خارج المكتب | Phase 2 / 3 |
| إشعارات خارجية | Phase 3 |
| جاهز للتسليم للمكاتب | Phase 4 |

---

## قرارات الأولوية

- **Offline يسبق Online دائماً**: لأنه القلب.
- **اعتمادية تسبق ميزات**: ما نضيف ميزة جديدة قبل ما الأساس صلب.
- **Desktop أهم من Web**: صاحب المكتب عنده جهاز تشغيل واحد، الطلاب متعددين لكن صفحتهم بسيطة.
- **اختبار يدوي في كل phase**: قبل الانتقال للـ next.

</div>
