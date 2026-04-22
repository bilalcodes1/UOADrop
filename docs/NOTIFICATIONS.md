<div dir="rtl">

# نظام الإشعارات — Email + Telegram

إشعارات تلقائية لبلال (Online فقط) عبر البريد الإلكتروني وتيليجرام، عند كل تحوّل في حالة طلبه.

> **ملاحظة مهمة**: الإشعارات **حصرية لبلال (Online)**. ملاك (Offline) تستلم مطبوعاتها يدوياً من سعد في المكتبة، فلا حاجة لإشعارها.

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

---

## 3. قنوات الإشعار

### 📧 البريد الإلكتروني
- بلال يُدخل `email` (اختياري) في نموذج الرفع.
- إذا أدخله → يستلم **رسالة واحدة فقط** عند جاهزية الطلب (`done`).
- إذا تركه فارغاً → لا إرسال.
- **السبب**: Resend Free tier محدود بـ 3,000 email/شهر. نحفظها للإشعار الأهم.

### 💬 Telegram
- بلال يُدخل `@username` أو يربط حسابه عبر البوت.
- أول مرة: يحتاج يبدأ محادثة مع البوت عبر `/start <ticket>`.
- بعدها، كل الإشعارات تأتي تلقائياً.

### قواعد الإرسال
- **إذا أدخل الاثنين** → نرسل على القناتين (redundancy).
- **إذا أدخل واحد فقط** → نرسل على تلك القناة فقط.
- **إذا ترك الاثنين فارغين** → لا إشعار (الطالب اختار هذا).
- **لا إشعار SMS** في هذا الإصدار (تكلفة عالية، غير ضرورية).

---

## 4. المزوّدات المختارة

### Email: Resend
- **لماذا**: أسهل API، developer-friendly، قوالب HTML + Markdown.
- **Free tier**: 3,000 email/شهر، 100/يوم.
- **الكفاية**: 300 طلب أونلاين/شهر × 3 إشعارات = 900 email → داخل الحدود.
- **Domain**: يحتاج verify domain (`uoadrop.app`) أو `onboarding@resend.dev` مؤقتاً.

### Telegram: Bot API
- **مجاني 100%**.
- **الإعداد**: [@BotFather](https://t.me/BotFather) → token.
- **اسم البوت المقترح**: `@UOADropBot`.
- **الحد الأقصى**: 30 رسالة/ثانية.

---

## 5. معمارية التنفيذ

```
┌────────────────────────────────────────────┐
│  Supabase Postgres                            │
│  - print_requests (INSERT/UPDATE)             │
│  - notifications_log (audit)                  │
└──────────────────┬──────────────────────────┘
                   │ Database Webhook (C13)
                   ▼
┌────────────────────────────────────────────┐
│  Supabase Edge Function: notify              │
│  - يقرأ الطلب + قناة الإشعار                   │
│  - يختار template حسب الحدث                    │
│  - يرسل عبر Resend + Telegram Bot            │
│  - يسجل النتيجة في notifications_log         │
└────────────────────────────────────────────┘
```

### 5.1 إعداد Database Webhook (C13 — مهم جداً)

> بدون هذا الإعداد الصريح، الإشعارات **لن تُرسل أبداً**. Supabase لا يربط DB triggers بـ Edge Functions تلقائياً.

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

### 5.2 الآلية
1. بلال يرفع الطلب → INSERT في `print_requests` → Webhook يستدعي Edge Function.
2. Edge Function يقرأ `email` + `telegram_chat_id` من الطلب.
3. يولّد محتوى حسب الحدث من template.
4. يرسل عبر الـ APIs بالتوازي (`Promise.allSettled`).
5. يسجل النتيجة (success/failure) في `notifications_log`.
6. فشل → retry تلقائي 3 مرات مع exponential backoff.

---

## 6. Schema — الحقول الإضافية

### في `print_requests` (إضافة)
```sql
ALTER TABLE print_requests ADD COLUMN email TEXT;
ALTER TABLE print_requests ADD COLUMN telegram_username TEXT;
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

> Email يُرسَل عند `done` (جاهزية) أو `blocked` (مشكلة — C6)، لتوفير quota الـ Resend.

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

## 9. Edge Function — التنفيذ

```ts
// supabase/functions/notify/index.ts
import { serve } from 'https://deno.land/std/http/server.ts';

serve(async (req) => {
  const { record, old_record, type } = await req.json();
  
  const event = determineEvent(record, old_record, type);
  if (!event) return new Response('no-op');
  
  const tasks: Promise<any>[] = [];
  // Email: فقط عند done أو blocked (C6)
  const EMAIL_EVENTS = new Set(['done', 'blocked']);
  if (record.email && EMAIL_EVENTS.has(event)) {
    tasks.push(sendEmail(record, event));
  }
  // Telegram: كل الأحداث (received / printing / done / blocked / canceled)
  if (record.telegram_chat_id) {
    tasks.push(sendTelegram(record, event));
  }
  
  const results = await Promise.allSettled(tasks);
  await logResults(record.id, event, results);
  
  return new Response('ok');
});

async function sendEmail(req: any, event: string) {
  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'UOADrop <noreply@uoadrop.app>',
      to: req.email,
      subject: subjectFor(event, req.ticket_no),
      html: htmlFor(event, req)
    })
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
// supabase/functions/telegram-webhook/index.ts
serve(async (req) => {
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
  
  return new Response('ok');
});
```

Webhook setup:
```bash
curl -X POST https://api.telegram.org/bot<TOKEN>/setWebhook \
  -d "url=https://<project>.supabase.co/functions/v1/telegram-webhook"
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
| Email غلط → bounces | Validation + Resend domain verification |
| Telegram username انتحال | نستخدم `chat_id` العددي لا `@username` |

---

## 13. الخصوصية

- **لا نشارك** email أو chat_id مع أي طرف ثالث.
- **نحذف** بيانات الإشعار بعد 30 يوم من اكتمال الطلب.
- **لا إعلانات** — البوت للإشعارات فقط.
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
│  Resend quota:         127/3000      │
└──────────────────────────────────────┘
```

---

## 15. Environment Variables

```bash
# .env للـ Supabase Edge Function
RESEND_API_KEY=re_xxxxxxxxxxxx
TELEGRAM_BOT_TOKEN=123456:ABC-xyz
FROM_EMAIL=noreply@uoadrop.app
BOT_USERNAME=UOADropBot
```

---

## 16. خارج النطاق

- **WhatsApp** — مكلف ومعقّد (تحقق Meta).
- **SMS** — مكلف ($0.05/رسالة في العراق).
- **Push notifications للـ PWA** — ممكن لاحقاً.
- **إشعارات لسعد** — مو ضرورية (يجلس عند الـ Dashboard).
- **إشعارات لملاك** — مو مطلوبة (تستلم مباشرة).

</div>
