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

const ADMIN_PASSWORD_KEY = 'uoadrop:admin:password';

function normalizeSlug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
}

function formatDate(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('ar-IQ', { dateStyle: 'medium', timeStyle: 'short' });
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
  const [generatedCode, setGeneratedCode] = useState('');

  const activeLibraries = useMemo(() => libraries.filter((library) => library.status === 'active'), [libraries]);

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
      throw new Error(payload.details || payload.error || `http_${res.status}`);
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
      setError(err instanceof Error ? err.message : String(err));
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
      setError(err instanceof Error ? err.message : String(err));
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
      setError(err instanceof Error ? err.message : String(err));
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
        body: JSON.stringify({ label: 'Desktop setup', expiresInDays: 14 }),
      });
      setGeneratedCode(payload.code ?? '');
      await loadAdminData();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
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
      setError(err instanceof Error ? err.message : String(err));
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
          <div className={styles.brandMark}>U</div>
          <p className={styles.kicker}>UOADrop Admin</p>
          <h1>لوحة إدارة المكتبات</h1>
          <p>أدخل باسورد الأدمن لإدارة المكتبات، الأجهزة، وأكواد التفعيل.</p>
          <input
            className={styles.input}
            type="password"
            placeholder="Admin password"
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
        <div>
          <p className={styles.kicker}>UOADrop Admin</p>
          <h1>إدارة المكتبات</h1>
          <p>قاعدة واحدة متعددة المكتبات، كل ديسكتوب يرتبط بمكتبته من كود التفعيل.</p>
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
          <span>أكواد التفعيل</span>
          <strong>{activationCodes.length.toLocaleString('ar-IQ')}</strong>
        </div>
      </section>

      <section className={styles.gridTwo}>
        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <h2>إضافة مكتبة</h2>
              <p>أنشئ مكتبة جديدة، ثم ولّد لها كود تفعيل للديسكتوب.</p>
            </div>
          </div>
          <div className={styles.formStack}>
            <input className={styles.input} placeholder="اسم المكتبة" value={libraryName} onChange={(event) => setLibraryName(event.target.value)} />
            <input className={styles.input} placeholder="الرابط المختصر مثل cs-library" value={librarySlug} onChange={(event) => setLibrarySlug(normalizeSlug(event.target.value))} />
            <button className={styles.primaryButton} disabled={busy || !libraryName.trim()} onClick={() => void createLibrary()}>إنشاء مكتبة</button>
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <h2>كود تفعيل ديسكتوب</h2>
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
            <button className={styles.primaryButton} disabled={busy || !selectedLibraryId} onClick={() => void createActivationCode()}>توليد كود</button>
            {generatedCode && <div className={styles.generatedCode} dir="ltr">{generatedCode}</div>}
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
              <p>آخر اتصال لكل تطبيق ديسكتوب مفعل.</p>
            </div>
          </div>
          <div className={styles.listStack}>
            {devices.map((device) => (
              <div key={device.id} className={styles.listItem}>
                <div>
                  <strong>{device.libraries?.name || device.name || 'Desktop device'}</strong>
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
              <p>لا يتم تخزين الكود نفسه، فقط hash آمن.</p>
            </div>
          </div>
          <div className={styles.listStack}>
            {activationCodes.map((code) => (
              <div key={code.id} className={styles.listItem}>
                <div>
                  <strong>{code.libraries?.name || code.library_id}</strong>
                  <span>{code.used_at ? 'مستخدم' : code.revoked_at ? 'ملغي' : 'جاهز'}</span>
                </div>
                <small>ينتهي: {formatDate(code.expires_at)}</small>
              </div>
            ))}
            {activationCodes.length === 0 && <div className={styles.emptyState}>لا توجد أكواد تفعيل بعد.</div>}
          </div>
        </div>
      </section>
    </main>
  );
}
