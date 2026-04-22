<div dir="rtl">

# المصطلحات والشخصيات

مرجع سريع لكل اسم / مصطلح / رمز يُستخدم في المشروع.

---

## الشخصيات (Personas)

### 👨‍💼 سعد — صاحب المكتبة (Librarian)
- الدور: يستلم طلبات الطباعة، يطبعها، يسلّمها للطلاب، يستلم الدفع.
- الجهاز: لابتوب Mac + راوتر + طابعة.
- الوصول: تطبيق UOADrop Desktop + Dashboard كامل.
- في الكود: `role: 'librarian'`.

### 👩‍🎓 ملاك — الطالبة Offline
- الدور: طالبة داخل المكتبة، ترفع ملفاتها عبر الـ Wi-Fi المحلي.
- الجهاز: أي موبايل (iOS/Android) أو لابتوب.
- الاتصال: Wi-Fi `UOA-Print` فقط، بدون إنترنت.
- في الكود: طلباتها تحمل `source: 'offline'` و `ticket_no: A-XXXX`.

### 👨‍🎓 بلال — الطالب Online
- الدور: طالب من أي مكان، يرفع ملفاته قبل وصوله للمكتبة.
- الجهاز: أي جهاز متصل بالإنترنت.
- الاتصال: الإنترنت العام → Supabase.
- في الكود: طلباته تحمل `source: 'online'` و `ticket_no: B-XXXX`.

---

## الأيقونات والرموز

| الرمز | المعنى |
|-------|--------|
| 📡 | طلب Offline (من داخل المكتبة) |
| 🌐 | طلب Online (من خارج المكتبة) |
| 🔵 | QR Offline (أزرق، مطبوع على الحائط) |
| 🟢 | QR Online (أخضر، مطبوع على الحائط) |
| ✅ | طلب مكتمل (done) |
| ⏳ | طلب في الانتظار (pending) |
| 🖨️ | طلب يُطبع حالياً (printing) |
| ❌ | طلب ملغى (canceled) |

---

## صيغة التذاكر (Ticket Format)

- **Offline**: `A-0001`, `A-0002`, ... — counter محلي في SQLite، يبدأ من جديد كل سنة.
- **Online**: `B-0001`, `B-0002`, ... — sequence في Postgres (Supabase)، مستمرة.
- الـ prefix (A/B) يميّز المصدر بسرعة حتى لو الأيقونة ما ظهرت.

---

## المصطلحات التقنية

### mDNS (Multicast DNS)
بروتوكول يسمح للأجهزة على نفس الشبكة المحلية باكتشاف بعضها بأسماء `.local` (مثل `drop.local`) بدون الحاجة لـ DNS server. **لم نستخدمه في المعمارية النهائية** — اعتمدنا IP ثابت مباشرة.

### Captive Portal
صفحة الترحيب اللي تفتح تلقائياً لما تتصل بشبكة Wi-Fi عامة (فنادق، مطارات). **لم نستخدمها** لأن الراوتر TL-WR940N ما يدعمها في الـ stock firmware. عوّضنا بمسح QR يدوي.

### AP Isolation (Access Point Isolation)
ميزة على الراوتر تمنع الأجهزة المتصلة بنفس الـ Wi-Fi من رؤية بعضها. **يجب أن تكون Disabled** في UOADrop، وإلا موبايل ملاك ما يوصل للابتوب سعد.

### RLS (Row Level Security)
ميزة في Postgres تسمح بوضع شروط على مستوى الصف الواحد لتحديد من يقرأ/يكتب. نستخدمها في Supabase لحماية طلبات سعد من الوصول العام.

### tus.io
بروتوكول رفع ملفات مفتوح يدعم **resumable uploads** — لو انقطع الاتصال في 80%، الرفع يستكمل من آخر chunk بدل البدء من الصفر. حرجة لاتصال Wi-Fi متذبذب.

### IP & MAC Binding
ميزة على الراوتر لحجز IP محدد لـ MAC address معيّن. نستخدمها لضمان أن لابتوب سعد **دائماً** يحصل على `192.168.0.100`، مما يجعل الـ QR ثابت للأبد.

### DHCP (Dynamic Host Configuration Protocol)
البروتوكول اللي يوزّع الـ IPs تلقائياً في الشبكة. الراوتر هو DHCP server في معماريتنا.

### DHCP Reservation
مرادف لـ IP & MAC Binding — حجز IP ثابت لجهاز معيّن.

### Drizzle ORM
ORM لـ TypeScript يدعم Postgres و SQLite بنفس الـ syntax. يسمح لنا بكتابة **نفس الكود** لقاعدتين مختلفتين.

### Supabase Realtime
ميزة في Supabase لبث تحديثات قاعدة البيانات للعملاء فوراً عبر WebSocket. نستخدمها لإشعار سعد لحظة رفع بلال.

### Edge Function
دالة serverless تشتغل على CDN edge. في Supabase نستخدمها لـ Keep-Alive endpoint.

### Resend
مزوّد خدمة إرسال Email الذي نستخدمه للإشعارات. Free tier 3,000 email/شهر. API بسيط ويدعم قوالب HTML + Markdown.

### Telegram Bot API
API رسمي من تيليجرام لإنشاء بوتات. مجاني بالكامل. نستخدمه لإرسال إشعارات الطباعة لبلال عبر `@UOADropBot`.

### Webhook
آلية حيث خدمة خارجية (مثل Telegram) ترسل HTTP POST إلى endpoint عندنا عند وقوع حدث (مثل رسالة جديدة من مستخدم). أسرع وأكفأ من polling.

### Chat ID
رقم عددي فريد يحدّد محادثة في Telegram. كل مستخدم عنده `chat_id` خاص مع كل بوت. نحفظه لنرسل الإشعارات مباشرة بدل الاعتماد على `@username` (اللي ممكن يتغير).

### Opt-in / Opt-out
- **Opt-in**: المستخدم يختار الاشتراك صراحة (مثلاً بإرسال `/start` للبوت).
- **Opt-out**: المستخدم يلغي الاشتراك (مثلاً `/stop` للبوت).
- نحترم الاثنين: لا نرسل إشعارات لأحد لم يطلبها.

### Electron
إطار لبناء تطبيقات Desktop بـ web technologies (JS/HTML/CSS). تطبيق سعد مبني عليه.

### Fastify
إطار HTTP server لـ Node.js، أسرع من Express. يشتغل داخل Electron main process.

### better-sqlite3
مكتبة Node.js للتعامل مع SQLite بشكل **synchronous** — الأسرع في الـ ecosystem.

### Monorepo
نمط تنظيم الكود حيث كل الحزم (packages + apps) في مستودع git واحد. نستخدم pnpm workspaces + Turborepo.

### PWA (Progressive Web App)
تطبيق ويب يقدر يُثبّت على الشاشة الرئيسية ويعمل offline. صفحة الرفع تدعم PWA اختيارياً.

### Zod
مكتبة TypeScript لـ schema validation. نستخدمها لـ form validation في كل من الـ client والـ server.

### Service Worker
script يشتغل في الخلفية في المتصفح، يدعم offline caching. يساعد صفحة الرفع لتفتح حتى لو الشبكة متذبذبة.

### WAL Mode (Write-Ahead Logging)
وضع في SQLite يحسّن الأداء والاعتمادية بفصل الكتابة عن القراءة. نفعّله افتراضياً.

---

## الملفات والمجلدات الرئيسية

| الاسم | الموقع | الغرض |
|-------|--------|-------|
| `apps/web` | جذر المشروع | Next.js — صفحة الطالب + Dashboard |
| `apps/desktop` | جذر المشروع | Electron — تطبيق سعد |
| `packages/shared` | جذر المشروع | types + schemas مشتركة |
| `packages/db-schema` | جذر المشروع | Drizzle schema + migrations |
| `packages/ui` | جذر المشروع | shadcn components مشتركة |
| `supabase/functions` | جذر المشروع | Edge Functions (keepalive) |
| `~/Library/Application Support/UOADrop` | Mac | بيانات سعد (SQLite + ملفات) |
| `%APPDATA%/UOADrop` | Windows | نفس الشي لـ Windows |

---

## URLs والعناوين

| العنوان | الغرض |
|---------|-------|
| `http://192.168.0.100:3000/u` | صفحة رفع Offline (ملاك) |
| `http://192.168.0.100:3000/dashboard` | Dashboard سعد (محلي) |
| `https://uoadrop.app/u` | صفحة رفع Online (بلال) |
| `https://uoadrop.app/dashboard` | Dashboard سعد (online — للوصول عن بُعد مستقبلاً) |
| `http://192.168.0.1` | واجهة إدارة الراوتر |
| `https://<project>.supabase.co` | Supabase project dashboard |

---

## مستويات حالة الطلب (Status)

| Status | معناها | من يقدر يغيّرها |
|--------|--------|-----------------|
| `pending` | منتظر في الطابور | الطالب (cancel) أو سعد |
| `printing` | سعد بدأ الطباعة | سعد فقط (→ done) |
| `done` | تم التسليم | نهائي (يدخل الأرشيف) |
| `canceled` | ألغي قبل الطباعة | نهائي |

---

## مصطلحات التشغيل اليومي

- **الطابور**: قائمة الطلبات pending مرتبة حسب الوقت.
- **التذكرة**: رقم فريد للطلب (A-XXXX / B-XXXX).
- **النموذج**: صفحة الرفع اللي تعبيها ملاك/بلال.
- **اللوحة**: Dashboard سعد.
- **الأرشيف**: الطلبات done أو canceled، محفوظة للسجل فقط.

</div>
