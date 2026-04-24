<div dir="rtl">

# UOADrop 📎

نظام إدارة طلبات الطباعة داخل المكتبة الجامعية. النسخة الحالية تعمل كـ **Desktop-first offline app**: الطالب يفتح صفحة رفع من المتصفح داخل شبكة المكتبة، بينما أمين المكتبة يدير الطلبات من تطبيق Electron محلي.

---

## المشكلة

في مكتبة الجامعة، الطالب اللي يريد يطبع ملف لازم إما:
- **يرسل الملف على تيليجرام** لصاحب المكتبة → يسأله يدوياً عن الاسم، الكمية، نوع الطباعة → بطيء وفيه أخطاء.
- **يستخدم بلوتوث/كيبل** إذا ما عنده نت → آيفون ما يدعم، أخطاء متكررة، إضاعة وقت.

## الحل

الحل الحالي يتكون من جزئين مترابطين:

- **صفحة رفع للطالب** تعمل من أي متصفح على نفس الشبكة المحلية.
- **Dashboard للمكتبة** داخل تطبيق Electron لإدارة الطلبات والملفات والطباعة.

المزايا المنفّذة حالياً:

- رفع عدة ملفات ضمن نفس الطلب.
- حفظ اسم الطالب والإعدادات الافتراضية محلياً لتسهيل الاستخدام المتكرر.
- **إعدادات طباعة مستقلة لكل ملف** داخل الطلب نفسه.
- عرض **رقم التذكرة** و**رمز الاستلام** مباشرة بعد الإرسال.
- حساب تلقائي لعدد الصفحات لملفات `PDF` و `PPTX` والصور (`JPG/PNG`).
- تحديث لحظي في الدشبورد عند وصول ملف جديد.
- إمكانية مراجعة ملفات الطلب وتعديل إعدادات كل ملف من الدشبورد.
- إدخال السعر يدوياً من أمين المكتبة قبل تحويل الطلب إلى `ready`.
- تبويب **معلومات المشروع** داخل الدشبورد مع بطاقات المطور والجهة الأكاديمية وروابط الصفحات الرسمية.
- قسم **عن UOADrop** داخل صفحة الطالب مع شعارات الجامعة والكلية وبطاقات الاعتمادات الأكاديمية.
- خدمة الشعارات وملفات الواجهة من الخادم المحلي نفسه لضمان عملها على الراوتر وداخل الشبكة المحلية بدون إنترنت.

---

## الشخصيات

| | الدور | الاتصال |
|---|---|---|
| 👨‍💼 **سعد** | صاحب المكتبة | لابتوب Mac + راوتر + طابعة |
| 👩‍🎓 **ملاك** | طالبة Offline | داخل المكتبة — Wi-Fi محلي |
| 👨‍🎓 **بلال** | طالب | يرسل طلبه من صفحة الرفع المحلية في النسخة الحالية |

---

## المعمارية المختصرة

```
                 📱 جهاز الطالب
                       │
                 متصفح داخل الشبكة
                       │
              http://<LAN-IP>:3737/
                       │
              ┌────────▼────────┐
              │ Electron Desktop │
              │  Fastify Server  │
              │  SQLite Database │
              └────────┬────────┘
                       │
                React Dashboard
                 لأمين المكتبة
```

---

## Tech Stack

| الطبقة | التقنية |
|--------|---------|
| Language | **TypeScript** (everywhere) |
| Student Page | **Standalone HTML/CSS/JS** داخل `apps/desktop/resources/student.html` |
| Dashboard UI | **React + Vite** داخل Electron renderer |
| Desktop | **Electron** (Windows أساسي + Mac) |
| Local Server | **Fastify** + **better-sqlite3** |
| Local Assets | شعارات وملفات `resources/` تُخدم محلياً من Fastify وتُضمّن مع نسخة التطبيق |
| Page Counting | **pdf-lib** + تحليل PPTX محلي + الصور = صفحة واحدة |
| Cloud / Web | **مؤجل لمرحلة لاحقة** |
| Monorepo | **pnpm workspaces** + **Turborepo** |
| Notifications | **Electron Notification API** + صوت النظام |

---

## الوثائق

| الملف | الغرض |
|-------|-------|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | المعمارية الكاملة والتفاصيل التقنية |
| [`docs/SETUP.md`](docs/SETUP.md) | دليل سعد لإعداد الراوتر واللابتوب |
| [`docs/RISKS.md`](docs/RISKS.md) | المخاطر والوقاية والاستجابة |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | خارطة الطريق والمراحل |
| [`docs/NOTIFICATIONS.md`](docs/NOTIFICATIONS.md) | نظام الإشعارات (Email + Telegram) لبلال |
| [`docs/GAPS.md`](docs/GAPS.md) | التحليل النقدي للفجوات قبل الإطلاق |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | قرارات المنتج النهائية (PIN، pricing، queue، ...) |
| [`docs/HARDENING.md`](docs/HARDENING.md) | إصلاحات Phase 0.5 الأمنية والموثوقية (C1-C17) |
| [`docs/GLOSSARY.md`](docs/GLOSSARY.md) | المصطلحات والشخصيات |

---

## Quick Start (Developer)

**المتطلبات:** Node.js ≥ 20، pnpm ≥ 8، Git.

```bash
pnpm install      # تثبيت dependencies لكل الـ workspaces
pnpm --filter @uoadrop/desktop dev     # تشغيل التطبيق الحالي
pnpm --filter @uoadrop/desktop build   # بناء نسخة الإنتاج للتطبيق الحالي
```

### هيكل الـ Monorepo

```
UOADrop/
├── apps/
│   ├── web/         # Placeholder للـ online phase لاحقاً
│   └── desktop/     # Electron + Fastify + SQLite + React dashboard
├── packages/
│   └── shared/      # types + constants + validation helpers
├── docs/            # التوثيق الكامل
├── pnpm-workspace.yaml
└── turbo.json
```

---

## الحالة الحالية

✅ **Phase 1 — Desktop Offline MVP** يعمل فعلياً

المنفّذ حالياً:

- [x] Electron app + React dashboard
- [x] Fastify server محلي على المنفذ `3737`
- [x] SQLite + migrations محلية
- [x] صفحة رفع للطالب من المتصفح
- [x] pickup PIN ظاهر في صفحة الطالب والدشبورد
- [x] حساب عدد الصفحات للأنواع المدعومة
- [x] **إعدادات مستقلة لكل ملف** في صفحة الرفع والدشبورد
- [x] واجهة معلومات مشروع منفصلة في الدشبورد عبر تبويب `معلومات المشروع`
- [x] شعارات وهوية بصرية محلية تعمل عبر `http://<LAN-IP>:3737/` بدون الاعتماد على CDN أو إنترنت خارجي
- [x] قسم معلومات أكاديمية داخل صفحة الطالب والدشبورد يتضمن العميد ورئيس القسم والمشرفات وروابطهم الرسمية

المؤجل:

- [ ] Online integration
- [ ] Cloud sync / Supabase flow
- [ ] Telegram / Email notifications
- [ ] Production installer + update flow

شوف [`docs/ROADMAP.md`](docs/ROADMAP.md) للتفاصيل.

---

## الترخيص

خاص بمشروع جامعي — لم يُحدد بعد.

</div>
