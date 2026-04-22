<div dir="rtl">

# دليل الإعداد لسعد

هذا الدليل يشرح خطوة بخطوة كيف يُركّب سعد النظام من الصفر لأول مرة. بعد إكماله، النظام جاهز للاستخدام اليومي بدون الحاجة لإعادة الإعداد.

**الوقت المتوقع**: ~30 دقيقة.

---

## ما تحتاجه قبل البدء

- **لابتوب Windows 10/11** (الأساسي) أو Mac (مدعوم) — هذا سيصير "جهاز المكتبة".
- للـ DOCX/PPTX: Microsoft Office مُنصَح به (PDF والصور تعمل بدونه).
- **الراوتر** (C16):
  - **الحد الأدنى**: TP-Link TL-WR940N (يعمل، لكن single-band 2.4GHz / 300Mbps).
  - **الموصى به**: TP-Link Archer C6 / C7 أو أحدث (dual-band 2.4+5GHz / AC1200+) — أسرع مع الرفع المتزامن (5+ طلاب).
  - كلها مدعومة من TP-Link وتدعم MAC Binding + AP Isolation toggle.
- طابعة موصولة مباشرة بالابتوب (USB أو شبكة).
- نسخة من تطبيق UOADrop (`.dmg` أو `.exe`).
- ورق A4 + طابعة ملوّنة لطباعة الـ QRs.

---

## الخطوة 1 — إعداد الراوتر (10 دقائق)

### 1.1 — دخول واجهة الراوتر

1. وصّل الراوتر بالكهرباء، انتظر دقيقة.
2. اتصل بالـ Wi-Fi الافتراضي للراوتر (اسم وباسوورد موجودين على الملصق خلف الراوتر).
3. افتح المتصفح → `http://192.168.0.1` (أو `tplinkwifi.net`).
4. سجّل دخول: `admin` / `admin` (أو اللي مكتوب على الراوتر).

### 1.2 — ضبط Working Mode

1. من القائمة اليسار: **Working Mode**.
2. اختر: **Standard Wireless Router** ← `Next` ← `Save`.
3. الراوتر يعيد التشغيل (~30 ثانية).

### 1.3 — ضبط الـ Wi-Fi

1. من القائمة: **Wireless → Wireless Settings**.
2. اضبط:
   - **Wireless Network Name (SSID)**: `UOA-Print`
   - **Region**: Iraq
   - **Channel**: Auto
   - **Mode**: 11bgn mixed
3. `Save`.

4. من: **Wireless → Wireless Security**.
5. **الموصى به (X7)**: **WPA/WPA2 Personal** مع باسوورد بسيط مثل `uoalib2026` يُكتب على الملصق بجانب الـ QR.
   - **لماذا ليس Open؟** أي شخص في نطاق 30م يتصل → مهاجم يرفع 50 ملف ضخم → يملأ قرص سعد أو يستنزف Fastify.
   - **الباسوورد البسيط لا يضيف احتكاكاً** — الطالب يقرأه من الملصق في ثواني، لكن يمنع drive-by.
6. `Save`.

### 1.4 — تعطيل AP Isolation (مهم جداً)

1. من: **Wireless → Wireless Advanced**.
2. تأكد أن **AP Isolation** = `Disable` (أو غير مفعّل).
3. إذا كانت مفعّلة → عطّلها → `Save`.

**بدون هذه الخطوة، موبايل ملاك ما راح يوصل للابتوب سعد.**

### 1.5 — DHCP

1. من: **DHCP → DHCP Settings**.
2. تأكد أنه **Enable**.
3. اضبط:
   - **Start IP**: `192.168.0.150`
   - **End IP**: `192.168.0.199`
   - **Default Gateway**: `192.168.0.1`
4. `Save`.

(نترك `100-149` محجوزة للأجهزة الثابتة مثل لابتوب سعد والطابعة.)

### 1.6 — حجز IP للابتوب سعد (الأهم)

> **🚨 تحذير حرج (R7)**: قبل هذه الخطوة **على Mac**، يجب تعطيل *Private Wi-Fi Address* لشبكة `UOA-Print`:
> - `System Settings → Wi-Fi → UOA-Print → Details → Private Wi-Fi Address = Off`.
> - **السبب**: iOS 14+ و macOS 14+ يستخدمان MAC عشوائي لكل شبكة افتراضياً → MAC يتغير عند كل اتصال → MAC binding يفشل → IP `192.168.0.100` لا يثبت.
> - نفس الإعداد مطلوب لو استُخدم iPhone كـ hotspot احتياطي لاحقاً.

1. **قبل** هذي الخطوة: وصّل لابتوب سعد بالـ Wi-Fi `UOA-Print` لكي يحصل على IP مؤقت.
2. من: **DHCP → DHCP Clients List** → انسخ **MAC Address** للابتوب سعد.
   - بديل: على Mac → `System Settings → Network → Wi-Fi → Details → Hardware` → MAC address.
   - **تأكد** أن MAC الظاهر هنا هو الـ hardware MAC (ثابت)، لا الـ private/random.
3. من: **IP & MAC Binding → Binding Settings**.
4. `Add New`:
   - **MAC Address**: (الصق MAC اللابتوب)
   - **IP Address**: `192.168.0.100`
   - **Bind**: ✅ Enable
5. `Save`.
6. فعّل **ARP Binding** = `Enable` من أعلى الصفحة → `Save All`.

### 1.7 — Backup إعدادات الراوتر

1. من: **System Tools → Backup & Restore**.
2. اضغط **Backup** → سيتحمّل ملف `config.bin`.
3. احفظه في مكان آمن (USB + iCloud/Google Drive).

**لو صار reset للراوتر لاحقاً، استعادة الإعدادات تأخذ دقيقة بدل 10.**

### 1.8 — إعادة تشغيل اللابتوب للتأكد من IP

1. على اللابتوب: افصل Wi-Fi ثم أعد الاتصال بـ `UOA-Print`.
2. تحقق من IP: `System Settings → Network → Wi-Fi → Details`.
3. يجب أن يكون: **`192.168.0.100`**.
4. لو طلع غيره → راجع خطوة 1.6.

---

## الخطوة 2 — تنصيب التطبيق على اللابتوب (5 دقائق)

### 2.1 — تنزيل وتنصيب

> **ملاحظة X2 — Code Signing**: إذا استُخدم إصدار موقّع (Apple Developer ID + notarization، Windows EV Certificate)، يختفي تحذير Gatekeeper/SmartScreen + auto-update يعمل بسلاسة. بدون توقيع، كل تحديث يتطلب *"Open Anyway"* يدوياً — auto-update مكسور.

**على Mac:**
1. حمّل `UOADrop.dmg` → افتحه → اسحب الأيقونة إلى `Applications`.
2. افتح التطبيق من `Applications`.
3. **(إصدار غير موقّع فقط)** Mac يعرض: *"UOADrop is from an unidentified developer"* →
   - `System Settings → Privacy & Security` → **Open Anyway**.
   - مع إصدار موقّع: يُفتح مباشرة دون تحذير.

**على Windows:**
1. حمّل `UOADrop-Setup.exe` → شغّله.
2. اتبع الـ installer.
3. **(إصدار غير موقّع فقط)** SmartScreen: **More info → Run anyway**.
   - مع EV certificate: يُنصّب مباشرة.

### 2.2 — Firewall Permission

Mac و Windows راح يطلبون إذن Firewall:

**على Mac:**
```
"Do you want the application UOADrop to accept incoming network connections?"
```
اضغط **Allow**.

**على Windows:**
```
"Windows Defender Firewall has blocked some features of UOADrop"
```
- اختر: ✅ **Private networks** ✅ **Public networks**
- اضغط **Allow access**.

### 2.3 — أول تشغيل

1. التطبيق يفتح لوحة سعد الرئيسية.
2. التطبيق يتحقق تلقائياً:
   - ✅ IP = `192.168.0.100`
   - ✅ Port 3000 متاح
   - ✅ SQLite DB initialized
   - ✅ Printer متصلة
3. لو أي فحص فشل → Health Dashboard يعرض تفاصيل المشكلة.

### 2.4 — Auto-start + منع النوم (C8)

من إعدادات التطبيق:
- ✅ Launch on system startup
- ✅ Prevent sleep while running
- ✅ Show in menu bar / system tray

### 2.4.1 — منع النوم عند إغلاق غطاء اللابتوب (C8 — مهم جداً)

لو سعد أغلق غطاء اللابتوب وخرج → النظام يدخل sleep وينقطع طلاب offline. `powerSaveBlocker` في التطبيق لا يغلب سياسة الغطاء.

**على Windows 10/11**:
```powershell
# في PowerShell بصلاحيات مسؤول
# 0 = Do nothing (when lid is closed)
powercfg /setacvalueindex SCHEME_CURRENT SUB_BUTTONS LIDACTION 0
powercfg /setdcvalueindex SCHEME_CURRENT SUB_BUTTONS LIDACTION 0
powercfg /setactive SCHEME_CURRENT
```
أو عبر GUI: `Control Panel → Power Options → Choose what closing the lid does → Do nothing` (لكلا Plugged-in و On-battery).

**على macOS 12+**:
```bash
# يحتاج sudo
sudo pmset -a disablesleep 1
sudo pmset -a sleep 0  # الجهاز لا ينام عند اتصاله بالشاحن
```
بديل بلا sudo: تطبيق [Amphetamine](https://apps.apple.com/app/amphetamine/id937984704) مجاني من Mac App Store.

**تحذير UI**: التطبيق يعرض banner أحمر لو اكتشف أن `lidaction ≠ 0`:
> ⚠️ غطاء اللابتوب مضبوط على "نوم" — النظام سيتوقف عند الإغلاق. راجع الخطوة 2.4.1 في `SETUP.md`.

**هذي الإعدادات تضمن أن النظام يرجع للعمل تلقائياً بعد أي إعادة تشغيل أو انقطاع كهرباء.**

### 2.5 — ربط الطابعة

1. من التطبيق: **Settings → Printer**.
2. اختر الطابعة الافتراضية من القائمة.
3. اضبط إعدادات افتراضية:
   - Paper size: A4
   - Quality: Normal
4. اضغط **Test Print** → يطبع صفحة اختبار.

---

## الخطوة 3 — توليد وطباعة الـ QRs (10 دقائق)

### 3.1 — من التطبيق

1. فتح: **Settings → QR Codes**.
2. تظهر QR-تان:
   - 📡 **Offline QR** (أزرق): `http://192.168.0.100:3000/u`
   - 🌐 **Online QR** (أخضر): `https://uoadrop.app/u`
3. اضغط **Print Wall Signs**.
4. التطبيق ينشئ PDF جاهز للطباعة (A4، QR كبير واضح، تعليمات عربية).

### 3.2 — تصميم الملصق المقترح

```
┌─────────────────────────────────────┐
│                                     │
│         📎 UOADrop                  │
│      نظام طباعة المكتبة              │
│                                     │
│  ┌──────────────┐   ┌──────────────┐│
│  │              │   │              ││
│  │  📡 أوفلاين   │   │  🌐 أونلاين   ││
│  │   [QR أزرق]   │   │  [QR أخضر]   ││
│  │              │   │              ││
│  └──────────────┘   └──────────────┘│
│                                     │
│  داخل المكتبة:        من أي مكان:    │
│  ١. اتصل بـ Wi-Fi:     امسح الباركود   │
│     UOA-Print          الأخضر        │
│  ٢. امسح الباركود                    │
│     الأزرق                            │
│                                     │
│  لا يعمل الباركود؟                    │
│  اكتب في المتصفح:                     │
│  192.168.0.100:3000/u               │
│                                     │
│  راجع الموظف للاستفسار                │
└─────────────────────────────────────┘
```

### 3.3 — الطباعة واللصق

1. اطبع الملصق ملوّناً على A4 (أفضل A3 لو متاح).
2. ضعه في إطار بلاستيك شفاف لحمايته.
3. ألصقه على الحائط أمام مدخل المكتبة، بارتفاع العين (~1.5م).
4. اطبع نسخة احتياطية واحتفظ بها.

---

## الخطوة 4 — اختبار شامل (5 دقائق)

### 4.1 — اختبار iOS

1. خذ iPhone (أي iOS 12+).
2. افصل الـ Wi-Fi الحالي.
3. اتصل بـ `UOA-Print`.
4. iPhone قد يعرض "No Internet" → اختر **Use Without Internet** أو تجاهل التحذير.
5. افتح Camera → وجّهها للـ QR الأزرق.
6. اضغط على الإشعار اللي يظهر.
7. يجب أن تفتح صفحة الرفع.

### 4.2 — اختبار Android

1. خذ Android (أي 7+).
2. اتصل بـ `UOA-Print`.
3. إذا ظهر "Stay connected?" → اختر **Yes**.
4. افتح الكاميرا أو Google Lens → امسح QR.
5. يجب أن تفتح الصفحة.

### 4.3 — اختبار رفع حقيقي

1. اختر ملف PDF صغير (< 1MB).
2. عبّي النموذج باسم تجريبي: `اختبار سعد`.
3. اضغط **إرسال**.
4. على لابتوب سعد: يجب أن يظهر الطلب فوراً في القائمة (بصوت تنبيه).
5. اضغط **طباعة** → يجب أن تخرج الورقة من الطابعة.
6. اضغط **تم** → الطلب يختفي من القائمة النشطة.

**لو كل الاختبارات نجحت → النظام جاهز للعمل الفعلي.**

---

## Troubleshooting — حلول المشاكل الشائعة

| المشكلة | السبب المرجّح | الحل |
|---------|---------------|------|
| الصفحة لا تفتح على موبايل الطالب | AP Isolation مفعّل | راجع خطوة 1.4 |
| الصفحة بطيئة جداً | إشارة Wi-Fi ضعيفة | قرّب الراوتر من مكان الطلاب |
| "Server not responding" على الموبايل | التطبيق مطفّأ على اللابتوب | افتح التطبيق |
| IP غير 192.168.0.100 على اللابتوب | MAC binding غير مفعّل | راجع خطوة 1.6 |
| موبايل يتحوّل لـ 4G تلقائياً | Android يكتشف "لا إنترنت" | اضبط "Stay connected" في إعدادات Wi-Fi للموبايل |
| الطلب يصل لكن الطباعة لا تعمل | الطابعة غير محددة افتراضياً | راجع خطوة 2.5 |
| التطبيق لا يفتح عند تشغيل اللابتوب | Auto-start معطّل | راجع خطوة 2.4 |
| Mac/Windows يدخل sleep عند إغلاق الغطاء | lidaction غير مضبوط | راجع خطوة 2.4.1 (C8) |
| Supabase paused email وصل | Keep-alive failed | افتح التطبيق، تحقق من نت اللابتوب |
| QR لا يُقرأ من بعيد | حجم صغير أو ضوء ضعيف | أعد طباعة على A3 أو قرّب الملصق من الضوء |

---

## الخطوة 5 — إعداد الإشعارات (10 دقائق، لـ Online فقط)

> هذه الخطوة تخص بلال (طلاب Online). ملاك (Offline) ما تحتاج إشعارات.
> التفاصيل التقنية الكاملة في [`NOTIFICATIONS.md`](./NOTIFICATIONS.md).

### 5.1 — إعداد Resend (Email)

1. افتح [resend.com](https://resend.com) → Sign up (مجاني).
2. من Dashboard: **API Keys → Create API Key**.
3. اسخ المفتاح (يبدأ بـ `re_...`) واحفظه مؤقتاً.
4. **Domain verification** (اختياري لكن موصى):
   - **Domains → Add Domain** → `uoadrop.app`.
   - أضف DNS records (TXT + MX) اللي تعرضها Resend عند domain provider.
   - انتظر التحقق (~5 دقائق).
   - لو ما عندك domain الآن → تخطى، واستخدم `onboarding@resend.dev` (محدود لكن يشتغل).

### 5.2 — إنشاء بوت تيليجرام

1. افتح تيليجرام → ابحث عن **@BotFather**.
2. أرسل: `/newbot`.
3. اسم البوت: `UOADrop Bot`.
4. Username: `UOADropBot` (لازم ينتهي بـ `bot`).
5. BotFather راح يعطيك **Token** يبدأ مثل `123456:ABC-xyz...` — احفظه.
6. اختياري — خصّص البوت:
   - `/setdescription` → "إشعارات طلبات الطباعة من UOADrop"
   - `/setuserpic` → ارفع شعار المشروع
   - `/setcommands`:
     ```
     start - بدء ربط حسابك بطلب
     stop - إلغاء الإشعارات
     ```

### 5.3 — حفظ المفاتيح في Supabase

1. افتح Supabase Dashboard → مشروعك → **Settings → Edge Functions**.
2. أضف Environment Variables:
   - `RESEND_API_KEY` = `re_xxxx` (من خطوة 5.1)
   - `TELEGRAM_BOT_TOKEN` = `123456:ABC-xyz` (من خطوة 5.2)
   - `FROM_EMAIL` = `noreply@uoadrop.app` (أو `onboarding@resend.dev`)
   - `BOT_USERNAME` = `UOADropBot`

### 5.4 — تسجيل Webhook للبوت

بعد deploy الـ Edge Functions (يسويها المطوّر):

```bash
curl -X POST \
  "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://<project>.supabase.co/functions/v1/telegram-webhook"
```

### 5.4.1 — ربط Database Webhook على Supabase (C13 — إلزامي)

> بدون هذه الخطوة، **الإشعارات لن تُرسل أبداً** مهما كان الكود صحيحاً. Supabase لا يربط جداول DB بـ Edge Functions تلقائياً.

1. Supabase Dashboard → مشروعك → **Database → Webhooks**.
2. اضغط **Create a new hook**.
3. اضبط:
   - **Name**: `notify_on_status_change`
   - **Table**: `print_requests`
   - **Events**: ✓ `Insert` ✓ `Update`
   - **Type**: `Supabase Edge Functions`
   - **Edge Function**: `notify`
   - **HTTP Headers**: `Authorization: Bearer <SERVICE_ROLE_KEY>`
4. ✓ Confirm → **Create webhook**.
5. **اختبار**: بدّل status طلب يدوياً في Table Editor → تحقّق من `Edge Functions → notify → Logs` أنه يستقبل الحدث.

التفاصيل الكاملة في [`NOTIFICATIONS.md` §5.1](./NOTIFICATIONS.md).

### 5.5 — اختبار الإشعارات

1. من جهاز خارج شبكة المكتبة: افتح `https://uoadrop.app/u`.
2. ارفع ملف اختبار.
3. عبّي الـ **email** ببريدك الشخصي.
4. اضغط **إرسال** → **لا** email يصل الآن (email يصل فقط عند جاهزية الطلب).
5. من صفحة التأكيد: اضغط **اربط Telegram** → يفتح البوت → اضغط Start.
6. **Telegram**: يصلك إشعار "تم الاستلام" فوراً.
7. على لابتوب سعد: اضغط **طباعة** → Telegram "جاري الطباعة".
8. اضغط **تم** → Telegram "جاهز للاستلام" + **Email واحد** "طلبك جاهز".

لو وصل:
- ✅ 3 إشعارات Telegram
- ✅ 1 email عند الجاهزية فقط

الإشعارات شغّالة.

---

## الصيانة الدورية

### يومياً
- لا شي — النظام يشتغل تلقائياً.

### أسبوعياً
- تحقق من Health Dashboard في التطبيق: كل المؤشرات خضراء؟
- مساحة القرص > 20%؟

### شهرياً
- Backup قاعدة البيانات (التطبيق يسويها تلقائياً، تأكد من وجودها).
- تحقق من سجل Supabase (هل في pings يومية؟).
- احذف الملفات القديمة يدوياً لو auto-cleanup تعطل.

### سنوياً
- حدّث firmware الراوتر.
- حدّث macOS / Windows.
- حدّث UOADrop من auto-updater.

---

## معلومات الطوارئ

احفظ هذي المعلومات في مكان آمن:

```
Router admin:    http://192.168.0.1
Router username: admin
Router password: (اللي ضبطته)

Laptop IP:       192.168.0.100
Wi-Fi SSID:      UOA-Print
Wi-Fi password:  (اللي ضبطته)

Config backup:   (مسار ملف config.bin)
App data folder: ~/Library/Application Support/UOADrop  (Mac)
                 %APPDATA%/UOADrop                       (Windows)
```

</div>
