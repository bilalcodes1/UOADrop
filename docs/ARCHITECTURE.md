<div dir="rtl">

# UOADrop — المعمارية الحالية

هذا المستند يصف **المعمارية الفعلية المنفّذة حالياً داخل المشروع**. أي جزء مستقبلي أو غير منفّذ سيتم التنبيه عليه بوضوح.

---

## 1. المبدأ الحالي

**Desktop-first / Local-first مع مسار Online اختياري**

- التطبيق الحالي يعمل بالكامل داخل جهاز أمين المكتبة.
- الطالب يستخدم **متصفحاً عادياً** لفتح صفحة رفع محلية من نفس الشبكة.
- يعمل النظام الأساسي بدون Supabase/Vercel داخل الشبكة المحلية.
- يوجد الآن مسار Online اختياري عبر Web app + Supabase لاستقبال الطلبات من خارج المكتبة.

---

## 2. التدفق الفعلي داخل التطبيق

### الطالب

1. يتصل بشبكة المكتبة.
2. يفتح الرابط المحلي الذي يولده التطبيق، مثل:
   - `http://192.168.0.100:3737/`
   - أو `http://<LAN-IP>:3737/`
3. يضيف ملفاً واحداً أو عدة ملفات.
4. يختار إعدادات افتراضية للطلب.
5. يغيّر إعدادات أي ملف بشكل مستقل إذا احتاج.
6. يرسل الطلب.
7. يحصل على:
   - `ticket`
   - `pickupPin`
   - شاشة نجاح لمتابعة الحالة

### أمين المكتبة

1. يفتح تطبيق Electron.
2. يرى الطلبات داخل Dashboard.
3. يستطيع التنقل بين تبويب **الطلبات** وتبويب **معلومات المشروع**.
4. يفتح drawer الملفات لكل طلب.
5. يراجع إعدادات كل ملف أو يعدّلها.
6. يفتح الملف أو يطبعه عبر التطبيق الافتراضي للنظام.
7. يحدد السعر يدوياً.
8. يحدّث الحالة إلى `printing` أو `ready` أو `done` حسب الحاجة.

---

## 3. المكوّنات الرئيسية

### 3.1 Electron main process

المسؤوليات الحالية:

- إنشاء نافذة التطبيق.
- تشغيل Fastify المحلي.
- تسجيل IPC handlers.
- تشغيل polling لحالة الطابعة.
- إرسال إشعارات نظام محلية عند وصول ملف جديد.

### 3.2 Fastify server

الخادم المحلي مسؤول عن:

- تقديم صفحة الطالب.
- تقديم أصول الواجهة المحلية من مجلد `resources/` مثل الشعارات.
- إنشاء الطلبات.
- استقبال الملفات.
- عدّ الصفحات للأنواع المدعومة.
- إرسال التحديثات الحية عبر WebSocket.

### 3.2.1 Online workflow service (داخل Electron main)

إضافة إلى الخادم المحلي، يوجد داخل تطبيق الديسكتوب خدمة Online تعمل عند توفر إعدادات Supabase:

- polling لاستيراد الطلبات الأونلاين من Supabase (`online-workflow.ts`)
- تنزيل الملفات من Supabase Storage إلى مسار محلي دائم
- تحديث Mirror في Supabase (`desk_received_at`, `total_pages`, `status`, ...)
- cleanup دوري للملفات الأونلاين من Supabase بعد مدة احتفاظ

### 3.3 SQLite

قاعدة البيانات المحلية مسؤولة عن:

- حفظ الطلبات والملفات.
- حفظ `pickupPin` و `pinHash`.
- حفظ عدد الصفحات.
- حفظ إعدادات الطباعة لكل ملف.
- حفظ أحداث الطابعة ومحاولات PIN الداخلية.

### 3.4 React Dashboard

الـ renderer الحالي مبني بـ React + Vite، ويعرض:

- الطلبات مع الفلاتر والبحث
- تبويب `معلومات المشروع` مع الجهة الأكاديمية، بطاقات الاعتمادات، وروابط الصفحات الرسمية
- السعر اليدوي
- حالة الطابعة
- `pickupPin`
- drawer الملفات وإعداداتها

### 3.5 Student page

الواجهة الحالية للطالب موجودة في:

`apps/desktop/resources/student.html`

وهي صفحة standalone HTML/CSS/JS، وليست React حالياً.

كما تتضمن حالياً:

- قسم **عن UOADrop** داخل الصفحة نفسها
- شعارات الجامعة والكلية مخدومة من الخادم المحلي
- بطاقات الاعتمادات الأكاديمية وروابط الصفحات الرسمية
- حفظاً محلياً لاسم الطالب والإعدادات الافتراضية لتسهيل الاستخدام المتكرر

### 3.6 Web app (Online upload)

تطبيق ويب مستقل (Next.js) يستقبل طلبات الأونلاين ويخزنها في Supabase:

- صفحة الرفع: `apps/web/src/app/page.tsx`
- URL الإنتاج: `https://uoadrop.vercel.app`
- يقوم بتخزين الطلب في جدول `print_requests` ثم يرفع الملفات إلى Supabase Storage ويضيفها إلى `request_files`.

---

## 4. التقنيات المستخدمة الآن

| الطبقة | التقنية |
|--------|---------|
| Desktop shell | Electron |
| Dashboard UI | React + Vite |
| Student page | HTML/CSS/JS standalone |
| Local server | Fastify |
| Database | better-sqlite3 |
| Shared types | `packages/shared` |
| QR generation | `qrcode` |
| Page counting | `pdf-lib` + PPTX slide scan + image fallback |

---

## 5. بنية المشروع الحالية

```text
UOADrop/
├── apps/
│   ├── desktop/
│   │   ├── resources/
│   │   │   ├── student.html
│   │   │   ├── uoadrop-logo.png
│   │   │   ├── university-of-anbar.svg
│   │   │   └── cs-college.svg
│   │   └── src/
│   │       ├── main/
│   │       │   ├── db.ts
│   │       │   ├── ipc.ts
│   │       │   ├── page-counter.ts
│   │       │   ├── printer.ts
│   │       │   └── server.ts
│   │       ├── preload/
│   │       └── renderer/
│   └── web/
│       └── README.md   # placeholder للمراحل القادمة
├── packages/
│   └── shared/
└── docs/
```

---

## 6. نموذج البيانات الحالي

### 6.1 `print_requests`

الحقول الأهم في الاستخدام الحالي:

- `id`
- `ticket`
- `student_name`
- `notes`
- `pickup_pin`
- `pin_hash`
- `status`
- `source` (`local` | `online`)
- `desk_received_at`
- `source_of_truth`
- `import_state`
- `online_files_cleanup_at`
- `options_json`
- `total_pages`
- `price_iqd`
- `created_at`
- `updated_at`

### 6.2 `request_files`

الحقول الأهم:

- `id`
- `request_id`
- `filename`
- `mime_type`
- `size_bytes`
- `local_path`
- `sha256`
- `magic_byte_verified`
- `pages`
- `options_json`
- `created_at`

### 6.3 Runtime migrations

التطبيق لا يعتمد حالياً على نظام migrations خارجي منفصل لتشغيل النسخة المحلية.

بدلاً من ذلك، `db.ts` يضمن وقت التشغيل:

- إنشاء الجداول إذا لم تكن موجودة
- إضافة الأعمدة الجديدة إذا كانت قاعدة البيانات قديمة
- backfill لبعض البيانات مثل عدد الصفحات عند الإمكان

هذا هو السبب في أن إعادة تشغيل التطبيق بعد التحديث تكفي عادةً لتفعيل أي تغييرات schema محلية.

والسبب نفسه ينطبق على التحديثات التي تمس `resources/`، لأن صفحة الطالب والشعارات تُحمّل من الخادم المحلي عند التشغيل.

---

## 7. إعدادات الطباعة لكل ملف

هذا هو القرار المعماري الأهم حالياً.

### 7.1 قبل التغيير

كانت إعدادات الطباعة تعتبر إعدادات طلب واحدة فقط.

### 7.2 بعد التغيير

- `print_requests.options_json` = الإعدادات الافتراضية للطلب
- `request_files.options_json` = الإعدادات الخاصة بكل ملف

### 7.3 السلوك الفعلي

- عند إنشاء طلب جديد، يختار الطالب إعدادات عامة.
- عند إضافة الملفات، يمكنه تعديل كل ملف بشكل منفصل.
- إذا لم يملك ملف إعدادات خاصة، يستخدم التطبيق fallback من إعدادات الطلب.
- الدشبورد يستطيع تعديل إعدادات أي ملف مباشرة.

---

## 8. عدّ الصفحات

عدّ الصفحات في التطبيق الحالي **جزئي لكنه فعلي**:

| النوع | النتيجة |
|------|---------|
| `PDF` | عدد صفحات دقيق |
| `PPTX` | عدد الشرائح |
| `JPG/JPEG/PNG` | صفحة واحدة |
| `DOCX/XLSX` | `0` حالياً |

كما يوجد backfill وقت التشغيل للملفات القديمة إذا كانت مخزنة محلياً والنوع مدعوم.

---

## 9. طبقة HTTP المحلية

### 9.1 المنفذ الحالي

الخادم المحلي يعمل افتراضياً على:

`3737`

### 9.2 أهم المسارات

- `GET /` → صفحة الطالب
- `GET /health` → فحص صحة بسيط
- `GET /qr` → توليد QR للرابط المحلي
- `GET /wall-sign` → صفحة ملصق جاهزة للطباعة
- `POST /api/requests` → إنشاء طلب
- `POST /api/requests/:id/files` → رفع ملف للطلب
- `GET /api/requests` → جلب الطلبات
- `PATCH /api/requests/:id/status` → تحديث الحالة
- `GET /ws` → تحديثات WebSocket

---

## 10. IPC بين Electron والواجهة

الـ renderer لا يصل مباشرة إلى Node APIs. التفاعل يتم عبر preload + IPC.

أهم handlers الحالية:

- `requests:list`
- `requests:listPaged`
- `requests:setStatus`
- `requests:setPrice`
- `requests:files`
- `requests:setFileOptions`
- `requests:delete`
- `file:open`
- `file:print`
- `printer:status`
- `printer:events`

### سلوك `file:print`

الطباعة الحالية **لا تنفذ بصمت** من داخل Electron.

بدلاً من ذلك:

- يفتح التطبيق الملف بالتطبيق الافتراضي في النظام
- ثم يطبع المستخدم عبر `Ctrl+P` أو `Cmd+P`

تم اعتماد هذا المسار لأنه الأكثر استقراراً عبر الأنظمة والأنواع المختلفة.

---

## 11. حالة الطابعة

`printer.ts` ينفّذ polling دوري باستخدام `getPrintersAsync()` من Electron.

النظام يحتفظ بـ:

- الحالة الحالية (`ready`, `printing`, `error`, `offline`, `unknown`)
- اسم الطابعة الافتراضية أو المتاحة
- سجل أحداث عند تغيّر الحالة

ثم يرسل التحديث إلى الواجهة عبر IPC.

---

## 12. الأمان والاعتمادية

ما هو منفّذ حالياً:

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- `setWindowOpenHandler` لمنع النوافذ غير المتوقعة
- single-instance lock
- whitelist للملفات + فحص `magic bytes`
- SQLite WAL mode + pragmas للحماية
- PIN خاص بالمكتبة لقفل الواجهة الإدارية

---

## 13. ما هو مؤجل

هذه العناصر **ليست جزءاً من التطبيق المحلي الأساسي** لكنها أصبحت جزءاً من النظام عند تفعيل مسار Online:

- Web app أونلاين عبر Vercel
- Supabase tables + Storage لمسار Online
- إشعار تأخير الطلبات الأونلاين بعد 3 دقائق عبر Supabase `pg_cron`

ما يزال مؤجلاً أو غير مكتمل بالكامل:

- مزامنة عكسية كاملة (desktop → cloud) خارج mirror الحالي
- إدارة تنظيف التخزين بالكامل من داخل Supabase بدون الاعتماد على تشغيل الديسكتوب

</div>
