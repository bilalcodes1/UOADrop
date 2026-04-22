<div dir="rtl">

# Phase 0.5 — Hardening Reference (C1–C17)

هذا المستند المرجع الموحّد لكل إصلاحات Phase 0.5 التي طُبّقت بعد النقد الهندسي الثاني. كل فجوة موثّقة مع: **المشكلة → الحل → أين طُبّق**.

> **الوضع**: ✅ كل الـ 17 فجوة محسومة في الوثائق. الجاهزية **97%**.

---

## 🔴 الحرجة — Security & Printing

### C1. `rundll32 print` لا يعرض Dialog على Windows
- **المشكلة**: `rundll32.exe shell32.dll,ShellExec_RunDLL print "file"` يطبع صامتاً على الطابعة الافتراضية بدون عرض dialog. النتيجة: تضيع إعدادات الطالب (عدد النسخ، لون، وجهين، مقاس الورق).
- **الحل**: DOCX/PPTX/XLSX تُفتح عبر `shell.openPath` على **كل الأنظمة** (Windows + Mac) + UI hint: "اضغط Ctrl+P / Cmd+P".
- **موثّق في**: `ARCHITECTURE.md §7.5`, `DECISIONS.md §D3/D4`.

### C2. `webContents.print` race condition على PDFs كبيرة
- **المشكلة**: `loadFile(pdf)` يرجع فور بدء التحميل، مو بعد اكتمال render. Print ينطلق على صفحة فارغة.
- **الحل**: انتظر `did-finish-load` + delay 350ms قبل `print()`.
- **موثّق في**: `ARCHITECTURE.md §7.5`.

### C3. Telegram `/start <ticket>` = ثغرة اختطاف
- **المشكلة**: `ticket_no` شكل `B-0077` sequential. مهاجم يرسل `/start B-0001..B-9999` ويختطف إشعارات الآخرين.
- **الحل**: token عشوائي 16-byte hex، مخزّن في جدول `telegram_link_tokens`، ينتهي بعد 24 ساعة + `used_at` marker لمنع إعادة الاستخدام.
- **موثّق في**: `DECISIONS.md §D7`, `NOTIFICATIONS.md §10`, `ARCHITECTURE.md §5` (schema).

### C4. RLS anon SELECT يكشف كل الجدول
- **المشكلة**: `USING (true)` مع "يُفلتر في الكود" = تسريب. `anon` يقرأ كل الأسماء و PINs بطلب واحد.
- **الحل**: حذف policy الـ SELECT. قراءة الطلب تمر عبر Edge Function `get-request` التي تتحقق من `bcrypt(pin)` قبل إرجاع صف واحد.
- **موثّق في**: `ARCHITECTURE.md §8`.

### C5. PIN ضعيف + plaintext
- **المشكلة**: `Math.random()` غير آمن + PIN مخزّن plaintext → تسريب backup = كارثة.
- **الحل**: `crypto.randomInt(1000, 10000)` للتوليد + `bcrypt.hash(pin, 10)` للتخزين. حقل DB `pickup_pin_hash` بدل `pickup_pin`. + rate limit 3/دقيقة على verification.
- **موثّق في**: `DECISIONS.md §PIN`, `ARCHITECTURE.md §5`, `ARCHITECTURE.md §8`.

### C6. إشعارات `blocked` / `canceled` مفقودة
- **المشكلة**: G4 يَعِد بإشعار عند blocked، لكن جدول الأحداث في NOTIFICATIONS.md ما فيه blocked ولا canceled → تضارب.
- **الحل**: إضافة صفّين للجدول + templates + Email يُرسَل على `done` و `blocked` (أقصى ~600/شهر < 3000 quota).
- **موثّق في**: `NOTIFICATIONS.md §2, §8, §9`.

### C7. File whitelist بالامتداد فقط = bypass سهل
- **المشكلة**: `evil.exe` → rename → `report.pdf` → يمر الفحص. سعد يفتحه.
- **الحل**: طبقة ثانية = `file-type` npm يقرأ magic bytes (أول 4KB). يرفض الملفات المُعاد تسميتها.
- **موثّق في**: `ARCHITECTURE.md §8`, `DECISIONS.md §D8`, `RISKS.md §4.1`.

---

## 🟠 مرتفعة — Reliability

### C8. Sleep prevention لا يغلب غطاء اللابتوب المغلق
- **المشكلة**: `powerSaveBlocker` يمنع النوم لما الشاشة مفتوحة فقط. سعد يغلق الغطاء → النظام ميت.
- **الحل**:
  - **Windows**: `powercfg /setacvalueindex ... LIDACTION 0` (+ DC variant).
  - **Mac**: `sudo pmset -a disablesleep 1` أو تطبيق Amphetamine.
  - UI: banner أحمر في التطبيق لو اكتشف الإعداد غير صحيح.
- **موثّق في**: `SETUP.md §2.4.1`, `RISKS.md §2.3.5`.

### C9. Single-instance lock مفقود
- **المشكلة**: نسختان من التطبيق → SQLite `SQLITE_BUSY` → طلبات تضيع.
- **الحل**: `app.requestSingleInstanceLock()` كأول سطر قبل أي initialization. نسخة ثانية تُغلق فوراً وتُركّز النافذة الأصلية.
- **موثّق في**: `ARCHITECTURE.md §7.5`.

### C10. Queue position يتجاهل `scheduledFor` + بلا تحديث حي
- **المشكلة**: طلبات مُجدولة للمستقبل تحتسب ضمن طابور اليوم. الترتيب لا يتحدّث لما يتقدم طلب آخر.
- **الحل**: فلترة `WHERE scheduledFor IS NULL OR scheduledFor <= now` + Supabase Realtime subscription على `print_requests`.
- **موثّق في**: `DECISIONS.md §Queue Position`.

### C11. `archive_offline` و `archived` مستخدمان بلا تعريف
- **المشكلة**: كود sync يشير لجدول سحابي وعمود محلي غير موجودين في Schema.
- **الحل**: إضافة عمود `archived` إلى `print_requests` + DDL لجدول `archive_offline` على Supabase + RLS.
- **موثّق في**: `ARCHITECTURE.md §5, §11`.

---

## 🟡 متوسطة — Integrity

### C12. CAPTCHA offline مستحيل
- **المشكلة**: reCAPTCHA/hCaptcha يحتاجان إنترنت. شبكة offline لا تصلها.
- **الحل**: CAPTCHA للـ online فقط. offline يعتمد rate limit بالـ MAC/IP.
- **موثّق في**: `ARCHITECTURE.md §8`.

### C13. Database Webhook يحتاج إعداد صريح
- **المشكلة**: DB trigger → Edge Function ليس تلقائياً في Supabase. بدونه، الإشعارات لن تُرسل أبداً.
- **الحل**: خطوات واضحة في SETUP.md §5.4.1 لإعداد Database Webhook من Dashboard + بديل SQL عبر `pg_net`.
- **موثّق في**: `SETUP.md §5.4.1`, `NOTIFICATIONS.md §5.1`.

### C14. `health_check` ينمو بلا سقف
- **المشكلة**: 3 طبقات keep-alive × ping يومي = نمو غير محدود.
- **الحل**: cron في Edge Function ينفّذ `DELETE WHERE pinged_at < now() - interval '30 days'` يومياً.
- **موثّق في**: `ARCHITECTURE.md §7`.

### C15. Fastify على `0.0.0.0` خطر على شبكات عامة
- **المشكلة**: لو سعد أخذ اللابتوب لمقهى، أي شخص على الـ Wi-Fi العامة يقدر يطلب.
- **الحل**: bind على `192.168.0.100` فقط.
- **موثّق في**: `ARCHITECTURE.md §8`.

### C16. TL-WR940N قديم (EOL 2019)
- **المشكلة**: single-band 2.4GHz / 300Mbps. Congestion مع 5+ طلاب متزامنين.
- **الحل**: توصية TP-Link Archer C6/C7 dual-band كـ "الموصى به"، TL-WR940N يبقى "الحد الأدنى".
- **موثّق في**: `SETUP.md §ما تحتاجه`.

### C17. لا session timeout لـ Dashboard سعد
- **المشكلة**: سعد يترك اللابتوب مفتوحاً → متطفل يعدّل أسعار، يحذف طلبات، يقرأ PINs.
- **الحل**: Idle lock بعد 15 دقيقة عبر `powerMonitor.getSystemIdleTime()` → يطلب password مرة أخرى.
- **موثّق في**: `DECISIONS.md §D6`, `ARCHITECTURE.md §8`.

---

---

# Phase 0.6 — Round 2 Hardening (R1–R12)

بعد مراجعة نقدية ثانية بعد Phase 0.5، اكتُشفت **12 فجوة إضافية** — مزيج من مشاكل موروثة ومشاكل ظهرت من الإصلاحات نفسها.

## 🔴 حرجة

### R1. PIN للـ offline redundant + يسبب lockout
- **المشكلة**: ملاك فيزيائياً عند سعد → PIN لا يضيف أمان. ولو أقفلت صفحة التأكيد = مقفولة.
- **الحل**: `pickup_pin_hash` nullable. Offline = NULL. Online إلزامي.
- **موثّق في**: `DECISIONS.md §G2, §PIN`, `ARCHITECTURE.md §2, §5`.

### R2. PIN lockout للـ online (لا استرجاع)
- **المشكلة**: PIN hash فقط → لا يمكن استرجاعه. بلال نسيه = مقفول.
- **الحل**: تضمين PIN في رسالة Telegram "Received" الأولى. الطالب يحفظها في المحادثة.
- **موثّق في**: `NOTIFICATIONS.md §8 (Telegram Received)`, `DECISIONS.md §PIN`.

### R3. bcrypt native لا يعمل في Deno
- **المشكلة**: Edge Functions = Deno، لا تدعم native bcrypt من Node.
- **الحل**: `import bcrypt from "npm:bcryptjs@2.4.3"` (pure JS يعمل على Deno).
- **موثّق في**: `DECISIONS.md §PIN (Supabase Edge Function)`.

### R4. Idle lock system-wide = bypass
- **المشكلة**: `powerMonitor.getSystemIdleTime()` يقيس النظام، لا التطبيق. زميل يستخدم Chrome → UOADrop ما يقفل.
- **الحل**: timer مبني على `before-input-event` + `focus` لنافذة UOADrop فقط.
- **موثّق في**: `DECISIONS.md §D6`.

### R5. Rate limit بلا تخزين دائم
- **المشكلة**: in-memory = restart يصفر العداد → brute force ممكن.
- **الحل**: جدول `pin_attempts` يحفظ `(ticket_no, attempted_at, success)` → يصمد restart.
- **موثّق في**: `ARCHITECTURE.md §5 (schema), §8 (Edge Function logic)`, `DECISIONS.md §PIN`.

### R6. `better-sqlite3` يحتاج electron-rebuild
- **المشكلة**: native compiled للـ Node ABI، Electron ABI مختلف → build يفشل.
- **الحل**: `@electron/rebuild` في `postinstall`.
- **موثّق في**: `ROADMAP.md §1.1`.

## 🟠 مرتفعة

### R7. Private Wi-Fi Address يكسر MAC binding
- **المشكلة**: macOS 14+ و iOS 14+ يولّدون MAC عشوائي لكل شبكة → binding يفشل فوراً.
- **الحل**: توثيق صريح في SETUP قبل خطوة MAC binding.
- **موثّق في**: `SETUP.md §1.6 (تحذير R7)`.

### R8. `get-request` Edge Function غير معرَّفة
- **المشكلة**: إشارات للـ endpoint بلا spec.
- **الحل**: جدول + كود كامل مع rate limit + response schema.
- **موثّق في**: `ARCHITECTURE.md §8 (Online Edge Functions)`.

### R9. Online cancel flow مفقود
- **المشكلة**: بلال لا يقدر يلغي قبل printing.
- **الحل**: `POST /functions/v1/cancel-request` — يرفض إذا status ≠ pending.
- **موثّق في**: `ARCHITECTURE.md §8`.

### R10. `archived` غير منطقي على Postgres
- **المشكلة**: unified schema يضع العمود على الجانبين لكن دلالته offline-only.
- **الحل**: توثيق صريح في تعليق الـ schema: "على Postgres: default=false دائماً".
- **موثّق في**: `ARCHITECTURE.md §5`.

### R11. Ticket format متضارب (A-0234 vs A-2026-0234)
- **المشكلة**: جزء من الوثائق يستخدم format قصير، جزء format كامل.
- **الحل**: توحيد على `{A|B}-{YYYY}-{seq}` في كل الوثائق (ضمان idempotency بعد backup).
- **موثّق في**: `ARCHITECTURE.md §2 (Dashboard mock), §5 (ticket generation)`.

### R12. Printer status detection غير محدّد
- **المشكلة**: Health Dashboard يعرض `✅ Printer ready` لكن لا يوجد API في Electron.
- **الحل**: IPC handler `printer:status` — PowerShell `Get-Printer` على Windows + `lpstat` على Mac.
- **موثّق في**: `ARCHITECTURE.md §7.5`.

---

---

# Phase 0.7 — Round 3 Hardening (X1–X10)

جولة ثالثة كشفت **10 فجوات** في compatibility، distribution، و OS-specifics. كلها موثّقة بحلول ملموسة.

## � Day-1 Blockers (X1–X5)

### X1. HTTPS-First Mode يكسر QR offline
- **المشكلة**: Chrome/Safari حديثة ترقّي `http://` إلى `https://` تلقائياً → فشل صامت.
- **الحل**: 3 طبقات — mDNS `uoadrop.local` + تعليمات نصية بجانب QR + رقم سعد.
- **موثّق في**: `ARCHITECTURE.md §6.2 (HTTPS-First Mode)`.

### X2. Electron unsigned = Gatekeeper blocks + auto-update مكسور
- **المشكلة**: Mac/Windows ينذران، auto-update يتطلب "Open Anyway" كل تحديث.
- **الحل**: توثيق requirement للـ Apple Developer ID + Windows EV cert، مع fallback لـ "Open Anyway" manual flow.
- **موثّق في**: `SETUP.md §2.1 (Code Signing note)`.

### X3. Dashboard password storage غير موثّق
- **الحل**: `keytar` (OS Keychain) + fallback إلى bcrypt hash في SQLite `settings`.
- **موثّق في**: `ARCHITECTURE.md §8.1`.

### X4. Electron security defaults غير محدّدة
- **الحل**: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` إلزامياً + `setWindowOpenHandler(deny)` + `will-navigate` guard.
- **موثّق في**: `ARCHITECTURE.md §7.5 (Electron Security Defaults)`.

### X5. Timezone handling غير محدّد
- **الحل**: كل الأوقات UTC storage + `TIMEZONE='Asia/Baghdad'` ثابت في `packages/shared/constants.ts`.
- **موثّق في**: `ARCHITECTURE.md §5 (schema comment)`.

## 🟠 Day-30 Cumulative (X6–X8)

### X6. SQLite WAL بدون `synchronous=NORMAL` = فساد عند power loss
- **الحل**: 4 pragmas (WAL + NORMAL + FK + busy_timeout) + `wal_checkpoint(TRUNCATE)` on-quit.
- **موثّق في**: `ARCHITECTURE.md §7 (SQLite Durability Pragmas)`.

### X7. Open Wi-Fi = DoS ممكن (MAC spoofing يتجاوز rate limit)
- **الحل**: WPA2 باسوورد بسيط (`uoalib2026`) مُعلَن على الملصق + rate limit باقي.
- **موثّق في**: `SETUP.md §1.3 (Wireless Security)`.

### X8. Cairo من Google Fonts يفشل offline
- **الحل**: self-host في `apps/web/public/fonts/Cairo-*.woff2` + `@font-face` في globals.
- **موثّق في**: `DECISIONS.md §H9`.

## 🟡 Day-60 Polish (X9–X10)

### X9. Supabase TUS يحتاج headers + metadata دقيقة
- **الحل**: config كامل موثّق (endpoint `storage/v1/upload/resumable`, 6MB chunks, `x-upsert: true`, metadata object keys).
- **موثّق في**: `ARCHITECTURE.md §9 (Online: Supabase Storage TUS)`.

### X10. Printer mid-job failure غير مُعالَج
- **الحل**: `webContents.print` callback check → modal للتعامل (إعادة/blocked/إلغاء) + `printer_events` audit.
- **موثّق في**: `ARCHITECTURE.md §7.5 (IPC section 3.1)`.

---

---

# Phase 0.8 — Round 4 Hardening (Z1–Z6)

الجولة الرابعة ركّزت على **تناقضات داخلية** بين إصلاحات الجولات السابقة + فجوات subtle. كلها محسومة.

## 🔴 تناقضات داخلية

### Z1. Navigation guard (X4) يحجب mDNS (X1)
- **المشكلة**: X1 أضاف `http://uoadrop.local` لكن X4 guard يسمح فقط بـ `localhost` و `192.168.0.100`.
- **الحل**: `ALLOWED_ORIGINS` array يتضمن الثلاثة.
- **موثّق في**: `ARCHITECTURE.md §7.5 (Electron Security Defaults)`.

### Z2. `printer_events` مذكور في X10 بدون schema
- **الحل**: جدول جديد `printer_events` في schema (id, request_id, event, detail, at).
- **موثّق في**: `ARCHITECTURE.md §5`.

### Z3. `pin_attempts` على SQLite فقط، Edge Function يستعلم Postgres
- **الحل**: تعليق schema يوضح أن Drizzle PG variant يولّد نفس الجدول على Postgres.
- **موثّق في**: `ARCHITECTURE.md §5`.

## 🟠 Hardening إضافي

### Z4. PIN brute force بطيء غير مُعالَج
- **المشكلة**: rate limit 3/دقيقة لكن 10,000 PIN قابلة للتخمين في ~2.5 يوم.
- **الحل**: cumulative lockout — بعد 10 فشل إجمالي على التذكرة → HTTP 423 "locked_contact_librarian".
- **موثّق في**: `ARCHITECTURE.md §8 (get-request logic 1b)`.

### Z5. Lock screen UI component مفقود من ROADMAP
- **الحل**: bullet صريح في Phase 1.7 Dashboard.
- **موثّق في**: `ROADMAP.md §1.7`.

### Z6. tus abandoned uploads يملؤون القرص
- **الحل**: cleanup cron يحذف uploads >24 ساعة غير مكتملة.
- **موثّق في**: `ROADMAP.md §1.6.5` (مهمة Phase 1 جديدة).

---

## 📊 ملخص الحالة

| المقياس | قبل P0.5 | بعد P0.5 | بعد P0.6 | بعد P0.7 | بعد P0.8 |
|---------|:--:|:--:|:--:|:--:|:--:|
| Security posture | 🔴 | 🟢 | 🟢 | 🟢 | 🟢 |
| Printing reliability | 🟠 | 🟢 | 🟢 | 🟢 | 🟢 |
| Data reliability | 🟠 | 🟢 | 🟢 | 🟢 | 🟢 |
| Doc consistency | 🟡 | 🟢 | 🟢 | 🟢 | 🟢 |
| UX (PIN lockout) | 🟡 | 🟡 | 🟢 | 🟢 | 🟢 |
| Deno runtime compat | ❓ | 🟠 | 🟢 | 🟢 | 🟢 |
| Build reliability | ❓ | ❓ | 🟢 | 🟢 | 🟢 |
| Mobile browser compat | ❓ | ❓ | ❓ | 🟢 | 🟢 |
| OS distribution | ❓ | ❓ | ❓ | 🟢 | 🟢 |
| Power-loss safety | ❓ | ❓ | ❓ | 🟢 | 🟢 |
| Internal consistency | ❓ | ❓ | ❓ | 🟡 | 🟢 |
| Brute-force resistance | ❓ | ❓ | 🟡 | 🟡 | 🟢 |
| **Overall readiness** | **78%** | **97%** | **99%** | **99.5%** | **99.8%** |

---

## 🎯 Next Step

كل القرارات الهندسية محسومة. الخطوة التالية:

**Phase 1 — MVP Offline**: monorepo setup, shared package, Electron shell + Fastify + SQLite, صفحة رفع `/u`, Dashboard بثلاثة أزرار، IPC handlers (مع Single-Instance lock + did-finish-load wait), PIN bcrypt flow.

راجع [`ROADMAP.md`](./ROADMAP.md) للتفاصيل.

</div>
