<div dir="rtl">

# UOADrop — المعمارية الكاملة

هذا المستند المرجع الرسمي لكل القرارات التقنية في المشروع. أي قرار يُتخذ لاحقاً لازم يكون متوافقاً مع ما هنا أو يحدّث هذا الملف صراحة.

---

## 1. المبدأ التصميمي

**Offline-First + Online Sync**

- النظام يعمل بشكل **كامل ومستقل** داخل المكتبة بدون الحاجة للإنترنت.
- الإنترنت مجرد **قناة إضافية** للطلاب اللي من برّا المكتبة.
- لا يوجد **نقطة فشل وحيدة** (Single Point of Failure) تُوقف الخدمة بالكامل.

---

## 2. الشخصيات والتدفقات

### 👩‍🎓 ملاك — Offline Flow

1. تدخل المكتبة، تشوف ملصق: *"اتصل بـ Wi-Fi `UOA-Print` ثم امسح الباركود الأزرق 📡"*.
2. تتصل بـ `UOA-Print` (بدون باسوورد أو باسوورد بسيط).
3. تمسح QR الأزرق → `http://192.168.0.100:3000/u`.
4. تفتح الصفحة مباشرة على لابتوب سعد (كلاهما على نفس الـ Wi-Fi).
5. تعبّي النموذج:
   - الاسم الثلاثي: `ملاك أحمد حسين`
   - القسم: dropdown
   - المرحلة: 1-4 / دراسات عليا
   - الملفات (يسحب/يختار)
   - خيارات: عدد النسخ، ملوّن/B&W، وجه/وجهين، A4/A3
   - ملاحظات (اختياري)
6. تضغط **إرسال** → رفع مباشر عبر tus.io → تأكيد برقم تذكرة `A-2026-0234`.
7. تتقدم للطاولة → سعد يطبع → تستلم. **لا PIN** (R1) — سعد يتحقّق بصرياً من الاسم.

### 👨‍🎓 بلال — Online Flow

1. من البيت، يفتح `https://uoadrop.app/u` (أو يمسح QR الأخضر).
2. نفس النموذج بالضبط.
3. الملف يُرفع إلى **Supabase Storage**.
4. الطلب يُسجّل في **Supabase Postgres**.
5. تأكيد برقم تذكرة `B-2026-0077`.
6. يأتي المكتبة بعدين → يبرز PIN لسعد → يستلم.

### 👨‍💼 سعد — Dashboard Flow

1. يفتح تطبيق UOADrop على لابتوبه (auto-start عند تسجيل الدخول).
2. يشوف قائمة موحّدة:
   ```
   📡 A-2026-0234  ملاك أحمد حسين  5 ثوان    [طباعة]
   🌐 B-2026-0077  بلال محمد علي   11 ساعة   [طباعة]
   ```
3. يضغط **👁️ عرض** → الملف يُفتح بالتطبيق الافتراضي (Preview/Word/Acrobat).
4. يضغط **🖨️ طباعة** → Dialog الطباعة الأصلي للنظام (Windows/Mac).
5. يضغط **✅ جهز** → يدخل السعر → status=done + إشعار تلقائي للطالب.

---

## 3. Stack التقنية

### اللغة الموحّدة: TypeScript

| الطبقة | التقنية | الغرض |
|--------|---------|-------|
| **Frontend** | Next.js 14 (App Router) | صفحة رفع + Dashboard |
| **Styling** | TailwindCSS + shadcn/ui | UI بسيط ومتجاوب |
| **Forms** | React Hook Form + Zod | validation موحّد |
| **State** | TanStack Query | data fetching + cache |
| **Desktop** | Electron | يحتضن Fastify + يعرض UI |
| **Local Server** | Fastify | HTTP server محلي |
| **Local DB** | better-sqlite3 | synchronous + سريع |
| **Cloud DB** | Supabase (Postgres) | الأونلاين |
| **Storage** | Supabase Storage | ملفات بلال |
| **Realtime** | Supabase Realtime | إشعار سعد فوري |
| **Auth** | Supabase Auth | لسعد فقط (JWT) |
| **ORM** | Drizzle | **نفس الكود** على SQLite و Postgres |
| **Upload** | tus.io (`@tus/server` + `tus-js-client`) | رفع resumable |
| **QR** | `qrcode` npm | توليد QR للطباعة |
| **Monorepo** | pnpm workspaces + Turborepo | تنظيم المشروع |

### لماذا TypeScript everywhere؟
- لغة واحدة من الواجهة للسيرفر → صيانة أسهل.
- Types موحّدة بين الـ client والـ server عبر `packages/shared`.
- النظام البيئي (npm) أكبر من أي بديل.

### لماذا Electron وليس Tauri؟
- Electron يسمح بكتابة كل شي بـ TypeScript (حتى الـ main process).
- Tauri يتطلب Rust للـ main process → تعلم إضافي.
- حجم Electron (~120MB) مقبول في حالة سعد (desktop واحد).

---

## 4. هيكل المشروع (Monorepo)

```
UOADrop/
├── apps/
│   ├── web/                    # Next.js — صفحة الطالب + Dashboard
│   │   ├── app/
│   │   │   ├── u/              # صفحة رفع (/u للـ URL القصير)
│   │   │   ├── dashboard/      # لوحة سعد
│   │   │   └── api/            # API routes (online mode)
│   │   └── ...
│   └── desktop/                # Electron — تطبيق سعد
│       ├── main/               # Fastify + SQLite + keepalive
│       │   ├── server.ts       # Fastify instance
│       │   ├── db.ts           # Drizzle + better-sqlite3
│       │   ├── ip-check.ts     # تحقق من IP الثابت
│       │   ├── keepalive.ts    # Supabase ping
│       │   └── ipc.ts          # open-file / print-file / update-status
│       ├── preload/
│       └── renderer/           # يحمّل apps/web
├── packages/
│   ├── shared/                 # types + Zod schemas + constants
│   ├── db-schema/              # Drizzle schema + migrations
│   └── ui/                     # shadcn components مشتركة
├── supabase/
│   ├── migrations/             # SQL migrations
│   └── functions/              # Edge Functions (keepalive)
├── .github/
│   └── workflows/
│       └── keepalive.yml       # GitHub Actions backup
├── docs/                       # هذا المجلد
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

---

## 5. قاعدة البيانات — Schema موحّد

Drizzle يسمح بكتابة schema واحد يعمل على SQLite و Postgres.

```ts
// packages/db-schema/schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
// (PG variant uses pgTable + uuid + timestamp)

// جميع الأوقات تُخزَّن UTC، تُعرض وتُقارن بـ **Asia/Baghdad** (UTC+3) — X5.
// ثابت في packages/shared/constants.ts: TIMEZONE = 'Asia/Baghdad'.

export const printRequests = sqliteTable('print_requests', {
  id:            text('id').primaryKey(),              // uuid
  ticketNo:      text('ticket_no').unique().notNull(), // A-0234 / B-0077
  source:        text('source').notNull(),             // 'offline' | 'online'
  fullName:      text('full_name').notNull(),          // الاسم الثلاثي
  department:    text('department').notNull(),
  stage:         text('stage').notNull(),              // 1|2|3|4|graduate
  phone:         text('phone'),
  copies:        integer('copies').notNull().default(1),
  color:         integer('color', { mode: 'boolean' }).default(false),
  doubleSided:   integer('double_sided', { mode: 'boolean' }).default(false),
  paperSize:     text('paper_size').notNull().default('A4'),
  notes:         text('notes'),
  pickupPinHash: text('pickup_pin_hash'),              // bcrypt(pin) — C5 — NULL للـ offline (R1)
  queuePosition: integer('queue_position'),            // ترتيب في الطابور (G6)
  scheduledFor:  integer('scheduled_for', { mode: 'timestamp' }), // (G3 + H10)
  status:        text('status').notNull().default('pending'),
  // pending | printing | done | blocked | canceled
  blockReason:   text('block_reason'),                 // سبب blocked (G4)
  price:         integer('price'),                     // IQD يدخله سعد (G1)
  paid:          integer('paid', { mode: 'boolean' }).default(false), // (H6)
  archived:      integer('archived', { mode: 'boolean' }).default(false), // C11 — SQLite فقط (R10)
  // ملاحظة R10: على Postgres/online الحقل يُترك default=false دائماً (لا sync من خارج السحابة).
  createdAt:     integer('created_at', { mode: 'timestamp' }).notNull(),
  completedAt:   integer('completed_at', { mode: 'timestamp' }),
});

// جدول جديد: rate limit محاولات PIN (R5 + Z3) — يصمد restart
// ملاحظة Z3: يُعرّف على الجانبين — SQLite (offline) + Postgres (online Edge Function)
//            Drizzle PG variant يولّد نفس الجدول بـ pgTable تلقائياً عند push.
export const pinAttempts = sqliteTable('pin_attempts', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  ticketNo:    text('ticket_no').notNull(),
  attemptedAt: integer('attempted_at', { mode: 'timestamp' }).notNull(),
  success:     integer('success', { mode: 'boolean' }).notNull(),
  // فهرس مركّب للبحث السريع عن محاولات آخر دقيقة + cumulative count
});

// جدول جديد: audit أحداث الطابعة (Z2)
export const printerEvents = sqliteTable('printer_events', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  requestId: text('request_id').references(() => printRequests.id, { onDelete: 'cascade' }),
  event:     text('event').notNull(),  // 'print_started' | 'print_success' | 'print_failed'
  detail:    text('detail'),            // رسالة الخطأ لو وجدت
  at:        integer('at', { mode: 'timestamp' }).notNull(),
});

// جدول جديد: token للربط الآمن مع Telegram (C3)
export const telegramLinkTokens = sqliteTable('telegram_link_tokens', {
  token:     text('token').primaryKey(),                // 16 bytes hex random
  requestId: text('request_id').notNull()
              .references(() => printRequests.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(), // +24h
  usedAt:    integer('used_at', { mode: 'timestamp' }), // يُحدّث عند /start
});

// جدول جديد لتتبع الإيرادات اليومية (H6)
export const dailyRevenue = sqliteTable('daily_revenue', {
  date:         text('date').primaryKey(),            // YYYY-MM-DD
  totalOrders:  integer('total_orders').notNull().default(0),
  totalIqd:     integer('total_iqd').notNull().default(0),
});

// جدول الإعدادات القابلة للتعديل (H1 + H3)
export const settings = sqliteTable('settings', {
  key:   text('key').primaryKey(),
  value: text('value').notNull(),
});

export const requestFiles = sqliteTable('request_files', {
  id:            text('id').primaryKey(),
  requestId:     text('request_id').notNull()
                  .references(() => printRequests.id, { onDelete: 'cascade' }),
  originalName:  text('original_name').notNull(),
  storagePath:   text('storage_path').notNull(),       // local path أو supabase key
  sizeBytes:     integer('size_bytes').notNull(),
  mimeType:      text('mime_type'),
  checksum:      text('checksum'),                     // sha256
});

export const healthCheck = sqliteTable('health_check', {
  id:            integer('id').primaryKey({ autoIncrement: true }),
  source:        text('source').notNull(),  // 'desktop' | 'cron-job.org' | 'github-actions'
  pingedAt:      integer('pinged_at', { mode: 'timestamp' }).notNull(),
});
```

### توليد `ticket_no` (R11 unified)
- Offline: `A-{YYYY}-{seq}` مثال `A-2026-0234` — counter محلي في SQLite.
- Online: `B-{YYYY}-{seq}` مثال `B-2026-0077` — sequence في Postgres.
- **لماذا السنة؟** بعد استعادة backup من سنة قديمة، counter يُشارك الأرقام مع السنة الحالية → idempotency.
- سعد ما يميّز بين المصدرين إلا بالأيقونة.

---

## 6. الشبكة — كيف تتصل ملاك

### الإعداد الفيزيائي
```
[لابتوب سعد] ═══ Wi-Fi ═══ [راوتر TL-WR940N] ═══ Wi-Fi ═══ [موبايل ملاك]
   192.168.0.100          192.168.0.1             192.168.0.X
   (IP محجوز عبر            (Standard Router)         (DHCP عادي)
    MAC binding)
```

### الضمانات
1. **IP & MAC Binding** على الراوتر: لابتوب سعد **دائماً** يحصل على `192.168.0.100`.
2. **AP Isolation = Disabled**: الأجهزة تشوف بعضها على الشبكة.
3. **Firewall permission** على Windows/Mac: مقبول مرة واحدة عند أول تشغيل.
4. **Sleep prevention**: التطبيق يمنع الجهاز من النوم طالما يشتغل.

### الـ QRs الدائمة

| اللون | الوضع | URL | ثبات |
|-------|-------|-----|------|
| 🔵 أزرق | Offline | `http://192.168.0.100:3000/u` أو `http://uoadrop.local:3000/u` (mDNS — X1) | دائم طالما router config محفوظ |
| 🟢 أخضر | Online | `https://uoadrop.app/u` | دائم (domain + Vercel) |

**الـ QR يُولّد مرة واحدة** من تطبيق سعد، يُطبع بجودة عالية، يُلصق على الحائط، **ما يتغير أبداً**.

### HTTPS-First Mode — تخفيف الخطر (X1)

متصفحات موبايل حديثة (Chrome 90+, Safari iOS 15+, Samsung Internet) قد تُحاول ترقية `http://` إلى `https://` تلقائياً → اتصال بـ HTTP عادي يفشل.

**الطبقات الثلاث للحماية**:
1. **mDNS hostname**: `uoadrop.local` أقل عرضة لـ HSTS من IP مباشر. Electron يشغّل Bonjour/Avahi على اللابتوب (قابل بنسبة أعلى من IP خام).
2. **تعليمات نصية بجانب QR**: *"إذا فشلت الصفحة، اكتب يدوياً: `192.168.0.100:3000/u` — تجنب كتابة https://"*.
3. **رقم سعد للمساعدة** على الملصق.

**خيار مستقبلي**: self-signed TLS عبر mkcert + تثبيت root CA على موبايل كل طالب — غير عملي.

---

## 7. Keep-Alive لـ Supabase

مشكلة: Supabase Free Tier يوقف المشاريع بعد 7 أيام خمول.

الحل: **3 طبقات redundant** يرسلون ping يومياً.

**Cleanup**: cron داخل Edge Function ينفّذ `DELETE FROM health_check WHERE pinged_at < now() - interval '30 days'` يومياً — الجدول لا ينمو بلا حدود (C14).

### SQLite Durability Pragmas (X6)

```ts
// apps/desktop/main/db.ts — أول شي بعد فتح الـ DB
db.pragma('journal_mode = WAL');        // WAL — reader-writer concurrency
db.pragma('synchronous = NORMAL');       // آمن مع WAL — يحمي من power loss
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');        // انتظر 5ث قبل SQLITE_BUSY
app.on('before-quit', () => db.pragma('wal_checkpoint(TRUNCATE)'));
```

**لماذا NORMAL + WAL؟** `synchronous=FULL` (افتراضي) بطيء. `OFF` يفسد DB عند انقطاع كهرباء. **NORMAL + WAL** يضمن durability مع سرعة مقبولة — مناسب للعراق حيث انقطاع الكهرباء متكرر.

---

### Layer 1 — Desktop app
```ts
// apps/desktop/main/keepalive.ts
setInterval(async () => {
  await supabase.from('health_check').insert({
    source: 'desktop',
    pinged_at: new Date()
  });
}, 12 * 60 * 60 * 1000); // كل 12 ساعة
```

### Layer 2 — cron-job.org
- Endpoint: `https://<project>.supabase.co/functions/v1/keepalive`
- Schedule: يومي الساعة 3 صباحاً UTC.
- Notification email عند الفشل.

### Layer 3 — GitHub Actions
```yaml
# .github/workflows/keepalive.yml
on:
  schedule:
    - cron: '0 6 * * *'  # يومي 6 صباحاً UTC
```

**النتيجة**: لو فشل أي مصدر، الاثنان الآخران يضمنان الاستمرار. اعتمادية ~99.99%.

---

## 7.5 IPC Handlers (Electron ↔ Renderer)

Dashboard سعد يتواصل مع Electron main process عبر IPC لوظائف native.

### Electron Security Defaults (X4)

```ts
// apps/desktop/main/index.ts
mainWindow = new BrowserWindow({
  webPreferences: {
    contextIsolation: true,        // إلزامي — عزل renderer عن Node
    nodeIntegration: false,        // إلزامي — renderer لا يصل إلى `require`
    sandbox: true,                 // إلزامي — Chromium sandbox مفعّل
    preload: path.join(__dirname, '../preload/index.js'),
    webSecurity: true,
  },
});

// منع فتح نوافذ خارجية غير متوقعة
mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

// منع navigation لمصادر مجهولة (Z1: uoadrop.local مسموح للـ mDNS)
const ALLOWED_ORIGINS = [
  'http://localhost',
  'http://192.168.0.100',
  'http://uoadrop.local',
];
mainWindow.webContents.on('will-navigate', (e, url) => {
  if (!ALLOWED_ORIGINS.some(o => url.startsWith(o))) e.preventDefault();
});
```

**بدون هذه الإعدادات**: ملف HTML/PDF ضار (لو فُتح في renderer) يقدر يقرأ SQLite، يكتب أي ملف، يتصل بالإنترنت دون إذن.

### Single-Instance Lock (C9)

```ts
// apps/desktop/main/index.ts — أول شي قبل أي initialization
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit(); // نسخة تشتغل مسبقاً → اخرج فوراً
} else {
  app.on('second-instance', () => mainWindow?.focus());
}
```

**السبب**: SQLite لا يدعم multi-process writes. نسختان متزامنتان → `SQLITE_BUSY` → طلبات تُفقد.

### الثلاثة الأساسية

```ts
// apps/desktop/main/ipc.ts
import { ipcMain, shell, BrowserWindow, app } from 'electron';
import { exec } from 'child_process';
import path from 'path';

// 1) 👁️ عرض — يفتح الملف بالتطبيق الافتراضي
ipcMain.handle('file:open', async (_, filePath: string) => {
  await shell.openPath(filePath);
  return { ok: true };
});

// 2) 🖨️ طباعة — يفتح Dialog الطباعة الأصلي للنظام
//    PDF + الصور: Electron Chromium يطبع بـ dialog النظام.
//    DOCX/PPTX/XLSX: نفتح بالتطبيق الافتراضي على كل الأنظمة (Windows/Mac)
//    — سعد يضغط Ctrl+P / Cmd+P داخل التطبيق المخصّص.
//    (C1: لا نستخدم rundll32 `print` verb لأنه يطبع صامت على الطابعة الافتراضية
//     وبذلك تضيع إعدادات الطالب — عدد النسخ، اللون، الوجهين، مقاس الورق.)
ipcMain.handle('file:print', async (_, filePath: string) => {
  const ext = path.extname(filePath).toLowerCase();
  const CHROMIUM_NATIVE = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.bmp'];

  if (CHROMIUM_NATIVE.includes(ext)) {
    const win = new BrowserWindow({ show: false, width: 1, height: 1 });
    await win.loadFile(filePath);
    // C2: انتظر حتى يكتمل render للـ PDF plugin قبل استدعاء print
    await new Promise<void>((resolve) =>
      win.webContents.once('did-finish-load', () => resolve())
    );
    await new Promise((r) => setTimeout(r, 350)); // buffer للـ PDF plugin
    return new Promise((resolve) => {
      win.webContents.print({ silent: false }, (success) => {
        win.close();
        resolve({ ok: success });
      });
    });
  }

  // DOCX / PPTX / XLSX — تجربة موحّدة عبر الأنظمة (C1)
  await shell.openPath(filePath);
  return { ok: true, hint: 'اضغط Ctrl+P (Windows) أو Cmd+P (Mac) داخل التطبيق' };
});

// 3) ✅ جهز — (يُنفّذ عبر Fastify API، ليس IPC)
//    Frontend يرسل POST /api/requests/:id/done مع price
//    الـ handler يحدّث status + يرسل الإشعار

// 3.1) ❌ فشل الطباعة خلال التنفيذ (X10)
//      webContents.print callback يرجع success=false → لا ننتقل إلى done
//      Frontend يعرض modal: [إعادة] [تحديد blocked + سبب] [إلغاء]
//      + insert في printer_events للـ audit

// 4) 🖨️ printer:status — R12 — حالة الطابعة للـ Health Dashboard
ipcMain.handle('printer:status', async () => {
  const { execFile } = require('child_process');
  const promisify = (fn: any) => (...a: any[]) => new Promise((r, j) =>
    fn(...a, (e: any, so: string) => e ? j(e) : r(so)));

  if (process.platform === 'win32') {
    // PowerShell: Get-Printer | Where-Object {$_.Default} | Select PrinterStatus
    const out = await promisify(execFile)('powershell', [
      '-Command',
      "(Get-Printer | Where-Object {$_.Default}).PrinterStatus"
    ]);
    return { ready: /Normal|Idle/i.test(out as string), raw: out };
  }
  // macOS: lpstat -p <default>  → "printer X is idle" / "disabled"
  const def = await promisify(execFile)('lpstat', ['-d']);
  const name = String(def).match(/: (.+)$/)?.[1]?.trim();
  const st  = await promisify(execFile)('lpstat', ['-p', name || '']);
  return { ready: /is idle/i.test(st as string), raw: st };
});
```

### الاستخدام من React (Renderer)

```ts
// apps/web/hooks/useFileActions.ts
export function useFileActions() {
  const openFile = (path: string) => window.electron.invoke('file:open', path);
  const printFile = (path: string) => window.electron.invoke('file:print', path);
  return { openFile, printFile };
}
```

### Preload Bridge

```ts
// apps/desktop/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  invoke: (channel: string, ...args: unknown[]) => {
    const allowed = ['file:open', 'file:print'];
    if (!allowed.includes(channel)) throw new Error(`blocked: ${channel}`);
    return ipcRenderer.invoke(channel, ...args);
  },
});
```

---

## 8. الأمان (Security)

### Offline
- شبكة معزولة (لا WAN) → ما فيه attack surface.
- لا Auth للطالب (سرعة + بساطة).
- Librarian Dashboard محمي بـ **password مخزّن في OS Keychain** (راجع §8.1 — X3) + **idle lock بعد 15 دقيقة** (C17/D6).
- File whitelist صارم + **magic-byte validation** (C7).
- Fastify يستمع على **`192.168.0.100` فقط**، ليس `0.0.0.0` (C15) — حماية لو استُخدم اللابتوب على شبكة مقهى/عامة.

### Online — Supabase Edge Functions (C4 + R8 + R9)

بديلاً عن RLS anon المتساهلة، الطالب يتفاعل مع 3 Edge Functions محمية:

| Endpoint | الغرض | Input | Output |
|---------|--------|-------|--------|
| `POST /functions/v1/upload-request` | إنشاء طلب جديد | form + tus upload URL | `{ ticket_no, pin, link_token }` (R2) |
| `POST /functions/v1/get-request` | استعلام عن حالة طلب (R8) | `{ ticket_no, pin }` | صف واحد (status, position, price, ...) |
| `POST /functions/v1/cancel-request` | إلغاء طلب (R9) | `{ ticket_no, pin }` | `{ ok, status }` — يرفض إذا status ≠ pending |

**منطق `get-request`** (R8):
```ts
serve(async (req) => {
  const { ticket_no, pin } = await req.json();
  
  // 1a) Rate limit قصير: 3 محاولات/دقيقة/ticket (R5)
  const recent = await supabase.from('pin_attempts')
    .select('*', { count: 'exact' })
    .eq('ticket_no', ticket_no)
    .gte('attempted_at', new Date(Date.now() - 60_000).toISOString());
  if ((recent.count ?? 0) >= 3) return new Response('rate_limited', { status: 429 });
  
  // 1b) Cumulative lockout (Z4): بعد 10 فشل إجمالي على التذكرة → قفل دائم
  const fails = await supabase.from('pin_attempts')
    .select('*', { count: 'exact' })
    .eq('ticket_no', ticket_no).eq('success', false);
  if ((fails.count ?? 0) >= 10) return new Response('locked_contact_librarian', { status: 423 });
  
  // 2) اقرأ الطلب عبر service_role (يتجاوز RLS)
  const { data: row } = await svc.from('print_requests')
    .select('*').eq('ticket_no', ticket_no).single();
  if (!row) return new Response('not_found', { status: 404 });
  
  // 3) تحقّق من PIN
  const ok = row.pickup_pin_hash ? await bcrypt.compare(pin, row.pickup_pin_hash) : false;
  await svc.from('pin_attempts').insert({ ticket_no, attempted_at: new Date(), success: ok });
  if (!ok) return new Response('invalid_pin', { status: 401 });
  
  // 4) أرجع الحقول غير الحساسة فقط
  return Response.json({
    ticket_no: row.ticket_no, status: row.status, queue_position: row.queue_position,
    price: row.price, block_reason: row.block_reason, scheduled_for: row.scheduled_for,
  });
});
```

**منطق `cancel-request`** (R9): نفس الـ flow — بعد التحقق من PIN، يتأكد أن `status='pending'` ثم `UPDATE status='canceled'`.

### Online — Supabase RLS (C4 — مُحكم)
```sql
-- أي شخص يقدر ينشئ طلب
CREATE POLICY "public_insert" ON print_requests 
  FOR INSERT TO anon WITH CHECK (true);

-- ❌ لا تمنح anon حق SELECT مباشر — تسريب للجدول.
-- بدلاً منه، Edge Function محمية تُرجع طلب واحد فقط.
-- GET /functions/v1/get-request
--   body: { ticket_no, pin }
--   يتحقق من bcrypt(pin) ضد pickup_pin_hash ثم يُرجع صف واحد.

-- سعد (librarian) يتحكم بالكل عبر JWT
CREATE POLICY "librarian_all" ON print_requests 
  FOR ALL TO authenticated USING (auth.role() = 'librarian');
```

### حماية عامة
- **Rate limit**: 5 طلبات/دقيقة لكل IP + **3 محاولات/دقيقة على PIN verification** (C5).
- **File whitelist بطبقتين**:
  1. الامتداد: `pdf, docx, doc, pptx, ppt, xlsx, xls, txt, jpg, png` فقط.
  2. **Magic bytes** عبر `file-type` npm — يرفض `evil.exe` المُعاد تسميته إلى `.pdf` (C7).
- **Max file size**: 50MB لكل ملف، 200MB للطلب كامل (مفروض على client + tus + Fastify).
- **CAPTCHA**: hCaptcha للـ **online فقط** بعد 3 طلبات متتالية.
  Offline لا يمكنه الوصول لخدمات CAPTCHA → نعتمد rate limit بالـ MAC/IP فقط (C12).
- **Single-instance lock**: `app.requestSingleInstanceLock()` يمنع فتح نسختين متزامنتين من التطبيق (C9) — وإلا SQLite يقفل ويسقط الطلبات.
- **PIN hashing**: `bcrypt(pin)` عند الحفظ، لا تخزين plaintext (C5).
- **Auto-delete**: الملفات بعد 7 أيام من الاكتمال + cron ينظّف `health_check` بعد 30 يوم (C14).

---

## 8.1 تخزين password سعد (X3)

```ts
// apps/desktop/main/auth.ts
import keytar from 'keytar';
import bcrypt from 'bcryptjs';

const SERVICE = 'UOADrop';
const ACCOUNT = 'librarian';

async function setPassword(plain: string) {
  const hash = await bcrypt.hash(plain, 10);
  // أولوية: OS Keychain (Keychain Mac, Credential Vault Windows)
  try { await keytar.setPassword(SERVICE, ACCOUNT, hash); return 'keychain'; }
  catch {
    // fallback: SQLite settings — حالة Linux بلا libsecret
    db.run("INSERT OR REPLACE INTO settings VALUES ('auth_hash', ?)", hash);
    return 'sqlite';
  }
}

async function verifyPassword(input: string): Promise<boolean> {
  const stored = (await keytar.getPassword(SERVICE, ACCOUNT))
    ?? db.prepare("SELECT value FROM settings WHERE key='auth_hash'").get()?.value;
  return stored ? await bcrypt.compare(input, stored) : false;
}
```

**لماذا keytar؟** يستخدم OS Keychain → محمي بتشفير الجهاز + لا يظهر في SQLite backup. fallback إلى bcrypt hash في `settings` table لو keytar فشل.

---

## 9. Upload — لماذا tus.io؟

مشكلة رفع ملف 50MB عبر Wi-Fi المكتبة:
- لو انقطع الاتصال في 80% → يبدأ من الصفر (بـ multipart عادي).
- بطيء على شبكات متذبذبة.

**tus.io protocol** يحل هذا:
- تقسيم الملف إلى chunks.
- كل chunk يُرفع مستقلاً.
- لو انقطع، يستكمل من آخر chunk ناجح.

### Offline: `@tus/server` داخل Fastify
- Chunk size: 5MB.
- Upload dir: `%APPDATA%/UOADrop/uploads/` (Windows) أو `~/Library/Application Support/UOADrop/uploads/` (Mac).

### Online: Supabase Storage TUS (X9 — تفاصيل دقيقة)
- **Endpoint** (مختلف عن Supabase root): `https://<project>.supabase.co/storage/v1/upload/resumable`.
- **Chunk size موصى**: **6MB** — محاذاة مع Supabase internal.
- **Headers إلزامية**: `Authorization: Bearer <SUPABASE_ANON_KEY>` + `x-upsert: true`.
- **Metadata keys دقيقة الاسم**:
  ```ts
  const upload = new tus.Upload(file, {
    endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
    retryDelays: [0, 3000, 5000, 10000],
    headers: {
      authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'x-upsert': 'true',
    },
    uploadDataDuringCreation: true,
    metadata: {
      bucketName: 'uploads',
      objectName: `${ticketNo}/${file.name}`,
      contentType: file.type,
      cacheControl: '3600',
    },
    chunkSize: 6 * 1024 * 1024, // 6MB
  });
  ```

---

## 10. Health Dashboard (في تطبيق سعد)

شاشة صغيرة في التطبيق تعرض صحة النظام:

```
┌──────────────────────────────────────┐
│  UOADrop — Health Status             │
├──────────────────────────────────────┤
│  ✅ Local server       running        │
│  ✅ SQLite DB          OK (12 MB)     │
│  ✅ Disk space         87% free       │
│  ✅ Supabase           active (ping)  │
│  ⚠️  Storage usage     780/1000 MB    │
│  ✅ Printer            ready          │
│  ✅ Last backup        2h ago         │
│  ✅ IP binding         192.168.0.100  │
│  ✅ Today's requests   14             │
└──────────────────────────────────────┘
```

أي حالة حمراء → سعد يتصرف قبل ما تصير مشكلة حقيقية.

---

## 10.5. الإشعارات (Email + Telegram)

**لبلال فقط** (Online) — ملاك ما تحتاج لأنها داخل المكتبة.

- **القنوات**: Resend (Email) + Telegram Bot API.
- **الأحداث**: `received` / `printing` / `done` (+ `canceled` اختياري).
- **المعمارية**: Supabase DB trigger → Edge Function `notify` → APIs بالتوازي.
- **Retry**: 3 محاولات مع exponential backoff.
- **Log**: جدول `notifications_log` يحفظ كل محاولة.
- **Opt-in**: Email اختياري، Telegram يحتاج `/start` عبر `@UOADropBot`.

التفاصيل الكاملة (schema، Edge Functions، قوالب الرسائل، ربط البوت) في [`NOTIFICATIONS.md`](./NOTIFICATIONS.md).

---

## 11. Sync من Offline إلى Online (للأرشفة)

عندما يكتمل طلب offline وعنده نت، التطبيق يرفع سجل الطلب (بدون الملف) إلى Supabase للأرشفة الإحصائية:

```ts
// apps/desktop/main/sync.ts
async function archiveCompletedOffline() {
  const completed = db.query('SELECT * FROM print_requests WHERE status = "done" AND archived = 0');
  for (const req of completed) {
    await supabase.from('archive_offline').insert(req);
    db.run('UPDATE print_requests SET archived = 1 WHERE id = ?', req.id);
  }
}
```

يشتغل في background كل ساعة لو فيه نت.

### جدول `archive_offline` على Supabase (C11)

```sql
CREATE TABLE archive_offline (
  id            UUID PRIMARY KEY,
  ticket_no     TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  department    TEXT NOT NULL,
  stage         TEXT NOT NULL,
  copies        INT NOT NULL,
  color         BOOLEAN NOT NULL,
  double_sided  BOOLEAN NOT NULL,
  paper_size    TEXT NOT NULL,
  price         INT,
  paid          BOOLEAN,
  created_at    TIMESTAMPTZ NOT NULL,
  completed_at  TIMESTAMPTZ,
  synced_at     TIMESTAMPTZ DEFAULT NOW()
);
-- RLS: فقط service_role يقدر يكتب، librarian يقرأ للإحصاءات.
```

السجل بيانات فقط (بلا الملف نفسه) — للإحصاءات والتدقيق.

---

## 12. Deployment

### Desktop (سعد)
- Build: `electron-builder` ينشئ:
  - `.exe` (NSIS) للـ **Windows 10/11** — الجهاز الأساسي.
  - `.dmg` للـ Mac (Intel + Apple Silicon) — دعم ثانوي.
- Auto-update عبر GitHub Releases.

### Web (بلال)
- **Vercel** ← Next.js deployed from GitHub.
- Environment vars: `SUPABASE_URL`, `SUPABASE_ANON_KEY`.
- Custom domain: `uoadrop.app` (مستقبلاً).

### Supabase
- مشروع واحد اسمه `UniPrint` أو `UOADrop`.
- Region: Frankfurt (أقرب للعراق).
- Free tier + Keep-Alive = مجاني ومستدام.
- **Database Webhooks** مُفعّلة على `print_requests` (UPDATE) → تستدعي Edge Function `notify` عند تغيّر `status` (راجع `NOTIFICATIONS.md` §5.1).

---

## 13. تجاوز خلاصة القرارات

| القرار | الخيار المُتبنى | السبب |
|--------|----------------|------|
| اللغة | TypeScript | لغة واحدة للجميع |
| Desktop | Electron (مو Tauri) | TS صرف |
| Local DB | SQLite عبر better-sqlite3 | synchronous + سريع |
| Cloud DB | Supabase | Postgres + Storage + Realtime في واحد |
| Upload | tus.io | resumable |
| Network | Router Standard + IP Binding | يعمل على Mac بدون Ethernet |
| QR | دائمان (أزرق + أخضر) | IP ثابت + domain ثابت |
| Supabase pause | Keep-Alive 3 طبقات | مجاني + اعتمادية 99.99% |
| Auth | سعد فقط، الطلاب بدون | سرعة + بساطة |
| Email | Resend | Free 3k/شهر + أسهل API |
| Telegram | Bot API مباشر | مجاني + شعبي في العراق |
| Notifications | لبلال فقط (Online) | ملاك داخل المكتبة، ما تحتاج |
| معالجة الملفات | ❌ لا تحويل، لا فحص، لا page counting | البساطة القصوى (D1) |
| أزرار Dashboard | 👁️ عرض / 🖨️ طباعة / ✅ جهز فقط | وضوح تام لسعد (D3) |
| Email frequency | رسالة واحدة عند `done` فقط | توفير quota Resend |
| OS أساسي | Windows 10/11 | جهاز سعد الفعلي (D5) |
| الاسم | 2-5 كلمات عربية (ليس "ثلاثي") | الواقع الثقافي العراقي (C6) |
| Ticket format | `A-2026-0234` مع السنة | idempotency بعد backup (C8) |
| PIN protection | Rate limit 3/دقيقة + عرض الاسم لسعد | حماية إضافية (C4) |

---

## 14. خارج النطاق (لا ندعمه الآن)

- **تحويل الملفات** (DOCX→PDF، HEIC→JPG) — الملف يصل كما هو، سعد يتعامل معه بأدواته.
- **Preview داخل التطبيق** — سعد يفتح الملف بـ Preview/Word/Acrobat الأصلية.
- **Page counting تلقائي** — سعد يشوفها بصرياً عند الفتح.
- **Silent printing** — نعتمد Dialog النظام الأصلي ليتحكم سعد.
- **دفع إلكتروني** — الدفع نقداً عند التسليم.
- **تطبيق موبايل native** — الـ PWA يكفي.
- **دعم عدة مكتبات** — مكتبة واحدة فقط في هذا الإصدار.
- **ملفات أكبر من 50MB** — rare و overkill.
- **طباعة من الكلاود مباشرة** — دائماً تمر من لابتوب سعد.
- **حسابات موظفين متعددة** — سعد فقط (G8).

</div>
