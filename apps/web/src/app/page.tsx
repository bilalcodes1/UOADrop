'use client';

export const dynamic = 'force-dynamic';

import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import styles from './page.module.css';

type PrintSettings = {
  copies: number;
  color: boolean;
  doubleSided: boolean;
  pagesPerSheet: 1 | 2 | 4;
  pageRange: string;
};

type FileEntry = {
  id: string;
  file: File;
  settings: PrintSettings;
  expanded: boolean;
};

type PageState = 'form' | 'uploading' | 'success';

type SuccessInfo = {
  ticket: string;
  pin: string;
  requestId: string;
  warning?: string;
  telegramEnabled?: boolean;
};

const DEFAULT_SETTINGS: PrintSettings = {
  copies: 1,
  color: false,
  doubleSided: false,
  pagesPerSheet: 1,
  pageRange: '',
};

const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
];

const MAX_FILES = 10;
const TELEGRAM_BOT_USERNAME = 'UOADropBot';
const FORM_PREFS_KEY = 'uoadrop:web:upload-form-prefs';

const FILE_ICONS: Record<string, string> = {
  'application/pdf': '📄',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '📊',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '📋',
  'image/jpeg': '🖼️',
  'image/png': '🖼️',
};

function generateTicket(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function generatePin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(saltBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const data = encoder.encode(pin + saltHex);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `sha256:${saltHex}:${hashHex}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function buildTelegramLinks(startValue: string): { deepLink: string; webLink: string } {
  const encoded = encodeURIComponent(startValue);
  return {
    deepLink: `tg://resolve?domain=${TELEGRAM_BOT_USERNAME}&start=${encoded}`,
    webLink: `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${encoded}`,
  };
}

function formatSettingsSummary(settings: PrintSettings): string {
  return [
    `${settings.copies.toLocaleString('ar-IQ')} نسخ`,
    settings.color ? 'ملون' : 'أبيض وأسود',
    settings.doubleSided ? 'وجهين' : 'وجه واحد',
  ].join(' • ');
}

function settingsEqual(a: PrintSettings, b: PrintSettings): boolean {
  return (
    a.copies === b.copies
    && a.color === b.color
    && a.doubleSided === b.doubleSided
    && a.pagesPerSheet === b.pagesPerSheet
    && a.pageRange === b.pageRange
  );
}

function clampOptionInt(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function readStoredFormPrefs(): {
  studentName: string;
  email: string;
  notifyEmail: boolean;
  notifyTelegram: boolean;
  defaultSettings: PrintSettings;
} | null {
  try {
    const raw = window.localStorage.getItem(FORM_PREFS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    return {
      studentName: typeof parsed.studentName === 'string' ? parsed.studentName.trim().slice(0, 80) : '',
      email: typeof parsed.email === 'string' ? parsed.email.trim().slice(0, 120) : '',
      notifyEmail: Boolean(parsed.notifyEmail),
      notifyTelegram: Boolean(parsed.notifyTelegram),
      defaultSettings: {
        copies: clampOptionInt((parsed as any)?.defaultSettings?.copies, 1, 10, DEFAULT_SETTINGS.copies),
        color: Boolean((parsed as any)?.defaultSettings?.color),
        doubleSided: Boolean((parsed as any)?.defaultSettings?.doubleSided),
        pagesPerSheet: [1, 2, 4].includes(Number((parsed as any)?.defaultSettings?.pagesPerSheet))
          ? Number((parsed as any)?.defaultSettings?.pagesPerSheet) as 1 | 2 | 4
          : DEFAULT_SETTINGS.pagesPerSheet,
        pageRange: typeof (parsed as any)?.defaultSettings?.pageRange === 'string'
          ? String((parsed as any).defaultSettings.pageRange).slice(0, 40)
          : DEFAULT_SETTINGS.pageRange,
      },
    };
  } catch {
    return null;
  }
}

export default function UploadPage() {
  const [state, setState] = useState<PageState>('form');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [notifyEmail, setNotifyEmail] = useState(false);
  const [notifyTelegram, setNotifyTelegram] = useState(false);
  const [defaultSettings, setDefaultSettings] = useState<PrintSettings>(DEFAULT_SETTINGS);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState(0);
  const [success, setSuccess] = useState<SuccessInfo | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = readStoredFormPrefs();
    if (!stored) return;

    setName(stored.studentName);
    setEmail(stored.email);
    setNotifyEmail(stored.notifyEmail);
    setNotifyTelegram(stored.notifyTelegram);
    setDefaultSettings(stored.defaultSettings);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        FORM_PREFS_KEY,
        JSON.stringify({
          studentName: name.trim().slice(0, 80),
          email: email.trim().slice(0, 120),
          notifyEmail,
          notifyTelegram,
          defaultSettings,
        }),
      );
    } catch {
      // Ignore storage errors.
    }
  }, [name, email, notifyEmail, notifyTelegram, defaultSettings]);

  const addFiles = useCallback((incoming: File[]) => {
    const valid = incoming.filter(f => ALLOWED_TYPES.includes(f.type));
    const invalid = incoming.length - valid.length;
    setFiles(prev => {
      const remainingSlots = Math.max(0, MAX_FILES - prev.length);
      const accepted = valid.slice(0, remainingSlots);
      const skippedOverflow = valid.length - accepted.length;
      const messages: string[] = [];

      if (invalid > 0) {
        messages.push(`${invalid} ملف غير مدعوم. المسموح فقط: PDF, DOCX, PPTX, XLSX, JPG, PNG`);
      }

      if (skippedOverflow > 0) {
        messages.push(`يمكنك رفع ${MAX_FILES.toLocaleString('ar-IQ')} ملفات كحد أقصى في الطلب الواحد.`);
      }

      setError(messages.join(' '));

      return [
        ...prev,
        ...accepted.map(f => ({
          id: crypto.randomUUID(),
          file: f,
          settings: { ...defaultSettings },
          expanded: false,
        })),
      ];
    });
  }, [defaultSettings]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      addFiles(Array.from(e.dataTransfer.files));
    },
    [addFiles],
  );

  const removeFile = (id: string) => setFiles(prev => prev.filter(f => f.id !== id));

  const toggleExpanded = (id: string) =>
    setFiles(prev => prev.map(f => (f.id === id ? { ...f, expanded: !f.expanded } : f)));

  const updateSettings = (id: string, patch: Partial<PrintSettings>) =>
    setFiles(prev => prev.map(f => (f.id === id ? { ...f, settings: { ...f.settings, ...patch } } : f)));

  const handleSubmit = async () => {
    setError('');
    if (!name.trim()) { setError('اسم الطالب مطلوب'); return; }
    if (files.length === 0) { setError('اختر ملفاً واحداً على الأقل'); return; }
    const normalizedEmail = email.trim();
    if (notifyEmail && !normalizedEmail) { setError('أدخل البريد الإلكتروني أو ألغِ خيار إشعارات البريد الإلكتروني'); return; }
    const emailForNotifications = notifyEmail ? normalizedEmail : '';

    setState('uploading');
    setProgress(0);
    setCurrentFile(0);

    try {
      const ticket = generateTicket();
      const pin = generatePin();
      const pinHash = await hashPin(pin);
      const baseRequestPayload = {
        ticket,
        student_name: name.trim(),
        student_email: emailForNotifications || null,
        pickup_pin_hash: pinHash,
        status: 'uploading',
        source: 'online',
      };
      const extendedRequestPayload = {
        ...baseRequestPayload,
        notify_preferences: {
          email: Boolean(emailForNotifications),
          telegram: notifyTelegram,
        },
      };

      let requestId = '';
      let warning = '';

      const { data: req, error: reqErr } = await supabase
        .from('print_requests')
        .insert(extendedRequestPayload)
        .select('id')
        .single();

      if (reqErr) {
        const missingNotificationColumns = /notify_preferences/i.test(reqErr.message ?? '');
        if (!missingNotificationColumns) throw reqErr;

        const { data: fallbackReq, error: fallbackErr } = await supabase
          .from('print_requests')
          .insert(baseRequestPayload)
          .select('id')
          .single();

        if (fallbackErr) throw fallbackErr;
        requestId = fallbackReq.id;
      } else {
        requestId = req.id;
      }

      for (let i = 0; i < files.length; i++) {
        setCurrentFile(i + 1);
        const entry = files[i]!;
        const safeName = entry.file.name.replace(/\s+/g, '_').replace(/[^\w.\-]/g, '_');
        const storagePath = `${requestId}/${Date.now()}-${safeName}`;

        const { error: uploadErr } = await supabase.storage
          .from('print-files')
          .upload(storagePath, entry.file, { upsert: false });

        if (uploadErr) throw uploadErr;

        const { error: fileErr } = await supabase.from('request_files').insert({
          request_id: requestId,
          filename: entry.file.name,
          mime_type: entry.file.type,
          size_bytes: entry.file.size,
          storage_path: storagePath,
          copies: entry.settings.copies,
          color: entry.settings.color,
          double_sided: entry.settings.doubleSided,
          pages_per_sheet: entry.settings.pagesPerSheet,
          page_range: entry.settings.pageRange || null,
        });

        if (fileErr) throw fileErr;

        setProgress(Math.round(((i + 1) / files.length) * 100));
      }

      const { error: readyErr } = await supabase
        .from('print_requests')
        .update({ status: 'pending' })
        .eq('id', requestId);

      if (readyErr) throw readyErr;

      setSuccess({ ticket, pin, requestId, warning: warning || undefined, telegramEnabled: notifyTelegram });
      setState('success');
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      setError(`خطأ: ${msg}`);
      setState('form');
    }
  };

  const resetForm = () => {
    setState('form');
    setFiles([]);
    setSuccess(null);
    setError('');
    setProgress(0);
  };

  const totalBytes = files.reduce((sum, entry) => sum + entry.file.size, 0);
  const filesCountLabel = `${files.length.toLocaleString('ar-IQ')} ${files.length === 1 ? 'ملف' : 'ملفات'}`;
  const filesHint = files.length === 0 ? 'أضف ملفاتك لتظهر هنا مباشرة.' : `${formatFileSize(totalBytes)} إجمالي الحجم الحالي`;
  const defaultsValue = formatSettingsSummary(defaultSettings);
  const readinessValue = state === 'uploading'
    ? 'جاري الرفع'
    : !name.trim()
      ? 'الاسم مطلوب'
      : files.length === 0
        ? 'بانتظار الملفات'
        : 'جاهز للإرسال';
  const readinessHint = state === 'uploading'
    ? `يتم الآن رفع ${Math.max(currentFile, 1).toLocaleString('ar-IQ')} من ${Math.max(files.length, 1).toLocaleString('ar-IQ')} ملفات.`
    : !name.trim()
      ? 'أدخل اسم الطالب أولاً للمتابعة.'
      : files.length === 0
        ? 'أضف ملفاً واحداً على الأقل حتى يصبح الطلب جاهزاً.'
        : 'يمكنك إرسال الطلب الآن وسيظهر مباشرة في لوحة الطباعة.';
  const queueCountLabel = files.length === 0
    ? 'لا توجد ملفات بعد'
    : `${files.length.toLocaleString('ar-IQ')} ${files.length === 1 ? 'ملف مضاف' : 'ملفات مضافة'}`;
  const notificationSummary = [
    notifyEmail && email.trim() ? 'البريد الإلكتروني' : '',
    notifyTelegram ? 'Telegram' : '',
  ].filter(Boolean).join(' • ') || 'لا توجد قنوات إشعار مفعلة';

  return (
    <div className={styles.pageShell}>
      <div className={styles.container}>
        <header className={styles.hero}>
          <div className={styles.heroBrandRow}>
            <div className={styles.brandMark}>
              <img className={styles.brandMarkLogo} src="/uoadrop-logo.png" alt="UOADrop" />
            </div>

            <div className={styles.heroCopy}>
              <span className={styles.heroKicker}>منصة رفع ملفات الطباعة</span>
              <h1 className={styles.heroTitle}>ارفع ملفاتك للطباعة بسرعة ووضوح</h1>
              <p className={styles.heroSub}>صفحة الرفع الأونلاين بنفس هوية صفحة الرفع الأساسية، مع وصول مباشر إلى لوحة المكتبة بعد الإرسال.</p>

              <div className={styles.heroPills}>
                <span className={styles.heroPill}>مصدر الطلب: أونلاين</span>
                <span className={styles.heroPill}>التذكرة وPIN يظهران بعد الإرسال</span>
                <span className={styles.heroPill}>PDF · Office · صور</span>
              </div>
            </div>
          </div>
        </header>

        <main className={styles.layout}>
          <section className={`${styles.card} ${styles.formCard}`}>
            {state === 'uploading' ? (
              <UploadingScreen progress={progress} current={currentFile} total={files.length} />
            ) : state === 'success' && success ? (
              <SuccessPanel
                ticket={success.ticket}
                pin={success.pin}
                requestId={success.requestId}
                warning={success.warning}
                telegramEnabled={success.telegramEnabled}
                onNew={resetForm}
              />
            ) : (
              <>
                <div className={styles.sectionHead}>
                  <div>
                    <h2 className={styles.sectionTitle}>تفاصيل الطلب</h2>
                  </div>
                  <span className={styles.sectionBadge}>الخطوة الأولى</span>
                </div>

                <div className={styles.formStack}>
                  <section className={styles.formSection}>
                    <span className={styles.sectionEyebrow}>1. المعلومات الأساسية</span>
                    <h3 className={styles.formSectionTitle}>بيانات الطالب</h3>

                    <div className={styles.fieldGrid}>
                      <div className={`${styles.field} ${styles.fieldFull}`}>
                        <label className={styles.label}>
                          اسم الطالب <span className={styles.required}>*</span>
                        </label>
                        <input
                          className={styles.input}
                          type="text"
                          placeholder="اكتب اسم الطالب"
                          value={name}
                          onChange={e => setName(e.target.value)}
                          autoComplete="name"
                        />
                      </div>
                    </div>
                  </section>

                  <section className={styles.formSection}>
                    <span className={styles.sectionEyebrow}>2. الإشعارات الاختيارية</span>
                    <h3 className={styles.formSectionTitle}>كيف تريد أن تصلك التحديثات؟</h3>

                    <div className={styles.notificationStack}>
                      <div className={styles.notificationCard}>
                        <label className={styles.notificationToggle}>
                          <input
                            type="checkbox"
                            checked={notifyEmail}
                            onChange={e => setNotifyEmail(e.target.checked)}
                          />
                          <span>تفعيل إشعارات البريد الإلكتروني</span>
                        </label>
                        <input
                          className={styles.input}
                          type="email"
                          placeholder="student@uoanbar.edu.iq"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          autoComplete="email"
                          dir="ltr"
                        />
                      </div>

                      <div className={styles.notificationCard}>
                        <label className={styles.notificationToggle}>
                          <input
                            type="checkbox"
                            checked={notifyTelegram}
                            onChange={e => setNotifyTelegram(e.target.checked)}
                          />
                          <span>تفعيل إشعارات Telegram</span>
                        </label>
                        <p className={styles.notificationHint}>بعد إرسال الطلب سيظهر لك زر واحد يفتح تطبيق Telegram مباشرة على بوت الإشعارات ليبدأ الربط.</p>
                      </div>
                    </div>
                  </section>

                  <section className={styles.formSection}>
                    <span className={styles.sectionEyebrow}>3. الإعدادات الافتراضية</span>
                    <h3 className={styles.formSectionTitle}>كيف تريد أن يبدأ الطلب؟</h3>

                    <div className={`${styles.fieldGrid} ${styles.defaultGrid}`}>
                      <div className={styles.field}>
                        <label className={styles.label}>عدد النسخ الافتراضي</label>
                        <input
                          className={styles.input}
                          type="number"
                          min={1}
                          max={10}
                          value={defaultSettings.copies}
                          onChange={e => setDefaultSettings(prev => ({
                            ...prev,
                            copies: Math.max(1, Math.min(10, Number(e.target.value) || 1)),
                          }))}
                          inputMode="numeric"
                        />
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label}>نوع الطباعة الافتراضي</label>
                        <select
                          className={styles.input}
                          value={String(defaultSettings.color)}
                          onChange={e => setDefaultSettings(prev => ({ ...prev, color: e.target.value === 'true' }))}
                        >
                          <option value="false">أبيض وأسود</option>
                          <option value="true">ملونة</option>
                        </select>
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label}>الطباعة على وجهين افتراضياً</label>
                        <select
                          className={styles.input}
                          value={String(defaultSettings.doubleSided)}
                          onChange={e => setDefaultSettings(prev => ({ ...prev, doubleSided: e.target.value === 'true' }))}
                        >
                          <option value="true">نعم</option>
                          <option value="false">لا</option>
                        </select>
                      </div>
                    </div>
                  </section>

                  <section className={styles.formSection}>
                    <div className={styles.queueShell}>
                      <div className={styles.queueHead}>
                        <div>
                          <span className={styles.sectionEyebrow}>4. الملفات</span>
                          <h3 className={styles.formSectionTitle}>أضف الملفات المطلوب طباعتها</h3>
                        </div>
                        <div className={styles.queueCount}>{queueCountLabel}</div>
                      </div>

                      <div
                        className={`${styles.dropzone} ${dragging ? styles.dropzoneDragging : ''}`}
                        onDragOver={e => { e.preventDefault(); setDragging(true); }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={onDrop}
                        onClick={() => fileInputRef.current?.click()}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
                      >
                        <div className={styles.dropVisual}>
                          <span className={styles.dropVisualIcon}>⬆</span>
                        </div>
                        <div className={styles.dropBig}>ابدأ من هنا وأضف ملفاتك</div>
                        <div className={styles.dropActions}>
                          <span className={styles.dropCta}>اختيار الملفات الآن</span>
                        </div>
                        <p className={styles.dropzoneHint}>PDF · DOCX · PPTX · XLSX · JPG · PNG — حد أقصى 50 MB للملف</p>
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          accept=".pdf,.docx,.pptx,.xlsx,.jpg,.jpeg,.png"
                          className={styles.fileInput}
                          onChange={e => e.target.files && addFiles(Array.from(e.target.files))}
                        />
                      </div>

                      {files.length === 0 && (
                        <div className={styles.queueEmpty}>
                          <strong>ما أضفت أي ملف بعد</strong>
                        </div>
                      )}

                      {files.length > 0 && (
                        <ul className={styles.fileList}>
                          {files.map(entry => (
                            <li key={entry.id} className={styles.fileItem}>
                              <div className={styles.fileHeader}>
                                <span className={styles.fileIcon}>
                                  {FILE_ICONS[entry.file.type] ?? '📄'}
                                </span>
                                <span className={styles.fileName}>{entry.file.name}</span>
                                <span className={styles.fileSize}>{formatFileSize(entry.file.size)}</span>
                                <button
                                  className={styles.settingsBtn}
                                  onClick={() => toggleExpanded(entry.id)}
                                >
                                  {entry.expanded ? '▲ إخفاء' : '▼ إعدادات'}
                                </button>
                                <button
                                  className={styles.removeBtn}
                                  onClick={() => removeFile(entry.id)}
                                  aria-label="حذف الملف"
                                >
                                  ✕
                                </button>
                              </div>

                              {entry.expanded && (
                                <div className={styles.settings}>
                                  <div className={styles.settingRow}>
                                    <label>عدد النسخ</label>
                                    <input
                                      type="number"
                                      min={1}
                                      max={20}
                                      value={entry.settings.copies}
                                      onChange={e =>
                                        updateSettings(entry.id, { copies: Math.max(1, Number(e.target.value)) })
                                      }
                                      className={styles.numberInput}
                                    />
                                  </div>
                                  <div className={styles.settingRow}>
                                    <label>طباعة ملوّنة</label>
                                    <input
                                      type="checkbox"
                                      checked={entry.settings.color}
                                      onChange={e => updateSettings(entry.id, { color: e.target.checked })}
                                    />
                                  </div>
                                  <div className={styles.settingRow}>
                                    <label>طباعة وجهين</label>
                                    <input
                                      type="checkbox"
                                      checked={entry.settings.doubleSided}
                                      onChange={e => updateSettings(entry.id, { doubleSided: e.target.checked })}
                                    />
                                  </div>
                                  <div className={styles.settingRow}>
                                    <label>صفحات في الورقة</label>
                                    <select
                                      value={entry.settings.pagesPerSheet}
                                      onChange={e =>
                                        updateSettings(entry.id, {
                                          pagesPerSheet: Number(e.target.value) as 1 | 2 | 4,
                                        })
                                      }
                                      className={styles.select}
                                    >
                                      <option value={1}>1</option>
                                      <option value={2}>2</option>
                                      <option value={4}>4</option>
                                    </select>
                                  </div>
                                  <div className={styles.settingRow}>
                                    <label>نطاق الصفحات</label>
                                    <input
                                      type="text"
                                      placeholder="مثال: 1-5,7"
                                      value={entry.settings.pageRange}
                                      onChange={e => updateSettings(entry.id, { pageRange: e.target.value })}
                                      className={styles.textInput}
                                      dir="ltr"
                                    />
                                  </div>
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </section>

                  <div className={styles.actionPanel}>
                    {error && <p className={styles.error}>{error}</p>}

                    <button
                      className={styles.submitBtn}
                      onClick={handleSubmit}
                      disabled={!name.trim() || files.length === 0}
                    >
                      إرسال الطلب إلى المكتبة
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>

          <aside className={styles.sidePanel}>
            <div className={styles.sideCard}>
              <span className={styles.sideEyebrow}>ملخص حي</span>
              <h3>جاهزية الطلب الآن</h3>
              <div className={styles.summaryStack}>
                <div className={styles.summaryItem}>
                  <span>الملفات المختارة</span>
                  <strong className={styles.sideValue}>{filesCountLabel}</strong>
                  <p className={styles.sideHint}>{filesHint}</p>
                </div>

                <div className={styles.summaryItem}>
                  <span>الإعداد الافتراضي الحالي</span>
                  <strong className={styles.sideValueSmall}>{defaultsValue}</strong>
                </div>

                <div className={styles.summaryItem}>
                  <span>حالة الإرسال</span>
                  <strong className={styles.sideValue}>{readinessValue}</strong>
                  <p className={styles.sideHint}>{readinessHint}</p>
                </div>

                <div className={styles.summaryItem}>
                  <span>قنوات الإشعار</span>
                  <strong className={styles.sideValueSmall}>{notificationSummary}</strong>
                </div>
              </div>
            </div>
          </aside>
        </main>

        <ProjectCreditsSection />
      </div>
    </div>
  );
}

function UploadingScreen({
  progress,
  current,
  total,
}: {
  progress: number;
  current: number;
  total: number;
}) {
  return (
    <div className={styles.uploadingCard}>
      <span className={styles.uploadingIcon}>⏳</span>
      <p className={styles.uploadingTitle}>جارٍ رفع الملفات...</p>
      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${progress}%` }} />
      </div>
      <p className={styles.progressLabel}>
        {progress}% — ملف {current} من {total}
      </p>
    </div>
  );
}

function SuccessPanel({
  ticket,
  pin,
  requestId,
  warning,
  telegramEnabled,
  onNew,
}: {
  ticket: string;
  pin: string;
  requestId: string;
  warning?: string;
  telegramEnabled?: boolean;
  onNew: () => void;
}) {
  const [copiedField, setCopiedField] = useState<'ticket' | 'pin' | null>(null);
  const [status, setStatus] = useState<string>('pending');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date>(new Date());
  const { deepLink, webLink } = buildTelegramLinks(ticket);

  type TrackerState = '' | 'done' | 'current' | 'warn';

  const statusMeta: Record<string, { badge: string; title: string; text: string }> = {
    pending: {
      badge: 'قيد الانتظار',
      title: 'تم استلام الطلب وهو الآن بانتظار المعالجة',
      text: 'اكتمل الرفع بنجاح، وسيظهر هنا أي تغيير في حالة الطلب داخل المكتبة.',
    },
    printing: {
      badge: 'تحت الطباعة',
      title: 'بدأت المكتبة تنفيذ الطلب',
      text: 'الطلب دخل مرحلة التنفيذ الآن. انتظر حتى يتحول إلى جاهز للاستلام.',
    },
    ready: {
      badge: 'جاهز للاستلام',
      title: 'الطلب جاهز الآن',
      text: 'يمكنك مراجعة المكتبة مع رقم التذكرة ورمز الاستلام لإتمام الاستلام.',
    },
    done: {
      badge: 'تم التسليم',
      title: 'تم تسليم الطلب',
      text: 'اكتملت الدورة الخاصة بهذا الطلب بنجاح.',
    },
    canceled: {
      badge: 'الطلب ملغي',
      title: 'تم إلغاء الطلب',
      text: 'إذا كان هذا الإلغاء غير مقصود، أنشئ طلباً جديداً وأعد رفع الملفات المطلوبة.',
    },
    blocked: {
      badge: 'الطلب موقوف',
      title: 'هذا الطلب يحتاج مراجعة',
      text: 'يرجى مراجعة المكتبة لمعرفة سبب إيقاف الطلب أو المتابعة المطلوبة.',
    },
  };

  const meta = (statusMeta[status] ?? statusMeta.pending)!;

  useEffect(() => {
    let timer: number | null = null;
    let active = true;

    const poll = async () => {
      try {
        const { data, error } = await supabase
          .from('print_requests')
          .select('status, updated_at')
          .eq('id', requestId)
          .single();

        if (!active) return;
        if (error) return;

        const nextStatus = String((data as any)?.status ?? 'pending');
        setStatus(nextStatus);
        const updated = (data as any)?.updated_at;
        setLastUpdatedAt(updated ? new Date(updated) : new Date());

        if (['done', 'canceled', 'blocked'].includes(nextStatus)) {
          return;
        }
      } finally {
        if (!active) return;
        timer = window.setTimeout(poll, 5000);
      }
    };

    void poll();

    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [requestId]);

  const formatUpdatedStamp = (value: Date) => {
    const diffMs = Date.now() - value.getTime();
    if (!Number.isFinite(diffMs) || diffMs < 0) return 'آخر تحديث: الآن';
    const seconds = Math.floor(diffMs / 1000);
    if (seconds < 10) return 'آخر تحديث: الآن';
    if (seconds < 60) return `آخر تحديث: قبل ${seconds} ثواني`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `آخر تحديث: قبل ${minutes} دقيقة`;
    const hours = Math.floor(minutes / 60);
    return `آخر تحديث: قبل ${hours} ساعة`;
  };

  const trackerSteps: Array<{ label: string; text: string; state: TrackerState; readyStep: boolean }> = (() => {
    const intro = [
      {
        label: 'تسجيل الطلب',
        text: 'تم إنشاء رقم التذكرة ورمز الاستلام الخاصين بطلبك.',
        state: 'done' as const,
        readyStep: false,
      },
      {
        label: 'رفع الملفات',
        text: 'اكتمل رفع الملفات إلى المكتبة بنجاح.',
        state: 'done' as const,
        readyStep: false,
      },
    ];
    const flow = [
      {
        key: 'pending',
        label: 'بانتظار المعالجة',
        text: 'الطلب وصل إلى المكتبة وينتظر بدء التنفيذ.',
      },
      {
        key: 'printing',
        label: 'تحت الطباعة',
        text: 'يتم الآن تجهيز الطلب على الطابعة.',
      },
      {
        key: 'ready',
        label: 'جاهز للاستلام',
        text: 'يمكنك مراجعة المكتبة واستلام الطلب باستخدام التذكرة والرمز.',
      },
    ];

    const statusIndex = flow.findIndex(step => step.key === status);
    const derived: Array<{ label: string; text: string; state: TrackerState; readyStep: boolean }> = flow.map((step, index) => {
      let state: TrackerState = '';
      if (status === 'done') state = 'done';
      else if (status === 'canceled' || status === 'blocked') state = '';
      else if (statusIndex > index) state = 'done';
      else if (statusIndex === index) state = 'current';
      return {
        label: step.label,
        text: step.text,
        state,
        readyStep: step.key === 'ready',
      };
    });

    if (status === 'canceled') {
      derived.push({
        label: 'تم إلغاء الطلب',
        text: 'تم إلغاء الطلب من قبل المكتبة أو بسبب خطأ في الطلب.',
        state: 'warn',
        readyStep: false,
      });
    }

    if (status === 'blocked') {
      derived.push({
        label: 'الطلب يحتاج مراجعة',
        text: 'يرجى مراجعة المكتبة لمعرفة سبب إيقاف الطلب.',
        state: 'warn',
        readyStep: false,
      });
    }

    return [...intro, ...derived];
  })();

  const copyValue = async (value: string, field: 'ticket' | 'pin') => {
    await navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const connectTelegram = () => {
    const fallbackTimer = window.setTimeout(() => {
      if (document.visibilityState === 'visible') {
        window.open(webLink, '_blank', 'noopener,noreferrer');
      }
    }, 700);

    window.location.href = deepLink;

    window.setTimeout(() => window.clearTimeout(fallbackTimer), 1800);
  };

  return (
    <>
      <div className={styles.successHead}>
        <div className={styles.successIllustrationWrap}>
          <svg className={styles.successIllustration} viewBox="0 0 220 170" fill="none" aria-hidden="true">
            <rect x="22" y="44" width="176" height="96" rx="28" fill="#ECFDF5" />
            <rect x="46" y="24" width="84" height="102" rx="18" fill="#FFFFFF" stroke="#BBF7D0" strokeWidth="2" />
            <rect x="60" y="40" width="56" height="10" rx="5" fill="#A7F3D0" />
            <rect x="60" y="58" width="44" height="8" rx="4" fill="#D1FAE5" />
            <rect x="60" y="74" width="52" height="8" rx="4" fill="#D1FAE5" />
            <circle cx="153" cy="79" r="28" fill="#DCFCE7" />
            <path d="M141 80l9 9 17-18" stroke="#16A34A" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M160 107h18a12 12 0 0012-12V69" stroke="#86EFAC" strokeWidth="4" strokeLinecap="round" />
            <circle cx="44" cy="132" r="6" fill="#4F46E5" fillOpacity="0.12" />
            <circle cx="182" cy="36" r="7" fill="#22C55E" fillOpacity="0.16" />
          </svg>
        </div>

        <div className={styles.successCopy}>
          <h1 className={styles.successHeadline}>تم استلام الطلب</h1>
          <div className={styles.statusMetaRow}>
            <div className={`${styles.statusPill} ${styles.pulseLive}`}>{meta.badge}</div>
            <div className={styles.updateStamp}>{formatUpdatedStamp(lastUpdatedAt)}</div>
          </div>
        </div>
      </div>

      <div className={styles.statusSummary}>
        <strong>{meta.title}</strong>
        <p>{meta.text}</p>
      </div>

      <div className={styles.ticketGrid}>
        <div className={styles.ticketBox}>
          <span className={styles.ticketLabel}>رقم التذكرة</span>
          <span className={styles.ticketCodeSmall} dir="ltr">{ticket}</span>
          <button className={styles.copyBtn} onClick={() => void copyValue(ticket, 'ticket')}>
            {copiedField === 'ticket' ? '✓ تم نسخ التذكرة' : 'نسخ رقم التذكرة'}
          </button>
        </div>

        <div className={styles.pinBox}>
          <span className={styles.pinLabel}>رمز الاستلام</span>
          <span className={styles.pinCode} dir="ltr">{pin}</span>
          <button className={styles.copyBtn} onClick={() => void copyValue(pin, 'pin')}>
            {copiedField === 'pin' ? '✓ تم نسخ الـ PIN' : 'نسخ رمز الاستلام'}
          </button>
          <p className={styles.pinNote}>
            أبقِ هذا الرمز سرياً — ستُطلب منك إدخاله عند استلام طباعتك
          </p>
        </div>
      </div>

      <div className={styles.statusTracker} aria-label="تتبع حالة الطلب">
        {trackerSteps.map((step, index) => (
          <div
            key={`${step.label}-${index}`}
            className={`${styles.trackerStep} ${step.state === 'done' ? styles.trackerDone : ''} ${step.state === 'current' ? `${styles.trackerCurrent} ${step.readyStep ? styles.readyStep : ''}` : ''} ${step.state === 'warn' ? styles.trackerWarn : ''}`}
          >
            <div className={styles.trackerDot} />
            <div className={styles.trackerCopy}>
              <strong>{step.label}</strong>
              <span>{step.text}</span>
            </div>
          </div>
        ))}
        <p className={styles.liveNote}>سيتم تحديث هذه الحالة تلقائياً عند أي تغيير من المكتبة.</p>
      </div>

      {telegramEnabled && (
        <div className={styles.telegramConnectCard}>
          <strong>ربط إشعارات Telegram</strong>
          <p>بضغطة واحدة سيتم فتح بوت <span className={styles.telegramInline}>@{TELEGRAM_BOT_USERNAME}</span> لبدء الربط مباشرة بهذا الطلب.</p>
          <button className={styles.telegramConnectBtn} onClick={connectTelegram}>
            ربط Telegram الآن
          </button>
        </div>
      )}

      {warning && <p className={styles.successWarning}>{warning}</p>}

      <button className={styles.newRequestBtn} onClick={onNew}>
        إرسال طلب جديد
      </button>
    </>
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
              <div className={styles.creditsInstitutionLogo}>
                <img src="/university-of-anbar.svg" alt="جامعة الأنبار" />
              </div>
              <div className={styles.creditsInstitutionCopy}>
                <span className={styles.creditsInstitutionLabel}>الجامعة</span>
                <strong>جامعة الأنبار</strong>
                <p>الجهة الأكاديمية الحاضنة للمشروع والداعمة لتطوير تجربة الطباعة داخل المكتبة.</p>
              </div>
            </article>

            <article className={styles.creditsInstitutionCard}>
              <div className={styles.creditsInstitutionLogo}>
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
              <svg className={styles.creditsActionIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M7 17L17 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M9 7h8v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </article>

          <article className={styles.creditsCard}>
            <span className={styles.creditsLabel}>رئيس القسم</span>
            <h3>د. عصام طه ياسين حسين الهيتي</h3>
            <p>يُذكر <span className={styles.creditsInlineEmphasis}>د. عصام طه ياسين حسين الهيتي</span> هنا بصفته <span className={styles.creditsInlineEmphasis}>رئيس القسم</span> ضمن البنية الأكاديمية الداعمة لبيئة المشروع في <span className={styles.creditsInlineEmphasis}>كلية علوم الحاسوب وتكنولوجيا المعلومات</span>.</p>
            <a className={styles.creditsAction} href="https://www.uoanbar.edu.iq/staff-page.php?ID=1673" target="_blank" rel="noreferrer">
              <span>الصفحة الرسمية</span>
              <svg className={styles.creditsActionIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M7 17L17 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M9 7h8v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </article>

          <article className={styles.creditsCard}>
            <span className={styles.creditsLabel}>الإشراف</span>
            <h3>د. رقية أياد عبد الجبار عبيد العاني</h3>
            <p>أشرفت <span className={styles.creditsInlineEmphasis}>د. رقية أياد عبد الجبار عبيد العاني</span> على الجوانب الأكاديمية والتنظيمية للمشروع لضمان انسجامه مع احتياج المكتبة وسهولة استخدامه للطلبة.</p>
            <a className={styles.creditsAction} href="https://www.uoanbar.edu.iq/staff-page.php?ID=1626" target="_blank" rel="noreferrer">
              <span>الصفحة الرسمية</span>
              <svg className={styles.creditsActionIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M7 17L17 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M9 7h8v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </article>

          <article className={styles.creditsCard}>
            <span className={styles.creditsLabel}>المشرفة الثانية</span>
            <h3>د. مكارم عبدالواحد عبدالجبار التركي</h3>
            <p>تُذكر <span className={styles.creditsInlineEmphasis}>د. مكارم عبدالواحد عبدالجبار التركي</span> ضمن الإطار الأكاديمي المساند للمشروع بوصفها من الكادر التدريسي في <span className={styles.creditsInlineEmphasis}>كلية علوم الحاسوب وتكنولوجيا المعلومات</span>.</p>
            <a className={styles.creditsAction} href="https://www.uoanbar.edu.iq/staff-page.php?ID=1651" target="_blank" rel="noreferrer">
              <span>الصفحة الرسمية</span>
              <svg className={styles.creditsActionIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M7 17L17 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M9 7h8v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </article>

          <article className={styles.creditsCard}>
            <span className={styles.creditsLabel}>المطور</span>
            <h3>بلال زامل احمد</h3>
            <p>تولّى <span className={styles.creditsInlineEmphasis}>بلال زامل احمد</span> تصميم النظام وتنفيذه وصياغة واجهته وتوحيد هويته البصرية لتظهر منصة <span className={styles.creditsInlineEmphasis}>UOADrop</span> بصورة واضحة واحترافية.</p>
            <ul className={styles.creditsMeta}>
              <li>
                <span>Instagram</span>
                <a className={styles.creditsLink} href="https://instagram.com/bilalcodes1" target="_blank" rel="noreferrer">bilalcodes1</a>
              </li>
              <li>
                <span>Telegram</span>
                <a className={styles.creditsLink} href="https://t.me/bilalcodes1" target="_blank" rel="noreferrer">bilalcodes1</a>
              </li>
              <li>
                <span>Email</span>
                <a className={styles.creditsLink} href="mailto:bil24c1055@uoanbar.edu.iq">bil24c1055@uoanbar.edu.iq</a>
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
