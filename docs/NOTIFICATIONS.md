<div dir="rtl">

# نظام الإشعارات — Email + Telegram

> **تنبيه مهم:** هذا المستند يصف نظام الإشعارات لمسار **Online**. داخل التطبيق المحلي (Offline/LAN) ما زالت الإشعارات الأساسية هي **إشعارات نظام محلية داخل Electron** عند وصول طلب/ملف جديد.

إشعارات تلقائية لبلال (Online فقط) عبر البريد الإلكتروني وتيليجرام، عند كل تحوّل في حالة طلبه.

> **ملاحظة مهمة**: الإشعارات **حصرية لبلال (Online)**. ملاك (Offline) تستلم مطبوعاتها يدوياً من سعد في المكتبة، فلا حاجة لإشعارها.

---

## 0. الحالة الحالية المختصرة

التنفيذ الحالي يعتمد على Next.js APIs داخل `apps/web` وليس Supabase Edge Functions:

- `/api/notify/email` لإشعار البريد عند استلام/جاهزية الطلب.
- `/api/desktop/telegram` لإشعار Telegram عند الربط/الجاهزية عبر Desktop Gateway.
- `/api/telegram/webhook` لربط `telegram_chat_id` بالطلب عبر البوت.
- `/api/desktop/announcement` للإعلان الجماعي للأونلاين فقط عبر Desktop Gateway.
- `/api/cron/notify-delayed` لتنبيه الطلبات المتأخرة.

الإعلان الجماعي الحالي:

- يقرأ المستلمين عبر Desktop Gateway من `print_requests` حيث `source = 'online'`.
- يستخدم `student_email` و`telegram_chat_id`.
- يتطلب من الديسكتوب إرسال activation token فقط.
- لا يشمل طلبات Offline/Local.
- يعتمد إرسال Email على SMTP variables في Vercel.
- يعتمد إرسال Telegram على `TELEGRAM_BOT_TOKEN` في Vercel.

---

## 1. لماذا لبلال فقط؟

- **بلال من خارج المكتبة**: لا يعرف متى طلبه جاهز → يحتاج إشعار.
- **ملاك داخل المكتبة**: تنتظر عند الطاولة → تستلم مباشرة، الإشعار overkill.
- **تقليل التعقيد والتكلفة**: الإشعارات تستهلك quota، نستخدمها فقط حيث تضيف قيمة.

---

## 2. نقاط الإشعار

المنطق **مختلف** بين القناتين (توفير quota Email + تغطية الحالات الاستثنائية — C6):

| # | الحدث | التوقيت | 📧 Email | 💬 Telegram |
|---|------|---------|:--:|:--:|
| 1 | **Received** | فور رفع الطلب | ❌ | ✅ |
| 2 | **Printing** | سعد ضغط "طباعة" | ❌ | ✅ |
| 3 | **Done** | سعد ضغط "جهز" | ✅ | ✅ |
| 4 | **Blocked** (C6) | مشكلة طابعة/ورق | ✅ | ✅ |
| 5 | **Canceled** (C6) | إلغاء في وقت مبكر | ❌ | ✅ |

- **Email**: فقط عند `done` (جاهزية) أو `blocked` (مشكلة تحتاج تدخل الطالب) — تقدير أقصى ~600 email/شهر < 3000 quota.
- **Telegram**: كل الأحداث (مجاني بلا حدود، خفيف وفوري).

> ملاحظة تنفيذية: في النظام الحالي يتم إرسال إشعارات Telegram لحالات `received` و`ready` عبر Desktop Gateway، أما البريد فيبقى عبر `/api/notify/email`.
> الإشعارات الأخرى المذكورة هنا قد تكون مخططة أو تعتمد على توسعة لاحقة في الداشبورد.

---

## 3. قنوات الإشعار

### 📧 البريد الإلكتروني
- بلال يُدخل `email` (اختياري) في نموذج الرفع.
- إذا أدخله → يُحفظ في `student_email` ويستطيع النظام إرسال إشعارات الطلب والإعلانات الجماعية للأونلاين.
- إذا تركه فارغاً → لا إرسال.
- **المزوّد الحالي**: SMTP عبر `nodemailer` داخل Next.js API.

### 💬 Telegram
- بلال يربط حسابه عبر البوت حتى يُحفظ `telegram_chat_id` داخل Supabase.
- أول مرة: يحتاج يبدأ محادثة مع البوت عبر `/start <ticket>`.
- بعدها، كل الإشعارات تأتي تلقائياً.

### قواعد الإرسال
- **إذا أدخل الاثنين** → نرسل على القناتين (redundancy).
- **إذا أدخل واحد فقط** → نرسل على تلك القناة فقط.
- **إذا ترك الاثنين فارغين** → لا إشعار (الطالب اختار هذا).
- **لا إشعار SMS** في هذا الإصدار (تكلفة عالية، غير ضرورية).

---

## 4. المزوّدات المختارة

### Email: SMTP عبر Nodemailer
- التنفيذ الحالي يستخدم `nodemailer` داخل Next.js API routes.
- الإعداد الافتراضي مناسب لـ Brevo SMTP: `smtp-relay.brevo.com:587`.
- الإرسال يحتاج `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM` في Vercel.
- إذا لم تُضبط بيانات SMTP، يرجع الإرسال كـ skipped/failed بدل أن ينجح بصمت.

### Telegram: Bot API
- **مجاني 100%**.
- **الإعداد**: [@BotFather](https://t.me/BotFather) → token.
- **اسم البوت المقترح**: `@UOADropBot`.
- **الحد الأقصى**: 30 رسالة/ثانية.

---

## 5. معمارية التنفيذ

```
┌────────────────────────────────────────────┐
│  Web app (Next.js على Vercel)               │
│  - /api/notify/email                        │
│  - /api/desktop/telegram                    │
│  - /api/desktop/announcement                │
│  - /api/cron/notify-delayed                 │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌────────────────────────────────────────────┐
│  Supabase Postgres + Storage                │
│  - print_requests / request_files           │
│  - pg_cron + pg_net (تنبيه التأخير)         │
└────────────────────────────────────────────┘
```

### 5.1 تنبيه التأخير (3 دقائق)

- يتم تشغيل فحص التأخير كل دقيقة عبر Supabase `pg_cron` (jobname: `uoadrop_notify_delayed_every_minute`).
- يقوم `pg_net` باستدعاء `https://uoadrop.vercel.app/api/cron/notify-delayed`.
- هذا التصميم تم اعتماده بسبب قيود Vercel Hobby التي تمنع cron بتكرار أكثر من مرة يومياً.

### 5.1 إعداد Database Webhook (تصميم سابق/اختياري)

التنفيذ الحالي لا يحتاج Database Webhook للإعلان الجماعي أو إشعارات الجاهزية الأساسية؛ الديسكتوب يستدعي Next.js APIs مباشرة. الخطوات التالية تخص التصميم الأصلي إذا تم الرجوع لاحقاً إلى Supabase Edge Functions.

**الخطوات** (من Supabase Dashboard):

1. **Database → Webhooks → Create a new hook**.
2. Name: `notify_on_status_change`.
3. Table: `print_requests`.
4. Events: ✓ `Insert` ✓ `Update`.
5. Type: `Supabase Edge Functions`.
6. Edge Function: `notify`.
7. HTTP Headers: `Authorization: Bearer <SERVICE_ROLE_KEY>`.
8. HTTP Params: (فارغ).
9. Confirm → حفظ.

**البديل عبر SQL** (لو تحتاج إدارة برمجية):

```sql
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE OR REPLACE FUNCTION notify_status_change() RETURNS TRIGGER AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://<project>.supabase.co/functions/v1/notify',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer '||current_setting('app.service_role_key')
    ),
    body := jsonb_build_object('record', row_to_json(NEW), 'old_record', row_to_json(OLD))
  );
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notify
  AFTER INSERT OR UPDATE OF status ON print_requests
  FOR EACH ROW EXECUTE FUNCTION notify_status_change();
```

### 5.2 الآلية الحالية
1. بلال يرفع الطلب → يتم حفظ `student_email` و/أو تفضيل Telegram في Supabase.
2. إذا ربط Telegram، `/api/telegram/webhook` يحفظ `telegram_chat_id`.
3. عند وصول/جاهزية الطلب، الديسكتوب يستدعي `/api/desktop/telegram` عبر activation token، والبريد عبر `/api/notify/email`.
4. للإعلان الجماعي، الديسكتوب يستدعي `/api/desktop/announcement` مع activation token.
5. Gateway يقرأ كل مستلمي الأونلاين من `print_requests.source = 'online'` ثم يرسل عبر SMTP وTelegram Bot API.

---

## 6. Schema — الحقول الإضافية

### في `print_requests` (إضافة)
```sql
ALTER TABLE print_requests ADD COLUMN student_email TEXT;
ALTER TABLE print_requests ADD COLUMN telegram_chat_id TEXT;
ALTER TABLE print_requests ADD COLUMN notify_preferences JSONB 
  DEFAULT '{"email": true, "telegram": true}';
```

### جدول جديد: `notifications_log`
```sql
CREATE TABLE notifications_log (
  id          BIGSERIAL PRIMARY KEY,
  request_id  TEXT REFERENCES print_requests(id) ON DELETE CASCADE,
  channel     TEXT NOT NULL,       -- 'email' | 'telegram'
  event       TEXT NOT NULL,       -- 'received' | 'printing' | 'done' | 'canceled'
  status      TEXT NOT NULL,       -- 'sent' | 'failed' | 'pending'
  error       TEXT,
  attempts    INT DEFAULT 1,
  sent_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notif_request ON notifications_log(request_id);
CREATE INDEX idx_notif_failed ON notifications_log(status) 
  WHERE status = 'failed';
```

يعطينا: audit trail + retry tracking + تنبيه سعد عند تكرار الفشل.

---

## 7. نموذج الرفع — الحقول الجديدة (Online فقط)

```
┌─────────────────────────────────────────┐
│  📧 البريد الإلكتروني (اختياري)           │
│  ┌─────────────────────────────────────┐│
│  │ bilal@example.com                   ││
│  └─────────────────────────────────────┘│
│  سنرسل لك إشعار عند جاهزية الطلب         │
│                                         │
│  💬 Telegram (اختياري)                  │
│  [ 🔗 اربط حسابك عبر البوت ]             │
│  بعد الإرسال، افتح البوت واضغط Start    │
└─────────────────────────────────────────┘
```

- **زر "اربط حسابك"**: بعد إرسال الطلب، يفتح `t.me/UOADropBot?start=<token>` (C3 — token آمن بدل `ticket_no`).
- في وضع Offline (ملاك)، الحقلان **مخفيان** تلقائياً بواسطة `source === 'online'` check.

---

## 8. قوالب الرسائل

### Email — Done (الرسالة الأساسية)

> Email يُرسَل عند الجاهزية أو الحالات التي تفعلها واجهات Next.js الحالية، مع الاعتماد على SMTP مضبوط في Vercel.

```
Subject: 🎉 طلبك جاهز للاستلام — UOADrop B-0077

مرحباً بلال،

طلب الطباعة الخاص بك جاهز للاستلام من المكتبة.

رقم التذكرة: B-0077
عدد الملفات: 1
عدد النسخ: 2
الحجم: A4 — أبيض وأسود — وجهين

يرجى مراجعة الموظف سعد وإبراز رقم التذكرة.

شكراً لاستخدامك UOADrop 📎
```

### Telegram — Received (R2: يتضمن PIN لمنع lockout)
```
✅ *تم استلام طلبك*

📎 رقم التذكرة: `B-2026-0077`
� رقم الاستلام (PIN): `4729`  ← احفظه! سعد يطلبه عند التسليم.
�📄 عدد الملفات: 1
🖨️ عدد النسخ: 2
📐 A4 — أبيض وأسود — وجهين

راجع سعد في المكتبة لاستلام المطبوعات.
```

> **لماذا نُرسل PIN في Telegram مع أن DB يخزّن hash فقط؟** PIN يُولَّد مرة واحدة، يُعرض في صفحة التأكيد، **ثم نرسله فوراً** قبل تخزين الـ hash. الطالب يحفظه في محادثة Telegram (R2). لو نسيه → يرجع للمحادثة.

### Telegram — Printing
```
🖨️ *جاري طباعة طلبك الآن*

رقم التذكرة: `B-0077`
```

### Telegram — Done
```
🎉 *طلبك جاهز للاستلام!*

رقم التذكرة: `B-0077`
السعر: 2000 دينار (يدفع عند الاستلام)
الـ PIN: استخدم الرقم الذي ظهر لك عند الرفع.
اذهب للمكتبة وأبرز الرقم لسعد.
```

### Email + Telegram — Blocked (C6)
```
⚠️ *تعذّر تجهيز طلبك مؤقتاً*

رقم التذكرة: `B-0077`
السبب: {blockReason}  مثال: "الطابعة معطّلة" / "الورق نفذ"
سنتواصل معك فور حل المشكلة.
```

### Telegram — Canceled (C6)
```
❌ *تم إلغاء طلبك*

رقم التذكرة: `B-0077`
إذا لم تقم أنت بالإلغاء، راجع المكتبة.
```

---

## 9. Notify engine — تصميم سابق/مرجعي

> ملاحظة: هذا القسم يصف التصميم الأصلي/المستقبلي باستخدام Supabase Edge Functions. التنفيذ الحالي للإشعارات والإعلان الجماعي موجود داخل Next.js API routes في `apps/web/src/app/api/notify/*`.

```ts
async function notify(record: any, oldRecord?: any) {
  const event = determineEvent(record, oldRecord);
  if (!event) return { ok: true, skipped: true };
  
  const tasks: Promise<any>[] = [];
  // Email: فقط عند done أو blocked (C6)
  const EMAIL_EVENTS = new Set(['done', 'blocked']);
  if (record.student_email && EMAIL_EVENTS.has(event)) {
    tasks.push(sendEmail(record, event));
  }
  // Telegram: كل الأحداث (received / printing / done / blocked / canceled)
  if (record.telegram_chat_id) {
    tasks.push(sendTelegram(record, event));
  }
  
  const results = await Promise.allSettled(tasks);
  await logResults(record.id, event, results);
  
  return { ok: true };
}

async function sendEmail(req: any, event: string) {
  // Current implementation uses Nodemailer inside Next.js API routes.
  return transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: req.student_email,
    subject: subjectFor(event, req.ticket),
    html: htmlFor(event, req)
  });
}

async function sendTelegram(req: any, event: string) {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
  return fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: req.telegram_chat_id,
      text: textFor(event, req),
      parse_mode: 'Markdown'
    })
  });
}
```

---

## 10. Telegram Bot — ربط الحساب (C3 hardened)

بلال يعبّي النموذج بدون `chat_id`. السيرفر يولّد **token عشوائي 16 بايت** يربط الطلب بالمحادثة. بلال يضغط زر "اربط حسابك":

```
t.me/UOADropBot?start=tok_f3k92m1q8v2nL9xA
```

> **لماذا ليس `ticket_no`؟** تذاكر `B-0077` sequential وسهلة التخمين، فأي شخص يرسل `/start B-0001..B-9999` يختطف إشعارات الآخرين.

```ts
// عند إنشاء الطلب (online)
import { randomBytes } from 'node:crypto';
const token = 'tok_' + randomBytes(16).toString('hex');
await db.insert(telegramLinkTokens).values({
  token, requestId: req.id,
  expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
});
// واجهة الطالب تبني الرابط: `https://t.me/UOADropBot?start=${token}`
```

البوت يتلقى `/start <token>` ويحفظ `chat_id`:

```ts
// apps/web/src/app/api/telegram/webhook/route.ts
export async function POST(req: Request) {
  const update = await req.json();
  const msg = update.message;
  
  if (msg?.text?.startsWith('/start ')) {
    const token = msg.text.split(' ')[1];
    const chatId = msg.chat.id.toString();
    
    // 1) تحقّق من الـ token: موجود + غير مستخدم + غير منتهي
    const row = await supabase.from('telegram_link_tokens')
      .select('request_id, expires_at, used_at')
      .eq('token', token).single();
    
    if (!row.data || row.data.used_at || new Date(row.data.expires_at) < new Date()) {
      return sendTelegramMessage(chatId, '❌ الرابط غير صالح أو منتهي.');
    }
    
    // 2) اربط الطلب بـ chat_id + علّم الـ token كـ used
    await supabase.from('print_requests')
      .update({ telegram_chat_id: chatId })
      .eq('id', row.data.request_id);
    await supabase.from('telegram_link_tokens')
      .update({ used_at: new Date() }).eq('token', token);
    
    await sendTelegramMessage(chatId, `✅ تم ربط حسابك. ستصلك الإشعارات هنا.`);
  }
  
  if (msg?.text === '/stop') {
    await supabase.from('print_requests')
      .update({ telegram_chat_id: null })
      .eq('telegram_chat_id', msg.chat.id.toString());
    await sendTelegramMessage(msg.chat.id, '❌ تم إلغاء الاشتراك.');
  }
  
  return Response.json({ ok: true });
}
```

Webhook setup:
```bash
curl -X POST https://api.telegram.org/bot<TOKEN>/setWebhook \
  -d "url=https://uoadrop.vercel.app/api/telegram/webhook"
```

---

## 11. Retry Strategy

| Attempt | Delay |
|--------|------|
| 1 | فوري |
| 2 | +1 دقيقة |
| 3 | +10 دقائق |

بعد 3 فشل → `status='failed'` + تنبيه في Dashboard سعد.

Cron job في Supabase كل 5 دقائق يفحص notifications_log للـ pending + retry.

---

## 12. Rate Limits والحماية

| المخاطرة | الحل |
|---------|------|
| طالب يرفع 50 طلب → 150 email | Rate limit: 5 طلبات/ساعة لكل email |
| Bot spam | Chat_id يُحفظ فقط بعد `/start` — opt-in صريح |
| Email غلط → bounces | Validation + SPF/DKIM/DMARC على مزود SMTP |
| Telegram username انتحال | نستخدم `chat_id` العددي لا `@username` |

---

## 13. الخصوصية

- **لا نشارك** email أو chat_id مع أي طرف ثالث.
- **نحذف** بيانات الإشعار بعد 30 يوم من اكتمال الطلب.
- **الإعلانات الجماعية** مسموحة فقط لمستلمي Online الذين لديهم `student_email` أو `telegram_chat_id` محفوظ.
- **opt-out**: أمر `/stop` يحذف chat_id فوراً.

---

## 14. Health Dashboard — إضافات

```
┌──────────────────────────────────────┐
│  📨 Notifications (آخر 24 ساعة)       │
├──────────────────────────────────────┤
│  ✅ Email sent         42/43         │
│  ✅ Telegram sent      38/38         │
│  ⚠️  Failed            1 (retrying)   │
│  SMTP skipped/failed   1             │
└──────────────────────────────────────┘
```

---

## 15. Environment Variables

```bash
# Vercel / Next.js API
EMAIL_HOST=smtp-relay.brevo.com
EMAIL_PORT=587
EMAIL_USER=...
EMAIL_PASS=...
EMAIL_FROM=UOADrop <...>
TELEGRAM_BOT_TOKEN=123456:ABC-xyz
BOT_USERNAME=UOADropBot
SUPABASE_SERVICE_ROLE_KEY=...
```

---

## 16. خارج النطاق

- **WhatsApp** — مكلف ومعقّد (تحقق Meta).
- **SMS** — مكلف ($0.05/رسالة في العراق).
- **Push notifications للـ PWA** — ممكن لاحقاً.
- **إشعارات لسعد** — مو ضرورية (يجلس عند الـ Dashboard).
- **إشعارات لملاك** — مو مطلوبة (تستلم مباشرة).

</div>
