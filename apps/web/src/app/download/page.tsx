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

type TechStackItem = {
  title: string;
  items: string[];
};

type PartnerIconType = 'university' | 'college' | 'library' | 'integration';

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
    title: 'المشكلة اليومية',
    text: 'بلال لاحظ تأخيراً واضحاً وفوضى أثناء نقل ملفات الطلبة إلى المكتبة: ملفات تصل عبر أكثر من تطبيق، أسئلة متكررة، ووقت يضيع قبل أن تبدأ الطباعة.',
  },
  {
    phase: '02',
    title: 'توحيد المسار',
    text: 'تم تحويل السؤال المتكرر: أين أرسل الملف؟ كم نسخة؟ ملون لو عادي؟ إلى نموذج رفع واضح يجمع معلومات الطلب من البداية.',
  },
  {
    phase: '03',
    title: 'داشبورد المكتبة',
    text: 'بُنيت لوحة تشغيل لأصحاب المكاتب تستقبل الطلبات، تعرض التفاصيل، تحدد السعر، تدير الدفع، وتحدّث حالة الطلب أمام الطالب.',
  },
  {
    phase: '04',
    title: 'منظومة كاملة',
    text: 'اكتمل النظام بصفحة رفع، داشبورد سطح مكتب، تشفير، إشعارات، دفع اختياري، وإصدارات لأنظمة macOS وWindows وLinux.',
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
  'استقبال طلبات الطباعة من صفحة رفع منظمة بدل الرسائل المتفرقة',
  'عرض عدد النسخ ونوع الطباعة والملاحظات والملفات داخل الداشبورد',
  'تحديد السعر يدوياً من صاحب المكتب قبل بدء التنفيذ',
  'تحديث حالة الطلب للطالب بدون اتصالات ورسائل متكررة',
  'تشفير ملفات الطلبة قبل وصولها إلى نظام المكتبة',
  'دفع اختياري عبر Qi Card وZainCash مع تحقق إداري',
  'إدارة حسابات الدفع ورمز PIN من إعدادات الداشبورد',
  'إصدارات مستقلة لأنظمة macOS وWindows وLinux',
];

const heroProofItems = [
  { value: 'داشبورد', label: 'إدارة طلبات المكتبة من شاشة واحدة' },
  { value: 'Realtime', label: 'متابعة مباشرة بين الطالب والمكتب' },
  { value: 'AES + RSA', label: 'حماية ملفات الطلبة أثناء النقل' },
];

const workflowProblems = [
  'أجهزة iPhone لا ترسل الملفات بسهولة عبر Bluetooth.',
  'الطالب يطلب: افتح لي نت أو وين أرسل الملف؟',
  'تكرار أسئلة حساب المكتبة وحساب الطالب ولقطة التحويل.',
  'ضياع تفاصيل الطلب: كم نسخة؟ ملون أم عادي؟ ومتى الاستلام؟',
];

const techStack: TechStackItem[] = [
  {
    title: 'واجهة الويب',
    items: ['Next.js', 'React', 'TypeScript', 'CSS Modules'],
  },
  {
    title: 'تطبيق سطح المكتب',
    items: ['Electron', 'SQLite', 'طابور طلبات', 'إصدارات macOS وWindows وLinux'],
  },
  {
    title: 'المزامنة والبيانات',
    items: ['Supabase', 'Realtime', 'PostgreSQL', 'مسارات API داخل Next.js'],
  },
  {
    title: 'الأمان والتنبيهات',
    items: ['AES-256-GCM', 'RSA-OAEP-SHA256', 'Telegram Bot', 'Email Notifications'],
  },
];

const faqItems = [
  {
    question: 'هل الداشبورد مناسب لأصحاب المكاتب؟',
    answer: 'نعم، الداشبورد مصمم لصاحب المكتب أو أمين المكتبة حتى يستقبل الطلبات، يراجع الملفات، يحدد السعر، يغيّر الحالة، ويتابع الدفع من مكان واحد.',
  },
  {
    question: 'كيف يقلل الفوضى بين الطالب والمكتبة؟',
    answer: 'بدل إرسال الملفات عبر Bluetooth أو رسائل متعددة، الطالب يرفع الطلب من صفحة واضحة ويكتب عدد النسخ ونوع الطباعة والملاحظات، فتصل كل التفاصيل مرتبة للداشبورد.',
  },
  {
    question: 'هل السعر والدفع بيد صاحب المكتب؟',
    answer: 'نعم، السعر النهائي يحدده صاحب المكتب من الداشبورد. الدفع الإلكتروني اختياري عبر Qi Card وZainCash، والكاش يبقى مدعوماً عند الحاجة.',
  },
  {
    question: 'هل يحتاج المكتب خبرة تقنية كبيرة؟',
    answer: 'لا، الفكرة أن تكون الواجهة قريبة من طريقة العمل اليومية: طلبات، ملفات، سعر، حالة، دفع، وتسليم. التقنية تعمل بالخلفية حتى تبقى التجربة بسيطة.',
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
            <p>يهدف <span className={styles.creditsInlineEmphasis}>UOADrop</span> إلى حل مشاكل نقل الملفات بين الطلبة والمكتبة: ضياع الملفات بين التطبيقات، صعوبة إرسال ملفات iPhone، تكرار أسئلة الحسابات والدفع، وعدم وضوح عدد النسخ أو نوع الطباعة. النظام يجمع كل ذلك في طلب واحد منظم يصل مباشرة إلى داشبورد المكتب.</p>
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
          <div className={styles.heroBadge}>حل عملي لتنظيم الطباعة داخل المكتبة</div>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <div className={styles.brandRow}>
                <div className={styles.brandMark}>
                  <img className={styles.brandMarkLogo} src="/uoadrop-logo.png" alt="UOADrop" />
                </div>
                <div className={styles.brandText}>
                  <span className={styles.kicker}>UOADrop Desktop</span>
                  <h1 className={styles.heroTitle}>UOADrop ينظم الطلب من الطالب إلى داشبورد المكتب</h1>
                </div>
              </div>
              <p className={styles.heroSub}>
                النظام صُمم لحل مشاكل نقل ملفات الطباعة: بدل Bluetooth، رسائل متفرقة، حسابات دفع ضائعة، وأسئلة عدد النسخ واللون، يصبح الطلب واضحاً من صفحة الرفع ويصل مرتباً إلى داشبورد صاحب المكتب.
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
                بلال لاحظ أن جزءاً كبيراً من وقت الطالب والمكتبة يضيع قبل الطباعة نفسها: طالب يريد إرسال ملف من iPhone ولا يستطيع نقله عبر Bluetooth، طالب يطلب فتح الإنترنت لإرسال الملف، وآخر يسأل أين حساب المكتبة أو أين أرسل لقطة التحويل، ثم تبدأ أسئلة جديدة عن عدد النسخ وهل الطباعة ملونة أم عادية.
              </p>
              <p>
                لذلك قرر بناء UOADrop ليجمع هذه التفاصيل في مسار واحد واضح: الطالب يرفع الملف ويكتب تفاصيل الطلب، والداشبورد يستقبل كل شيء مرتباً أمام صاحب المكتب، من الملفات إلى السعر والدفع وحالة التسليم.
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
