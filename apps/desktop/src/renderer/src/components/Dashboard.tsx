import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, type SupabaseRequestRow, type OnlineEntry, type SupabaseFileRow } from '../lib/supabase';
import uoadropLogo from './icons/uoadrop-logo.png';
import universityOfAnbarLogo from './icons/university-of-anbar.svg';
import csCollegeLogo from './icons/cs-college.svg';
import type { PrintRequest, PrinterStatus, RequestFile, RequestStatus } from '@uoadrop/shared';

const PRINTER_LABEL: Record<PrinterStatus, string> = {
  ready: 'جاهزة',
  printing: 'تطبع',
  paused: 'متوقفة',
  offline: 'غير متصلة',
  error: 'خطأ',
  'out-of-paper': 'نفاد ورق',
  'out-of-toner': 'نفاد حبر',
  'paper-jam': 'انحشار ورق',
  unknown: 'غير معروف',
};

const STATUS_LABEL: Record<RequestStatus, string> = {
  pending: 'قيد الانتظار',
  printing: 'يطبع الآن',
  ready: 'جاهز للاستلام',
  done: 'تم التسليم',
  canceled: 'ملغي',
  blocked: 'محظور',
};

const STATUS_COLOR: Record<RequestStatus, string> = {
  pending: 'badge-pending',
  printing: 'badge-printing',
  ready: 'badge-ready',
  done: 'badge-done',
  canceled: 'badge-canceled',
  blocked: 'badge-blocked',
};

const PAGE_SIZE = 24;
const DEFAULT_REQUEST_STATUSES: RequestStatus[] = ['pending', 'printing', 'done', 'canceled', 'blocked'];
const STATUS_FILTERS: Array<{ key: 'all' | RequestStatus; label: string }> = [
  { key: 'all', label: 'الطلبات' },
  { key: 'ready', label: 'جاهز' },
];

const DATE_FORMATTER = new Intl.DateTimeFormat('ar-IQ', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

function formatMoney(value: number): string {
  if (value <= 0) return 'قيد الحساب';
  return `${value.toLocaleString('ar-IQ')} د.ع`;
}

function formatStamp(value: string): string {
  return DATE_FORMATTER.format(new Date(value));
}

function formatPages(value: number): string {
  if (value <= 0) return 'قيد الحساب';
  return `${value.toLocaleString('ar-IQ')} صفحة`;
}

type FileOptionDraft = {
  copies: string;
  color: 'true' | 'false';
  doubleSided: 'true' | 'false';
};

function createFileOptionDraft(file: RequestFile): FileOptionDraft {
  return {
    copies: String(file.options.copies),
    color: file.options.color ? 'true' : 'false',
    doubleSided: file.options.doubleSided ? 'true' : 'false',
  };
}

function normalizeFileOptionDraft(file: RequestFile, draft?: FileOptionDraft): RequestFile['options'] {
  const copies = Number(draft?.copies ?? file.options.copies);
  return {
    ...file.options,
    copies: Number.isFinite(copies) ? Math.max(1, Math.min(10, Math.floor(copies))) : file.options.copies,
    color: (draft?.color ?? (file.options.color ? 'true' : 'false')) === 'true',
    doubleSided: (draft?.doubleSided ?? (file.options.doubleSided ? 'true' : 'false')) === 'true',
  };
}

function normalizeSearchValue(value?: string | null): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/\s+/g, ' ');
}

function matchesLiveSearch(req: PrintRequest, query: string): boolean {
  if (!query) return true;
  const ticket = normalizeSearchValue(req.ticket);
  const studentName = normalizeSearchValue(req.studentName);
  return ticket.includes(query) || studentName.includes(query);
}

function projectSearchText(value: string): { normalized: string; indexMap: number[] } {
  const normalizedChars: string[] = [];
  const indexMap: number[] = [];

  for (let i = 0; i < value.length; i += 1) {
    const char = value.charAt(i);
    let normalizedChar = char.toLowerCase();
    if (/[٠-٩]/.test(char)) normalizedChar = String('٠١٢٣٤٥٦٧٨٩'.indexOf(char));
    else if (/[۰-۹]/.test(char)) normalizedChar = String('۰۱۲۳۴۵۶۷۸۹'.indexOf(char));
    else if (/\s/.test(char)) normalizedChar = ' ';
    normalizedChars.push(normalizedChar);
    indexMap.push(i);
  }

  return { normalized: normalizedChars.join(''), indexMap };
}

function renderHighlightedText(value: string, query: string): JSX.Element | string {
  if (!query) return value;
  const { normalized, indexMap } = projectSearchText(value);
  const start = normalized.indexOf(query);
  if (start === -1) return value;

  const end = start + query.length - 1;
  const startIndex = indexMap[start] ?? 0;
  const endIndex = (indexMap[end] ?? value.length - 1) + 1;

  return (
    <>
      {value.slice(0, startIndex)}
      <mark className="search-highlight">{value.slice(startIndex, endIndex)}</mark>
      {value.slice(endIndex)}
    </>
  );
}

function containsEnglish(value?: string | null): boolean {
  return Boolean(value && /[A-Za-z]/.test(value));
}

function getArabicPrintIssue(error?: string | null, hint?: string | null): string {
  if (hint && !containsEnglish(hint)) return hint;

  switch (error) {
    case 'NO_PRINTERS_CONFIGURED':
      return 'لا توجد طابعات مضافة إلى النظام';
    case 'canceled':
    case 'cancelled':
      return 'تم إلغاء الطباعة';
    case 'ENOENT':
      return 'تعذر العثور على الملف المطلوب للطباعة';
    default:
      return 'تعذر تنفيذ الطباعة حالياً';
  }
}

type IconProps = { className?: string };

function SearchIcon({ className }: IconProps): JSX.Element {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowUpRightIcon({ className }: IconProps): JSX.Element {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 17L17 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 7h8v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EyeIcon({ className }: IconProps): JSX.Element {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function PrintIcon({ className }: IconProps): JSX.Element {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 9V3h10v6M7 17h10v4H7v-4zm-2-8h14a3 3 0 013 3v3h-4m-12 0H2v-3a3 3 0 013-3z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon({ className }: IconProps): JSX.Element {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 6L9 17l-5-5"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon({ className }: IconProps): JSX.Element {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 7h16m-10 4v6m4-6v6M9 4h6l1 3H8l1-3zm1 16h4a2 2 0 002-2V7H8v11a2 2 0 002 2z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AttachmentIcon({ className }: IconProps): JSX.Element {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21.44 11.05l-8.49 8.49a6 6 0 11-8.49-8.49l8.49-8.48a4 4 0 115.66 5.65l-8.49 8.49a2 2 0 11-2.83-2.83l7.78-7.78"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PosterIcon({ className }: IconProps): JSX.Element {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 3h10a2 2 0 012 2v14l-3-2-4 3-4-3-3 2V5a2 2 0 012-2z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9 8h6M9 12h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function InstagramIcon({ className }: IconProps): JSX.Element {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" />
    </svg>
  );
}

function TelegramIcon({ className }: IconProps): JSX.Element {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21 5L11 14.2m10-9.2l-14.5 5.6c-.9.35-.88 1.64.04 1.95l3.63 1.23c.31.1.65.05.9-.15L18.3 8.6c.18-.13.4.12.24.28l-5.67 5.64a1 1 0 00-.28.82l.42 3.09c.13.95 1.34 1.12 1.72.24L21 5z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MailIcon({ className }: IconProps): JSX.Element {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 6h16a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M3 8l9 6 9-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EmptyStateIllustration({ className }: IconProps): JSX.Element {
  return (
    <svg className={className} viewBox="0 0 220 160" fill="none" aria-hidden="true">
      <rect x="28" y="34" width="164" height="98" rx="24" fill="#EEF2FF" />
      <rect x="53" y="20" width="88" height="108" rx="18" fill="#FFFFFF" stroke="#C7D2FE" strokeWidth="2" />
      <rect x="78" y="40" width="66" height="84" rx="16" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="2" />
      <rect x="91" y="58" width="40" height="8" rx="4" fill="#A5B4FC" />
      <rect x="91" y="76" width="52" height="8" rx="4" fill="#CBD5E1" />
      <rect x="91" y="94" width="33" height="8" rx="4" fill="#CBD5E1" />
      <path d="M148 71h20l14 14v30a12 12 0 01-12 12h-22a12 12 0 01-12-12V83a12 12 0 0112-12z" fill="#FFFFFF" stroke="#A5B4FC" strokeWidth="2" />
      <path d="M168 71v12a6 6 0 006 6h8" stroke="#A5B4FC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="159" cy="108" r="6" fill="#4F46E5" fillOpacity="0.14" />
      <circle cx="46" cy="52" r="8" fill="#4F46E5" fillOpacity="0.14" />
      <circle cx="181" cy="42" r="5" fill="#22C55E" fillOpacity="0.2" />
    </svg>
  );
}

function CloseIcon({ className }: IconProps): JSX.Element {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SpinnerIcon({ className }: IconProps): JSX.Element {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 4a8 8 0 108 8"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Dashboard(): JSX.Element {
  const [requests, setRequests] = useState<PrintRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'requests' | 'about'>('requests');
  const [filter, setFilter] = useState<'all' | RequestStatus>('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [printer, setPrinter] = useState<{
    status: PrinterStatus;
    printerName: string | null;
  }>({ status: 'unknown', printerName: null });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [fileCounts, setFileCounts] = useState<Record<string, number>>({});
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [filesPanel, setFilesPanel] = useState<{ request: PrintRequest; files: RequestFile[] } | null>(null);
  const [fileOptionDrafts, setFileOptionDrafts] = useState<Record<string, FileOptionDraft>>({});
  const [fileOptionBusy, setFileOptionBusy] = useState<string | null>(null);
  const [onlineQueue, setOnlineQueue] = useState<OnlineEntry[]>([]);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshTokenRef = useRef(0);

  const normalizedSearchInput = normalizeSearchValue(searchInput);
  const isSearchPending = normalizedSearchInput !== search;
  const isSearchMode = searchFocused || searchInput.length > 0;
  const liveVisibleCount = requests.filter((req) => matchesLiveSearch(req, normalizedSearchInput)).length;

  const showToast = useCallback((msg: string): void => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const updateStatus = (id: string, status: RequestStatus): void => {
    setRequests((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, status, updatedAt: new Date().toISOString() } : r,
      ),
    );
  };

  const updatePrice = (id: string, priceIqd: number): void => {
    setRequests((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, priceIqd, updatedAt: new Date().toISOString() } : r,
      ),
    );
  };

  const updateRequestSnapshot = (request: PrintRequest): void => {
    setRequests((prev) => prev.map((r) => (r.id === request.id ? request : r)));
  };

  const refresh = useCallback(async (): Promise<void> => {
    const requestToken = ++refreshTokenRef.current;
    setListLoading(true);
    const statuses = filter === 'all' ? DEFAULT_REQUEST_STATUSES : [filter];
    try {
      const res = await window.api.listRequestsPaged({
        statuses,
        search: search || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      if (requestToken !== refreshTokenRef.current) return;
      setRequests(res.items);
      setTotal(res.total);
    } finally {
      if (requestToken === refreshTokenRef.current) {
        setListLoading(false);
      }
    }
  }, [filter, search, page]);

  // Always-fresh ref so WS callbacks never hold a stale closure
  const refreshRef = useRef(refresh);
  useEffect(() => { refreshRef.current = refresh; }, [refresh]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSearch((prev) => (prev === normalizedSearchInput ? prev : normalizedSearchInput));
    }, 220);

    return () => window.clearTimeout(timeoutId);
  }, [normalizedSearchInput]);

  useEffect(() => {
    setPage(0);
  }, [filter, search]);

  useEffect(() => {
    void refreshRef.current();
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refreshRef.current(), 30_000);
    return () => clearInterval(id);
  }, [filter, search, page]);

  // ── Helper: download files + produce OnlineEntry ──
  const processOnlineRequest = useCallback(async (row: SupabaseRequestRow): Promise<OnlineEntry> => {
    const { data: files } = await supabase
      .from('request_files')
      .select('*')
      .eq('request_id', row.id);

    const localFiles: OnlineEntry['localFiles'] = [];
    for (const f of (files ?? []) as SupabaseFileRow[]) {
      const { data: urlData } = await supabase.storage
        .from('print-files')
        .createSignedUrl(f.storage_path, 60 * 60 * 24 * 7);
      if (urlData?.signedUrl) {
        try {
          const localPath = await window.api.downloadOnlineFile(urlData.signedUrl, f.filename);
          localFiles.push({ filename: f.filename, localPath, copies: f.copies, color: f.color });
        } catch { /* skip failed file */ }
      }
    }
    await supabase.from('print_requests').update({ status: 'received' }).eq('id', row.id);
    return { ...row, localFiles };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Supabase catch-up: fetch + download + auto-delete on startup ──
  useEffect(() => {
    supabase
      .from('print_requests')
      .select('*')
      .eq('source', 'online')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .then(async ({ data }) => {
        if (!data || data.length === 0) return;
        showToast(`${data.length} طلب أونلاين جديد — جارٍ التحميل...`);
        const entries = await Promise.all((data as SupabaseRequestRow[]).map(processOnlineRequest));
        const valid = entries.filter((e) => e.localFiles.length > 0);
        setOnlineQueue(valid);
        if (valid.length > 0) showToast(`${valid.length} طلب أونلاين جاهز للطباعة`);
      });
  }, [processOnlineRequest]);

  // ── Supabase Realtime — online requests ──
  useEffect(() => {
    const channel = supabase
      .channel('online-requests')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'print_requests' },
        async (payload) => {
          const row = payload.new as SupabaseRequestRow;
          if (row.source !== 'online') return;
          if (onlineQueue.some((r) => r.id === row.id)) return;
          showToast(`طلب أونلاين جديد — ${row.ticket} — جارٍ التحميل...`);
          const entry = await processOnlineRequest(row);
          setOnlineQueue((prev) => {
            if (prev.some((r) => r.id === entry.id)) return prev;
            return [entry, ...prev];
          });
          showToast(`طلب ${entry.ticket} جاهز للطباعة`);
        },
      )
      .subscribe((status, err) => {
        console.log('[Realtime] status:', status, err ?? '');
      });
    return () => { void supabase.removeChannel(channel); };
  }, [processOnlineRequest]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Real-time updates via direct Electron IPC (zero network hop) ──
  useEffect(() => {
    const unsub = window.api.onRequestsChanged((ev) => {
      if (ev.reason === 'created' && ev.payload) {
        setRequests((prev) => {
          if (prev.some((r) => r.id === ev.payload!.id)) return prev;
          return [ev.payload!, ...prev];
        });
        setTotal((t) => t + 1);
      }
      if (ev.reason === 'file-added' && ev.requestId) {
        setFileCounts((prev) => ({
          ...prev,
          [ev.requestId!]: (prev[ev.requestId!] ?? 0) + 1,
        }));
        if (ev.payload) updateRequestSnapshot(ev.payload);
        showToast('ملف جديد — جاهز للطباعة');
      }
      void refreshRef.current();
    });
    return unsub;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    window.api.printerStatus().then((p) =>
      setPrinter({ status: p.status, printerName: p.printerName }),
    );
    const unsub = window.api.onPrinterStatusUpdate((p) => {
      setPrinter({ status: p.status, printerName: p.printerName });
      if (p.status === 'offline' || p.status === 'error') {
        showToast(`تنبيه طابعة: ${PRINTER_LABEL[p.status]}`);
      }
    });
    return () => unsub();
  }, []);

  const getDraftPriceValue = (req: PrintRequest): string =>
    priceDrafts[req.id] ?? (req.priceIqd > 0 ? String(req.priceIqd) : '');

  const openFilesPanel = (request: PrintRequest, files: RequestFile[]): void => {
    setFilesPanel({ request, files });
    setFileOptionDrafts(Object.fromEntries(files.map((file) => [file.id, createFileOptionDraft(file)])));
  };

  const refreshFilesPanel = async (request: PrintRequest): Promise<void> => {
    const res = await window.api.listRequestFiles(request.id);
    openFilesPanel(request, res.items);
  };

  const getFileDraft = (file: RequestFile): FileOptionDraft => fileOptionDrafts[file.id] ?? createFileOptionDraft(file);

  const updateFileDraft = (file: RequestFile, patch: Partial<FileOptionDraft>): void => {
    setFileOptionDrafts((prev) => ({
      ...prev,
      [file.id]: {
        ...(prev[file.id] ?? createFileOptionDraft(file)),
        ...patch,
      },
    }));
  };

  const handleOpenSingleFile = async (file: RequestFile): Promise<void> => {
    if (!file.localPath) {
      showToast('هذا الملف لا يملك مساراً محلياً حالياً');
      return;
    }
    const res = await window.api.openFile(file.localPath);
    if (!res.ok) {
      showToast('تعذر فتح الملف المطلوب');
      return;
    }
    showToast(`تم فتح الملف ${file.filename}`);
  };

  const handleSaveFileOptions = async (request: PrintRequest, file: RequestFile): Promise<void> => {
    setFileOptionBusy(file.id);
    try {
      await window.api.setRequestFileOptions(file.id, normalizeFileOptionDraft(file, getFileDraft(file)));
      await refreshFilesPanel(request);
      showToast(`تم حفظ إعدادات الملف ${file.filename}`);
    } finally {
      setFileOptionBusy(null);
    }
  };

  const canMoveToReady = (req: PrintRequest): boolean => {
    const value = Number(getDraftPriceValue(req).trim());
    return req.status === 'printing' && Number.isFinite(value) && value > 0;
  };

  const saveManualPrice = async (
    req: PrintRequest,
    options?: { silent?: boolean; overrideValue?: number },
  ): Promise<number | null> => {
    const nextPrice = options?.overrideValue ?? Number(getDraftPriceValue(req).trim());
    if (!Number.isFinite(nextPrice) || nextPrice <= 0) {
      if (!options?.silent) showToast('حدد السعر يدوياً أولاً بمبلغ صحيح');
      return null;
    }
    setBusy(req.id);
    try {
      await window.api.setRequestPrice(req.id, Math.floor(nextPrice));
      updatePrice(req.id, Math.floor(nextPrice));
      setPriceDrafts((prev) => {
        const next = { ...prev };
        delete next[req.id];
        return next;
      });
      if (!options?.silent) {
        showToast(`تم حفظ سعر الطلب ${req.ticket}`);
      }
      return Math.floor(nextPrice);
    } finally {
      setBusy(null);
    }
  };

  const handleView = async (req: PrintRequest): Promise<void> => {
    setBusy(req.id);
    try {
      const res = await window.api.listRequestFiles(req.id);
      if (res.items.length === 0) {
        showToast(`لا توجد ملفات مرتبطة بالطلب ${req.ticket} بعد`);
        return;
      }
      openFilesPanel(req, res.items);
    } finally {
      setBusy(null);
    }
  };

  const handlePrint = async (req: PrintRequest): Promise<void> => {
    setBusy(req.id);
    const listing = await window.api.listRequestFiles(req.id);
    if (listing.items.length === 0) {
      showToast(`لا توجد ملفات مرفقة بالطلب ${req.ticket}`);
      setBusy(null);
      return;
    }

    let anyOk = false;
    let lastHint: string | undefined;
    let lastError: string | undefined;
    for (const f of listing.items) {
      if (!f.localPath) continue;
      const printRes = await window.api.printFile(f.localPath);
      if (printRes.ok) {
        anyOk = true;
        lastHint = printRes.hint ?? lastHint;
      } else {
        lastError = printRes.error ?? lastError;
        lastHint = printRes.hint ?? lastHint;
        // User cancelled — do not open further dialogs for remaining files.
        if (printRes.error === 'canceled' || printRes.error === 'cancelled') break;
      }
    }

    if (anyOk) {
      await window.api.setRequestStatus(req.id, 'printing');
      updateStatus(req.id, 'printing');
      showToast(!lastHint || containsEnglish(lastHint) ? `بدأت طباعة الطلب ${req.ticket}` : lastHint);
    } else if (lastError === 'NO_PRINTERS_CONFIGURED') {
      showToast('فشل الطباعة: لا توجد طابعات مضافة إلى النظام');
    } else {
      const issue = getArabicPrintIssue(lastError, lastHint);
      showToast(issue === 'تم إلغاء الطباعة' ? issue : `فشل الطباعة: ${issue}`);
    }
    setBusy(null);
  };

  const handleReady = async (
    req: PrintRequest,
    options?: { switchToReadyView?: boolean; silent?: boolean },
  ): Promise<void> => {
    const draftPrice = getDraftPriceValue(req).trim();
    const hasDraftPrice = draftPrice.length > 0;
    const parsedDraftPrice = Number(draftPrice);
    const finalPrice = hasDraftPrice ? parsedDraftPrice : req.priceIqd;
    if (!Number.isFinite(finalPrice) || finalPrice <= 0) {
      showToast('قبل الجاهز لازم تحدد السعر اليدوي وتحفظه');
      return;
    }
    if (Math.floor(finalPrice) !== req.priceIqd) {
      const saved = await saveManualPrice(req, { silent: true, overrideValue: finalPrice });
      if (!saved) return;
    }

    setBusy(req.id);
    try {
      await window.api.setRequestStatus(req.id, 'ready');
      updateStatus(req.id, 'ready');
      setSelectedIds((prev) => {
        if (!prev.has(req.id)) return prev;
        const next = new Set(prev);
        next.delete(req.id);
        return next;
      });
      if (options?.switchToReadyView ?? true) {
        moveToReadyView();
      }
      if (!options?.silent) {
        showToast(`الطلب ${req.ticket} أصبح جاهزاً — أُرسل الإشعار للطالب`);
      }
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (req: PrintRequest): Promise<void> => {
    const confirmed = window.confirm(
      `حذف الطلب ${req.ticket} وكل ملفاته؟ لا يمكن التراجع.`,
    );
    if (!confirmed) return;
    setBusy(req.id);
    try {
      await window.api.deleteRequest(req.id);
      await refresh();
      showToast(`تم حذف الطلب ${req.ticket}`);
    } finally {
      setBusy(null);
    }
  };

  const toggleSelect = (id: string): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allSelected = requests.length > 0 && requests.every((r) => selectedIds.has(r.id));
  const toggleSelectAll = (): void => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(requests.map((r) => r.id)));
  };

  const applySearchNow = (): void => {
    setSearch(normalizedSearchInput);
    setPage(0);
  };

  const clearSearch = (): void => {
    setSearchInput('');
    setSearch('');
    setPage(0);
  };

  const moveToReadyView = (): void => {
    setFilter('ready');
    setPage(0);
  };

  const handleBulkPrint = async (): Promise<void> => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBulkBusy(true);
    for (const id of ids) {
      const req = requests.find((r) => r.id === id);
      if (!req || req.status === 'done' || req.status === 'canceled') continue;
      await handlePrint(req);
    }
    setBulkBusy(false);
    setSelectedIds(new Set());
  };

  const handleBulkReady = async (): Promise<void> => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBulkBusy(true);
    let readyCount = 0;
    try {
      for (const id of ids) {
        const req = requests.find((r) => r.id === id);
        if (!req || !canMoveToReady(req)) continue;
        await handleReady(req, { switchToReadyView: false, silent: true });
        readyCount += 1;
      }
      if (readyCount > 0) {
        moveToReadyView();
        showToast(`تم نقل ${readyCount.toLocaleString('ar-IQ')} طلبات إلى قسم الجاهز`);
      }
    } finally {
      setBulkBusy(false);
      setSelectedIds(new Set());
    }
  };

  const handleBulkDelete = async (): Promise<void> => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    if (!window.confirm(`حذف ${ids.length} طلبات؟ لا يمكن التراجع.`)) return;
    setBulkBusy(true);
    for (const id of ids) {
      await window.api.deleteRequest(id).catch(() => {});
    }
    await refresh();
    showToast(`تم حذف ${ids.length} طلبات`);
    setBulkBusy(false);
    setSelectedIds(new Set());
  };

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const visibleRevenue = requests.reduce((sum, req) => sum + req.priceIqd, 0);
  const metrics = [
    {
      label: 'إجمالي الطلبات',
      value: total.toLocaleString('ar-IQ'),
      hint: `${requests.length.toLocaleString('ar-IQ')} ظاهرة في الصفحة الحالية`,
    },
    {
      label: 'القيمة الظاهرة',
      value: formatMoney(visibleRevenue),
      hint: `${selectedIds.size.toLocaleString('ar-IQ')} محدد للإجراءات الجماعية`,
    },
  ];

  const contactLinks = [
    {
      label: 'Instagram',
      value: '@bilalcodes1',
      href: 'https://instagram.com/bilalcodes1',
      icon: <InstagramIcon className="credit-link-icon" />,
    },
    {
      label: 'Telegram',
      value: '@bilalcodes1',
      href: 'https://t.me/bilalcodes1',
      icon: <TelegramIcon className="credit-link-icon" />,
    },
    {
      label: 'Email',
      value: 'bil24c1055@uoanbar.edu.iq',
      href: 'mailto:bil24c1055@uoanbar.edu.iq',
      icon: <MailIcon className="credit-link-icon" />,
    },
  ];

  return (
    <div className="dashboard">
      <header className="header">
        <div className="header-top">
          <div className="brand-logos">
            <div className="logo-shell logo-shell-brand">
              <span className="logo-badge">UOADrop</span>
              <div className="logo-frame">
                <img src={uoadropLogo} alt="UOADrop" className="brand-logo" />
              </div>
              <span className="logo-title">نظام إدارة الطباعة</span>
            </div>
          </div>

          <div className="brand-copy">
            <span className="brand-kicker">مركز إدارة الطباعة</span>
            <h1>لوحة إدارة الطباعة</h1>
            <p className="subtitle">
              مركز متابعة الطلبات، وحالة الطابعة، والتنفيذ الفوري داخل مكتبة كلية علوم الحاسوب وتكنولوجيا المعلومات.
            </p>
          </div>

          <div className={`printer-panel printer-panel-${printer.status}`}>
            <div className={`printer-indicator printer-${printer.status}`}>
              <span className="dot" />
            </div>
            <div className="printer-copy">
              <span className="printer-caption">حالة الطابعة</span>
              <strong>
                {PRINTER_LABEL[printer.status]}
                {printer.printerName ? ` • ${printer.printerName}` : ''}
              </strong>
            </div>
          </div>

          <button
            className="hero-action"
            onClick={() => window.open('http://localhost:3737/wall-sign', '_blank')}
          >
            <PosterIcon className="hero-action-icon" />
            <span>طباعة ملصق الحائط</span>
          </button>
        </div>

        <div className="hero-metrics">
          {metrics.map((metric) => (
            <section key={metric.label} className="metric-card">
              <span className="metric-label">{metric.label}</span>
              <strong className="metric-value">{metric.value}</strong>
              <span className="metric-hint">{metric.hint}</span>
            </section>
          ))}
        </div>
      </header>

      <div className="dashboard-tabs" role="tablist" aria-label="تبويبات الدشبورد">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'requests'}
          className={`dashboard-tab ${activeTab === 'requests' ? 'dashboard-tab-active' : ''}`}
          onClick={() => setActiveTab('requests')}
        >
          <span className="dashboard-tab-title">الطلبات</span>
          <span className="dashboard-tab-meta">{liveVisibleCount.toLocaleString('ar-IQ')} ظاهرة</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'about'}
          className={`dashboard-tab ${activeTab === 'about' ? 'dashboard-tab-active' : ''}`}
          onClick={() => setActiveTab('about')}
        >
          <span className="dashboard-tab-title">معلومات المشروع</span>
          <span className="dashboard-tab-meta">المطور والمشرف والتواصل</span>
        </button>
      </div>

      {activeTab === 'requests' && onlineQueue.length > 0 && (
        <div className="online-queue-strip">
          <div className="online-queue-header">
            <span className="online-queue-dot" />
            <span className="online-queue-title">طلبات أونلاين جديدة</span>
            <span className="online-queue-count">{onlineQueue.length}</span>
            <button
              className="online-queue-clear"
              onClick={() => setOnlineQueue([])}
              aria-label="مسح القائمة"
            >
              مسح
            </button>
          </div>
          <ul className="online-queue-list">
            {onlineQueue.map((entry) => (
              <li key={entry.id} className="online-queue-item">
                <span className="online-queue-ticket">{entry.ticket}</span>
                <span className="online-queue-name">{entry.student_name ?? 'طالب'}</span>
                <span className="online-queue-time">
                  {new Date(entry.created_at).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <div className="online-queue-files">
                  {entry.localFiles.map((f) => (
                    <span key={f.localPath} className="online-queue-file">
                      <span className="online-queue-filename">{f.filename}</span>
                      <button
                        className="online-queue-btn"
                        onClick={() => void window.api.openFile(f.localPath)}
                      >فتح</button>
                      <button
                        className="online-queue-btn online-queue-btn--print"
                        onClick={() => void window.api.printFile(f.localPath)}
                      >طباعة</button>
                    </span>
                  ))}
                  {entry.localFiles.length === 0 && (
                    <span className="online-queue-no-files">لا توجد ملفات</span>
                  )}
                </div>
                <button
                  className="online-queue-dismiss"
                  onClick={() => setOnlineQueue((prev) => prev.filter((r) => r.id !== entry.id))}
                >✕</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {activeTab === 'about' ? (
        <section className="dashboard-credits">
          <div className="dashboard-credits-main">
            <div className="dashboard-credits-copy">
              <span className="dashboard-credits-kicker">اعتمادات المشروع</span>
              <h2>معلومات المشروع والجهة الأكاديمية الداعمة</h2>
              <p>
                تم تطوير <span className="dashboard-inline-emphasis">UOADrop</span> ليكون واجهة طباعة أكثر وضوحاً وتنظيماً داخل <span className="dashboard-inline-emphasis">مكتبة كلية علوم الحاسوب وتكنولوجيا المعلومات</span> في <span className="dashboard-inline-emphasis">جامعة الأنبار</span>، مع تجربة بصرية حديثة تسهّل العمل على الطلبة والإدارة معاً.
              </p>
            </div>

            <div className="dashboard-institutions" aria-label="الجهة الأكاديمية">
              <article className="dashboard-institution-card">
                <div className="dashboard-institution-logo">
                  <img src={universityOfAnbarLogo} alt="جامعة الأنبار" />
                </div>
                <div className="dashboard-institution-copy">
                  <span className="dashboard-institution-label">الجامعة</span>
                  <strong>جامعة الأنبار</strong>
                  <p>الجهة الأكاديمية الحاضنة للمشروع والداعمة لتطوير تجربة الطباعة داخل المكتبة.</p>
                </div>
              </article>

              <article className="dashboard-institution-card">
                <div className="dashboard-institution-logo">
                  <img src={csCollegeLogo} alt="كلية علوم الحاسوب" />
                </div>
                <div className="dashboard-institution-copy">
                  <span className="dashboard-institution-label">الكلية</span>
                  <strong>كلية علوم الحاسوب وتكنولوجيا المعلومات</strong>
                  <p>بيئة التطبيق المباشرة التي يستهدفها النظام لخدمة رفع الملفات والطباعة بسرعة ووضوح.</p>
                </div>
              </article>
            </div>

            <div className="dashboard-credits-grid">
              <article className="dashboard-credit-card">
                <span className="dashboard-credit-label">العميد</span>
                <strong>أ.د. صلاح عواد سلمان</strong>
                <p>
                  عميد <span className="dashboard-inline-emphasis">كلية علوم الحاسوب وتكنولوجيا المعلومات</span>، وتأتي الإشارة إليه هنا بوصفه جزءاً من البيئة الأكاديمية الداعمة للمشروع داخل <span className="dashboard-inline-emphasis">جامعة الأنبار</span>.
                </p>
                <a className="dashboard-credit-action" href="https://www.uoanbar.edu.iq/staff-page.php?ID=1614" target="_blank" rel="noreferrer">
                  <span>الصفحة الرسمية</span>
                  <ArrowUpRightIcon className="dashboard-credit-action-icon" />
                </a>
              </article>

              <article className="dashboard-credit-card">
                <span className="dashboard-credit-label">رئيس القسم</span>
                <strong>د. عصام طه ياسين حسين الهيتي</strong>
                <p>
                  يُذكر <span className="dashboard-inline-emphasis">د. عصام طه ياسين حسين الهيتي</span> هنا بصفته <span className="dashboard-inline-emphasis">رئيس القسم</span> ضمن البنية الأكاديمية الداعمة لبيئة المشروع في <span className="dashboard-inline-emphasis">كلية علوم الحاسوب وتكنولوجيا المعلومات</span>.
                </p>
                <a className="dashboard-credit-action" href="https://www.uoanbar.edu.iq/staff-page.php?ID=1673" target="_blank" rel="noreferrer">
                  <span>الصفحة الرسمية</span>
                  <ArrowUpRightIcon className="dashboard-credit-action-icon" />
                </a>
              </article>

              <article className="dashboard-credit-card">
                <span className="dashboard-credit-label">الإشراف</span>
                <strong>د. رقية أياد عبد الجبار عبيد العاني</strong>
                <p>
                  أشرفت <span className="dashboard-inline-emphasis">د. رقية أياد عبد الجبار عبيد العاني</span> على الجوانب الأكاديمية والتنظيمية للمشروع لضمان انسجامه مع احتياج المكتبة وسهولة استخدامه للطلبة.
                </p>
                <a className="dashboard-credit-action" href="https://www.uoanbar.edu.iq/staff-page.php?ID=1626" target="_blank" rel="noreferrer">
                  <span>الصفحة الرسمية</span>
                  <ArrowUpRightIcon className="dashboard-credit-action-icon" />
                </a>
              </article>

              <article className="dashboard-credit-card">
                <span className="dashboard-credit-label">المشرفة الثانية</span>
                <strong>د. مكارم عبدالواحد عبدالجبار التركي</strong>
                <p>
                  تُذكر <span className="dashboard-inline-emphasis">د. مكارم عبدالواحد عبدالجبار التركي</span> ضمن الإطار الأكاديمي المساند للمشروع بوصفها من الكادر التدريسي في <span className="dashboard-inline-emphasis">كلية علوم الحاسوب وتكنولوجيا المعلومات</span>.
                </p>
                <a className="dashboard-credit-action" href="https://www.uoanbar.edu.iq/staff-page.php?ID=1651" target="_blank" rel="noreferrer">
                  <span>الصفحة الرسمية</span>
                  <ArrowUpRightIcon className="dashboard-credit-action-icon" />
                </a>
              </article>

              <article className="dashboard-credit-card dashboard-credit-card-primary">
                <span className="dashboard-credit-label">المطور</span>
                <strong>بلال زامل احمد</strong>
                <p>
                  تولّى <span className="dashboard-inline-emphasis">بلال زامل احمد</span> تحليل الفكرة، وبناء النظام، وصياغة الواجهة، وتوحيد الهوية البصرية الخاصة بمنصة <span className="dashboard-inline-emphasis">UOADrop</span>.
                </p>
              </article>

              <article className="dashboard-credit-card dashboard-credit-card-wide">
                <span className="dashboard-credit-label">الهدف من المشروع</span>
                <p>
                  يهدف المشروع إلى تقليل الوقت والجهد في رفع ملفات الطباعة ومتابعة الطلبات داخل المكتبة، عبر تجربة أسرع وأكثر وضوحاً واحترافية لكل من <span className="dashboard-inline-emphasis">الطالب</span> و<span className="dashboard-inline-emphasis">إدارة الطباعة</span>.
                </p>
              </article>

              <article className="dashboard-credit-card dashboard-credit-card-wide">
                <span className="dashboard-credit-label">رسالة شكر</span>
                <p>
                  شكر خاص إلى <span className="dashboard-inline-emphasis">الطالب عمر عبد الجبار مجبل</span> و<span className="dashboard-inline-emphasis">الطالبة ملاك مازن يوسف</span> على مساعدتهم ودعمهم القيّم خلال مراحل العمل على المشروع.
                </p>
              </article>
            </div>
          </div>

          <div className="dashboard-contact-panel">
            <div className="dashboard-contact-head">
              <span className="dashboard-credit-label">التواصل</span>
              <strong>وسائل تواصل مباشرة</strong>
              <p>روابط واضحة وسريعة للوصول إلى حسابات المطور، مع الإبقاء على أسماء الخدمات كما هي.</p>
            </div>

            <div className="dashboard-contact-links">
              {contactLinks.map((link) => (
                <a key={link.label} className="dashboard-contact-link" href={link.href} target="_blank" rel="noreferrer">
                  <span className="dashboard-contact-icon">{link.icon}</span>
                  <span className="dashboard-contact-copy">
                    <span className="dashboard-contact-label">{link.label}</span>
                    <strong>{link.value}</strong>
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>
      ) : (
        <>
      <div className={`toolbar ${isSearchMode ? 'toolbar-searching' : ''}`}>
        <div className="toolbar-main">
          <div className="filters">
            <label className={`select-all-label ${allSelected ? 'select-all-label-active' : ''}`} title="تحديد الكل">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleSelectAll}
                disabled={requests.length === 0}
              />
              <span className="select-all-indicator" aria-hidden="true">
                <span className="select-all-indicator-dot" />
              </span>
              <span className="select-all-copy">
                <strong>تحديد الكل</strong>
                <small>{allSelected ? 'كل الطلبات الظاهرة محددة' : 'تحديد الطلبات الظاهرة بسرعة'}</small>
              </span>
            </label>
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.key}
                className={`chip ${filter === f.key ? 'chip-active' : ''}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="toolbar-pills">
            <span className="inline-pill">الصفحة {page + 1} / {pageCount}</span>
            <span className="inline-pill">{liveVisibleCount.toLocaleString('ar-IQ')} ظاهرة</span>
            <span className="inline-pill">{selectedIds.size.toLocaleString('ar-IQ')} محدد</span>
          </div>
        </div>

        <div className={`search-row ${isSearchMode ? 'search-row-active' : ''}`}>
          <div className={`search-shell ${isSearchMode ? 'search-shell-active' : ''}`}>
            <span className="search-icon">
              <SearchIcon className="search-icon-svg" />
            </span>
            <input
              className="search"
              placeholder="بحث بالتذكرة أو الاسم..."
              value={searchInput}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => window.setTimeout(() => setSearchFocused(false), 120)}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  applySearchNow();
                }
                if (e.key === 'Escape' && searchInput.length > 0) {
                  e.preventDefault();
                  clearSearch();
                }
              }}
            />
            <div className="search-actions">
              {(isSearchPending || listLoading) && (
                <span className="search-loader-wrap" aria-hidden="true">
                  <SpinnerIcon className="search-loader" />
                </span>
              )}
              {searchInput.length > 0 && (
                <button
                  type="button"
                  className="search-clear"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={clearSearch}
                  aria-label="مسح البحث"
                  title="مسح البحث"
                >
                  <CloseIcon className="search-clear-icon" />
                </button>
              )}
            </div>
          </div>
          <button
            type="button"
            className={`search-cancel ${isSearchMode ? 'search-cancel-visible' : ''}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              clearSearch();
              setSearchFocused(false);
            }}
          >
            إلغاء
          </button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="bulk-bar">
          <div className="bulk-summary">
            <span className="bulk-kicker">طلبات محددة</span>
            <strong className="bulk-count">{selectedIds.size.toLocaleString('ar-IQ')}</strong>
            <span className="bulk-caption">اختر الإجراء المناسب للطلبات الظاهرة</span>
          </div>

          <div className="bulk-actions">
            <button className="btn btn-print" disabled={bulkBusy} onClick={() => void handleBulkPrint()}>
              <PrintIcon className="btn-icon" />
              <span>طباعة الكل</span>
            </button>
            <button className="btn btn-ready" disabled={bulkBusy} onClick={handleBulkReady}>
              <CheckIcon className="btn-icon" />
              <span>جاهز الكل</span>
            </button>
            <button className="btn btn-delete" disabled={bulkBusy} onClick={() => void handleBulkDelete()}>
              <TrashIcon className="btn-icon" />
              <span>حذف الكل</span>
            </button>
            <button className="btn bulk-cancel-btn" onClick={() => setSelectedIds(new Set())}>
              <CloseIcon className="btn-icon" />
              <span>إلغاء</span>
            </button>
          </div>
        </div>
      )}

      <main className={`list ${normalizedSearchInput ? 'list-search-active' : ''}`}>
        {liveVisibleCount === 0 && (
          <div className="empty">
            <EmptyStateIllustration className="empty-illustration" />
            <span className="empty-eyebrow">{normalizedSearchInput ? 'نتائج البحث' : 'صندوق الطلبات هادئ الآن'}</span>
            <strong>{normalizedSearchInput ? 'لا توجد نتائج مطابقة' : 'لا توجد طلبات مطابقة'}</strong>
            <span className="empty-copy">
              {normalizedSearchInput
                ? 'جرّب كتابة جزء من الاسم أو رقم التذكرة بصيغة أقصر.'
                : 'جرّب تغيير الفلاتر أو تعديل نص البحث لعرض نتائج مختلفة.'}
            </span>
          </div>
        )}
        {requests.map((req) => (
          <div
            key={req.id}
            className={`request-slot ${matchesLiveSearch(req, normalizedSearchInput) ? 'request-slot-visible' : 'request-slot-hidden'}`}
          >
            <article
              className={`request-card ${selectedIds.has(req.id) ? 'card-selected' : ''}`}
              onClick={() => toggleSelect(req.id)}
            >
              <div className="card-top">
                <div className="card-leading">
                  <label className="card-checkbox" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(req.id)}
                      onChange={() => toggleSelect(req.id)}
                    />
                  </label>

                  <div>
                    <span className="ticket">{renderHighlightedText(req.ticket, normalizedSearchInput)}</span>
                    <div className="card-updated">آخر تحديث: {formatStamp(req.updatedAt)}</div>
                  </div>
                </div>

                <div className="card-status-group">
                  <span className={`badge ${STATUS_COLOR[req.status]}`}>{STATUS_LABEL[req.status]}</span>
                  <span className="file-badge">
                    <AttachmentIcon className="file-badge-icon" />
                    <span>{(fileCounts[req.id] ?? 0).toLocaleString('ar-IQ')} ملفات</span>
                  </span>
                </div>
              </div>

              <div className="card-title-row">
                <div>
                  <h3>{req.studentName ? renderHighlightedText(req.studentName, normalizedSearchInput) : 'بدون اسم'}</h3>
                  <p>
                    {req.options.color ? 'ملون' : 'أبيض وأسود'}
                    {' • '}
                    {req.options.doubleSided ? 'وجهين' : 'وجه واحد'}
                  </p>
                </div>

                <div className="price-box" onClick={(e) => e.stopPropagation()}>
                  <span className="price-label">السعر</span>
                  {req.status === 'pending' || req.status === 'printing' ? (
                    <>
                      <input
                        className="price-input"
                        inputMode="numeric"
                        placeholder="أدخل السعر يدوياً"
                        value={getDraftPriceValue(req)}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/[^0-9]/g, '');
                          setPriceDrafts((prev) => ({ ...prev, [req.id]: digits }));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void saveManualPrice(req);
                          }
                        }}
                      />
                      <div className="price-actions">
                        <button
                          className="price-save-btn"
                          disabled={busy === req.id}
                          onClick={() => void saveManualPrice(req)}
                        >
                          حفظ السعر
                        </button>
                        <span className="price-hint">مطلوب قبل تحويل الطلب إلى جاهز</span>
                      </div>
                    </>
                  ) : (
                    <strong className="price">{formatMoney(req.priceIqd)}</strong>
                  )}
                </div>
              </div>

              <div className="meta-grid">
                <span className="meta-pill meta-pill-code">
                  <span>رمز الاستلام:</span>
                  <strong dir="ltr">{req.pickupPin ?? 'غير متاح'}</strong>
                </span>
                <span className="meta-pill">عدد الصفحات: {formatPages(req.totalPages)}</span>
                <span className="meta-pill">افتراضي: {req.options.copies.toLocaleString('ar-IQ')} نسخ</span>
                <span className="meta-pill">أُنشئ {formatStamp(req.createdAt)}</span>
              </div>

              <div className={`card-actions ${req.status === 'printing' ? 'card-actions-printing' : ''}`} onClick={(e) => e.stopPropagation()}>
                <button className="btn btn-open" disabled={busy === req.id} onClick={() => void handleView(req)}>
                  <EyeIcon className="btn-icon" />
                  <span>الملفات</span>
                </button>
                <button
                  className={`btn btn-print ${req.status === 'printing' ? 'btn-print-repeat' : ''}`}
                  disabled={
                    busy === req.id ||
                    req.status === 'done' ||
                    req.status === 'canceled' ||
                    req.status === 'blocked'
                  }
                  onClick={() => void handlePrint(req)}
                  title={req.status === 'printing' ? 'إعادة طباعة' : 'طباعة'}
                >
                  <PrintIcon className="btn-icon" />
                  <span>{req.status === 'printing' ? 'إعادة طباعة' : 'طباعة'}</span>
                </button>
                <button
                  className="btn btn-ready"
                  disabled={busy === req.id || !canMoveToReady(req)}
                  onClick={() => handleReady(req)}
                  title={req.status === 'printing' && !canMoveToReady(req) ? 'حدد السعر أولاً' : 'جاهز'}
                >
                  <CheckIcon className="btn-icon" />
                  <span>جاهز</span>
                </button>
                <button className="btn btn-delete" disabled={busy === req.id} onClick={() => void handleDelete(req)}>
                  <TrashIcon className="btn-icon" />
                  <span>حذف</span>
                </button>
              </div>
            </article>
          </div>
        ))}
      </main>

      {total > PAGE_SIZE && (
        <div className="pager">
          <button
            className="btn"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            السابق
          </button>
          <span className="pager-info">
            صفحة {page + 1} من {pageCount} • الإجمالي {total.toLocaleString('ar-IQ')}
          </span>
          <button
            className="btn"
            disabled={(page + 1) * PAGE_SIZE >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            التالي
          </button>
        </div>
      )}

        </>
      )}

      {filesPanel && (
        <div className="files-overlay" onClick={() => setFilesPanel(null)}>
          <section className="files-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="files-drawer-head">
              <div>
                <span className="files-drawer-kicker">ملفات الطلب</span>
                <h2>{filesPanel.request.ticket}</h2>
                <p>يمكنك مراجعة و تعديل إعدادات كل ملف داخل هذا الطلب بشكل مستقل.</p>
              </div>
              <button className="files-drawer-close" onClick={() => setFilesPanel(null)} aria-label="إغلاق">
                <CloseIcon className="search-clear-icon" />
              </button>
            </div>

            <div className="files-drawer-list">
              {filesPanel.files.map((file) => {
                const draft = getFileDraft(file);
                const canEdit = filesPanel.request.status === 'pending' || filesPanel.request.status === 'printing';
                return (
                  <article key={file.id} className="file-sheet-card">
                    <div className="file-sheet-top">
                      <div>
                        <strong>{file.filename}</strong>
                        <div className="file-sheet-meta">
                          <span>{formatPages(file.pages ?? 0)}</span>
                          <span>{file.sizeBytes.toLocaleString('ar-IQ')} بايت</span>
                        </div>
                      </div>
                      <button className="btn btn-open" onClick={() => void handleOpenSingleFile(file)}>
                        <EyeIcon className="btn-icon" />
                        <span>فتح الملف</span>
                      </button>
                    </div>

                    <div className="file-sheet-options">
                      <label className="file-sheet-field">
                        <span>عدد النسخ</span>
                        <input
                          className="file-sheet-input"
                          inputMode="numeric"
                          value={draft.copies}
                          disabled={!canEdit}
                          onChange={(e) => updateFileDraft(file, { copies: e.target.value.replace(/[^0-9]/g, '') })}
                        />
                      </label>
                      <label className="file-sheet-field">
                        <span>نوع الطباعة</span>
                        <select
                          className="file-sheet-select"
                          value={draft.color}
                          disabled={!canEdit}
                          onChange={(e) => updateFileDraft(file, { color: e.target.value as 'true' | 'false' })}
                        >
                          <option value="false">أبيض وأسود</option>
                          <option value="true">ملونة</option>
                        </select>
                      </label>
                      <label className="file-sheet-field">
                        <span>الطباعة على وجهين</span>
                        <select
                          className="file-sheet-select"
                          value={draft.doubleSided}
                          disabled={!canEdit}
                          onChange={(e) => updateFileDraft(file, { doubleSided: e.target.value as 'true' | 'false' })}
                        >
                          <option value="true">نعم</option>
                          <option value="false">لا</option>
                        </select>
                      </label>
                    </div>

                    <div className="file-sheet-actions">
                      <span className="file-sheet-note">
                        {canEdit ? 'هذه الإعدادات خاصة بهذا الملف فقط.' : 'التعديل متاح فقط قبل اكتمال الطلب.'}
                      </span>
                      <button
                        className="btn btn-ready"
                        disabled={!canEdit || fileOptionBusy === file.id}
                        onClick={() => void handleSaveFileOptions(filesPanel.request, file)}
                      >
                        <span>{fileOptionBusy === file.id ? 'جارٍ الحفظ...' : 'حفظ الإعدادات'}</span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
