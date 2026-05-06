import type { Metadata } from 'next';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'UOADrop — تحميل تطبيق مكاتب الطباعة والمنصة الذكية',
  description: 'صفحة تحميل UOADrop الرسمية لكل مكاتب الطباعة والمكتبات المسجلة، مع التفعيل متعدد المكاتب، روابط الرفع الخاصة، وإصدارات سطح المكتب',
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
  { value: 'v0.1.5', label: 'الإصدار الحالي', detail: 'إصدار التسليم النهائي الأولي لتطبيق UOADrop Desktop' },
  { value: '6', label: 'حزم تشغيل', detail: 'Windows Installer وPortable + macOS Intel وApple Silicon بصيغ DMG وZIP' },
  { value: 'Multi-Office', label: 'تشغيل متعدد المكاتب', detail: 'كل مكتب أو مكتبة لها كود تفعيل، رابط رفع، وباركود خاص' },
  { value: 'SHA-256', label: 'تحقق الملفات', detail: 'ملف Checksums منشور مع الإصدار لمطابقة ملفات التحميل' },
];

const platforms: PlatformInfo[] = [
  {
    name: 'macOS',
    arch: 'Apple Silicon arm64 + Intel x64',
    description: 'نسخة macOS الرسمية لأجهزة Apple Silicon وIntel. بعد التثبيت يتم ربط التطبيق بمكتب/مكتبة محددة عبر كود التفعيل، ثم يظهر داخل التطبيق رابط الرفع الأونلاين الخاص بتلك الجهة.',
    iconType: 'mac',
    requirement: 'macOS 12 Monterey أو أحدث، صلاحية الوصول للطابعة، اتصال إنترنت للتفعيل والمزامنة، وكود تفعيل صادر من لوحة الأدمن.',
    assets: [
      { label: 'Apple Silicon DMG', format: 'arm64', fileName: 'UOADrop-0.1.5-arm64.dmg', note: 'الخيار الأفضل لأجهزة Mac الحديثة بمعالجات M1/M2/M3 وما بعدها.', href: downloadFile('mac-arm64-dmg'), primary: true },
      { label: 'Intel DMG', format: 'x64', fileName: 'UOADrop-0.1.5.dmg', note: 'لأجهزة Mac بمعالجات Intel.', href: downloadFile('mac-x64-dmg') },
      { label: 'Apple Silicon ZIP', format: 'arm64', fileName: 'UOADrop-0.1.5-arm64-mac.zip', note: 'نسخة مضغوطة للتشغيل أو الأرشفة.', href: downloadFile('mac-arm64-zip') },
      { label: 'Intel ZIP', format: 'x64', fileName: 'UOADrop-0.1.5-mac.zip', note: 'نسخة مضغوطة لأجهزة Intel.', href: downloadFile('mac-x64-zip') },
    ],
  },
  {
    name: 'Windows',
    arch: 'x64',
    description: 'نسخة Windows الرسمية لأجهزة مكاتب الطباعة والمكتبات. يدعم التطبيق استقبال طلبات الجهة المرتبطة فقط، مع Dashboard محلي، استيراد Online، وإشعارات عبر Desktop Gateway.',
    iconType: 'windows',
    requirement: 'Windows 10 أو Windows 11، معالج 64-bit، صلاحية الوصول للطابعة، مساحة تخزين محلية للملفات، واتصال إنترنت للتفعيل والمزامنة.',
    assets: [
      { label: 'Windows Installer', format: 'x64', fileName: 'UOADrop.Setup.0.1.5.exe', note: 'الخيار الموصى به للتثبيت الرسمي على جهاز المكتب.', href: downloadFile('win-x64-installer'), primary: true },
      { label: 'Windows Portable', format: 'x64', fileName: 'UOADrop.0.1.5.exe', note: 'نسخة محمولة للتشغيل السريع أو الاختبار بدون مثبت.', href: downloadFile('win-x64-portable') },
    ],
  },
];

const releaseHighlights = [
  {
    title: 'تفعيل رسمي لكل مكتب',
    text: 'التطبيق لا يعمل كنسخة عامة عشوائية؛ كل جهاز ديسكتوب يرتبط بمكتب/مكتبة محددة عبر كود تفعيل، وتظهر بيانات الجهة ورابطها داخل الداشبورد.',
  },
  {
    title: 'روابط رفع دقيقة',
    text: 'الرابط العام يسمح للطالب باختيار المكتب، أما باركود المكتب فيفتح رابط الرفع الخاص مباشرة باستخدام slug الجهة، بدون خلط بين طلبات المكاتب.',
  },
  {
    title: 'أسرار النظام خارج التطبيق',
    text: 'مفاتيح Supabase وTelegram وSMTP والتشفير تبقى داخل Vercel/Desktop Gateway، بينما تطبيق الديسكتوب يستخدم activation token فقط.',
  },
];

const downloadGuides = [
  {
    title: 'إذا كان جهازك Windows',
    text: 'حمّل Installer للتثبيت الدائم. استخدم Portable فقط إذا تريد اختبار سريع أو تشغيل مؤقت بدون تثبيت.',
  },
  {
    title: 'إذا كان جهازك Mac حديث',
    text: 'أجهزة Apple Silicon مثل M1/M2/M3 تستخدم ملف arm64. ملف DMG هو الخيار الأنسب للتثبيت.',
  },
  {
    title: 'إذا كان جهازك Mac Intel',
    text: 'استخدم ملف Intel x64. لا تختار arm64 إلا إذا كان الجهاز بمعالج Apple Silicon.',
  },
];

const setupSteps = [
  {
    title: 'إنشاء المكتب من لوحة الأدمن',
    text: 'يتم إنشاء المكتب/المكتبة من صفحة الأدمن، ثم توليد كود تفعيل خاص بالجهة.',
  },
  {
    title: 'تثبيت تطبيق الديسكتوب',
    text: 'حمّل نسخة نظام التشغيل المناسبة وثبّت التطبيق على جهاز صاحب المكتب المتصل بالطابعة.',
  },
  {
    title: 'إدخال كود التفعيل',
    text: 'من إعدادات التطبيق، أدخل كود التفعيل حتى يرتبط الجهاز بالمكتب الصحيح وتظهر روابطه وطلباته فقط.',
  },
  {
    title: 'استخدام رابط الرفع أو الباركود',
    text: 'بعد التفعيل، استخدم رابط الرفع الأونلاين أو باركود المكتب من داخل التطبيق لتوجيه الطلاب بدقة.',
  },
];

const verificationItems = [
  {
    title: 'مطابقة SHA256SUMS',
    text: 'ملف SHA256SUMS.txt منشور مع الإصدار، ويمكن استخدامه للتحقق من أن ملف التحميل مطابق للنسخة الرسمية.',
  },
  {
    title: 'تحذيرات التوقيع الرقمي',
    text: 'الإصدارات الحالية غير موقعة رقمياً، لذلك قد يظهر SmartScreen على Windows أو تحذير فتح التطبيق على macOS.',
  },
  {
    title: 'لا تضع الأسرار داخل الديسكتوب',
    text: 'لا يحتاج التطبيق إلى service-role keys أو Telegram bot token أو SMTP password داخل ملفات الديسكتوب.',
  },
];

const timeline: TimelineItem[] = [
  {
    phase: '01',
    title: 'المشكلة اليومية',
    text: 'انطلقت الفكرة من ملاحظة تأخر واضح وفوضى أثناء نقل ملفات الطلبة إلى مكاتب الطباعة: ملفات تصل عبر أكثر من تطبيق، أسئلة متكررة، ووقت يضيع قبل أن تبدأ الطباعة.',
  },
  {
    phase: '02',
    title: 'توحيد المسار',
    text: 'تم تحويل الأسئلة المتكررة حول مكان إرسال الملف، وعدد النسخ، ونوع الطباعة، وموعد الاستلام إلى نموذج رفع واضح يجمع معلومات الطلب من البداية.',
  },
  {
    phase: '03',
    title: 'داشبورد المكتب',
    text: 'بُنيت لوحة تشغيل لأصحاب المكاتب تستقبل الطلبات، تعرض التفاصيل، تحدد السعر، تدير الدفع، وتحدّث حالة الطلب أمام الطالب.',
  },
  {
    phase: '04',
    title: 'مكاتب متعددة',
    text: 'أضيفت لوحة أدمن لإدارة المكاتب والمكتبات، توليد أكواد التفعيل، حذف المكتب عند الحاجة، وربط كل تطبيق ديسكتوب بجهة محددة.',
  },
  {
    phase: '05',
    title: 'روابط رفع ذكية',
    text: 'صار الباركود الخاص بكل مكتب يفتح رابط الرفع الخاص به مباشرة، بينما الرابط العام يسمح للطالب باختيار المكتب من الجهات النشطة.',
  },
];

const partners = [
  {
    iconType: 'university' as PartnerIconType,
    name: 'جامعة الأنبار',
    role: 'البيئة الأكاديمية التي صُممت التجربة لخدمتها',
  },
  {
    iconType: 'college' as PartnerIconType,
    name: 'كلية علوم الحاسوب وتكنولوجيا المعلومات',
    role: 'بيئة الانطلاق الأكاديمية الأولى، والنظام الآن قابل للعمل مع كل مكاتب الطباعة',
  },
  {
    iconType: 'library' as PartnerIconType,
    name: 'المكاتب والمكتبات المسجلة',
    role: 'كل مكتب له كود تفعيل، رابط رفع، أجهزة، أكواد، وحسابات دفع مستقلة',
  },
  {
    iconType: 'integration' as PartnerIconType,
    name: 'تقنيات التكامل',
    role: 'تطبيق سطح مكتب، منصة ويب، قاعدة بيانات لحظية، وإشعارات لخدمة منظومة متكاملة',
  },
];

const capabilities = [
  'استقبال طلبات الطباعة من صفحة رفع منظمة بدل الرسائل المتفرقة',
  'اختيار المكتب من الرابط العام أو التوجيه المباشر عند الدخول من باركود مكتب',
  'ربط تطبيق سطح المكتب بمكتب محدد عن طريق كود تفعيل مستقل',
  'عرض رابط الرفع الأونلاين الكامل داخل التطبيق مع زر فتح مباشر',
  'عرض عدد النسخ ونوع الطباعة والملاحظات والملفات داخل الداشبورد',
  'تحديد السعر يدوياً من صاحب المكتب قبل بدء التنفيذ',
  'تحديث حالة الطلب للطالب بدون اتصالات ورسائل متكررة',
  'تشفير ملفات الطلبة قبل وصولها إلى نظام المكتب',
  'دفع اختياري عبر Qi Card وZainCash مع تحقق إداري',
  'إدارة حسابات الدفع ورمز PIN من إعدادات الداشبورد لكل مكتب',
  'إصدارات مستقلة ومحدثة لأنظمة macOS وWindows',
];

const heroProofItems = [
  { value: 'Multi-Office', label: 'كل مكتب له رابط وتفعيل مستقل' },
  { value: 'Realtime', label: 'متابعة مباشرة بين الطالب والمكتب' },
  { value: 'QR خاص', label: 'باركود يفتح مكتب محدد مباشرة' },
];

const workflowProblems = [
  'أجهزة iPhone لا ترسل الملفات بسهولة عبر Bluetooth.',
  'الطالب يحتاج طريقة واضحة لإرسال الملف بدون سؤال متكرر عن قناة الإرسال.',
  'تكرار أسئلة حساب المكتب وحساب الطالب ولقطة التحويل.',
  'ضياع تفاصيل الطلب مثل عدد النسخ ونوع الطباعة وموعد الاستلام.',
];

const techStack: TechStackItem[] = [
  {
    title: 'واجهة الويب',
    items: ['Next.js', 'React', 'TypeScript', 'اختيار المكتب من الرابط العام'],
  },
  {
    title: 'تطبيق سطح المكتب',
    items: ['Electron', 'SQLite', 'تفعيل بمكتب', 'رابط رفع أونلاين داخل التطبيق'],
  },
  {
    title: 'المزامنة والبيانات',
    items: ['Supabase', 'Realtime', 'PostgreSQL', 'Admin API للمكاتب والأكواد'],
  },
  {
    title: 'الأمان والتنبيهات',
    items: ['AES-256-GCM', 'RSA-OAEP-SHA256', 'Telegram Bot', 'Email Notifications'],
  },
];

const latestUpdates = [
  'لوحة أدمن أونلاين لإنشاء مكاتب الطباعة وتفعيلها وتعطيلها وحذفها نهائياً عند الحاجة',
  'توليد أكواد تفعيل قابلة للنسخ، والأكواد الحديثة تبقى ظاهرة داخل لوحة الأدمن',
  'صفحة الرفع العامة تعرض اختيار المكتب، ورابط الباركود يحدد المكتب تلقائياً',
  'تطبيق الديسكتوب يعرض رابط الرفع الأونلاين الكامل الخاص بالمكتب مع زر فتح مباشر',
  'ملصق وباركود الأونلاين يستخدمان رابط المكتب الصحيح بدل الرابط العام',
  'دعم تشغيل أكثر من نسخة ديسكتوب للتجربة مع بيانات ومنافذ مستقلة أثناء التطوير',
];

const faqItems = [
  {
    question: 'هل الداشبورد مناسب لأصحاب المكاتب؟',
    answer: 'نعم، الداشبورد مصمم لصاحب المكتب أو أمين المكتبة حتى يستقبل طلبات جهته فقط، يراجع الملفات، يحدد السعر، يغيّر الحالة، ويتابع الدفع من مكان واحد.',
  },
  {
    question: 'كيف يختار الطالب المكتب الصحيح؟',
    answer: 'إذا دخل من باركود المكتب فالموقع يحدده مباشرة. وإذا دخل من الرابط العام، تظهر له قائمة بالمكاتب والمكتبات المسجلة والنشطة حتى يختار الجهة قبل الإرسال.',
  },
  {
    question: 'كيف يتم تفعيل تطبيق المكتب؟',
    answer: 'الأدمن يولد كود تفعيل للمكتب المطلوب، وصاحب المكتب يدخله داخل تطبيق الديسكتوب. بعدها يرتبط التطبيق بتلك الجهة وتظهر روابطها وطلباتها فقط.',
  },
  {
    question: 'هل السعر والدفع بيد صاحب المكتب؟',
    answer: 'نعم، السعر النهائي يحدده صاحب المكتب من الداشبورد. حسابات Qi Card وZainCash تكون مرتبطة بالمكتب، والكاش يبقى مدعوماً عند الحاجة.',
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
          <div className={styles.heroBadge}>آخر تحديث: كل مكاتب الطباعة + باركود خاص لكل مكتب</div>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <div className={styles.brandRow}>
                <div className={styles.brandMark}>
                  <img className={styles.brandMarkLogo} src="/uoadrop-logo.png" alt="UOADrop" />
                </div>
                <div className={styles.brandText}>
                  <span className={styles.kicker}>UOADrop Desktop</span>
                  <h1 className={styles.heroTitle}>UOADrop صار لكل مكاتب الطباعة والمكتبات المسجلة</h1>
                </div>
              </div>
              <p className={styles.heroSub}>
                النظام لم يعد محصوراً بجهة واحدة. أي مكتب طباعة أو مكتبة مسجلة تحصل على كود تفعيل ورابط رفع وباركود خاص، والطالب إمّا يدخل من باركود المكتب فيتوجه له مباشرة أو يختاره من الرابط العام.
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
                <a href="/download/file" className={styles.primaryAction} download>
                  <DownloadIcon />
                  تحميل آخر إصدار
                </a>
                <a href="/" className={styles.secondaryAction}>صفحة رفع الملفات</a>
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
              <div className={styles.floatingChip}>Office QR + online upload link</div>
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
            <h2>UOADrop v0.1.5 — نسخة التسليم النهائي الأولي</h2>
            <p>
              هذه الصفحة مخصصة لتحميل تطبيق سطح المكتب الخاص بصاحب المكتب. بعد التثبيت، يتم تفعيل الجهاز بكود صادر من لوحة الأدمن حتى يستقبل طلبات المكتب أو المكتبة المرتبطة به فقط.
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
            <span>اختيار النسخة الصحيحة</span>
            <h2>أي ملف أحمّل؟</h2>
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

        <section className={styles.logoStripSection} aria-label="الشعارات المستخدمة">
          <div className={styles.logoStripCard}>
            <span className={styles.cardEyebrow}>الهوية والشعارات</span>
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
            <span>الفكرة</span>
            <h2>لماذا تم بناء UOADrop؟</h2>
          </div>
          <div className={styles.storyGrid}>
            <article className={styles.storyCardLarge}>
              <h3>حل مشكلة يومية بطريقة نظامية</h3>
              <p>
                جزء كبير من وقت الطالب ومكتب الطباعة يضيع قبل بدء الطباعة نفسها: طالب يريد إرسال ملف من iPhone ولا يستطيع نقله عبر Bluetooth، وآخر يبحث عن قناة إرسال واضحة، ثم تبدأ أسئلة إضافية عن حساب الدفع، لقطة التحويل، عدد النسخ، ونوع الطباعة.
              </p>
              <p>
                لذلك يجمع UOADrop هذه التفاصيل في مسار واحد واضح: الطالب يرفع الملف ويكتب تفاصيل الطلب، والداشبورد يستقبل كل شيء مرتباً أمام صاحب المكتب، من الملفات إلى السعر والدفع وحالة التسليم.
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
                طالب مرحلة ثانية في علوم الحاسوب، مهتم بتقديم حلول برمجية لمشاكل واقعية بدل الاكتفاء بالأفكار النظرية. يعمل على استخدام التكنولوجيا بشكل فعلي لبناء أدوات مفهومة، عملية، وفي متناول الجميع، خصوصاً عندما تكون المشكلة قريبة من حياة الطلبة والمؤسسات اليومية.
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
                <span>الهدف: تحويل المشاكل اليومية إلى حلول تقنية عملية</span>
              </div>
            </article>
          </div>
        </section>

        <section className={styles.partnersSection}>
          <div className={styles.sectionHead}>
            <span>الشراكات والجهات</span>
            <h2>بيئة العمل والتكامل</h2>
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
            <span>التقنيات المستخدمة</span>
            <h2>تقنيات المشروع مرتبة حسب دورها</h2>
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
            <span>آخر التحديثات</span>
            <h2>أحدث ما تمت إضافته للمنظومة</h2>
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
            <span>القدرات</span>
            <h2>ماذا يقدم النظام؟</h2>
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
            <span>المدة والتطور</span>
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
            <h2>ملفات الطلبة لا تمر كنص خام</h2>
            <p>
              يدعم UOADrop تشفير الملفات قبل رفعها باستخدام مفتاح AES لكل ملف، ثم تغليف المفتاح بواسطة RSA. الداشبورد فقط هو الذي يملك مفتاح فك التشفير، والطلبات القديمة تبقى متوافقة مع النظام.
            </p>
          </div>
        </section>

        <section className={styles.platformSection}>
          <div className={styles.sectionHead}>
            <span>تحميل التطبيق</span>
            <h2>ملفات التحميل الرسمية</h2>
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
            <span>خطوات التشغيل بعد التحميل</span>
            <h2>من التحميل إلى استقبال الطلبات</h2>
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
            <span>الدقة والتحقق</span>
            <h2>قبل تثبيت التطبيق</h2>
          </div>
          <div className={styles.verificationGrid}>
            {verificationItems.map((item) => (
              <article key={item.title} className={styles.verificationCard}>
                <div className={styles.verificationIcon}><ShieldIcon /></div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.faqSection}>
          <div className={styles.sectionHead}>
            <span>أسئلة أصحاب المكاتب</span>
            <h2>كيف يساعد الداشبورد في تنظيم العمل؟</h2>
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
              <span className={styles.cardEyebrow}>طريقة التحميل</span>
              <h2>اضغط زر التحميل وتبدأ العملية مباشرة</h2>
              <p>
                كل أزرار التحميل في هذه الصفحة تمر عبر مسار رسمي داخل موقع UOADrop ثم تحوّل إلى ملف الإصدار المنشور على GitHub Releases. اختَر نسخة نظام التشغيل المناسبة، وبعد التثبيت فعّل التطبيق بكود المكتب حتى تظهر بيانات الجهة وروابطها الصحيحة.
              </p>
            </div>
            <a href="/download/file" className={styles.primaryAction} download>
              <SparkIcon />
              تحميل النسخة المناسبة
            </a>
          </div>
        </section>

        <ProjectCreditsSection />
      </div>
    </main>
  );
}
