import type { Metadata } from 'next';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'UOADrop — تحميل التطبيق ومنصة الطباعة الذكية',
  description: 'صفحة تحميل UOADrop الرسمية مع معلومات المشروع، المطور، الشركاء، التقنية، المتطلبات، وإصدارات سطح المكتب',
};

type DownloadAsset = {
  label: string;
  format: string;
  href: string;
  primary?: boolean;
};

type PlatformInfo = {
  name: string;
  arch: string;
  description: string;
  iconType: 'mac' | 'windows' | 'linux';
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

type PartnerIconType = 'university' | 'college' | 'library' | 'integration';
type OpsIconType = 'release' | 'secure' | 'updates' | 'analytics' | 'download' | 'support';

type OpsStackItem = {
  iconType: OpsIconType;
  title: string;
  text: string;
  metric: string;
};

const downloadFile = (asset: string) => `/download/file?asset=${asset}`;

const stats: StatItem[] = [
  { value: '21K+', label: 'سطر كود', detail: 'تقريباً 21,214 سطر متتبع بدون ملف القفل' },
  { value: '145', label: 'ملف مشروع', detail: 'ويب، ديسكتوب، shared packages، migrations' },
  { value: 'شهرين', label: 'مدة تطوير', detail: 'تصميم، تطوير، اختبار، وتحسين تجربة الاستخدام' },
  { value: '3', label: 'أنظمة تشغيل', detail: 'macOS و Windows و Linux' },
];

const platforms: PlatformInfo[] = [
  {
    name: 'macOS',
    arch: 'Apple Silicon arm64 + Intel x64',
    description: 'نسخة مصممة لأجهزة Mac الحديثة والقديمة بصيغة DMG للتثبيت أو ZIP للتشغيل السريع.',
    iconType: 'mac',
    requirement: 'macOS 12 Monterey أو أحدث، صلاحية الطابعة، واتصال إنترنت للمزامنة الأونلاين.',
    assets: [
      { label: 'DMG — Apple Silicon', format: 'arm64', href: downloadFile('mac-arm64-dmg'), primary: true },
      { label: 'DMG — Intel', format: 'x64', href: downloadFile('mac-x64-dmg') },
      { label: 'ZIP — Apple Silicon', format: 'arm64', href: downloadFile('mac-arm64-zip') },
      { label: 'ZIP — Intel', format: 'x64', href: downloadFile('mac-x64-zip') },
    ],
  },
  {
    name: 'Windows',
    arch: 'x64 + ARM64',
    description: 'مناسب لأجهزة المختبرات والمكاتب، مع مثبت رسمي ونسخة Portable للتشغيل بدون تثبيت كامل.',
    iconType: 'windows',
    requirement: 'Windows 10/11، معالج 64-bit، صلاحية الوصول للطابعة ومساحة تخزين محلية للملفات.',
    assets: [
      { label: 'Installer — x64', format: 'exe', href: downloadFile('win-x64-installer'), primary: true },
      { label: 'Portable — x64', format: 'exe', href: downloadFile('win-x64-portable') },
    ],
  },
  {
    name: 'Linux',
    arch: 'x64 AppImage',
    description: 'نسخة AppImage تعمل على أغلب التوزيعات الشائعة بدون خطوات تثبيت معقدة.',
    iconType: 'linux',
    requirement: 'توزيعة حديثة، صلاحية تنفيذ AppImage، وحزم طباعة النظام مثل CUPS عند الحاجة.',
    assets: [],
  },
];

const timeline: TimelineItem[] = [
  {
    phase: '01',
    title: 'الفكرة',
    text: 'تحويل طابور الطباعة الورقي إلى تجربة رقمية: الطالب يرفع ملفاته، والمكتبة تدير الطلبات من شاشة واحدة.',
  },
  {
    phase: '02',
    title: 'النواة',
    text: 'بناء تطبيق سطح مكتب Electron مع قاعدة بيانات SQLite، طابور طباعة، تسعير يدوي، وأرشفة الطلبات.',
  },
  {
    phase: '03',
    title: 'الأونلاين',
    text: 'إضافة منصة الرفع عبر الويب، Supabase Realtime، تشفير الملفات، ومزامنة الطلبات إلى الداشبورد.',
  },
  {
    phase: '04',
    title: 'الدفع والتوزيع',
    text: 'إضافة Qi Card وZainCash، التحقق اليدوي من العمليات، وصفحة تحميل احترافية متعددة المنصات.',
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
    role: 'الجهة المستفيدة من تبسيط إدارة طلبات الطباعة',
  },
  {
    iconType: 'library' as PartnerIconType,
    name: 'مكتبة الكلية',
    role: 'مركز التشغيل اليومي: استلام، تسعير، طباعة، وتسليم',
  },
  {
    iconType: 'integration' as PartnerIconType,
    name: 'تقنيات التكامل',
    role: 'تطبيق سطح مكتب، منصة ويب، قاعدة بيانات لحظية، وإشعارات لخدمة منظومة متكاملة',
  },
];

const capabilities = [
  'رفع ملفات أونلاين من المتصفح مع حفظ الطلب فوراً',
  'داشبورد سطح مكتب للطباعة والتسعير والتحكم بالحالات',
  'تشفير ملفات AES-256-GCM مع تغليف RSA-OAEP-SHA256',
  'إشعارات Telegram والبريد الإلكتروني لحالة الطلب',
  'تتبع مباشر لحالة الطلب من صفحة الطالب',
  'دفع اختياري عبر Qi Card وZainCash مع تحقق إداري',
  'إدارة PIN وأرقام حسابات الدفع من لوحة الإعدادات',
  'بناء إصدارات مستقلة لأنظمة macOS وWindows وLinux',
];

const heroProofItems = [
  { value: '3 أنظمة', label: 'تنزيل مخصص حسب المنصة' },
  { value: 'Realtime', label: 'مزامنة مباشرة للطلبات' },
  { value: 'AES + RSA', label: 'حماية ملفات الطلبة' },
];

const opsStack: OpsStackItem[] = [
  {
    iconType: 'release',
    title: 'إصدار متعدد المنصات',
    text: 'تجهيز صفحة تنزيل واضحة لنسخ macOS وWindows وLinux مع صيغ مناسبة لكل جهاز.',
    metric: 'DMG / EXE / AppImage',
  },
  {
    iconType: 'secure',
    title: 'أمان الملفات',
    text: 'مسار الطلبات مبني حول تشفير الملفات قبل وصولها إلى لوحة المكتبة وفكها من الداشبورد فقط.',
    metric: 'AES-256-GCM',
  },
  {
    iconType: 'updates',
    title: 'أحدث إصدار دائماً',
    text: 'زر التحميل الرئيسي يوجه المستخدم إلى أحدث ملف مناسب بدون تشتيت أو صفحات خارجية.',
    metric: '/download/file',
  },
  {
    iconType: 'analytics',
    title: 'وضوح تقني',
    text: 'الأرقام والبطاقات تعرض حجم المشروع، مدة العمل، عدد الملفات، والأنظمة المدعومة بطريقة مفهومة.',
    metric: '21K+ lines',
  },
  {
    iconType: 'download',
    title: 'اختيار نسخة دقيقة',
    text: 'كل نظام تشغيل يملك كرت مستقل، متطلبات واضحة، وصيغ تنزيل مناسبة للمعمارية المتوفرة.',
    metric: 'arm64 + x64',
  },
  {
    iconType: 'support',
    title: 'مصمم للمكتبة',
    text: 'التجربة ليست صفحة تسويق فقط، بل شرح لمسار تشغيل فعلي بين الطالب وأمين المكتبة والدفع والطباعة.',
    metric: 'Library workflow',
  },
];

const faqItems = [
  {
    question: 'هل زر التحميل يختار النسخة المناسبة تلقائياً؟',
    answer: 'زر التحميل الرئيسي يمر عبر مسار داخلي يحاول توجيه المستخدم إلى أحدث ملف مناسب، وتبقى أزرار الأنظمة متاحة لمن يريد اختيار نسخة محددة.',
  },
  {
    question: 'أي نسخة أختار لجهازي؟',
    answer: 'لأجهزة Mac الحديثة اختر Apple Silicon، ولأجهزة Intel اختر x64. على Windows استخدم Installer للتثبيت الكامل أو Portable للتشغيل السريع.',
  },
  {
    question: 'هل النظام مخصص للطلاب فقط؟',
    answer: 'الطالب يستخدم صفحة الرفع والمتابعة، بينما تطبيق سطح المكتب موجه للمكتبة لإدارة الطلبات، التسعير، الطباعة، الدفع، والإشعارات.',
  },
  {
    question: 'هل الدفع الإلكتروني إجباري؟',
    answer: 'لا، الدفع الإلكتروني اختياري عبر Qi Card وZainCash، ويبقى الكاش مدعوماً لأن السعر النهائي يحدده الداشبورد داخل المكتبة.',
  },
];

const pageLogos = [
  { key: 'uoadrop', src: '/uoadrop-logo.png', alt: 'UOADrop', label: 'UOADrop' },
  { key: 'university', src: '/university-of-anbar.svg', alt: 'جامعة الأنبار', label: 'جامعة الأنبار' },
  { key: 'college', src: '/cs-college.svg', alt: 'كلية علوم الحاسوب', label: 'كلية علوم الحاسوب' },
  { key: 'qicard', src: '/Qicard.webp', alt: 'Qi Card', label: 'Qi Card' },
  { key: 'zaincash', src: '/zaincash.webp', alt: 'ZainCash', label: 'ZainCash' },
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

function LinuxIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C9.2 2 7 4.5 7 7.5c0 1.2.3 2.4.9 3.3-.3.6-.5 1.3-.7 2-.4 1.5-.7 3-.7 4.2 0 .8.1 1.5.3 2.1.3.8.8 1.4 1.5 1.7.5.2 1 .3 1.7.3h4c.7 0 1.2-.1 1.7-.3.7-.3 1.2-.9 1.5-1.7.2-.6.3-1.3.3-2.1 0-1.2-.3-2.7-.7-4.2-.2-.7-.4-1.4-.7-2 .6-.9.9-2.1.9-3.3C17 4.5 14.8 2 12 2z" />
      <circle cx="10" cy="7" r="1" fill="currentColor" />
      <circle cx="14" cy="7" r="1" fill="currentColor" />
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

function ReleaseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 8.5L12 4l7 4.5v7L12 20l-7-4.5v-7z" />
      <path d="M5.5 8.8L12 13l6.5-4.2" />
      <path d="M12 13v6.5" />
    </svg>
  );
}

function UpdateIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 7v5h-5" />
      <path d="M4 17v-5h5" />
      <path d="M18 12a6 6 0 00-10.2-4.2L4 11" />
      <path d="M6 12a6 6 0 0010.2 4.2L20 13" />
    </svg>
  );
}

function AnalyticsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <rect x="7" y="11" width="3" height="5" rx="1" />
      <rect x="12" y="7" width="3" height="9" rx="1" />
      <rect x="17" y="9" width="3" height="7" rx="1" />
    </svg>
  );
}

function RouteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 4h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2z" />
      <path d="M8 12h8" />
      <path d="M13 9l3 3-3 3" />
    </svg>
  );
}

function SupportIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12a8 8 0 0116 0" />
      <path d="M4 12v4a2 2 0 002 2h1v-6H6a2 2 0 00-2 2" />
      <path d="M20 12v4a2 2 0 01-2 2h-1v-6h1a2 2 0 012 2" />
      <path d="M9 19h4" />
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

function opsIcon(type: OpsIconType) {
  const icons = {
    release: ReleaseIcon,
    secure: ShieldIcon,
    updates: UpdateIcon,
    analytics: AnalyticsIcon,
    download: RouteIcon,
    support: SupportIcon,
  };
  return icons[type];
}

function platformIcon(type: PlatformInfo['iconType']) {
  const icons = { mac: MacIcon, windows: WindowsIcon, linux: LinuxIcon };
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
                <p>الجهة الأكاديمية الحاضنة للمشروع والداعمة لتطوير تجربة الطباعة داخل المكتبة.</p>
              </div>
            </article>

            <article className={styles.creditsInstitutionCard}>
              <div className={styles.creditsInstitutionLogo} data-logo="college">
                <img src="/cs-college.svg" alt="كلية علوم الحاسوب" />
              </div>
              <div className={styles.creditsInstitutionCopy}>
                <span className={styles.creditsInstitutionLabel}>الكلية</span>
                <strong>كلية علوم الحاسوب وتكنولوجيا المعلومات</strong>
                <p>البيئة الأكاديمية التي يستهدفها النظام لتسهيل رفع الملفات والطباعة بسرعة ووضوح.</p>
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
            <p>أشرفت <span className={styles.creditsInlineEmphasis}>د. رقية أياد عبد الجبار عبيد العاني</span> على الجوانب الأكاديمية والتنظيمية للمشروع لضمان انسجامه مع احتياج المكتبة وسهولة استخدامه للطلبة.</p>
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
            <p><span className={styles.creditsInlineEmphasis}>بلال زامل احمد</span> طالب مرحلة ثانية في <span className={styles.creditsInlineEmphasis}>علوم الحاسوب</span>، تولّى تصميم النظام وتنفيذه وصياغة واجهته وتوحيد هويته البصرية لتظهر منصة <span className={styles.creditsInlineEmphasis}>UOADrop</span> بصورة واضحة واحترافية.</p>
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
            <p>يهدف <span className={styles.creditsInlineEmphasis}>UOADrop</span> إلى تقليل الوقت والجهد في رفع ملفات الطباعة ومتابعة الطلبات داخل المكتبة، عبر تجربة أسرع وأكثر وضوحاً واحترافية لكل من <span className={styles.creditsInlineEmphasis}>الطالب</span> و<span className={styles.creditsInlineEmphasis}>إدارة الطباعة</span>.</p>
          </article>

          <article className={`${styles.creditsCard} ${styles.creditsCardWide}`}>
            <span className={styles.creditsLabel}>رسالة شكر</span>
            <p>شكر خاص إلى <span className={styles.creditsInlineEmphasis}>الطالب عمر عبد الجبار مجبل</span> و<span className={styles.creditsInlineEmphasis}>الطالبة ملاك مازن يوسف</span> على مساعدتهم ودعمهم القيّم خلال مراحل العمل على هذا المشروع.</p>
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
          <div className={styles.heroBadge}>Release, secure and run UOADrop Desktop</div>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <div className={styles.brandRow}>
                <div className={styles.brandMark}>
                  <img className={styles.brandMarkLogo} src="/uoadrop-logo.png" alt="UOADrop" />
                </div>
                <div>
                  <span className={styles.kicker}>UOADrop Desktop</span>
                  <h1 className={styles.heroTitle}>منصة طباعة جامعية ذكية من الرفع إلى التسليم</h1>
                </div>
              </div>
              <p className={styles.heroSub}>
                UOADrop يحوّل تجربة الطباعة داخل المكتبة إلى نظام رقمي كامل: رفع ملفات من الويب، معالجة داخل الداشبورد، تسعير يدوي موثوق، إشعارات لحظية، دفع اختياري، وتوزيع تطبيق سطح مكتب يعمل على macOS وWindows وLinux.
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
              <div className={styles.floatingChip}>Realtime + encrypted uploads</div>
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
            <h2>ليش انبنى UOADrop؟</h2>
          </div>
          <div className={styles.storyGrid}>
            <article className={styles.storyCardLarge}>
              <h3>حل مشكلة يومية بطريقة نظامية</h3>
              <p>
                الفكرة بدأت من احتياج واضح داخل المكتبة: كثرة طلبات الطباعة، اختلاف الملفات، متابعة الأسعار، وضياع الوقت بين الطالب وأمين المكتبة. لذلك صُمم UOADrop ليجمع كل شيء بمسار واحد: الطالب يرفع الطلب، الداشبورد يستلمه، المكتبة تحدد السعر، والطالب يتابع الحالة بدون رسائل عشوائية أو انتظار غير واضح.
              </p>
              <p>
                النظام لا يستبدل دور المكتبة، بل يجعل عملها أسرع وأكثر دقة. السعر النهائي يبقى بيد الداشبورد، والدفع الإلكتروني يبقى اختيارياً بجانب الكاش.
              </p>
            </article>
            <article className={styles.developerCard}>
              <span className={styles.cardEyebrow}>المطور</span>
              <h3>بلال زامل احمد</h3>
              <p>
                طالب مرحلة ثانية في علوم الحاسوب، طوّر UOADrop كمشروع عملي كامل يجمع بين هندسة الويب، تطبيقات سطح المكتب، قواعد البيانات، التشفير، الطباعة، وتجربة المستخدم العربية.
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
                <span>الهدف: خدمة مكتبة الكلية والطلبة</span>
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

        <section className={styles.opsSection}>
          <div className={styles.sectionHead}>
            <span>Desktop ops stack</span>
            <h2>صفحة تحميل تشبه منظومة تشغيل كاملة</h2>
          </div>
          <div className={styles.opsGrid}>
            {opsStack.map((item) => {
              const Icon = opsIcon(item.iconType);
              return (
                <article key={item.title} className={styles.opsCard}>
                  <div className={styles.opsIcon}><Icon /></div>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                    <span className={styles.opsMetric}>{item.metric}</span>
                  </div>
                </article>
              );
            })}
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
            <h2>اختر نظام التشغيل المناسب</h2>
          </div>
          <div className={styles.platforms}>
            {platforms.map((platform) => {
              const Icon = platformIcon(platform.iconType);
              return (
                <article key={platform.name} className={styles.platformCard}>
                  <div className={styles.platformHead}>
                    <div className={`${styles.platformIcon} ${
                      platform.iconType === 'mac' ? styles.platformIconMac
                      : platform.iconType === 'windows' ? styles.platformIconWindows
                      : styles.platformIconLinux
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
                          <span>{asset.label}</span>
                          <em>{asset.format}</em>
                        </a>
                      ))
                    ) : (
                      <span className={styles.downloadUnavailable}>سيتوفر ملف هذا النظام قريباً</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className={styles.faqSection}>
          <div className={styles.sectionHead}>
            <span>Questions & answers</span>
            <h2>أسئلة سريعة قبل التحميل</h2>
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
                كل أزرار التحميل في هذه الصفحة موجهة لمسار تنزيل مباشر داخل موقع UOADrop. اختَر نسخة نظام التشغيل المناسبة، وسيبدأ المتصفح بتنزيل ملف التطبيق بدون الحاجة لفتح أي صفحة خارجية.
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
