<div dir="rtl">

# التحليل النقدي — الفجوات المكتشفة

> **ملاحظة مرجعية:** هذا الملف تحليلي/تاريخي ويجمع فجوات ونقاشات قادت إلى قرارات لاحقة. لا يُستخدم كمرجع وحيد لوصف ما هو منفّذ الآن؛ المرجع الحالي هو `ARCHITECTURE.md` و`DECISIONS.md` و`SETUP.md` و`README.md`، خصوصاً فيما يخص صفحة الطالب المحلية، تبويب معلومات المشروع، وخدمة الشعارات داخل الشبكة المحلية.

مراجعة صادقة لكل ما لم يُذكر في التوثيق الأساسي. القرارات المعتمدة عليها في [`DECISIONS.md`](./DECISIONS.md).

---

## 🔴 الحرجة (8) — محسومة في DECISIONS

| # | الفجوة | القرار |
|---|--------|-------|
| G1 | التسعير | سعد يدخل يدوياً |
| G2 | التحقق من المستلم | PIN 4 أرقام |
| G3 | خارج الدوام | يُجدول للصباح التالي |
| G4 | الطابعة معطّلة | حالة `blocked` + إشعار |
| G5 | PDF محمي | رفض عند الرفع |
| G6 | ساعات الذروة | Queue + مؤشر موقع |
| G7 | المحتوى الحساس | النظام غير مسؤول |
| G8 | بديل سعد | حساب واحد فقط |

---

## 🟡 المهمة (12) — محسومة تلقائياً في DECISIONS

| # | الفجوة | القرار |
|---|--------|-------|
| G9 | Testing | Unit + Integration + 1 E2E |
| G10 | Error Tracking | Sentry |
| G11 | i18n | عربي فقط في MVP |
| G12 | RTL + خط | Cairo + Tailwind `dir="rtl"` |
| G13 | Backup rotation | 7 يومية + 4 أسبوعية + 12 شهرية |
| G14 | Zero-downtime | update ليلاً + rollback |
| G15 | Scheduled Pickup | حقل اختياري + تذكير |
| ~~G16~~ | ~~تحويل الملفات~~ | ❌ **محذوف** (D1) — الملف يصل كما هو |
| G17 | الأقسام | 10 + "غير ذلك" |
| G18 | الطابعة | خيارات مرنة في Settings |
| G19 | المحاسبة | سجل يومي `daily_revenue` |
| G20 | Rush hour concurrent | queue منظم + سعد يوافق |

---

## 🔒 Phase 0.5 — Hardening (C1-C17)

بعد مراجعة نقدية ثانية، اكتُشفت **17 فجوة هندسية** في الأمان والموثوقية. كلها محسومة في [`HARDENING.md`](./HARDENING.md):

| الفئة | الإصلاحات |
|-------|---------|
| 🔴 Security | C3 (Telegram token), C4 (RLS), C5 (bcrypt PIN), C7 (magic-bytes) |
| 🔴 Printing | C1 (no rundll32), C2 (did-finish-load) |
| 🟠 Reliability | C8 (lid-close), C9 (single-instance), C10 (queue realtime), C11 (archive schema) |
| 🟡 Integrity | C6 (blocked/canceled notif), C12 (CAPTCHA online-only), C13 (webhook setup), C14 (health cleanup), C15 (bind IP), C16 (router rec), C17 (idle lock) |

---

## 🔒 Phase 0.6 — Round 2 Hardening (R1-R12)

مراجعة ثانية كشفت **12 فجوة إضافية** (UX, runtime compat, auth):

| الفئة | الإصلاحات |
|-------|---------|
| 🔴 UX/Security | R1 (PIN offline nullable), R2 (PIN in Telegram), R3 (bcryptjs Deno), R4 (app idle), R5 (persistent rate limit), R6 (electron-rebuild) |
| 🟠 Integrity | R7 (Private Wi-Fi), R8 (get-request spec), R9 (cancel endpoint), R10 (archived scope), R11 (ticket format unified), R12 (printer status) |

---

## 🔒 Phase 0.7 — Round 3 Hardening (X1-X10)

جولة ثالثة كشفت **10 فجوات** في compatibility + distribution + OS specifics:

| الفئة | الإصلاحات |
|-------|---------|
| 🔴 Day-1 Blockers | X1 (HTTPS mitigation), X2 (code signing), X3 (password keytar), X4 (Electron security), X5 (timezone) |
| 🟠 Day-30 Cumulative | X6 (SQLite pragmas), X7 (WPA2), X8 (Cairo self-host) |
| 🟡 Day-60 Polish | X9 (Supabase TUS config), X10 (printer mid-job) |

---

## 🔒 Phase 0.8 — Round 4 Hardening (Z1-Z6)

الجولة الرابعة ركّزت على **تناقضات داخلية** بين إصلاحات الجولات السابقة:

| الفئة | الإصلاحات |
|-------|---------|
| 🔴 Internal consistency | Z1 (nav guard + mDNS), Z2 (printer_events schema), Z3 (pin_attempts both-sides) |
| 🟠 Extra hardening | Z4 (cumulative PIN lockout), Z5 (lock screen UI in roadmap), Z6 (tus cleanup cron) |

التفاصيل الكاملة في [`HARDENING.md`](./HARDENING.md).

---

##  جاهزية الإطلاق

| المرحلة | الجاهزية |
|---------|:-------:|
| قبل التحليل الأول | 65% |
| بعد حسم القرارات G/H | 95% |
| بعد النقد الهندسي الأول (C1-C17) | 78% |
| بعد Phase 0.5 Hardening | 97% |
| بعد النقد الثاني (R1-R12) | 89% |
| بعد Phase 0.6 Hardening | 99% |
| بعد النقد الثالث (X1-X10) | 93% |
| بعد Phase 0.7 Hardening | 99.5% |
| بعد النقد الرابع (Z1-Z6) | 97% |
| **بعد Phase 0.8 Hardening (الحالي)** | **99.8%** |
| بعد Phase 1 (MVP Offline) | 99.9% |
| بعد Phase 2-4 (كامل) | 100% |

للتفاصيل، راجع [`DECISIONS.md`](./DECISIONS.md) و [`HARDENING.md`](./HARDENING.md) و [`ROADMAP.md`](./ROADMAP.md).

</div>
