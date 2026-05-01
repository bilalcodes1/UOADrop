import type { Metadata } from 'next';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'UOADrop — تحميل التطبيق',
  description: 'حمّل تطبيق UOADrop لإدارة طلبات الطباعة على macOS وWindows وLinux',
};

type DownloadAsset = {
  label: string;
  format: string;
  href: string | null;
  primary?: boolean;
};

type PlatformInfo = {
  name: string;
  arch: string;
  description: string;
  iconType: 'mac' | 'windows' | 'linux';
  assets: DownloadAsset[];
};

const platforms: PlatformInfo[] = [
  {
    name: 'macOS',
    arch: 'Apple Silicon (arm64) و Intel (x64)',
    description:
      'يعمل على أجهزة Mac بمعالجات M1/M2/M3/M4 وأيضاً معالجات Intel. التطبيق يأتي بصيغة DMG للتثبيت أو ZIP للتشغيل المباشر.',
    iconType: 'mac',
    assets: [
      { label: 'DMG — Apple Silicon', format: 'dmg', href: null, primary: true },
      { label: 'DMG — Intel', format: 'dmg', href: null },
      { label: 'ZIP — Apple Silicon', format: 'zip', href: null },
      { label: 'ZIP — Intel', format: 'zip', href: null },
    ],
  },
  {
    name: 'Windows',
    arch: 'x64 و ARM64',
    description:
      'متوافق مع Windows 10/11 على معالجات Intel/AMD (x64) ومعالجات ARM. يتوفر مثبت (NSIS) ونسخة محمولة (Portable).',
    iconType: 'windows',
    assets: [
      { label: 'مثبت — x64', format: 'exe', href: null, primary: true },
      { label: 'محمول — x64', format: 'exe', href: null },
      { label: 'مثبت — ARM64', format: 'exe', href: null },
    ],
  },
  {
    name: 'Linux',
    arch: 'x64 (AppImage)',
    description:
      'يعمل على معظم توزيعات Linux الشائعة مثل Ubuntu وFedora وArch. صيغة AppImage لا تحتاج تثبيت — شغّل مباشرة.',
    iconType: 'linux',
    assets: [
      { label: 'AppImage — x64', format: 'AppImage', href: null, primary: true },
    ],
  },
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

function DownloadArrow() {
  return (
    <svg className={styles.downloadIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function PrinterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 9V3h10v6M7 17h10v4H7v-4zm-2-8h14a3 3 0 013 3v3h-4m-12 0H2v-3a3 3 0 013-3z" />
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

function ZapIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function CloudIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z" />
    </svg>
  );
}

const PLATFORM_ICONS: Record<string, () => JSX.Element> = {
  mac: MacIcon,
  windows: WindowsIcon,
  linux: LinuxIcon,
};

export default function DownloadPage() {
  return (
    <div className={styles.pageShell}>
      <div className={styles.container}>
        <header className={styles.hero}>
          <div className={styles.heroLogo}>
            <img src="/uoadrop-logo.png" alt="UOADrop" />
          </div>
          <h1 className={styles.heroTitle}>تحميل UOADrop</h1>
          <p className={styles.heroSub}>
            تطبيق سطح المكتب لإدارة طلبات الطباعة في مكتبة كلية علوم الحاسوب وتكنولوجيا المعلومات — جامعة الأنبار.
            <br />
            مبني بتقنية <strong>Electron</strong> ويعمل على macOS وWindows وLinux.
          </p>
        </header>

        <section className={styles.descSection}>
          <h2 className={styles.descTitle}>عن النظام</h2>
          <p className={styles.descText}>
            <strong>UOADrop</strong> هو نظام متكامل لإدارة طلبات الطباعة داخل المكتبة. يتيح للطلبة رفع ملفاتهم أونلاين من أي جهاز، ويعطي أمين المكتبة داشبورد كامل لمتابعة الطلبات وطباعتها وتسعيرها وتسليمها. يتضمن تشفيراً كاملاً للملفات، ودعم إشعارات Telegram والبريد الإلكتروني، ومتابعة حالة الطلب لحظة بلحظة.
          </p>
          <div className={styles.features}>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}><PrinterIcon /></div>
              <div className={styles.featureCopy}>
                <strong>طباعة ذكية</strong>
                <span>طابور طباعة تلقائي مع خيارات الألوان والنسخ والوجهين</span>
              </div>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}><ShieldIcon /></div>
              <div className={styles.featureCopy}>
                <strong>تشفير الملفات</strong>
                <span>تشفير AES-256 + RSA لحماية ملفات الطلبة أثناء النقل</span>
              </div>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}><ZapIcon /></div>
              <div className={styles.featureCopy}>
                <strong>لحظي</strong>
                <span>تحديثات فورية عبر Supabase Realtime بدون تأخير</span>
              </div>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}><CloudIcon /></div>
              <div className={styles.featureCopy}>
                <strong>أونلاين + أوفلاين</strong>
                <span>يعمل مع الملفات المحلية والمرفوعة عبر الإنترنت</span>
              </div>
            </div>
          </div>
        </section>

        <h2 className={styles.platformsTitle}>اختر نظام التشغيل</h2>
        <div className={styles.platforms}>
          {platforms.map((platform) => {
            const Icon = PLATFORM_ICONS[platform.iconType]!;
            return (
              <div key={platform.name} className={styles.platformCard}>
                <div className={styles.platformHead}>
                  <div className={`${styles.platformIcon} ${
                    platform.iconType === 'mac' ? styles.platformIconMac
                    : platform.iconType === 'windows' ? styles.platformIconWindows
                    : styles.platformIconLinux
                  }`}>
                    {Icon && <Icon />}
                  </div>
                  <div>
                    <div className={styles.platformName}>{platform.name}</div>
                    <div className={styles.platformArch}>{platform.arch}</div>
                  </div>
                </div>
                <p className={styles.platformDesc}>{platform.description}</p>
                <div className={styles.downloadLinks}>
                  {platform.assets.map((asset) =>
                    asset.href ? (
                      <a
                        key={asset.label}
                        href={asset.href}
                        className={`${styles.downloadBtn} ${asset.primary ? styles.downloadBtnPrimary : styles.downloadBtnSecondary}`}
                        download
                      >
                        <DownloadArrow />
                        <span>{asset.label}</span>
                      </a>
                    ) : (
                      <span
                        key={asset.label}
                        className={`${styles.downloadBtn} ${styles.downloadBtnDisabled}`}
                      >
                        <DownloadArrow />
                        <span>{asset.label}</span>
                        <span className={styles.comingSoon}>قريباً</span>
                      </span>
                    ),
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <footer className={styles.footer}>
          <p>
            UOADrop — كلية علوم الحاسوب وتكنولوجيا المعلومات، جامعة الأنبار
            <br />
            <a href="/">رفع ملفات الطباعة</a>
          </p>
        </footer>
      </div>
    </div>
  );
}
