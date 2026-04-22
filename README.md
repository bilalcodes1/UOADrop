<div dir="rtl">

# UOADrop 📎

نظام نقل ملفات الطباعة بين الطلاب وصاحب المكتبة في جامعة عراقية — يعمل **أونلاين وأوفلاين** بواجهة ويب بسيطة بدون الحاجة لتنصيب أي تطبيق على جهاز الطالب.

---

## المشكلة

في مكتبة الجامعة، الطالب اللي يريد يطبع ملف لازم إما:
- **يرسل الملف على تيليجرام** لصاحب المكتبة → يسأله يدوياً عن الاسم، الكمية، نوع الطباعة → بطيء وفيه أخطاء.
- **يستخدم بلوتوث/كيبل** إذا ما عنده نت → آيفون ما يدعم، أخطاء متكررة، إضاعة وقت.

## الحل

صفحة رفع ذكية تُفتح من أي متصفح:
- **أوفلاين** (داخل المكتبة): يمسح الطالب QR على الحائط → يتصل بـ Wi-Fi المكتبة → يرفع ملفاته مباشرة للابتوب صاحب المكتبة.
- **أونلاين** (من أي مكان): يدخل الموقع → يرفع ملفاته → تصل فوراً لصاحب المكتبة عبر الإنترنت.

كلتا الطريقتين تعبّيان نفس النموذج (الاسم الثلاثي، القسم، المرحلة، عدد النسخ، ملوّن/أبيض، إلخ) ويصلان لنفس **لوحة موحّدة** عند صاحب المكتبة.

**بلال** يتلقى **إشعارات تلقائية**: Telegram لحظة بلحظة (استلام → طباعة → جاهز)، و Email واحد فقط عند جاهزية الطلب. (ملاك ما تحتاج — تنتظر عند الطاولة).

---

## الشخصيات

| | الدور | الاتصال |
|---|---|---|
| 👨‍💼 **سعد** | صاحب المكتبة | لابتوب Mac + راوتر + طابعة |
| 👩‍🎓 **ملاك** | طالبة Offline | داخل المكتبة — Wi-Fi محلي |
| 👨‍🎓 **بلال** | طالب Online | خارج المكتبة — إنترنت عادي |

---

## المعمارية المختصرة

```
                    📱 الطالب (ملاك/بلال)
                   ┌────────┴────────┐
                   │                 │
              [Offline]          [Online]
                   │                 │
           ┌───────▼─────┐   ┌───────▼─────┐
           │  Wi-Fi      │   │  Internet   │
           │  المكتبة     │   │             │
           └───────┬─────┘   └───────┬─────┘
                   │                 │
           ┌───────▼─────┐   ┌───────▼─────┐
           │  لابتوب سعد  │   │  Supabase   │
           │  SQLite     │◄──┤  Postgres   │
           │  Fastify    │   │  Storage    │
           └───────┬─────┘   └───────┬─────┘
                   └────────┬────────┘
                            ▼
                   💻 Dashboard سعد
                   (قائمة طلبات موحّدة)
```

---

## Tech Stack

| الطبقة | التقنية |
|--------|---------|
| Language | **TypeScript** (everywhere) |
| Web UI | **Next.js 14** (App Router) + Tailwind + shadcn/ui |
| Desktop | **Electron** (Windows أساسي + Mac) |
| Local Server | **Fastify** + **better-sqlite3** |
| Cloud | **Supabase** (Postgres + Storage + Realtime) |
| ORM | **Drizzle** (موحّد على SQLite و Postgres) |
| File Upload | **tus.io** (resumable) |
| Monorepo | **pnpm workspaces** + **Turborepo** |
| Notifications | **Resend** (Email) + **Telegram Bot API** |

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
pnpm typecheck    # فحص TypeScript
pnpm dev          # تشغيل dev servers (بعد Phase 1.2)
```

### هيكل الـ Monorepo

```
UOADrop/
├── apps/
│   ├── web/         # Next.js — واجهة الطالب (Phase 2)
│   └── desktop/     # Electron — لوحة سعد (Phase 1.2)
├── packages/
│   ├── shared/      # types + constants + zod schemas
│   ├── db-schema/   # Drizzle schema (Postgres + SQLite)
│   └── ui/          # React components مشتركة
├── docs/            # التوثيق الكامل
├── pnpm-workspace.yaml
└── turbo.json
```

---

## الحالة الحالية

✅ **Phase 0** — Documentation (مكتملة)
🚧 **Phase 1.1** — Monorepo scaffold (الحالية)
- [ ] Phase 1.2: Electron app + dashboard
- [ ] Phase 1.3: Local SQLite + Fastify server
- [ ] Phase 1: MVP Offline كامل
- [ ] Phase 2: Online integration
- [ ] Phase 3: Print & polish
- [ ] Phase 4: Production release

شوف [`docs/ROADMAP.md`](docs/ROADMAP.md) للتفاصيل.

---

## الترخيص

خاص بمشروع جامعي — لم يُحدد بعد.

</div>
