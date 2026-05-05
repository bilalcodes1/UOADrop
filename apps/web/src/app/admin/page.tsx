'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from './page.module.css';

type LibraryRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
  created_at?: string;
  updated_at?: string;
};

type DeviceRow = {
  id: string;
  device_id: string;
  library_id: string;
  name?: string | null;
  status: string;
  activated_at?: string | null;
  last_seen_at?: string | null;
  libraries?: { name?: string | null; slug?: string | null } | null;
};

type ActivationCodeRow = {
  id: string;
  library_id: string;
  label?: string | null;
  expires_at?: string | null;
  used_at?: string | null;
  used_by_device_id?: string | null;
  revoked_at?: string | null;
  created_at?: string | null;
  libraries?: { name?: string | null; slug?: string | null } | null;
};

type AdminPayload = {
  ok?: boolean;
  error?: string;
  details?: string;
  libraries?: LibraryRow[];
  devices?: DeviceRow[];
  activationCodes?: ActivationCodeRow[];
  library?: LibraryRow;
  activationCode?: ActivationCodeRow;
  code?: string;
};

type ExpiryOption = '7' | '30' | '365' | 'never';
type ExpiryChoice = { value: ExpiryOption; label: string; hint: string; days: number | null };

const ADMIN_PASSWORD_KEY = 'uoadrop:admin:password';
const DEFAULT_EXPIRY_OPTION: ExpiryChoice = { value: '7', label: 'أسبوع', hint: 'صالح لمدة 7 أيام', days: 7 };
const EXPIRY_OPTIONS: ExpiryChoice[] = [
  DEFAULT_EXPIRY_OPTION,
  { value: '30', label: 'شهر', hint: 'صالح لمدة 30 يوم', days: 30 },
  { value: '365', label: 'سنة', hint: 'صالح لمدة سنة كاملة', days: 365 },
  { value: 'never', label: 'لا نهائي', hint: 'يبقى صالحاً بدون تاريخ انتهاء', days: null },
];

function normalizeSlug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
}

function formatDate(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('ar-IQ', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatExpiry(value?: string | null): string {
  return value ? formatDate(value) : 'بدون انتهاء';
}

function getCodeStatus(code: ActivationCodeRow): { label: string; active: boolean } {
  if (code.revoked_at) return { label: 'ملغي', active: false };
  if (code.used_at) return { label: 'مستخدم', active: false };
  if (code.expires_at && new Date(code.expires_at).getTime() < Date.now()) return { label: 'منتهي', active: false };
  return { label: 'جاهز', active: true };
}

function formatAdminError(value: unknown): string {
  const message = value instanceof Error ? value.message : String(value ?? '');
  const messages: Record<string, string> = {
    unauthorized: 'الباسورد غير صحيح.',
    missing_admin_password: 'باسورد الأدمن غير مهيأ على السيرفر.',
    invalid_library: 'تأكد من اسم المكتبة والرابط المختصر.',
    not_found: 'المسار غير موجود.',
    server_error: 'حدث خطأ في الخادم.',
    http_400: 'الطلب غير صحيح.',
    http_401: 'الباسورد غير صحيح.',
    http_404: 'المسار غير موجود.',
    http_500: 'حدث خطأ في الخادم.',
  };
  return messages[message.trim()] ?? 'حدث خطأ، حاول مرة ثانية.';
}

function formatActivationLabel(value?: string | null): string {
  const label = String(value ?? '').trim();
  if (!label) return 'تفعيل تطبيق المكتبة';
  return label.replace(/^Desktop setup/i, 'تفعيل تطبيق المكتبة');
}

function formatDeviceName(device: DeviceRow): string {
  const name = String(device.libraries?.name || device.name || '').trim();
  return /^desktop device$/i.test(name) || !name ? 'جهاز تطبيق المكتبة' : name;
}

function StatusDot({ active }: { active: boolean }) {
  return <span className={`${styles.statusDot} ${active ? styles.statusDotActive : styles.statusDotMuted}`} />;
}

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [libraries, setLibraries] = useState<LibraryRow[]>([]);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [activationCodes, setActivationCodes] = useState<ActivationCodeRow[]>([]);
  const [libraryName, setLibraryName] = useState('');
  const [librarySlug, setLibrarySlug] = useState('');
  const [selectedLibraryId, setSelectedLibraryId] = useState('');
  const [activationExpiry, setActivationExpiry] = useState<ExpiryOption>('7');
  const [generatedCode, setGeneratedCode] = useState('');

  const activeLibraries = useMemo(() => libraries.filter((library) => library.status === 'active'), [libraries]);
  const activeCodes = useMemo(() => activationCodes.filter((code) => getCodeStatus(code).active), [activationCodes]);
  const selectedExpiry = EXPIRY_OPTIONS.find((option) => option.value === activationExpiry) ?? DEFAULT_EXPIRY_OPTION;

  const adminRequest = async (path: string, init?: RequestInit): Promise<AdminPayload> => {
    const res = await fetch(`/api/admin${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${password}`,
        ...(init?.headers ?? {}),
      },
    });
    const payload = (await res.json().catch(() => ({}))) as AdminPayload;
    if (!res.ok || payload.ok === false) {
      throw new Error(payload.error || `http_${res.status}`);
    }
    return payload;
  };

  const loadAdminData = async () => {
    setBusy(true);
    setError('');
    try {
      const [librariesPayload, devicesPayload, codesPayload] = await Promise.all([
        adminRequest('/libraries'),
        adminRequest('/devices'),
        adminRequest('/activation-codes'),
      ]);
      setLibraries(librariesPayload.libraries ?? []);
      setDevices(devicesPayload.devices ?? []);
      setActivationCodes(codesPayload.activationCodes ?? []);
      const firstLibrary = (librariesPayload.libraries ?? [])[0];
      setSelectedLibraryId((current) => current || firstLibrary?.id || '');
    } catch (err) {
      setError(formatAdminError(err));
      setAuthorized(false);
    } finally {
      setBusy(false);
    }
  };

  const unlock = async () => {
    setBusy(true);
    setError('');
    try {
      await adminRequest('/status');
      window.sessionStorage.setItem(ADMIN_PASSWORD_KEY, password);
      setAuthorized(true);
      await loadAdminData();
    } catch (err) {
      setError(formatAdminError(err));
    } finally {
      setBusy(false);
    }
  };

  const createLibrary = async () => {
    if (!libraryName.trim()) return;
    setBusy(true);
    setError('');
    try {
      await adminRequest('/libraries', {
        method: 'POST',
        body: JSON.stringify({ name: libraryName, slug: librarySlug || normalizeSlug(libraryName) }),
      });
      setLibraryName('');
      setLibrarySlug('');
      await loadAdminData();
    } catch (err) {
      setError(formatAdminError(err));
    } finally {
      setBusy(false);
    }
  };

  const createActivationCode = async () => {
    if (!selectedLibraryId) return;
    setBusy(true);
    setError('');
    setGeneratedCode('');
    try {
      const payload = await adminRequest(`/libraries/${selectedLibraryId}/activation-codes`, {
        method: 'POST',
        body: JSON.stringify({ label: `تفعيل تطبيق المكتبة — ${selectedExpiry.label}`, expiresInDays: selectedExpiry.days }),
      });
      setGeneratedCode(payload.code ?? '');
      await loadAdminData();
    } catch (err) {
      setError(formatAdminError(err));
    } finally {
      setBusy(false);
    }
  };

  const toggleLibrary = async (library: LibraryRow) => {
    setBusy(true);
    setError('');
    try {
      await adminRequest(`/libraries/${library.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: library.status === 'active' ? 'disabled' : 'active' }),
      });
      await loadAdminData();
    } catch (err) {
      setError(formatAdminError(err));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const stored = window.sessionStorage.getItem(ADMIN_PASSWORD_KEY) ?? '';
    if (stored) setPassword(stored);
  }, []);

  if (!authorized) {
    return (
      <main className={styles.shell} dir="rtl">
        <section className={styles.loginCard}>
          <div className={styles.brandRow}>
            <div className={styles.brandMark}>
              <img className={styles.brandMarkLogo} src="/uoadrop-logo.png" alt="يو أو أي دروب" />
            </div>
            <div>
              <p className={styles.kicker}>لوحة إدارة يو أو أي دروب</p>
              <strong>إدارة منظومة المكتبات</strong>
            </div>
          </div>
          <h1>لوحة إدارة المكتبات</h1>
          <p>أدخل باسورد الأدمن لإدارة المكتبات، الأجهزة، وأكواد التفعيل.</p>
          <input
            className={styles.input}
            type="password"
            placeholder="باسورد الأدمن"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') void unlock(); }}
          />
          {error && <div className={styles.errorBox}>{error}</div>}
          <button className={styles.primaryButton} disabled={busy || !password.trim()} onClick={() => void unlock()}>
            {busy ? 'جارٍ التحقق...' : 'دخول الأدمن'}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.shell} dir="rtl">
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <div className={styles.brandRow}>
            <div className={styles.brandMark}>
              <img className={styles.brandMarkLogo} src="/uoadrop-logo.png" alt="يو أو أي دروب" />
            </div>
            <div>
              <p className={styles.kicker}>لوحة إدارة يو أو أي دروب</p>
              <h1>إدارة المكتبات</h1>
            </div>
          </div>
          <p>قاعدة واحدة متعددة المكتبات، كل تطبيق مكتبة يرتبط بمكتبته من كود تفعيل مستقل.</p>
          <div className={styles.heroPills}>
            <span>مكتبات متعددة</span>
            <span>أكواد آمنة</span>
            <span>هوية يو أو أي دروب</span>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.secondaryButton} disabled={busy} onClick={() => void loadAdminData()}>تحديث</button>
          <button
            className={styles.ghostButton}
            onClick={() => {
              window.sessionStorage.removeItem(ADMIN_PASSWORD_KEY);
              setAuthorized(false);
            }}
          >
            خروج
          </button>
        </div>
      </header>

      {error && <div className={styles.errorBox}>{error}</div>}

      <section className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span>المكتبات</span>
          <strong>{libraries.length.toLocaleString('ar-IQ')}</strong>
        </div>
        <div className={styles.statCard}>
          <span>النشطة</span>
          <strong>{activeLibraries.length.toLocaleString('ar-IQ')}</strong>
        </div>
        <div className={styles.statCard}>
          <span>الأجهزة</span>
          <strong>{devices.length.toLocaleString('ar-IQ')}</strong>
        </div>
        <div className={styles.statCard}>
          <span>الأكواد الجاهزة</span>
          <strong>{activeCodes.length.toLocaleString('ar-IQ')}</strong>
        </div>
        <div className={styles.statCard}>
          <span>كل الأكواد</span>
          <strong>{activationCodes.length.toLocaleString('ar-IQ')}</strong>
        </div>
      </section>

      <section className={styles.gridTwo}>
        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <h2>إضافة مكتبة</h2>
              <p>أنشئ مكتبة جديدة، ثم ولّد لها كود تفعيل لتطبيق المكتبة.</p>
            </div>
          </div>
          <div className={styles.formStack}>
            <input className={styles.input} placeholder="اسم المكتبة" value={libraryName} onChange={(event) => setLibraryName(event.target.value)} />
            <input className={styles.input} placeholder="الرابط المختصر بالأحرف الإنجليزية" value={librarySlug} onChange={(event) => setLibrarySlug(normalizeSlug(event.target.value))} />
            <button className={styles.primaryButton} disabled={busy || !libraryName.trim()} onClick={() => void createLibrary()}>إنشاء مكتبة</button>
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <h2>كود تفعيل تطبيق المكتبة</h2>
              <p>يعرض مرة واحدة. أعطه لأمين المكتبة عند أول تشغيل للتطبيق.</p>
            </div>
          </div>
          <div className={styles.formStack}>
            <select className={styles.input} value={selectedLibraryId} onChange={(event) => setSelectedLibraryId(event.target.value)}>
              <option value="">اختر مكتبة</option>
              {libraries.map((library) => (
                <option key={library.id} value={library.id}>{library.name}</option>
              ))}
            </select>
            <div className={styles.expiryGrid}>
              {EXPIRY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`${styles.expiryOption} ${activationExpiry === option.value ? styles.expiryOptionActive : ''}`}
                  onClick={() => setActivationExpiry(option.value)}
                >
                  <strong>{option.label}</strong>
                  <span>{option.hint}</span>
                </button>
              ))}
            </div>
            <button className={styles.primaryButton} disabled={busy || !selectedLibraryId} onClick={() => void createActivationCode()}>توليد كود</button>
            {generatedCode && (
              <div className={styles.generatedCode}>
                <span>انسخ الكود الآن، لن يظهر مرة ثانية</span>
                <strong dir="ltr">{generatedCode}</strong>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <div>
            <h2>المكتبات</h2>
            <p>كل مكتبة لها رابط رفع مستقل ويمكن تعطيلها عند الحاجة.</p>
          </div>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>الاسم</th>
                <th>الرابط</th>
                <th>الحالة</th>
                <th>رابط الرفع</th>
                <th>إجراء</th>
              </tr>
            </thead>
            <tbody>
              {libraries.map((library) => (
                <tr key={library.id}>
                  <td>{library.name}</td>
                  <td dir="ltr">{library.slug}</td>
                  <td><StatusDot active={library.status === 'active'} /> {library.status === 'active' ? 'فعالة' : 'متوقفة'}</td>
                  <td dir="ltr">/?library={library.slug}</td>
                  <td><button className={styles.smallButton} disabled={busy} onClick={() => void toggleLibrary(library)}>{library.status === 'active' ? 'تعطيل' : 'تفعيل'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.gridTwo}>
        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <h2>الأجهزة</h2>
              <p>آخر اتصال لكل تطبيق مكتبة مفعل.</p>
            </div>
          </div>
          <div className={styles.listStack}>
            {devices.map((device) => (
              <div key={device.id} className={styles.listItem}>
                <div>
                  <strong>{formatDeviceName(device)}</strong>
                  <span dir="ltr">{device.device_id}</span>
                </div>
                <small>آخر اتصال: {formatDate(device.last_seen_at)}</small>
              </div>
            ))}
            {devices.length === 0 && <div className={styles.emptyState}>لا توجد أجهزة مفعلة بعد.</div>}
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <h2>أكواد التفعيل</h2>
              <p>لا يتم تخزين الكود نفسه، فقط بصمة آمنة.</p>
            </div>
          </div>
          <div className={styles.listStack}>
            {activationCodes.map((code) => {
              const status = getCodeStatus(code);
              return (
                <div key={code.id} className={styles.listItem}>
                  <div>
                    <strong>{code.libraries?.name || code.library_id}</strong>
                    <span>{formatActivationLabel(code.label)}</span>
                  </div>
                  <div className={styles.listMeta}>
                    <span className={`${styles.codeState} ${status.active ? styles.codeStateActive : ''}`}>{status.label}</span>
                    <small>الصلاحية: {formatExpiry(code.expires_at)}</small>
                  </div>
                </div>
              );
            })}
            {activationCodes.length === 0 && <div className={styles.emptyState}>لا توجد أكواد تفعيل بعد.</div>}
          </div>
        </div>
      </section>
    </main>
  );
}
