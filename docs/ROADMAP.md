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

## Phase 1 — MVP Offline 🚧

**المدة المتوقعة**: 5-7 أيام.
**الهدف**: ملاك تقدر ترفع ملف، سعد يشوفه ويطبعه. بدون online.

### 1.1 — Monorepo Setup (نصف يوم)
- [ ] `pnpm-workspace.yaml` + `turbo.json` + `package.json` في الجذر
- [ ] إنشاء `apps/web`, `apps/desktop`, `packages/shared`, `packages/db-schema`, `packages/ui`
- [ ] TypeScript config موحّد (`tsconfig.base.json`)
- [ ] ESLint + Prettier + Husky pre-commit hooks
- [ ] `.gitignore` شامل
- [ ] إنشاء GitHub repo + initial commit
- [ ] **R6**: إضافة `@electron/rebuild` + `postinstall` script لبناء `better-sqlite3` للـ Electron ABI
  ```json
  "scripts": {
    "postinstall": "electron-rebuild -f -w better-sqlite3"
  }
  ```
  بدونه: `better-sqlite3` يبني لـ Node ABI ويفشل في Electron.

### 1.2 — Shared Package (نصف يوم)
- [ ] `packages/shared/src/schemas.ts` — Zod schemas (PrintRequest, StudentForm, FileUpload)
- [ ] `packages/shared/src/constants.ts` — DEPARTMENTS, STAGES, PAPER_SIZES, FILE_WHITELIST
- [ ] `packages/shared/src/types.ts` — types مشتقة من schemas
- [ ] Export كل شي من `index.ts`

### 1.3 — DB Schema (يوم)
- [ ] `packages/db-schema/src/schema.ts` — Drizzle tables (SQLite variant + PG variant)
- [ ] `drizzle.config.ts` — للـ SQLite محلي + Postgres Supabase
- [ ] Migrations folder: `packages/db-schema/migrations/`
- [ ] Scripts في `package.json`: `db:generate`, `db:push`

### 1.4 — Electron Shell (يوم)
- [ ] `apps/desktop/main/index.ts` — BrowserWindow + loadURL للـ Next.js
- [ ] `apps/desktop/preload/index.ts` — IPC bridge
- [ ] `apps/desktop/main/ip-check.ts` — يتحقق من IP = 192.168.0.100
- [ ] `apps/desktop/main/sleep-guard.ts` — يمنع Sleep (powerSaveBlocker)
- [ ] `apps/desktop/main/auto-start.ts` — يضيف للـ login items
- [ ] Electron dev mode يشتغل مع Next.js dev server

### 1.5 — Fastify Server داخل Electron (يوم ونصف)
- [ ] `apps/desktop/main/server.ts` — Fastify يبدأ على port 3000
- [ ] `apps/desktop/main/db.ts` — better-sqlite3 + Drizzle + WAL mode
- [ ] `POST /api/upload` — tus.io endpoint
- [ ] `POST /api/requests` — إنشاء طلب جديد
- [ ] `GET /api/requests` — قائمة الطلبات (للـ dashboard)
- [ ] `PATCH /api/requests/:id` — تحديث status
- [ ] WebSocket endpoint للتحديث اللحظي

### 1.6 — صفحة رفع الطالب `/u` (يوم)
- [ ] `apps/web/app/u/page.tsx` — نموذج الرفع
- [ ] React Hook Form + Zod validation
- [ ] Dropzone للملفات + preview
- [ ] tus-js-client للرفع المقاوم للانقطاع
- [ ] progress bar + نسبة مئوية
- [ ] صفحة تأكيد مع رقم التذكرة

### 1.6.5 — Cleanup cron للـ tus abandoned uploads (Z6)
- [ ] `apps/desktop/main/cleanup.ts` — يحذف ملفات upload أقدم من 24 ساعة غير مكتملة
- [ ] يشتغل يومياً عبر `setInterval` + عند app startup

### 1.7 — Dashboard سعد (يوم)
- [ ] `apps/web/app/dashboard/page.tsx` — قائمة الطلبات
- [ ] WebSocket للتحديث اللحظي + صوت تنبيه
- [ ] تفاصيل الطلب (metadata فقط، بلا preview داخلي)
- [ ] الأزرار placeholders (الربط الفعلي في Phase 3)
- [ ] Filter بالـ status + تاريخ + Pagination 50/صفحة (C12)
- [ ] **Lock screen overlay (Z5)** — يظهر بعد 15 دقيقة idle + re-enter password (D6)

### 1.8 — QR Generator (نصف يوم)
- [ ] `apps/desktop/main/qr.ts` — توليد QR عبر `qrcode`
- [ ] صفحة Settings في dashboard → Print Wall Signs
- [ ] PDF جاهز للطباعة (A4) بتصميم حائط المكتبة

### 1.9 — Polish + اختبار يدوي (نصف يوم)
- [ ] اختبار مع iOS + Android حقيقي
- [ ] تجربة رفع ملفات مختلفة الأحجام
- [ ] تجربة انقطاع شبكة أثناء الرفع
- [ ] تصحيح أي مشاكل

**مخرجات Phase 1**: ملاك تقدر تستخدم النظام بالكامل. سعد عنده لوحة شغّالة. بدون online.

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

## Phase 3 — الأزرار الثلاثة ومراحل الطلب 🖨️

**المدة المتوقعة**: 1-2 يوم.
**الهدف**: أزرار عرض/طباعة/جهز شغّالة + state machine — **بلا أي معالجة للملفات** (D1).

### 3.1 — Electron IPC Handlers (نصف يوم)
- [ ] `apps/desktop/main/ipc.ts`
- [ ] `file:open` → `shell.openPath(filePath)`
- [ ] `file:print` → PDF/صور عبر `webContents.print({silent:false})`؛ DOCX على Windows عبر `rundll32 ... print`؛ على Mac عبر `shell.openPath` (سعد يضغط Cmd+P)
- [ ] Preload bridge مع whitelist channels

### 3.2 — الأزرار الثلاثة في Dashboard (نصف يوم)
- [ ] 👁️ **عرض** — يستدعي `file:open`
- [ ] 🖨️ **طباعة** — يستدعي `file:print`، يفتح Dialog النظام الأصلي
- [ ] ✅ **جهز** — modal لإدخال السعر → POST `/api/requests/:id/done` → status=done + إشعار

### 3.3 — مراحل الطلب (نصف يوم)
- [ ] State machine: `pending → printing → done | blocked | canceled`
- [ ] زر **blocked** مع reason (G4)
- [ ] timestamps لكل انتقال
- [ ] update daily_revenue عند done (H6)

**مخرجات Phase 3**: سعد عنده 3 أزرار، الطباعة عبر Dialog النظام الأصلي، بدون أي معالجة ملفات.

---

## Phase 4 — Production 🚀

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
| Online يشتغل مع بلال | Phase 2 |
| طباعة زر واحد | Phase 3 |
| جاهز للتسليم لسعد | Phase 4 |

---

## قرارات الأولوية

- **Offline يسبق Online دائماً**: لأنه القلب.
- **اعتمادية تسبق ميزات**: ما نضيف ميزة جديدة قبل ما الأساس صلب.
- **Desktop أهم من Web**: سعد عنده جهاز واحد، الطلاب متعددين لكن صفحتهم بسيطة.
- **اختبار يدوي في كل phase**: قبل الانتقال للـ next.

</div>
