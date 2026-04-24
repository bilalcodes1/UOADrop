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
- [x] `docs/SETUP.md` — دليل سعد
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
- [x] ربط الخادم على `0.0.0.0` ليتاح عبر الشبكة المحلية داخل المكتبة

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

### 1.7 — Dashboard المكتبة ✅
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
- [ ] اختبار مع iOS + Android حقيقي (يحتاج جهاز سعد على شبكة حقيقية)
- [ ] اختبار سيناريو طلب متعدد الملفات بإعدادات مختلفة لكل ملف

**مخرجات Phase 1**: الطالب يرفع الملفات محلياً من المتصفح، ولكل ملف إعداداته الخاصة، وتظهر له واجهة محلية مكتملة الهوية البصرية، وسعد يدير الطلب من لوحة شغالة بالكامل داخل Electron.

---

## Phase 2 — Online Integration 🌐

**المدة المتوقعة**: 4-5 أيام.
**الهدف**: بلال يقدر يرفع من خارج المكتبة، يتلقى إشعارات على Email/Telegram، ودمج القائمتين عند سعد.

### 2.1 — Supabase Setup (نصف يوم)
- [ ] إنشاء project على `supabase.com`
- [ ] Region: Frankfurt
- [ ] Push schema عبر `drizzle-kit push:pg`
- [ ] إنشاء Storage bucket: `print-files`
- [ ] ضبط Storage policies
- [ ] ضبط RLS على الجداول
- [ ] حفظ `SUPABASE_URL` + `SUPABASE_ANON_KEY` في `.env`

### 2.2 — Online Upload API (يوم)
- [ ] `apps/web/app/api/requests/route.ts` — POST يُدخل في Supabase
- [ ] Upload مباشر لـ Supabase Storage من الـ client (signed URL)
- [ ] نفس صفحة `/u` تكتشف: `process.env.MODE === 'online'`
- [ ] Ticket generation: `B-XXXX` من Postgres sequence

### 2.3 — Realtime في Dashboard (يوم)
- [ ] Supabase client في desktop app
- [ ] Subscribe على `print_requests` channel
- [ ] دمج مع WebSocket المحلي → قائمة موحّدة في UI
- [ ] تمييز 📡 vs 🌐 في كل بطاقة

### 2.4 — Keep-Alive 3 طبقات (يوم)
- [ ] `apps/desktop/main/keepalive.ts` — ping كل 12 ساعة
- [ ] `supabase/functions/keepalive/index.ts` — Edge Function
- [ ] Deploy: `supabase functions deploy keepalive`
- [ ] تسجيل في cron-job.org + إعداد schedule يومي
- [ ] `.github/workflows/keepalive.yml` — backup layer
- [ ] Health Dashboard يعرض آخر ping من كل مصدر

### 2.5 — نظام الإشعارات لبلال (يوم ونصف) 📨
**تفاصيل كاملة في [`NOTIFICATIONS.md`](./NOTIFICATIONS.md).**

#### Email (Resend)
- [ ] إنشاء حساب Resend + API key
- [ ] Verify domain `uoadrop.app` (أو استخدام `onboarding@resend.dev` مؤقتاً)
- [ ] إضافة حقل `email` (اختياري) لنموذج الرفع — Online فقط
- [ ] قالب HTML واحد فقط لحدث `done` (توفير quota)
- [ ] rate limit: 5 طلبات/ساعة لكل email

#### Telegram
- [ ] إنشاء بوت عبر [@BotFather](https://t.me/BotFather) → `@UOADropBot`
- [ ] حفظ `TELEGRAM_BOT_TOKEN` في env
- [ ] زر "اربط حسابك" في صفحة التأكيد → `t.me/UOADropBot?start=<ticket>`
- [ ] Edge Function `telegram-webhook` يستقبل `/start` و `/stop`
- [ ] setWebhook لربط البوت بالـ Edge Function

#### Notify Engine
- [ ] جدول `notifications_log` في Supabase
- [ ] Edge Function `notify` يُستدعى من DB trigger
- [ ] إرسال بالتوازي (Email + Telegram)
- [ ] Retry strategy: 1 min → 10 min → failed
- [ ] Cron كل 5 دقائق لـ retry
- [ ] قسم جديد في Health Dashboard لإحصائيات الإشعارات

#### حقول DB الإضافية
- [ ] `email`, `telegram_username`, `telegram_chat_id`, `notify_preferences`
- [ ] migration في `packages/db-schema`

### 2.6 — Vercel Deployment (نصف يوم)
- [ ] ربط GitHub repo بـ Vercel
- [ ] Environment variables
- [ ] Custom domain setup (`uoadrop.app` إذا متوفر، أو `uoadrop.vercel.app`)
- [ ] اختبار من موبايل خارج المكتبة

**مخرجات Phase 2**: بلال يقدر يرفع من البيت. سعد يشوف كل الطلبات في واجهة واحدة.

---

## Phase 3 — Online + Notifications 🌐

**المدة المتوقعة**: 2-4 أيام.
**الهدف**: إضافة نسخة online مرتبطة بالسحابة وإشعارات Email/Telegram للطلبات الخارجية.

### 3.1 — Cloud storage + online upload
- [ ] Supabase project + storage bucket + tables
- [ ] صفحة web/online مستقلة عن صفحة الرفع المحلية
- [ ] Request tracking للطلبات الأونلاين

### 3.2 — Notifications
- [ ] Telegram linking flow
- [ ] Email notifications عند الجاهزية أو التعذر
- [ ] Cloud-side request status API

### 3.3 — Unified visibility
- [ ] دمج الطلبات المحلية والسحابية داخل واجهة المكتبة عند الحاجة
- [ ] تمييز مصدر الطلب بوضوح في اللوحة

**مخرجات Phase 3**: الطلبات الخارجية تعمل وتصل إلى النظام مع الإشعارات المناسبة.

---

## Phase 4 — Packaging & Operations 🚀

**المدة المتوقعة**: 2-3 أيام.
**الهدف**: installer جاهز + auto-update + cleanup + backup.

### 4.1 — Installer (يوم)
- [ ] `electron-builder` config
- [ ] Build `.dmg` للـ Mac (Universal: Intel + ARM)
- [ ] Build `.exe` للـ Windows (NSIS)
- [ ] App icon + splash screen
- [ ] Code signing (لو متاح)

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
- [ ] اختبار كامل في بيئة المكتبة الفعلية
- [ ] اختبار مع 10+ أجهزة مختلفة
- [ ] stress test: 20 طلب متزامن
- [ ] اختبار sleep/wake/restart scenarios

**مخرجات Phase 4**: منتج جاهز للتسليم لسعد — مكتمل ونهائي.

---

## المعالم الزمنية

| المعلم | بعد نهاية Phase |
|--------|-----------------|
| Offline يشتغل مع ملاك | Phase 1 |
| Online يشتغل مع بلال | Phase 2 / 3 |
| إشعارات خارجية | Phase 3 |
| جاهز للتسليم لسعد | Phase 4 |

---

## قرارات الأولوية

- **Offline يسبق Online دائماً**: لأنه القلب.
- **اعتمادية تسبق ميزات**: ما نضيف ميزة جديدة قبل ما الأساس صلب.
- **Desktop أهم من Web**: سعد عنده جهاز واحد، الطلاب متعددين لكن صفحتهم بسيطة.
- **اختبار يدوي في كل phase**: قبل الانتقال للـ next.

</div>
