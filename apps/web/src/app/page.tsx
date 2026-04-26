'use client';

export const dynamic = 'force-dynamic';

import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import styles from './page.module.css';

type PrintSettings = {
  copies: number;
  color: boolean;
  doubleSided: boolean;
};

type FileEntry = {
  id: string;
  file: File;
  settings: PrintSettings;
};

type PageState = 'form' | 'uploading' | 'success';

type SuccessInfo = {
  ticket: string;
  requestId: string;
  warning?: string;
  telegramEnabled?: boolean;
};

const DEFAULT_SETTINGS: PrintSettings = {
  copies: 1,
  color: false,
  doubleSided: true,
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
const TELEGRAM_BOT_USERNAME = 'uoadrop_bot';
const FORM_PREFS_KEY = 'uoadrop:web:upload-form-prefs';

function generateTicket(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}


function formatFileSize(bytes: number): string {
  const mb = bytes / 1024 / 1024;
  if (mb >= 1) return `${mb.toFixed(2)} ميغابايت`;
  return `${Math.max(1, Math.round(bytes / 1024))} كيلوبايت`;
}

function buildTelegramLinks(startValue: string): { deepLink: string; webLink: string } {
  const encoded = encodeURIComponent(startValue);
  return {
    deepLink: `tg://resolve?domain=${TELEGRAM_BOT_USERNAME}&start=${encoded}`,
    webLink: `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${encoded}`,
  };
}

function formatDefaultOptionsText(settings: PrintSettings): string {
  const copies = settings.copies;
  const copiesLabel = copies === 1 ? 'نسخة واحدة' : copies === 2 ? 'نسختان' : `${copies} نسخ`;
  const colorLabel = settings.color ? 'ملونة' : 'أبيض وأسود';
  const doubleSidedLabel = settings.doubleSided ? 'وجهين' : 'وجه واحد';
  return `${copiesLabel} • ${colorLabel} • ${doubleSidedLabel}`;
}

function formatPriceValue(value: number): string {
  const num = Number(value || 0);
  if (!Number.isFinite(num) || num <= 0) return 'قيد الحساب';
  return `${num.toLocaleString('ar-IQ')} د.ع`;
}

function formatPagesValue(value: number): string {
  const num = Number(value || 0);
  if (!Number.isFinite(num) || num <= 0) return 'قيد الحساب';
  return `${num.toLocaleString('ar-IQ')} صفحة`;
}

function clampOptionInt(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function formatQueueCountLabel(count: number): string {
  if (!count) return 'لا توجد ملفات بعد';
  if (count === 1) return 'ملف واحد جاهز';
  if (count === 2) return 'ملفان جاهزان';
  return `${count} ملفات جاهزة`;
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
        doubleSided: (parsed as any)?.defaultSettings?.doubleSided === undefined ? true : Boolean((parsed as any)?.defaultSettings?.doubleSided),
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
      const rawBaseRequestPayload = {
        ticket,
        student_name: name.trim(),
        student_email: emailForNotifications || null,
        status: 'uploading',
        source: 'online',
      };
      const baseRequestPayload = {
        ...rawBaseRequestPayload,
        source_of_truth: 'supabase_intake',
        import_state: 'pending',
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

      const appendWarning = (message: string) => {
        warning = warning ? `${warning} ${message}` : message;
      };

      const requestInsertAttempts = [
        { payload: extendedRequestPayload, kind: 'extended' as const },
        { payload: baseRequestPayload, kind: 'workflow' as const },
        { payload: rawBaseRequestPayload, kind: 'base' as const },
      ];

      let lastRequestError: Error | null = null;

      for (const attempt of requestInsertAttempts) {
        const { data, error: insertError } = await supabase
          .from('print_requests')
          .insert(attempt.payload)
          .select('id')
          .single();

        if (!insertError) {
          requestId = data.id;
          break;
        }

        lastRequestError = insertError;
        const errorMessage = insertError.message ?? '';
        const missingNotificationColumns = /notify_preferences/i.test(errorMessage);
        const missingMetricsColumns = /source_of_truth|import_state/i.test(errorMessage);

        if (attempt.kind === 'extended' && missingNotificationColumns) {
          appendWarning('تم إرسال الطلب، لكن حقول تفضيلات الإشعار غير مفعّلة بعد في قاعدة البيانات.');
          continue;
        }

        if ((attempt.kind === 'extended' || attempt.kind === 'workflow') && missingMetricsColumns) {
          appendWarning('تم إرسال الطلب، لكن تتبع الاستلام يحتاج تحديث Schema في Supabase.');
          continue;
        }

        throw insertError;
      }

      if (!requestId) {
        throw lastRequestError ?? new Error('تعذر إنشاء الطلب');
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

        const filePayload = {
          request_id: requestId,
          filename: entry.file.name,
          mime_type: entry.file.type,
          size_bytes: entry.file.size,
          storage_path: storagePath,
          copies: entry.settings.copies,
          color: entry.settings.color,
          double_sided: entry.settings.doubleSided,
        };

        const { error: fileErr } = await supabase.from('request_files').insert(filePayload);
        if (fileErr) throw fileErr;

        setProgress(Math.round(((i + 1) / files.length) * 100));
      }

      const { error: readyErr } = await supabase
        .from('print_requests')
        .update({ status: 'pending' })
        .eq('id', requestId);

      if (readyErr) throw readyErr;

      setSuccess({
        ticket,
        requestId,
        warning: warning || undefined,
        telegramEnabled: notifyTelegram,
      });
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
  const filesCountLabel = formatQueueCountLabel(files.length);
  const filesHint = files.length === 0 ? 'أضف ملفاتك لتظهر هنا مباشرة.' : `${formatFileSize(totalBytes)} إجمالي الحجم`;
  const defaultsValue = formatDefaultOptionsText(defaultSettings);
  const readinessValue = state === 'uploading'
    ? 'جاري الرفع'
    : !name.trim()
      ? 'الاسم مطلوب'
      : files.length === 0
        ? 'بانتظار الملفات'
        : 'جاهز للإرسال';
  const readinessHint = state === 'uploading'
    ? `يتم الآن رفع ${Math.max(currentFile, 1)} من ${Math.max(files.length, 1)} ملفات.`
    : !name.trim()
      ? 'أدخل اسم الطالب أولاً للمتابعة.'
      : files.length === 0
        ? 'أضف ملفاً واحداً على الأقل حتى يصبح الطلب جاهزاً.'
        : 'يمكنك إرسال الطلب الآن وسيظهر مباشرة في لوحة الطباعة.';
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
                <span className={styles.heroPill}>التذكرة تظهر بعد الإرسال</span>
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
                    <p className={styles.sectionSub}>ارفع ملفاتك واضبط الإعدادات الأساسية ليصل الطلب إلى المكتبة بنفس تجربة الواجهة الأساسية.</p>
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
                        <div className={styles.queueCount}>{filesCountLabel}</div>
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
                          <svg className={styles.dropIllustration} viewBox="0 0 260 170" fill="none" aria-hidden="true">
                            <rect x="33" y="42" width="194" height="96" rx="28" fill="#EDE9FE" />
                            <rect x="49" y="56" width="162" height="68" rx="22" fill="#FFFFFF" stroke="#C7D2FE" strokeWidth="2" />
                            <path d="M85 107l28-29 18 18 34-35 29 31" stroke="#A5B4FC" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
                            <circle cx="171" cy="74" r="10" fill="#C4B5FD" />
                            <path d="M130 27v42m0 0l-16-16m16 16l16-16" stroke="#4F46E5" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
                            <rect x="102" y="118" width="56" height="14" rx="7" fill="#4F46E5" fillOpacity="0.12" />
                            <circle cx="54" cy="30" r="8" fill="#22C55E" fillOpacity="0.18" />
                            <circle cx="212" cy="34" r="6" fill="#4F46E5" fillOpacity="0.14" />
                          </svg>
                        </div>
                        <div className={styles.dropBig}>ابدأ من هنا وأضف ملفاتك</div>
                        <div className={styles.dropActions}>
                          <span className={styles.dropCta}>اختيار الملفات الآن</span>
                        </div>
                        <div className={styles.dropMeta}>
                          <span className={styles.dropMetaPill}>حد أقصى 10 ملفات</span>
                          <span className={styles.dropMetaPill}>50 MB لكل ملف</span>
                          <span className={styles.dropMetaPill}>PDF · Office · صور</span>
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
                          <span>اسحب الملفات هنا أو استخدم زر الاختيار للبدء برفع الطلب.</span>
                        </div>
                      )}

                      {files.length > 0 && (
                        <ul className={styles.fileList}>
                          {files.map(entry => (
                            <li key={entry.id} className={styles.fileItem}>
                              <div className={styles.fileHeader}>
                                <div className={styles.fileMain}>
                                  <span className={styles.fileIconBadge}>📄</span>
                                  <div className={styles.fileMetaBlock}>
                                    <span className={styles.fileOverline}>ملف للطباعة</span>
                                    <span className={styles.fileName}>{entry.file.name}</span>
                                    <span className={styles.fileSize}>{formatFileSize(entry.file.size)}</span>
                                  </div>
                                </div>

                                <div className={styles.fileHeaderActions}>
                                  <button
                                    className={styles.removeBtn}
                                    onClick={() => removeFile(entry.id)}
                                    aria-label="حذف الملف"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>

                              <div className={styles.settings}>
                                <div className={styles.fileOptionsGrid}>
                                  <div className={styles.fileOption}>
                                    <label>عدد النسخ</label>
                                    <input
                                      type="number"
                                      min={1}
                                      max={20}
                                      value={entry.settings.copies}
                                      onChange={e => updateSettings(entry.id, { copies: Math.max(1, Number(e.target.value) || 1) })}
                                      className={styles.optionInput}
                                      inputMode="numeric"
                                    />
                                  </div>

                                  <div className={styles.fileOption}>
                                    <label>نوع الطباعة</label>
                                    <select
                                      value={String(entry.settings.color)}
                                      onChange={e => updateSettings(entry.id, { color: e.target.value === 'true' })}
                                      className={styles.optionInput}
                                    >
                                      <option value="false">أبيض وأسود</option>
                                      <option value="true">ملونة</option>
                                    </select>
                                  </div>

                                  <div className={styles.fileOption}>
                                    <label>وجهين</label>
                                    <select
                                      value={String(entry.settings.doubleSided)}
                                      onChange={e => updateSettings(entry.id, { doubleSided: e.target.value === 'true' })}
                                      className={styles.optionInput}
                                    >
                                      <option value="true">نعم</option>
                                      <option value="false">لا</option>
                                    </select>
                                  </div>
                                </div>
                              </div>
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
                    <p className={styles.footerNote}>بعد الإرسال ستظهر لك التذكرة مباشرة، مع تتبع حي للحالة داخل صفحة النجاح.</p>
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
  requestId,
  warning,
  telegramEnabled,
  onNew,
}: {
  ticket: string;
  requestId: string;
  warning?: string;
  telegramEnabled?: boolean;
  onNew: () => void;
}) {
  const [copiedField, setCopiedField] = useState<'ticket' | null>(null);
  const [status, setStatus] = useState<string>('pending');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date>(new Date());
  const [totalPages, setTotalPages] = useState<number>(0);
  const [priceIqd, setPriceIqd] = useState<number>(0);
  const [deskReceivedAt, setDeskReceivedAt] = useState<string | null>(null);
  const [finalPriceConfirmedAt, setFinalPriceConfirmedAt] = useState<string | null>(null);
  const [readyFlash, setReadyFlash] = useState(false);
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
      text: 'يمكنك مراجعة المكتبة مع رقم التذكرة لإتمام الاستلام.',
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

  const meta = status === 'pending' && deskReceivedAt
    ? {
        badge: 'تم استلامه بالمكتبة',
        title: 'استلمت المكتبة الطلب وجرى إدخاله إلى الداشبورد',
        text: 'أصبح التنفيذ الآن من داخل المكتبة. سيظهر هنا بدء الطباعة ثم حالة الجاهزية والتسليم.',
      }
    : (statusMeta[status] ?? statusMeta.pending)!;

  useEffect(() => {
    let timer: number | null = null;
    let active = true;

    const applyRequestSnapshot = (data: any) => {
      const nextStatus = String(data?.status ?? 'pending');
      setStatus(nextStatus);

      const updated = data?.updated_at;
      setLastUpdatedAt(updated ? new Date(updated) : new Date());

      if (typeof data?.price_iqd === 'number') {
        setPriceIqd(data.price_iqd);
      }

      if (typeof data?.total_pages === 'number') {
        setTotalPages(data.total_pages);
      }

      setDeskReceivedAt(typeof data?.desk_received_at === 'string' ? data.desk_received_at : null);
      setFinalPriceConfirmedAt(typeof data?.final_price_confirmed_at === 'string' ? data.final_price_confirmed_at : null);

      return nextStatus;
    };

    const poll = async () => {
      try {
        let result = await supabase
          .from('print_requests')
          .select('status, updated_at, price_iqd, total_pages, desk_received_at, final_price_confirmed_at')
          .eq('id', requestId)
          .single();

        if (result.error && /total_pages|desk_received_at|final_price_confirmed_at/i.test(result.error.message ?? '')) {
          result = await supabase
            .from('print_requests')
            .select('status, updated_at, price_iqd, total_pages')
            .eq('id', requestId)
            .single();
        }

        if (!active) return;
        if (result.error) return;

        const nextStatus = applyRequestSnapshot(result.data as any);

        if (['done', 'canceled', 'blocked'].includes(nextStatus)) {
          return;
        }
      } finally {
        if (!active) return;
        timer = window.setTimeout(poll, 5000);
      }
    };

    const channel = supabase
      .channel(`web-request-${requestId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'print_requests', filter: `id=eq.${requestId}` },
        payload => {
          if (!active) return;
          applyRequestSnapshot(payload.new as any);
        },
      )
      .subscribe();

    void poll();

    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [requestId]);

  useEffect(() => {
    if (status !== 'ready') return;
    setReadyFlash(true);
    const timer = window.setTimeout(() => setReadyFlash(false), 1500);
    return () => window.clearTimeout(timer);
  }, [status]);

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
        text: 'تم إنشاء رقم التذكرة الخاص بطلبك.',
        state: 'done' as const,
        readyStep: false,
      },
      {
        label: 'رفع الملفات',
        text: 'اكتمل رفع الملفات إلى المكتبة بنجاح.',
        state: 'done' as const,
        readyStep: false,
      },
      {
        label: deskReceivedAt ? 'استلام المكتبة' : 'بانتظار استلام المكتبة',
        text: deskReceivedAt
          ? 'تم استلام الطلب داخل المكتبة وأصبح التنفيذ من الداشبورد.'
          : 'بانتظار أن يستلم الداشبورد الطلب ويبدأ التنفيذ من داخل المكتبة.',
        state: ((status === 'printing' || status === 'ready' || status === 'done') ? 'done' : 'current') as TrackerState,
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

  const copyValue = async (value: string, field: 'ticket') => {
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

      <div className={`${styles.statusSummary} ${status === 'ready' ? styles.statusSummaryReadyArrived : ''} ${readyFlash ? styles.statusSummaryReadyFlash : ''}`}>
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

      </div>

      <div className={styles.requestInsights}>
        <div className={`${styles.insightCard} ${finalPriceConfirmedAt ? styles.insightCardReady : ''}`}>
          <strong>السعر النهائي</strong>
          <div className={styles.insightValue}>{finalPriceConfirmedAt ? formatPriceValue(priceIqd) : 'بانتظار اعتماد المكتبة'}</div>
          <span className={styles.insightHint}>{finalPriceConfirmedAt ? 'تم اعتماد السعر النهائي من الداشبورد.' : 'لن يظهر السعر النهائي هنا حتى تعتمده المكتبة من الداشبورد.'}</span>
        </div>

        <div className={`${styles.insightCard} ${totalPages > 0 ? styles.insightCardReady : ''}`}>
          <strong>عدد الصفحات</strong>
          <div className={styles.insightValue}>{formatPagesValue(totalPages)}</div>
          <span className={styles.insightHint}>{deskReceivedAt ? 'القيمة الظاهرة تعكس آخر عدد صفحات معتمد في المكتبة.' : 'قد يتحدث العدد بعد استلام الطلب داخل المكتبة.'}</span>
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
