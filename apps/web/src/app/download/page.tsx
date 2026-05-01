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

const GITHUB_RELEASES_URL = 'https://github.com/bilalcodes1/UOADrop/releases';

const stats: StatItem[] = [
  { value: '21K+', label: 'سطر كود', detail: 'تقريباً 21,214 سطر متتبع بدون ملف القفل' },
  { value: '145', label: 'ملف مشروع', detail: 'ويب، ديسكتوب، shared packages، migrations' },
  { value: '10', label: 'أيام تطوير', detail: 'من 2026-04-22 إلى 2026-05-01 حسب Git history' },
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
      { label: 'DMG — Apple Silicon', format: 'arm64', href: GITHUB_RELEASES_URL, primary: true },
      { label: 'DMG — Intel', format: 'x64', href: GITHUB_RELEASES_URL },
      { label: 'ZIP — Apple Silicon', format: 'arm64', href: GITHUB_RELEASES_URL },
      { label: 'ZIP — Intel', format: 'x64', href: GITHUB_RELEASES_URL },
    ],
  },
  {
    name: 'Windows',
    arch: 'x64 + ARM64',
    description: 'مناسب لأجهزة المختبرات والمكاتب، مع مثبت رسمي ونسخة Portable للتشغيل بدون تثبيت كامل.',
    iconType: 'windows',
    requirement: 'Windows 10/11، معالج 64-bit، صلاحية الوصول للطابعة ومساحة تخزين محلية للملفات.',
    assets: [
      { label: 'Installer — x64', format: 'exe', href: GITHUB_RELEASES_URL, primary: true },
      { label: 'Portable — x64', format: 'exe', href: GITHUB_RELEASES_URL },
      { label: 'Installer — ARM64', format: 'arm64', href: GITHUB_RELEASES_URL },
    ],
  },
  {
    name: 'Linux',
    arch: 'x64 AppImage',
    description: 'نسخة AppImage تعمل على أغلب التوزيعات الشائعة بدون خطوات تثبيت معقدة.',
    iconType: 'linux',
    requirement: 'توزيعة حديثة، صلاحية تنفيذ AppImage، وحزم طباعة النظام مثل CUPS عند الحاجة.',
    assets: [
      { label: 'AppImage — x64', format: 'AppImage', href: GITHUB_RELEASES_URL, primary: true },
    ],
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
    name: 'جامعة الأنبار',
    role: 'البيئة الأكاديمية التي صُممت التجربة لخدمتها',
  },
  {
    name: 'كلية علوم الحاسوب وتكنولوجيا المعلومات',
    role: 'الجهة المستفيدة من تبسيط إدارة طلبات الطباعة',
  },
  {
    name: 'مكتبة الكلية',
    role: 'مركز التشغيل اليومي: استلام، تسعير، طباعة، وتسليم',
  },
  {
    name: 'تقنيات التكامل',
    role: 'Electron وNext.js وSupabase وVercel وTelegram لخدمة منظومة متكاملة',
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

function platformIcon(type: PlatformInfo['iconType']) {
  const icons = { mac: MacIcon, windows: WindowsIcon, linux: LinuxIcon };
  return icons[type];
}

export default function DownloadPage() {
  return (
    <main className={styles.pageShell}>
      <div className={styles.glowOne} />
      <div className={styles.glowTwo} />
      <div className={styles.container}>
        <section className={styles.hero}>
          <div className={styles.heroBadge}>Official desktop launch page</div>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <div className={styles.brandRow}>
                <div className={styles.heroLogo}>
                  <img src="/uoadrop-logo.png" alt="UOADrop" />
                </div>
                <div>
                  <span className={styles.kicker}>UOADrop Desktop</span>
                  <h1 className={styles.heroTitle}>منصة طباعة جامعية ذكية من الرفع إلى التسليم</h1>
                </div>
              </div>
              <p className={styles.heroSub}>
                UOADrop يحوّل تجربة الطباعة داخل المكتبة إلى نظام رقمي كامل: رفع ملفات من الويب، معالجة داخل الداشبورد، تسعير يدوي موثوق، إشعارات لحظية، دفع اختياري، وتوزيع تطبيق سطح مكتب يعمل على macOS وWindows وLinux.
              </p>
              <div className={styles.heroActions}>
                <a href={GITHUB_RELEASES_URL} className={styles.primaryAction}>
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
              <h3>Bilal Codes</h3>
              <p>
                تم تطوير UOADrop كمشروع عملي كامل يجمع بين هندسة الويب، تطبيقات سطح المكتب، قواعد البيانات، التشفير، الطباعة، وتجربة المستخدم العربية.
              </p>
              <div className={styles.developerMeta}>
                <span>GitHub: bilalcodes1</span>
                <span>Repository: UOADrop</span>
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
            {partners.map((partner) => (
              <div key={partner.name} className={styles.partnerCard}>
                <strong>{partner.name}</strong>
                <p>{partner.role}</p>
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
                <div className={styles.checkMark}>✓</div>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.timelineSection}>
          <div className={styles.sectionHead}>
            <span>المدة والتطور</span>
            <h2>من فكرة إلى منظومة تشغيلية خلال 10 أيام</h2>
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
                    {platform.assets.map((asset) => (
                      <a
                        key={`${platform.name}-${asset.label}`}
                        href={asset.href}
                        className={`${styles.downloadBtn} ${asset.primary ? styles.downloadBtnPrimary : styles.downloadBtnSecondary}`}
                      >
                        <DownloadIcon />
                        <span>{asset.label}</span>
                        <em>{asset.format}</em>
                      </a>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className={styles.releaseSection}>
          <div className={styles.releaseCard}>
            <div>
              <span className={styles.cardEyebrow}>وين تنرفع؟</span>
              <h2>الصفحة على Vercel والملفات على GitHub Releases</h2>
              <p>
                صفحة التحميل الرسمية تُنشر على نفس موقع UOADrop عبر Vercel على المسار <strong>/download</strong>. أما ملفات التطبيق الكبيرة مثل DMG وEXE وAppImage فالأفضل ترفع على GitHub Releases حتى تبقى منظمة حسب الإصدار والمعمارية.
              </p>
            </div>
            <a href={GITHUB_RELEASES_URL} className={styles.primaryAction}>
              <SparkIcon />
              فتح صفحة الإصدارات
            </a>
          </div>
        </section>

        <footer className={styles.footer}>
          <strong>UOADrop</strong>
          <span>كلية علوم الحاسوب وتكنولوجيا المعلومات — جامعة الأنبار</span>
          <div className={styles.footerLinks}>
            <a href="/">رفع ملفات الطباعة</a>
            <a href={GITHUB_RELEASES_URL}>GitHub Releases</a>
          </div>
        </footer>
      </div>
    </main>
  );
}
