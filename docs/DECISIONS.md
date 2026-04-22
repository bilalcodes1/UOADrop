<div dir="rtl">

# قرارات المنتج النهائية

هذا المستند يوثّق كل قرارات المنتج (Product Decisions) المتّخذة بعد مراجعة الفجوات في [`GAPS.md`](./GAPS.md).

---

## 🔴 القرارات الحرجة (من المستخدم)

| # | الموضوع | القرار |
|---|---------|--------|
| G1 | **التسعير** | سعد يدخل السعر يدوياً عند التسليم — لا حاسبة تلقائية |
| G2 | **التحقق من المستلم** | **Online فقط** (R1): PIN 4 أرقام، يظهر في صفحة التأكيد **وفي رسالة Telegram الأولى** (R2). Offline: سعد يتحقّق بصرياً من الاسم لأن ملاك أمامه |
| G3 | **خارج ساعات الدوام** | الطلب يُقبل ويُجدول تلقائياً لصباح اليوم التالي |
| G4 | **الطابعة معطّلة** | حالة `blocked` + إشعار تلقائي للطالب مع سبب |
| G5 | **PDF محمي بكلمة سر** | **يصل كما هو** (لا فحص) — سعد يكتشف عند الطباعة |
| G6 | **ساعات الذروة** | Queue مرتّب + مؤشر "أنت رقم X من Y" في صفحة الطالب |
| G7 | **المحتوى الحساس** | النظام **غير مسؤول** — مجرد أداة طباعة، لا TOS ولا مراقبة |
| G8 | **بديل سعد** | حساب واحد فقط في MVP |

---

## 🎯 قرارات التبسيط النهائية (مُحكمة)

هذه القرارات اتُخذت بعد النقد الهندسي — تحافظ على البساطة القصوى.

### D1. لا معالجة ملفات نهائياً
- ❌ لا LibreOffice (DOCX→PDF).
- ❌ لا HEIC→JPG conversion.
- ❌ لا PDF validation (رفض المحمي).
- ❌ لا page counting تلقائي.
- ✅ **الملف يصل كما هو**. سعد يتعامل معه بأدواته.

### D2. تطبيق Desktop واحد فقط
- Electron shell واحد، بلا mini-apps أو خدمات خارجية.
- داخله: Next.js Dashboard + Fastify + SQLite.
- حجم متوقّع: **~85MB**.

### D3. ثلاثة أزرار في Dashboard
| الزر | الوظيفة | Implementation |
|-----|---------|----------------|
| 👁️ **عرض** | يفتح الملف بالتطبيق الافتراضي | `shell.openPath(filePath)` |
| 🖨️ **طباعة** | يفتح Dialog الطباعة الأصلي | PDF/صور → `webContents.print({silent:false})` (+ `did-finish-load` wait). DOCX/PPTX → `shell.openPath` + تنبيه Ctrl+P/Cmd+P (C1+C2) |
| ✅ **جهز** | يحدّث status=done + يرسل إشعار + يطلب السعر | update DB + notify + modal للـ price |

### D4. طباعة Cross-Platform (مُحدّث بـ C1)
| نوع الملف | Windows | Mac | الملاحظة |
|-----------|---------|-----|----------|
| PDF | Dialog Chromium الأصلي | Dialog Chromium الأصلي | تلقائي |
| صور | Dialog Chromium الأصلي | Dialog Chromium الأصلي | تلقائي |
| DOCX | Word يفتح + تنبيه للضغط Ctrl+P | Word/Pages + Cmd+P | يدوي الخطوة الأخيرة |
| PPTX | PowerPoint + Ctrl+P | PowerPoint + Cmd+P | يدوي الخطوة الأخيرة |

> **لماذا ليس `rundll32 print` للـ DOCX؟** يطبع صامتاً على الطابعة الافتراضية بدون dialog → تضيع إعدادات الطالب (نسخ، لون، وجهين). الحل الموحّد أوضح وأأمن.

### D5. الأنظمة المدعومة
- **Windows 10/11** — الجهاز الأساسي لسعد.
- **macOS 12+** — دعم ثانوي.
- Office أو Pages مُنصَح به للـ DOCX/PPTX.

### تأثير على Schema
- ❌ حذف `pages` من `request_files` (لن يُحسب تلقائياً).
- ✅ سعد يدخل عدد الصفحات بصرياً لو احتاج للحساب.

---

## 🟡 القرارات التلقائية (توصيات مُتبنّاة)

| # | الموضوع | القرار |
|---|---------|--------|
| H1 | **ساعات الدوام** | 8ص - 4م، مغلق الجمعة. قابل للتعديل من Settings |
| H2 | **الأقسام** | قائمة أولية 10 + زر "غير ذلك" — تتوسّع بالاستخدام |
| H3 | **الطابعة** | كل الخيارات متاحة، سعد يعطّل غير المدعوم من Settings |
| H4 | **Metadata بعد 7 أيام** | نحفظ (ticket, name, department, pages, price) للإحصاء، نحذف الملف فقط |
| H5 | **اللغة** | عربي فقط في MVP |
| H6 | **الدفع** | سجل يومي بسيط في Dashboard سعد (كم طلب × كم دينار) |
| H7 | **الاختبار** | Unit + Integration + 1 E2E Playwright |
| H8 | **Error Tracking** | Sentry free tier |
| H9 | **الخط العربي** | Cairo **self-hosted** في `apps/web/public/fonts/` (X8) — يعمل offline أيضاً. Google Fonts تفشل في شبكة `UOA-Print` المعزولة → fallback قبيح |
| H10 | **Scheduled Pickup** | حقل اختياري "الوقت المفضل" + تذكير Telegram قبل ساعة |
| ~~H11~~ | ~~تحويل الملفات~~ | ❌ **محذوف** — لا تحويل (راجع D1) |

---

## Schema إضافات على `print_requests`

الحقول الجديدة الناتجة من القرارات أعلاه:

```ts
pickupPin:     text('pickup_pin').notNull(),          // G2 — 4 أرقام
queuePosition: integer('queue_position'),             // G6 — ترتيب في الطابور
scheduledFor:  integer('scheduled_for',{ mode:'timestamp' }), // G3 + H10
status:        text('status').notNull().default('pending'),
// pending | printing | done | blocked | canceled       // G4 + G6
blockReason:   text('block_reason'),                  // G4
price:         integer('price'),                      // G1 — IQD، يدخله سعد
paid:          integer('paid',{ mode:'boolean' }).default(false),  // H6
```

---

## Schema جديد: `daily_revenue` (H6)

```sql
CREATE TABLE daily_revenue (
  date          DATE PRIMARY KEY,
  total_orders  INT NOT NULL DEFAULT 0,
  total_iqd     INT NOT NULL DEFAULT 0
);
```

يُحدَّث تلقائياً عند كل `status = 'done'` بقيمة `price`.

---

## Schema جديد: `settings` (H1 + H3)

```sql
CREATE TABLE settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);

-- افتراضيات
INSERT INTO settings VALUES
  ('working_hours',     '{"open":"08:00","close":"16:00","closed_days":["Friday"]}'),
  ('printer_duplex',    'true'),
  ('printer_color',     'true'),
  ('max_file_size_mb',  '50'),
  ('max_request_mb',    '200');
```

---

## منطق الأحداث والحالات (Status Flow)

```
                    ┌─────────────┐
                    │  pending    │ ← الحالة الافتراضية بعد الرفع
                    └──────┬──────┘
                           │
                  ┌────────┼────────┐
                  │        │        │
                  ▼        ▼        ▼
            ┌─────────┐ ┌─────────┐ ┌──────────┐
            │printing │ │canceled │ │ blocked  │ (طابعة/ورق/...)
            └────┬────┘ └─────────┘ └─────┬────┘
                 │                        │
                 ▼                        │
            ┌─────────┐                   │
            │  done   │ ← (+price + paid) │
            └─────────┘                   │
                 ▲                        │
                 └────────────────────────┘
                    (بعد حل المشكلة)
```

---

## آلية توليد الـ PIN (G2 + C5 + R1/R2/R3 hardened)

**Online فقط** — Offline: `pickup_pin_hash = NULL` (R1).

```ts
// على Node (Electron/Fastify): التوليد + حفظ hash
import { randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs'; // pure JS — يعمل على Node + Deno

function generatePin(): string {
  return randomInt(1000, 10000).toString(); // 1000..9999
}

if (source === 'online') {
  const pin = generatePin();
  const pinHash = await bcrypt.hash(pin, 10);
  // 1) نحفظ pinHash في DB
  // 2) نعرض pin للطالب في صفحة التأكيد
  // 3) نرسله في رسالة Telegram "Received" الأولى (R2) — الطالب يحفظها في المحادثة
}
```

**على Supabase Edge Function (Deno)** — R3:
```ts
// supabase/functions/get-request/index.ts
import bcrypt from "npm:bcryptjs@2.4.3"; // عبر Deno npm: — R3
const ok = await bcrypt.compare(input, row.pickup_pin_hash);
// بديل native: Deno.subtle + PBKDF2 — أسرع لكن يحتاج rewrite للـ hash format
```

**Rate limit مخزّن** (R5): 3 محاولات/دقيقة/ticket في جدول `pin_attempts` مع `(ticket_no, attempted_at)` — ليس in-memory حتى يصمد restart.

**لماذا bcrypt؟** PIN 4 أرقام ضعيف (10³ احتمال). لو تسرّب backup plaintext → كل PINs مكشوفة. bcrypt + rate limit = دفاع متعدد الطبقات.

---

## آلية Queue Position (G6 + C10 hardened)

```ts
// تصحيح C10: تجاهل الطلبات المُجدولة للمستقبل (scheduledFor > now)
const now = new Date();
const position = await db
  .select({ count: count() })
  .from(printRequests)
  .where(and(
    eq(status, 'pending'),
    lt(createdAt, currentRequest.createdAt),
    or(isNull(scheduledFor), lte(scheduledFor, now)) // فقط الجاهزة الآن
  ));
```

**التحديث الحي**: Supabase Realtime subscription على `print_requests` يدفع تحديث للطالب لما يتقدم طلب آخر — لا يحتاج polling.

```ts
// apps/web/app/s/[ticket]/page.tsx
supabase.channel('queue')
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'print_requests' },
     () => refetchPosition())
  .subscribe();
```

---

## منطق خارج الدوام (G3)

```ts
// عند رفع طلب
const now = new Date();
const { open, close, closed_days } = getWorkingHours();

const isOpen = 
  !closed_days.includes(weekday(now)) &&
  hour(now) >= open &&
  hour(now) < close;

if (!isOpen) {
  request.scheduledFor = nextWorkingMorning();
  request.status = 'pending';  // يبقى pending، سعد يشوفه الصبح
  notifyStudent(
    `تم استلام طلبك. المكتبة مغلقة حالياً — سيتم التجهيز صباح ${formatDate(request.scheduledFor)}`
  );
}
```

---

## ~~رفض PDF المحمي~~ (محذوف — D1)

> بعد قرار D1 (لا معالجة ملفات)، لم نعد نفحص PDF عند الرفع. الملف يصل كما هو، وسعد يكتشف أي مشكلة عند الطباعة.

---

## 🔒 D6. Idle Lock للـ Dashboard (C17 + R4 hardened)

Dashboard سعد يقفل تلقائياً بعد **15 دقيقة دون نشاط داخل نافذة UOADrop** (ليس idle على مستوى النظام — R4).

```ts
// apps/desktop/main/idle-lock.ts — منظور التطبيق، لا النظام
let lastActivity = Date.now();
const IDLE_MS = 15 * 60 * 1000;

function resetIdle() { lastActivity = Date.now(); }

// نشاط داخل النافذة فقط
mainWindow.webContents.on('before-input-event', resetIdle); // طباعة أزرار + ماوس
mainWindow.on('focus', resetIdle);                          // أعاد التركيز على UOADrop

setInterval(() => {
  if (Date.now() - lastActivity >= IDLE_MS) {
    mainWindow.webContents.send('lock');
  }
}, 60_000);
```

> **لماذا ليس `powerMonitor.getSystemIdleTime()`؟** يقيس idle على مستوى النظام — لو زميل سعد يستخدم Chrome على نفس اللابتوب، النظام ليس idle → Dashboard لا يقفل → الزميل ينقر على UOADrop ويقرأ PINs.

**السبب**: سعد يترك اللابتوب مفتوحاً لدقائق → زميل/متطفل يعدل الأسعار، يحذف طلبات، يقرأ PINs.

---

## 🔒 D7. Telegram Link Token (C3)

بدل إرسال `ticket_no` في `/start` → نرسل **token عشوائي 16 بايت** (مخزّن في جدول `telegram_link_tokens`) ينتهي بعد 24 ساعة.

**السبب**: `ticket_no` شكل `B-0077` sequential وسهل التخمين → مهاجم يرسل `/start B-0077` ويستلم إشعارات بلال. token عشوائي يمنع الاختطاف.

---

## 🛡️ D8. File Validation بطبقتين (C7)

1. **الامتداد** (client + server).
2. **Magic bytes** عبر `file-type` npm — يقرأ أول 4KB من الملف للتأكد من النوع الحقيقي.

```ts
import { fileTypeFromBuffer } from 'file-type';
const head = await readFirst4KB(filePath);
const type = await fileTypeFromBuffer(head);
if (!ALLOWED_MIMES.includes(type?.mime ?? '')) reject();
```

**السبب**: `evil.exe` → rename → `report.pdf` → يمر whitelist الامتداد فقط. Magic bytes يكشف.

</div>
