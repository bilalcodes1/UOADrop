import type { Metadata } from 'next';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'تحميل UOADrop — نظام إدارة طلبات الطباعة للمكاتب والمكتبات الجامعية',
  description: 'حمّل تطبيق UOADrop الرسمي لأنظمة Windows وmacOS. نظام متكامل لإدارة طلبات الطباعة في المكاتب والمكتبات، مع تفعيل خاص بكل مكتب، روابط رفع مستقلة، وداشبورد عملي لاستلام الطلبات وتسعيرها وتسليمها.',
};

type DownloadAsset = {
  label: string;
  format: string;
  fileName: string;
  note: string;
  href: string;
  primary?: boolean;
};

type PlatformInfo = {
  name: string;
  arch: string;
  description: string;
  iconType: 'mac' | 'windows';
  requirement: string;
  assets: DownloadAsset[];
};

type StatItem = {
  value: string;
  label: string;
  detail: string;
};

type TimelineItem = {
  phase: string;
  title: string;
  text: string;
};

type TechStackItem = {
  title: string;
  items: string[];
};

type PartnerIconType = 'university' | 'college' | 'library' | 'integration';

const downloadFile = (asset: string) => `/download/file?asset=${asset}`;

const stats: StatItem[] = [
  { value: 'v0.1.5', label: 'الإصدار المستقر', detail: 'النسخة الرسمية الحالية، مُختبرة وتعمل في الإنتاج لدى المكاتب المُفعَّلة' },
  { value: '٦ ملفات', label: 'حزم تثبيت', detail: 'Windows Installer وPortable، إضافة إلى macOS Intel وApple Silicon بصيغتي DMG وZIP' },
  { value: 'متعدد المكاتب', label: 'تشغيل مستقل', detail: 'كل مكتبة مستقلة بكود تفعيل ورابط رفع وباركود خاص بها لا يتداخل مع غيرها' },
  { value: 'SHA-256', label: 'تحقق سلامة الملف', detail: 'ملف بصمات تحقق منشور مع الإصدار للتأكد من مطابقة الملف الذي حمّلته للنسخة الرسمية' },
];

const platforms: PlatformInfo[] = [
  {
    name: 'macOS',
    arch: 'Apple Silicon (M1/M2/M3) + Intel x64',
    description: 'نسخة macOS الرسمية تدعم أجهزة Apple Silicon (M1 وM2 وM3 وما بعدها) إضافة إلى الأجهزة الأقدم بمعالجات Intel. بعد التثبيت، يبدأ التطبيق بشاشة فارغة حتى تُدخل كود التفعيل الخاص بمكتبتك، فيظهر اسمها ورابط الرفع المخصّص لها داخل الإعدادات.',
    iconType: 'mac',
    requirement: 'macOS 12 (Monterey) أو أحدث · ذاكرة 4GB · مساحة 200MB على القرص · إنترنت للتفعيل ومزامنة الطلبات الأونلاين · كود تفعيل صادر من لوحة الأدمن.',
    assets: [
      { label: 'macOS Apple Silicon — DMG', format: '~135MB', fileName: 'UOADrop-0.1.5-arm64.dmg', note: 'الخيار الموصى به لأجهزة Mac الحديثة بمعالجات Apple Silicon (M1/M2/M3/M4). افتح الملف ثم اسحب أيقونة UOADrop إلى مجلد Applications.', href: downloadFile('mac-arm64-dmg'), primary: true },
      { label: 'macOS Intel — DMG', format: '~140MB', fileName: 'UOADrop-0.1.5.dmg', note: 'النسخة المخصصة لأجهزة Mac القديمة بمعالجات Intel. لا تستخدم هذا الملف على أجهزة Apple Silicon.', href: downloadFile('mac-x64-dmg') },
      { label: 'macOS Apple Silicon — ZIP', format: '~130MB', fileName: 'UOADrop-0.1.5-arm64-mac.zip', note: 'نفس النسخة بصيغة مضغوطة، مفيدة للأرشفة أو النقل بين الأجهزة.', href: downloadFile('mac-arm64-zip') },
      { label: 'macOS Intel — ZIP', format: '~135MB', fileName: 'UOADrop-0.1.5-mac.zip', note: 'نسخة Intel مضغوطة للنسخ الاحتياطي أو التشغيل اليدوي.', href: downloadFile('mac-x64-zip') },
    ],
  },
  {
    name: 'Windows',
    arch: 'Windows 10 / 11 — 64-bit',
    description: 'نسخة Windows الرسمية لأجهزة المكاتب والمكتبات. تستقبل طلبات المكتبة المرتبطة بها فقط، مع داشبورد محلي يعمل بدون إنترنت، واستيراد لطلبات الويب، وإشعارات تصل عبر بوابة آمنة دون تخزين أي مفاتيح حساسة على جهازك.',
    iconType: 'windows',
    requirement: 'Windows 10 أو Windows 11 · معالج 64-bit · ذاكرة 4GB · مساحة 200MB على القرص · إنترنت للتفعيل ومزامنة الطلبات · كود تفعيل صادر من لوحة الأدمن.',
    assets: [
      { label: 'Windows Installer', format: '~114MB', fileName: 'UOADrop.Setup.0.1.5.exe', note: 'الخيار الموصى به للتثبيت الدائم على جهاز المكتبة، يضيف اختصاراً في قائمة Start ويدعم التحديث فوق النسخة القديمة.', href: downloadFile('win-x64-installer'), primary: true },
      { label: 'Windows Portable', format: '~114MB', fileName: 'UOADrop.0.1.5.exe', note: 'نسخة محمولة تعمل بدون تثبيت، مفيدة للتجربة السريعة أو لتشغيل التطبيق من فلاش USB.', href: downloadFile('win-x64-portable') },
    ],
  },
];

const releaseHighlights = [
  {
    title: 'تفعيل مستقل لكل مكتبة',
    text: 'كل تطبيق يرتبط بمكتبة محددة عبر كود تفعيل تُولّده لوحة الأدمن. لا يمكن لـ تطبيق واحد استقبال طلبات أكثر من مكتبة، ولن تصل إليك أي طلبات قبل إدخال كود التفعيل الخاص بك.',
  },
  {
    title: 'روابط وباركودات منفصلة',
    text: 'لكل مكتبة باركود QR خاص يوجّه الطالب مباشرة إلى صفحة رفع تخصّها، أما الرابط العام فيعرض قائمة بالمكتبات النشطة ليختار منها. لا تداخل بين طلبات الجهات المختلفة تحت أي ظرف.',
  },
  {
    title: 'أمان مدمج في التصميم',
    text: 'تطبيق المكتبة لا يحوي أي مفاتيح حساسة أو بيانات إدارية؛ جميع الأسرار (قاعدة البيانات، الإشعارات، مفاتيح التشفير) تبقى على خوادم النظام. إذا فُقد الجهاز، يمكن إلغاء تفعيله فوراً من اللوحة المركزية.',
  },
];

const downloadGuides = [
  {
    title: 'جهازك Windows 10 أو 11',
    text: 'حمّل ملف Windows Installer (حجمه 114MB) وهو الخيار الموصى به للتثبيت الدائم على جهاز المكتبة. النسخة المحمولة (Portable) تبقى خياراً للتجربة السريعة أو لتشغيل التطبيق مباشرة من فلاش USB دون تثبيت.',
  },
  {
    title: 'Mac بمعالج Apple Silicon',
    text: 'أجهزة Mac المصنوعة من عام 2020 فصاعداً (بمعالجات M1 وM2 وM3 وM4) تستخدم نسخة arm64. حمّل ملف DMG (حجمه 135MB) وهو الأنسب للتثبيت، ثم اسحب أيقونة التطبيق إلى مجلد Applications.',
  },
  {
    title: 'Mac بمعالج Intel',
    text: 'أجهزة Mac الأقدم (قبل عام 2020) تستخدم نسخة Intel x64 (حجمها 140MB). لا تختر ملف arm64 على هذه الأجهزة، فالتطبيق لن يعمل. للتأكد من نوع المعالج، افتح قائمة Apple ثم About This Mac.',
  },
];

const setupSteps = [
  {
    title: 'إنشاء المكتبة في لوحة الأدمن',
    text: 'يدخل مدير النظام إلى لوحة الأدمن، ويُنشئ سجلاً جديداً لمكتبتك باسم واضح ووصلة (slug)، ثم يُولّد كود تفعيل خاصاً بها. هذا الكود لا يعمل إلا مع مكتبتك وجهاز واحد.',
  },
  {
    title: 'تحميل التطبيق وتثبيته',
    text: 'اختر من أسفل الصفحة النسخة المناسبة لنظام تشغيل جهاز المكتبة الموصول بالطابعة، ثم ثبّته بالطريقة المعتادة. للتحديثات لاحقاً، يكفي تشغيل المثبّت الجديد فوق النسخة القديمة دون فقدان أي بيانات.',
  },
  {
    title: 'إدخال كود التفعيل',
    text: 'افتح التطبيق، توجه إلى الإعدادات، والصق كود التفعيل الصادر لك من الأدمن. عند نجاح التفعيل، سيظهر اسم مكتبتك ورابط الرفع الخاص بها داخل التطبيق جاهزاً للنسخ والمشاركة.',
  },
  {
    title: 'بدء استقبال الطلبات',
    text: 'اعرض باركود QR الخاص بمكتبتك على الحائط أو في لافتة المدخل، أو شارك الرابط مع الطلبة مباشرة. كل طلب جديد سيظهر فوراً في الداشبورد جاهزاً للمراجعة والتسعير والطباعة.',
  },
];

const verificationItems = [
  {
    title: 'التحقق من بصمة SHA-256',
    text: 'ملف SHA256SUMS.txt منشور رسمياً مع كل إصدار. يمكنك التأكد من أن الملف الذي حملته مطابق تماماً للنسخة الرسمية بإجراء بسيط في Terminal أو PowerShell.',
    command: 'shasum -a 256 -c SHA256SUMS.txt',
  },
  {
    title: 'تحذيرات نظام التشغيل عند أول تشغيل',
    text: 'النسخة الحالية غير موقّعة بشهادة رسمية، لذلك قد يظهر على Windows تحذير SmartScreen (اضغط More info « ثم Run anyway)، وعلى macOS قد يطلب منك السماح للتطبيق من System Settings » Privacy & Security. هذا سلوك طبيعي وأمن لأن الملف منشور من المصدر الرسمي.',
  },
  {
    title: 'خصوصية بياناتك وطلبات طلبتك',
    text: 'التطبيق المثبّت على جهازك لا يحوي أي مفاتيح حساسة أو بيانات إدارية؛ جميع المفاتيح تبقى في خوادم النظام. حتى لو فُقد الجهاز أو تعرّض للسرقة، لا تُكشف بيانات النظام، ويمكن إلغاء تفعيل التطبيق فوراً من اللوحة المركزية.',
  },
  {
    title: 'حل رسالة damaged على macOS',
    text: 'إذا ظهرت رسالة «UOADrop is damaged» بعد التثبيت، انقل التطبيق أولاً إلى مجلد Applications، ثم نفّذ الأمر التالي في Terminal لإزالة علامة الحجر الصحي التي يضعها النظام على الملفات المحملة من الإنترنت.',
    command: 'xattr -dr com.apple.quarantine /Applications/UOADrop.app',
  },
];

const timeline: TimelineItem[] = [
  {
    phase: '01',
    title: 'رصد المشكلة الحقيقية',
    text: 'بدأت الفكرة من معاناة يومية في إيصال ملفات الطباعة إلى المكتبات: طالب يرسل عبر Telegram، وآخر عبر WhatsApp، وثالث جاء بفلاش USB، وبينهم أسئلة متكررة تستهلك وقت صاحب المكتبة والطلبة قبل تشغيل أول صفحة.',
  },
  {
    phase: '02',
    title: 'توحيد قناة الاستلام',
    text: 'تم تصميم صفحة رفع موحّدة تجمع كل تفاصيل الطلب منذ اللحظة الأولى: الملفات، عدد النسخ، لون الطباعة، نوع الورق، الموعد المطلوب، وبيانات التواصل. انتهت فوضى تعدد التطبيقات، وصار لكل طلب سجل واحد واضح.',
  },
  {
    phase: '03',
    title: 'بناء داشبورد المكتبة',
    text: 'طُوّرت لوحة تحكّم عملية لصاحب المكتبة تجمع كل ما يحتاجه في مكان واحد: استلام الطلبات لحظيّاً، مراجعة الملفات، تحديد السعر يدويّاً، إدارة الدفع، وتحديث حالة الطلب ليراها الطالب فوراً.',
  },
  {
    phase: '04',
    title: 'التوسّع لعدة مكتبات',
    text: 'أُضيفت لوحة أدمن مركزية لإدارة المكتبات الأخرى: إنشاء مكتبة جديدة، توليد أكواد تفعيل، تعطيل وحذف عند الحاجة، وربط كل تطبيق بجهة محددة لمنع أي تداخل أو إتلاف للبيانات.',
  },
  {
    phase: '05',
    title: 'الباركودات الذكية',
    text: 'كل مكتبة الآن تحصل على باركود QR خاص يفتح صفحة الرفع موجّهاً إليها مباشرة، والرابط العام يبقى متاحاً ليختار الطالب من قائمة المكتبات المسجلة والنشطة، لتلبية أسلوبي التوزيع في البيئة الأكاديمية.',
  },
];

const partners = [
  {
    iconType: 'university' as PartnerIconType,
    name: 'جامعة الأنبار',
    role: 'البيئة الأكاديمية الحاضنة للمشروع والداعمة لفكرة تطوير تجربة الطباعة الجامعية.',
  },
  {
    iconType: 'college' as PartnerIconType,
    name: 'كلية علوم الحاسوب وتكنولوجيا المعلومات',
    role: 'بيئة الانطلاق الأولى للمشروع. النظام مفتوح الآن للعمل مع كل مكاتب الطباعة الأكاديمية والجامعية.',
  },
  {
    iconType: 'library' as PartnerIconType,
    name: 'المكتبات ومكاتب الطباعة',
    role: 'كل مكتبة تعمل بشكل مستقل تماماً: كود تفعيل خاص، رابط رفع مستقل، حسابات دفع، وأسعار تحددها بنفسك.',
  },
  {
    iconType: 'integration' as PartnerIconType,
    name: 'بنية تقنية متكاملة',
    role: 'تطبيق سطح مكتب، منصة ويب للرفع، قاعدة بيانات لحظية، وإشعارات عبر البريد وTelegram تعمل بتجانس ودون تدخل يدوي.',
  },
];

const capabilities = [
  'استقبال طلبات الطباعة عبر صفحة واحدة منظمة بدلاً من فوضى WhatsApp وTelegram والبريد',
  'توجيه الطالب إلى مكتبتك تلقائيّاً عند دخوله من باركود QR، أو اختيارها من الرابط العام',
  'ربط التطبيق بمكتبتك عبر كود تفعيل مستقل لا يعمل على أكثر من جهاز',
  'عرض رابط الرفع وباركود QR الخاص بمكتبتك داخل الإعدادات مع أزرار نسخ وفتح مباشر',
  'استلام عدد النسخ ولون الطباعة ونوع الورق وملاحظات الطالب لكل ملف على حدة',
  'تسعير يدوي مرن تتحكّم فيه دون تدخل خارجي أو عمولات مفروضة',
  'تحديث حالة الطلب بضغطة واحدة: قيد التنفيذ « جاهز « تم التسليم، تصل للطالب تلقائيّاً',
  'تشفير ملفات الطلبة أثناء الرفع، وفك التشفير داخل جهاز مكتبتك فقط',
  'دعم وسائل الدفع المحلية: Qi Card وZainCash، مع خيار الدفع نقداً عند الاستلام',
  'إدارة حسابات الدفع ورمز PIN التطبيق من داخل الداشبورد دون تدخل خارجي',
  'عرض IP وMAC جهاز المكتبة داخل التطبيق لتسهيل حجز عنوان IP ثابت في الراوتر',
  'تحديثات مستمرة لأنظمة macOS وWindows تُنشر رسمياً على GitHub Releases',
];

const heroProofItems = [
  { value: 'متعدد المكاتب', label: 'كل مكتبة تعمل مستقلة ببياناتها' },
  { value: 'تحديث لحظي', label: 'الطالب يرى حالة طلبه فوراً' },
  { value: 'QR لكل مكتبة', label: 'باركود خاص يوجّه بدقة' },
];

const workflowProblems = [
  'أجهزة iPhone لا تدعم إرسال الملفات عبر Bluetooth إلى أجهزة Windows.',
  'كل طالب يختار قناة إرسال مختلفة (Telegram أو البريد أو WhatsApp) بدون توحيد.',
  'تكرار الأسئلة بين كل طالب وصاحب المكتبة: عدد النسخ، اللون، الورق، وطريقة الدفع.',
  'ضياع تفاصيل الطلب أثناء الحوار وغياب سجل واضح للملفات والأسعار.',
];

const techStack: TechStackItem[] = [
  {
    title: 'منصة الويب وصفحة الرفع',
    items: ['Next.js 14', 'React 18', 'TypeScript', 'تصميم متجاوب للهاتف'],
  },
  {
    title: 'تطبيق المكتبة المحلي',
    items: ['Electron Desktop', 'SQLite محلي', 'Fastify Server', 'React Dashboard'],
  },
  {
    title: 'البنية السحابية',
    items: ['Supabase Postgres', 'Realtime Subscriptions', 'Storage محمي', 'Vercel Edge'],
  },
  {
    title: 'التشفير والإشعارات',
    items: ['AES-256-GCM', 'RSA-OAEP-SHA256', 'Telegram Webhook', 'SMTP Email'],
  },
];

const latestUpdates = [
  'لوحة أدمن متكاملة لإدارة المكتبات: إنشاء وتفعيل وتعطيل وحذف نهائي، مع توليد ونسخ أكواد التفعيل',
  'إعدادات الراوتر داخل التطبيق تعرض IP الجهاز وعنوان MAC مع أزرار نسخ، لتسهيل حجز IP ثابت في الراوتر',
  'صفحة الرفع العامة تعرض قائمة المكتبات النشطة، أما باركود المكتبة فيوجّه الطالب مباشرة إليها',
  'تطبيق المكتبة يعرض اسم الجهة المرتبطة ورابط الرفع الكامل مع زر فتح مباشر للنسخ والمشاركة',
  'ملصقات الحائط وباركودات QR تُولّد برابط المكتبة الصحيح بدلاً من الرابط العام',
  'منع الربط التلقائي بأي مكتبة افتراضية، لإلزام التفعيل بكود رسمي صادر من الأدمن فقط',
];

const faqItems = [
  {
    question: 'هل التطبيق مناسب لمكتبتي إذا لم تكن لديّ خبرة تقنية عميقة؟',
    answer: 'نعم. تم تصميم التطبيق ليكون بسيطاً وعملياً: تثبيت بنقرتين، تفعيل بلصق كود واحد، ولا يحتاج إعداداً تقنياً معقداً. كل ما تحتاجه هو استلام الطلب من الداشبورد، تحديد السعر، والضغط على طباعة. دليل إعداد الراوتر والشبكة متوفر بخطوات واضحة إن احتجته.',
  },
  {
    question: 'كيف يعرف الطالب أين يرسل ملفه؟',
    answer: 'أمامه طريقتان: إما مسح باركود QR المعروض في المكتبة فيُوجّه مباشرة إلى صفحة الرفع الخاصة بها، أو الدخول من الرابط العام واختيار المكتبة من قائمة الجهات النشطة قبل الإرسال.',
  },
  {
    question: 'ماذا لو دخل طالب بالخطأ على مكتبة أخرى؟',
    answer: 'كل مكتبة لديها باركود خاص ورابط رفع منفصل بوصلة (slug) فريدة. لا تستقبل مكتبتك إلا طلبات موجّهة إليها صراحة، والرابط العام يلزم الطالب باختيار المكتبة قبل الإرسال. إذا اختار مكتبة خاطئة، لن يصل الطلب إلى داشبورد مكتبتك.',
  },
  {
    question: 'هل أتحكّم بأسعاري وحساباتي وإعداداتي؟',
    answer: 'نعم. السعر النهائي تحدده بنفسك يدوياً لكل طلب قبل تأكيده، ولا توجد أسعار مفروضة أو عمولات خفية. حسابات Qi Card وZainCash ورمز PIN دخول التطبيق كلها قابلة للتعديل من إعدادات الداشبورد ولا يطّلع عليها أي طرف خارجي.',
  },
];

const pageLogos = [
  { key: 'uoadrop', src: '/uoadrop-logo.png', alt: 'UOADrop', label: 'UOADrop' },
  { key: 'university', src: '/university-of-anbar.svg', alt: 'جامعة الأنبار', label: 'جامعة الأنبار' },
  { key: 'college', src: '/cs-college.svg', alt: 'كلية علوم الحاسوب', label: 'كلية علوم الحاسوب' },
  { key: 'qicard', src: '/Qicard.png', alt: 'Qi Card', label: 'Qi Card' },
  { key: 'zaincash', src: '/zaincash.png', alt: 'ZainCash', label: 'ZainCash' },
];

function MacIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a8.5 8.5 0 00-2.7 16.5c-.1.5-.4 1.2-1.1 2-.5.6-.2 1.5.6 1.5h6.4c.8 0 1.1-.9.6-1.5-.7-.8-1-1.5-1.1-2A8.5 8.5 0 0012 2z" />
    </svg>
  );
}

function WindowsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5.5l7.5-1.2v7.2H3V5.5zM3 12.5h7.5v7.2L3 18.5v-6zM11.5 4.2L21 2.5v9H11.5V4.2zM11.5 12.5H21v9l-9.5-1.7v-7.3z" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg className={styles.downloadIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h8l-1 8 11-14h-8l1-6z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function UniversityIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 10.2L12 4l8.5 6.2" />
      <path d="M5 10h14" />
      <path d="M7 10v8" />
      <path d="M11 10v8" />
      <path d="M15 10v8" />
      <path d="M19 10v8" />
      <path d="M4.5 18h15" />
      <path d="M3.5 21h17" />
    </svg>
  );
}

function CollegeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="4.5" width="17" height="12" rx="2.5" />
      <path d="M9 20h6" />
      <path d="M12 16.5V20" />
      <path d="M10 9l-2 2 2 2" />
      <path d="M14 9l2 2-2 2" />
    </svg>
  );
}

function LibraryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 5.5h5.5A2.5 2.5 0 0113 8v11a2.8 2.8 0 00-2.5-1.5H5V5.5z" />
      <path d="M19 5.5h-5.5A2.5 2.5 0 0011 8v11a2.8 2.8 0 012.5-1.5H19V5.5z" />
      <path d="M8 9h2" />
      <path d="M15 9h2" />
      <path d="M8 12h2" />
      <path d="M15 12h2" />
    </svg>
  );
}

function IntegrationIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="7" r="2.5" />
      <circle cx="18" cy="7" r="2.5" />
      <circle cx="12" cy="17" r="2.5" />
      <path d="M8.2 8.3l2.7 5.7" />
      <path d="M15.8 8.3L13.1 14" />
      <path d="M8.6 7h6.8" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg className={styles.socialIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="16.7" cy="7.3" r="1.1" fill="currentColor" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg className={styles.socialIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21 5.2L18.1 19c-.2.9-.9 1.1-1.6.7l-4.4-3.3-2.1 2c-.2.2-.4.4-.9.4l.3-4.6 8.4-7.6c.4-.3-.1-.5-.5-.2L7 13.1l-4.5-1.4c-1-.3-1-.9.2-1.4L20.1 3.7c.8-.3 1.4.2.9 1.5z" fill="currentColor" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function partnerIcon(type: PartnerIconType) {
  const icons = {
    university: UniversityIcon,
    college: CollegeIcon,
    library: LibraryIcon,
    integration: IntegrationIcon,
  };
  return icons[type];
}

function platformIcon(type: PlatformInfo['iconType']) {
  const icons = { mac: MacIcon, windows: WindowsIcon };
  return icons[type];
}

function CreditsActionIcon() {
  return (
    <svg className={styles.creditsActionIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 17L17 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 7h8v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ProjectCreditsSection() {
  return (
    <section className={styles.creditsSection} aria-label="معلومات المشروع والمطور">
      <details className={styles.creditsPanel}>
        <summary className={styles.creditsSummary}>
          <div className={styles.creditsSummaryCopy}>
            <span className={styles.creditsKicker}>عن UOADrop</span>
            <strong>معلومات المشروع والجهة الأكاديمية الداعمة</strong>
            <p>اضغط لعرض تفاصيل المشروع، والجهة الأكاديمية، ووسائل التواصل بشكل منظم ومتناسق مع الهوية البصرية.</p>
          </div>
        </summary>

        <div className={styles.creditsBody}>
          <div className={styles.creditsInstitutions} aria-label="الجهة الأكاديمية">
            <article className={styles.creditsInstitutionCard}>
              <div className={styles.creditsInstitutionLogo} data-logo="university">
                <img src="/university-of-anbar.svg" alt="جامعة الأنبار" />
              </div>
              <div className={styles.creditsInstitutionCopy}>
                <span className={styles.creditsInstitutionLabel}>الجامعة</span>
                <strong>جامعة الأنبار</strong>
                <p>الجهة الأكاديمية الحاضنة لانطلاق المشروع والداعمة لفكرة تطوير تجربة الطباعة.</p>
              </div>
            </article>

            <article className={styles.creditsInstitutionCard}>
              <div className={styles.creditsInstitutionLogo} data-logo="college">
                <img src="/cs-college.svg" alt="كلية علوم الحاسوب" />
              </div>
              <div className={styles.creditsInstitutionCopy}>
                <span className={styles.creditsInstitutionLabel}>الكلية</span>
                <strong>كلية علوم الحاسوب وتكنولوجيا المعلومات</strong>
                <p>بيئة الانطلاق الأولى للمشروع، مع بقاء النظام قابلاً للعمل مع كل المكاتب والمكتبات المسجلة.</p>
              </div>
            </article>
          </div>

          <article className={styles.creditsCard}>
            <span className={styles.creditsLabel}>العميد</span>
            <h3>أ.د. صلاح عواد سلمان</h3>
            <p>عميد <span className={styles.creditsInlineEmphasis}>كلية علوم الحاسوب وتكنولوجيا المعلومات</span>، وتأتي الإشارة إليه هنا بوصفه جزءاً من البيئة الأكاديمية الداعمة للمشروع داخل <span className={styles.creditsInlineEmphasis}>جامعة الأنبار</span>.</p>
            <a className={styles.creditsAction} href="https://www.uoanbar.edu.iq/staff-page.php?ID=1614" target="_blank" rel="noreferrer">
              <span>الصفحة الرسمية</span>
              <CreditsActionIcon />
            </a>
          </article>

          <article className={styles.creditsCard}>
            <span className={styles.creditsLabel}>رئيس القسم</span>
            <h3>د. عصام طه ياسين حسين الهيتي</h3>
            <p>يُذكر <span className={styles.creditsInlineEmphasis}>د. عصام طه ياسين حسين الهيتي</span> هنا بصفته <span className={styles.creditsInlineEmphasis}>رئيس القسم</span> ضمن البنية الأكاديمية الداعمة لبيئة المشروع في <span className={styles.creditsInlineEmphasis}>كلية علوم الحاسوب وتكنولوجيا المعلومات</span>.</p>
            <a className={styles.creditsAction} href="https://www.uoanbar.edu.iq/staff-page.php?ID=1673" target="_blank" rel="noreferrer">
              <span>الصفحة الرسمية</span>
              <CreditsActionIcon />
            </a>
          </article>

          <article className={styles.creditsCard}>
            <span className={styles.creditsLabel}>الإشراف</span>
            <h3>د. رقية أياد عبد الجبار عبيد العاني</h3>
            <p>أشرفت <span className={styles.creditsInlineEmphasis}>د. رقية أياد عبد الجبار عبيد العاني</span> على الجوانب الأكاديمية والتنظيمية للمشروع لضمان انسجامه مع احتياج الطلبة وسهولة استخدامه.</p>
            <a className={styles.creditsAction} href="https://www.uoanbar.edu.iq/staff-page.php?ID=1626" target="_blank" rel="noreferrer">
              <span>الصفحة الرسمية</span>
              <CreditsActionIcon />
            </a>
          </article>

          <article className={styles.creditsCard}>
            <span className={styles.creditsLabel}>المشرفة الثانية</span>
            <h3>د. مكارم عبدالواحد عبدالجبار التركي</h3>
            <p>تُذكر <span className={styles.creditsInlineEmphasis}>د. مكارم عبدالواحد عبدالجبار التركي</span> ضمن الإطار الأكاديمي المساند للمشروع بوصفها من الكادر التدريسي في <span className={styles.creditsInlineEmphasis}>كلية علوم الحاسوب وتكنولوجيا المعلومات</span>.</p>
            <a className={styles.creditsAction} href="https://www.uoanbar.edu.iq/staff-page.php?ID=1651" target="_blank" rel="noreferrer">
              <span>الصفحة الرسمية</span>
              <CreditsActionIcon />
            </a>
          </article>

          <article className={styles.creditsCard}>
            <span className={styles.creditsLabel}>المطور</span>
            <h3>بلال زامل احمد</h3>
            <p><span className={styles.creditsInlineEmphasis}>بلال زامل احمد</span> طالب مرحلة ثانية في <span className={styles.creditsInlineEmphasis}>علوم الحاسوب</span>، مهتم بتحويل المشاكل الواقعية إلى حلول برمجية عملية، وبناء أدوات تقنية بسيطة ومفيدة وفي متناول الجميع.</p>
            <ul className={styles.creditsMeta}>
              <li>
                <span className={styles.creditsMetaLabel}><InstagramIcon /> Instagram</span>
                <a className={styles.creditsLink} href="https://instagram.com/bilalcodes1" target="_blank" rel="noreferrer">bilalcodes1</a>
              </li>
              <li>
                <span className={styles.creditsMetaLabel}><TelegramIcon /> Telegram</span>
                <a className={styles.creditsLink} href="https://t.me/bilalcodes1" target="_blank" rel="noreferrer">bilalcodes1</a>
              </li>
            </ul>
          </article>

          <article className={`${styles.creditsCard} ${styles.creditsCardWide}`}>
            <span className={styles.creditsLabel}>الهدف من المشروع</span>
            <p>يهدف <span className={styles.creditsInlineEmphasis}>UOADrop</span> إلى حل مشاكل نقل الملفات بين الطلبة ومكاتب الطباعة: ضياع الملفات بين التطبيقات، صعوبة إرسال ملفات iPhone، تكرار أسئلة الحسابات والدفع، وعدم وضوح عدد النسخ أو نوع الطباعة. النظام يجمع كل ذلك في طلب واحد منظم يصل مباشرة إلى داشبورد المكتب الصحيح.</p>
          </article>

          <article className={`${styles.creditsCard} ${styles.creditsCardWide}`}>
            <span className={styles.creditsLabel}>رسالة شكر</span>
            <p>شكر خاص لكل من ساهم في اختبار الفكرة ودعم مراحل العمل على المشروع، من مراجعة التجربة إلى تحسين قابلية الاستخدام قبل التسليم.</p>
          </article>
        </div>
      </details>
    </section>
  );
}

export default function DownloadPage() {
  return (
    <main className={styles.pageShell}>
      <div className={styles.glowOne} />
      <div className={styles.glowTwo} />
      <div className={styles.container}>
        <section className={styles.hero}>
          <div className={styles.heroBadge}>الإصدار الرسمي v0.1.5 · متاح لأنظمة Windows وmacOS</div>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <div className={styles.brandRow}>
                <div className={styles.brandMark}>
                  <img className={styles.brandMarkLogo} src="/uoadrop-logo.png" alt="UOADrop" />
                </div>
                <div className={styles.brandText}>
                  <span className={styles.kicker}>UOADrop Desktop · تطبيق إدارة المكتبة</span>
                  <h1 className={styles.heroTitle}>نظام UOADrop لإدارة طلبات الطباعة في المكتبات والمكاتب الجامعية</h1>
                </div>
              </div>
              <p className={styles.heroSub}>
                تطبيق متكامل يجمع طلبات طباعة الطلبة في داشبورد واحد منظّم، يربط كل مكتبة بكود تفعيل خاص ورابط رفع مستقل، ويُمكّن صاحب المكتبة من استلام الملفات، تسعيرها، وتسليمها بدون فوضى تطبيقات المراسلة المتعددة.
              </p>
              <div className={styles.heroProof}>
                {heroProofItems.map((item) => (
                  <div key={item.value} className={styles.heroProofItem}>
                    <strong>{item.value}</strong>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
              <div className={styles.heroActions}>
                <a href="#official-downloads" className={styles.primaryAction}>
                  <DownloadIcon />
                  تحميل الإصدار الرسمي
                </a>
                <a href="/" className={styles.secondaryAction}>تجربة صفحة الرفع</a>
              </div>
            </div>
            <div className={styles.deviceCard}>
              <div className={styles.windowTop}>
                <span />
                <span />
                <span />
              </div>
              <div className={styles.dashboardMock}>
                <div className={styles.mockSidebar}>
                  <span />
                  <span />
                  <span />
                </div>
                <div className={styles.mockContent}>
                  <div className={styles.mockMetric} />
                  <div className={styles.mockRow} />
                  <div className={styles.mockRowShort} />
                  <div className={styles.mockCards}>
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
              <div className={styles.floatingChip}>داشبورد المكتبة · استلام لحظي للطلبات</div>
            </div>
          </div>
        </section>

        <section className={styles.statsGrid} aria-label="إحصائيات المشروع">
          {stats.map((item) => (
            <div key={item.label} className={styles.statCard}>
              <strong>{item.value}</strong>
              <span>{item.label}</span>
              <p>{item.detail}</p>
            </div>
          ))}
        </section>

        <section className={styles.releasePanel} aria-label="ملخص الإصدار الحالي">
          <div className={styles.releaseHeader}>
            <span className={styles.cardEyebrow}>إصدار التشغيل الرسمي</span>
            <h2>UOADrop v0.1.5 — نسخة التسليم الرسمية</h2>
            <p>
              هذه الصفحة مخصصة لتحميل التطبيق الرسمي لصاحب المكتبة. بعد التثبيت، تُفعّل النسخة بكود خاص تُولّده لوحة الأدمن حتى يستقبل الداشبورد طلبات مكتبتك فقط دون تداخل مع أي جهة أخرى. جميع الملفات موقّعة ببصمة SHA-256 للتأكد من سلامتها.
            </p>
          </div>
          <div className={styles.releaseHighlights}>
            {releaseHighlights.map((item) => (
              <article key={item.title} className={styles.releaseHighlightCard}>
                <div className={styles.releaseHighlightIcon}><CheckIcon /></div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.downloadGuideSection}>
          <div className={styles.sectionHead}>
            <span>اختيار النسخة المناسبة</span>
            <h2>دليل مختصر لاختيار الملف الصحيح</h2>
          </div>
          <div className={styles.downloadGuideGrid}>
            {downloadGuides.map((item) => (
              <article key={item.title} className={styles.downloadGuideCard}>
                <strong>{item.title}</strong>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.logoStripSection} aria-label="الشعارات ووسائل الدفع المدعومة">
          <div className={styles.logoStripCard}>
            <span className={styles.cardEyebrow}>الهوية ووسائل الدفع المدعومة</span>
            <div className={styles.logoStrip}>
              {pageLogos.map((logo) => (
                <div key={logo.src} className={styles.logoStripItem} data-logo={logo.key}>
                  <div className={styles.logoStripMark}>
                    <img className={styles.logoStripImage} src={logo.src} alt={logo.alt} />
                  </div>
                  <span>{logo.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.storySection}>
          <div className={styles.sectionHead}>
            <span>الفكرة والدوافع</span>
            <h2>لماذا تم بناء UOADrop؟</h2>
          </div>
          <div className={styles.storyGrid}>
            <article className={styles.storyCardLarge}>
              <h3>معالجة مشكلة حقيقية بحل نظامي واحد</h3>
              <p>
                جزء كبير من وقت الطالب وصاحب المكتبة يُستهلك في مرحلة ما قبل الطباعة: طالب يحاول إرسال ملف من iPhone بلا جدوى، وآخر يتساءل عن الوسيلة الصحيحة، ثم تتوالى الأسئلة عن حساب الدفع، لقطة التحويل، عدد النسخ، ونوع الورق واللون.
              </p>
              <p>
                يجمع UOADrop كل هذه التفاصيل في مسار واحد منظّم: الطالب يرفع ملفه ويكتب التفاصيل في نموذج واحد، والداشبورد يستقبل كل شيء مرتباً أمامك: الملفات، الإعدادات، السعر، الدفع، وحالة التسليم لحظيّاً.
              </p>
              <div className={styles.problemGrid}>
                {workflowProblems.map((problem) => (
                  <span key={problem}>{problem}</span>
                ))}
              </div>
            </article>
            <article className={`${styles.developerCard} ${styles.developerCardWide}`}>
              <span className={styles.cardEyebrow}>المطور</span>
              <h3>بلال زامل احمد</h3>
              <p>
                طالب في المرحلة الثانية بتخصص علوم الحاسوب، مهتم ببناء حلول برمجية عملية لمشاكل واقعية تواجهها البيئة الأكاديمية، بدل الاكتفاء بالأفكار النظرية. يركّز عمله على تقديم أدوات تقنية بسيطة، واضحة، وفي متناول غير المتخصصين، خصوصاً حين ترتبط المشكلة بالحياة اليومية للطلبة والمؤسسات.
              </p>
              <div className={styles.developerMeta}>
                <span>المرحلة: الثانية — علوم حاسوب</span>
                <a href="https://instagram.com/bilalcodes1" target="_blank" rel="noreferrer">
                  <InstagramIcon />
                  Instagram: bilalcodes1
                </a>
                <a href="https://t.me/bilalcodes1" target="_blank" rel="noreferrer">
                  <TelegramIcon />
                  Telegram: bilalcodes1
                </a>
                <span>الهدف: تحويل المشاكل اليومية إلى حلول برمجية عملية</span>
              </div>
            </article>
          </div>
        </section>

        <section className={styles.partnersSection}>
          <div className={styles.sectionHead}>
            <span>البيئة والجهات الداعمة</span>
            <h2>منظومة عمل متكاملة</h2>
          </div>
          <div className={styles.partnerGrid}>
            {partners.map((partner) => {
              const Icon = partnerIcon(partner.iconType);
              return (
                <div key={partner.name} className={styles.partnerCard}>
                  <div className={styles.partnerIcon}><Icon /></div>
                  <strong>{partner.name}</strong>
                  <p>{partner.role}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className={styles.techSection}>
          <div className={styles.sectionHead}>
            <span>البنية التقنية</span>
            <h2>التقنيات المعتمدة في بناء النظام</h2>
          </div>
          <div className={styles.techGrid}>
            {techStack.map((group) => (
              <article key={group.title} className={styles.techCard}>
                <h3>{group.title}</h3>
                <div className={styles.techPills}>
                  {group.items.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.capabilitySection}>
          <div className={styles.sectionHead}>
            <span>أحدث التحديثات</span>
            <h2>ما الجديد في إصدار v0.1.5</h2>
          </div>
          <div className={styles.capabilityGrid}>
            {latestUpdates.map((item) => (
              <div key={item} className={styles.capabilityItem}>
                <div className={styles.checkMark}><SparkIcon /></div>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.capabilitySection}>
          <div className={styles.sectionHead}>
            <span>قدرات النظام</span>
            <h2>ماذا يقدّم UOADrop لمكتبتك؟</h2>
          </div>
          <div className={styles.capabilityGrid}>
            {capabilities.map((item) => (
              <div key={item} className={styles.capabilityItem}>
                <div className={styles.checkMark}><CheckIcon /></div>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.timelineSection}>
          <div className={styles.sectionHead}>
            <span>رحلة التطوير</span>
            <h2>من فكرة إلى منظومة تشغيلية خلال شهرين</h2>
          </div>
          <div className={styles.timeline}>
            {timeline.map((item) => (
              <div key={item.phase} className={styles.timelineItem}>
                <div className={styles.phase}>{item.phase}</div>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.securitySection}>
          <div className={styles.securityIcon}><ShieldIcon /></div>
          <div>
            <span className={styles.cardEyebrow}>الأمان والخصوصية</span>
            <h2>ملفات الطلبة محمية بالتشفير منذ لحظة الرفع</h2>
            <p>
              يدعم UOADrop تشفير الملفات لحظة رفعها بمفتاح AES-256 فريد لكل ملف، ثم يُغلّف هذا المفتاح بتشفير RSA. لا تُفكّ الملفات إلا داخل داشبورد مكتبتك المثبّت على جهازك، والطلبات الأقدم غير المشفّرة تبقى قابلة للاستيراد دون إخلال بالتوافق.
            </p>
          </div>
        </section>

        <section id="official-downloads" className={styles.platformSection}>
          <div className={styles.sectionHead}>
            <span>تحميل التطبيق</span>
            <h2>ملفات التحميل الرسمية لأنظمة macOS وWindows</h2>
          </div>
          <div className={styles.platforms}>
            {platforms.map((platform) => {
              const Icon = platformIcon(platform.iconType);
              return (
                <article key={platform.name} className={styles.platformCard}>
                  <div className={styles.platformHead}>
                    <div className={`${styles.platformIcon} ${
                      platform.iconType === 'mac' ? styles.platformIconMac
                      : styles.platformIconWindows
                    }`}>
                      <Icon />
                    </div>
                    <div>
                      <h3>{platform.name}</h3>
                      <span>{platform.arch}</span>
                    </div>
                  </div>
                  <p>{platform.description}</p>
                  <div className={styles.requirementBox}>
                    <strong>المتطلبات</strong>
                    <span>{platform.requirement}</span>
                  </div>
                  <div className={styles.downloadLinks}>
                    {platform.assets.length > 0 ? (
                      platform.assets.map((asset) => (
                        <a
                          key={`${platform.name}-${asset.label}`}
                          href={asset.href}
                          className={`${styles.downloadBtn} ${asset.primary ? styles.downloadBtnPrimary : styles.downloadBtnSecondary}`}
                          download
                        >
                          <DownloadIcon />
                          <span>
                            <strong>{asset.label}</strong>
                            <small>{asset.fileName}</small>
                          </span>
                          <em>{asset.format}</em>
                        </a>
                      ))
                    ) : (
                      <span className={styles.downloadUnavailable}>سيتوفر ملف هذا النظام قريباً</span>
                    )}
                  </div>
                  <div className={styles.assetNotes}>
                    {platform.assets.map((asset) => (
                      <div key={`${asset.fileName}-note`} className={styles.assetNote}>
                        <strong>{asset.fileName}</strong>
                        <span>{asset.note}</span>
                      </div>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className={styles.setupSection}>
          <div className={styles.sectionHead}>
            <span>خطوات التشغيل</span>
            <h2>أربع خطوات من التحميل إلى استقبال أول طلب</h2>
          </div>
          <div className={styles.setupSteps}>
            {setupSteps.map((item, index) => (
              <article key={item.title} className={styles.setupStep}>
                <div className={styles.setupStepNumber}>{String(index + 1).padStart(2, '0')}</div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.verificationSection}>
          <div className={styles.sectionHead}>
            <span>التحقق والأمان</span>
            <h2>معلومات مهمة قبل وبعد التثبيت</h2>
          </div>
          <div className={styles.verificationGrid}>
            {verificationItems.map((item) => (
              <article key={item.title} className={styles.verificationCard}>
                <div className={styles.verificationIcon}><ShieldIcon /></div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
                {'command' in item ? <code className={styles.verificationCommand}>{item.command}</code> : null}
              </article>
            ))}
          </div>
        </section>

        <section className={styles.faqSection}>
          <div className={styles.sectionHead}>
            <span>أسئلة شائعة</span>
            <h2>إجابات على أبرز استفسارات أصحاب المكتبات</h2>
          </div>
          <div className={styles.faqGrid}>
            {faqItems.map((item, index) => (
              <details key={item.question} className={styles.faqItem} open={index === 0}>
                <summary>
                  <span>{item.question}</span>
                  <i />
                </summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className={styles.downloadMethodSection}>
          <div className={styles.downloadMethodCard}>
            <div>
              <span className={styles.cardEyebrow}>جاهز للبدء؟</span>
              <h2>ثلاث خطوات تفصلك عن تشغيل مكتبتك</h2>
              <p>
                جميع أزرار التحميل تمر عبر مسار آمن داخل uoadrop.vercel.app ثم تحوّل إلى ملف الإصدار الرسمي المنشور على GitHub Releases. اختر النسخة المناسبة لنظام تشغيلك، ثبّت التطبيق، ثم أدخل كود التفعيل الخاص بمكتبتك لتبدأ باستقبال أول طلب.
              </p>
            </div>
            <a href="#official-downloads" className={styles.primaryAction}>
              <SparkIcon />
              ابدأ التحميل الآن
            </a>
          </div>
        </section>

        <ProjectCreditsSection />
      </div>
    </main>
  );
}
