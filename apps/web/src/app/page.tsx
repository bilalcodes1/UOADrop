'use client';

import { useState, useCallback, useRef } from 'react';
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

export default function UploadPage() {
  const [state, setState] = useState<PageState>('form');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState(0);
  const [success, setSuccess] = useState<SuccessInfo | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((incoming: File[]) => {
    const valid = incoming.filter(f => ALLOWED_TYPES.includes(f.type));
    const invalid = incoming.length - valid.length;
    if (invalid > 0) {
      setError(`${invalid} ملف غير مدعوم. المسموح فقط: PDF, DOCX, PPTX, XLSX, JPG, PNG`);
    } else {
      setError('');
    }
    setFiles(prev => [
      ...prev,
      ...valid.map(f => ({
        id: crypto.randomUUID(),
        file: f,
        settings: { ...DEFAULT_SETTINGS },
        expanded: false,
      })),
    ]);
  }, []);

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

    setState('uploading');
    setProgress(0);
    setCurrentFile(0);

    try {
      const ticket = generateTicket();
      const pin = generatePin();
      const pinHash = await hashPin(pin);

      const { data: req, error: reqErr } = await supabase
        .from('print_requests')
        .insert({
          ticket,
          student_name: name.trim(),
          student_email: email.trim() || null,
          pickup_pin_hash: pinHash,
          status: 'pending',
          source: 'online',
        })
        .select('id')
        .single();

      if (reqErr) throw reqErr;

      for (let i = 0; i < files.length; i++) {
        setCurrentFile(i + 1);
        const entry = files[i]!;
        const storagePath = `${req.id}/${Date.now()}-${entry.file.name}`;

        const { error: uploadErr } = await supabase.storage
          .from('print-files')
          .upload(storagePath, entry.file, { upsert: false });

        if (uploadErr) throw uploadErr;

        const { error: fileErr } = await supabase.from('request_files').insert({
          request_id: req.id,
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

      setSuccess({ ticket, pin });
      setState('success');
    } catch (err) {
      console.error(err);
      setError('حدث خطأ أثناء الرفع. تحقق من اتصالك بالإنترنت وحاول مجدداً.');
      setState('form');
    }
  };

  const resetForm = () => {
    setState('form');
    setName('');
    setEmail('');
    setFiles([]);
    setSuccess(null);
    setError('');
    setProgress(0);
  };

  if (state === 'success' && success) {
    return <SuccessScreen ticket={success.ticket} pin={success.pin} onNew={resetForm} />;
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <h1 className={styles.logo}>UOADrop</h1>
          <p className={styles.subtitle}>رفع ملفات الطباعة — مكتبة كلية علوم الحاسوب · جامعة الأنبار</p>
        </div>
      </header>

      <main className={styles.main}>
        {state === 'uploading' ? (
          <UploadingScreen progress={progress} current={currentFile} total={files.length} />
        ) : (
          <>
            <section className={styles.card}>
              <h2 className={styles.sectionTitle}>معلومات الطالب</h2>
              <div className={styles.field}>
                <label className={styles.label}>
                  الاسم الكامل <span className={styles.required}>*</span>
                </label>
                <input
                  className={styles.input}
                  type="text"
                  placeholder="مثال: أحمد محمد علي"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  autoComplete="name"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>
                  البريد الإلكتروني{' '}
                  <span className={styles.optional}>(اختياري — للإشعارات)</span>
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
            </section>

            <section className={styles.card}>
              <h2 className={styles.sectionTitle}>الملفات</h2>

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
                <span className={styles.dropzoneIcon}>📎</span>
                <p className={styles.dropzoneText}>اسحب الملفات هنا أو انقر للاختيار</p>
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
            </section>

            {error && <p className={styles.error}>{error}</p>}

            <button
              className={styles.submitBtn}
              onClick={handleSubmit}
              disabled={!name.trim() || files.length === 0}
            >
              إرسال الطلب
            </button>
          </>
        )}
      </main>
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

function SuccessScreen({
  ticket,
  pin,
  onNew,
}: {
  ticket: string;
  pin: string;
  onNew: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyTicket = async () => {
    await navigator.clipboard.writeText(ticket);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <h1 className={styles.logo}>UOADrop</h1>
          <p className={styles.subtitle}>رفع ملفات الطباعة — مكتبة كلية علوم الحاسوب · جامعة الأنبار</p>
        </div>
      </header>
      <main className={styles.main}>
        <div className={styles.successCard}>
          <span className={styles.successIcon}>✅</span>
          <h2 className={styles.successTitle}>تم استلام طلبك بنجاح!</h2>
          <p className={styles.successSubtitle}>
            احتفظ برقم التذكرة والـ PIN — ستحتاجهما عند استلام طباعتك من المكتبة
          </p>

          <div className={styles.ticketBox}>
            <span className={styles.ticketLabel}>رقم التذكرة</span>
            <span className={styles.ticketCode}>{ticket}</span>
            <button className={styles.copyBtn} onClick={copyTicket}>
              {copied ? '✓ تم النسخ' : 'نسخ الرقم'}
            </button>
          </div>

          <div className={styles.pinBox}>
            <span className={styles.pinLabel}>رمز PIN للاستلام</span>
            <span className={styles.pinCode}>{pin}</span>
            <p className={styles.pinNote}>
              أبقِ هذا الرمز سرياً — ستُطلب منك إدخاله عند استلام طباعتك
            </p>
          </div>

          <button className={styles.newRequestBtn} onClick={onNew}>
            إرسال طلب جديد
          </button>
        </div>
      </main>
    </div>
  );
}
