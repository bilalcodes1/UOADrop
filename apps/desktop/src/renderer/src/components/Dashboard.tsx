import { useCallback, useEffect, useRef, useState } from 'react';
import type { PrintRequest, PrinterStatus, RequestStatus } from '@uoadrop/shared';

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
const STATUS_FILTERS: Array<{ key: 'all' | RequestStatus; label: string }> = [
  { key: 'all', label: 'الكل' },
  { key: 'pending', label: 'قيد الانتظار' },
  { key: 'printing', label: 'يطبع' },
  { key: 'ready', label: 'جاهز' },
  { key: 'done', label: 'تم التسليم' },
];

export function Dashboard(): JSX.Element {
  const [requests, setRequests] = useState<PrintRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | RequestStatus>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [printer, setPrinter] = useState<{
    status: PrinterStatus;
    printerName: string | null;
  }>({ status: 'unknown', printerName: null });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [fileCounts, setFileCounts] = useState<Record<string, number>>({});
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const refresh = async (): Promise<void> => {
    const statuses = filter === 'all' ? undefined : [filter];
    const res = await window.api.listRequestsPaged({
      statuses,
      search: search.trim() || undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    });
    setRequests(res.items);
    setTotal(res.total);
  };

  useEffect(() => {
    setPage(0);
  }, [filter, search]);

  useEffect(() => {
    void window.api.seed().then(() => refresh());
  }, []);

  useEffect(() => {
    void refresh();
    // Safety re-poll every 30s in case WS is down.
    const id = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(id);
  }, [filter, search, page]);

  // Live updates via WebSocket.
  // NOTE: native OS notification + system sound are emitted from the main
  // process (see main/index.ts). Here we only refresh data and show a toast.
  useEffect(() => {
    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const connect = (): void => {
      try {
        ws = new WebSocket(`ws://${window.location.hostname || 'localhost'}:3737/ws`);
      } catch {
        retry = setTimeout(connect, 3000);
        return;
      }
      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data as string);
          if (data?.type === 'requests:changed') {
            if (data.reason === 'created' && data.payload) {
              setRequests((prev) => {
                if (prev.some((r: { id: string }) => r.id === data.payload.id)) return prev;
                return [data.payload, ...prev];
              });
              setTotal((t) => t + 1);
            }
            if (data.reason === 'file-added') {
              // Instant file-count badge update — zero IPC round-trip
              if (data.requestId) {
                setFileCounts((prev) => ({
                  ...prev,
                  [data.requestId as string]: (prev[data.requestId as string] ?? 0) + 1,
                }));
              }
              showToast('📩 ملف جديد — جاهز للطباعة');
            }
            void refresh();
          }
        } catch { /* ignore */ }
      };
      ws.onclose = () => {
        if (closed) return;
        retry = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws?.close();
    };
    connect();

    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      ws?.close();
    };
  }, [filter, search, page]);

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

  const handleView = async (req: PrintRequest): Promise<void> => {
    setBusy(req.id);
    const res = await window.api.listRequestFiles(req.id);
    if (res.items.length === 0) {
      showToast(`لا توجد ملفات مرتبطة بالطلب ${req.ticket} بعد`);
      setBusy(null);
      return;
    }
    for (const f of res.items) {
      if (f.localPath) await window.api.openFile(f.localPath);
    }
    showToast(`تم فتح ملفات الطلب ${req.ticket}`);
    setBusy(null);
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
      showToast(lastHint ?? `بدأت طباعة ${req.ticket}`);
    } else if (lastError === 'NO_PRINTERS_CONFIGURED') {
      showToast(lastHint ?? 'فشل الطباعة: لا توجد طابعات مُضافة للنظام');
    } else {
      showToast(lastHint ? `فشل الطباعة: ${lastHint}` : `فشل الطباعة: ${lastError ?? 'unknown'}`);
    }
    setBusy(null);
  };

  const handleReady = (req: PrintRequest): void => {
    window.api.setRequestStatus(req.id, 'ready').then(() => refresh());
    updateStatus(req.id, 'ready');
    showToast(`الطلب ${req.ticket} أصبح جاهزاً — أُرسل الإشعار للطالب`);
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

  const handleBulkReady = (): void => {
    for (const id of selectedIds) {
      const req = requests.find((r) => r.id === id);
      if (req && req.status === 'printing') handleReady(req);
    }
    setSelectedIds(new Set());
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

  const counts = {
    pending: requests.filter((r) => r.status === 'pending').length,
    printing: requests.filter((r) => r.status === 'printing').length,
    ready: requests.filter((r) => r.status === 'ready').length,
  };

  return (
    <div className="dashboard">
      <header className="header">
        <div>
          <h1>UOADrop</h1>
          <p className="subtitle">لوحة المكتبة</p>
          <div className={`printer-indicator printer-${printer.status}`}>
            <span className="dot" />
            <span className="label">
              الطابعة: {PRINTER_LABEL[printer.status]}
              {printer.printerName ? ` • ${printer.printerName}` : ''}
            </span>
          </div>
          <div style={{ marginTop: 8 }}>
            <button
              className="btn"
              style={{ padding: '6px 12px', fontSize: 13 }}
              onClick={() => window.open('http://localhost:3737/wall-sign', '_blank')}
            >
              🧾 طباعة ملصق الحائط (QR)
            </button>
          </div>
        </div>
        <div className="stats">
          <div className="stat">
            <span className="stat-num">{counts.pending}</span>
            <span className="stat-label">قيد الانتظار</span>
          </div>
          <div className="stat">
            <span className="stat-num">{counts.printing}</span>
            <span className="stat-label">يطبع</span>
          </div>
          <div className="stat">
            <span className="stat-num">{counts.ready}</span>
            <span className="stat-label">جاهز</span>
          </div>
        </div>
      </header>

      <div className="toolbar">
        <div className="filters">
          <label className="select-all-label" title="تحديد الكل">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              disabled={requests.length === 0}
            />
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
        <input
          className="search"
          placeholder="بحث بالتذكرة أو الاسم..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {selectedIds.size > 0 && (
        <div className="bulk-bar">
          <span className="bulk-count">{selectedIds.size} محدد</span>
          <button className="btn btn-print" disabled={bulkBusy} onClick={() => void handleBulkPrint()}>
            🖨️ طباعة الكل
          </button>
          <button className="btn btn-ready" disabled={bulkBusy} onClick={handleBulkReady}>
            ✅ جاهز الكل
          </button>
          <button className="btn btn-delete" disabled={bulkBusy} onClick={() => void handleBulkDelete()}>
            🗑️ حذف الكل
          </button>
          <button className="btn" onClick={() => setSelectedIds(new Set())}>إلغاء</button>
        </div>
      )}

      <main className="list">
        {requests.length === 0 && (
          <div className="empty">لا توجد طلبات مطابقة</div>
        )}
        {requests.map((req) => (
          <article
            key={req.id}
            className={`request-card ${selectedIds.has(req.id) ? 'card-selected' : ''}`}
            onClick={() => toggleSelect(req.id)}
          >
            <div className="card-top">
              <label className="card-checkbox" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(req.id)}
                  onChange={() => toggleSelect(req.id)}
                />
              </label>
              <div className="ticket">#{req.ticket}</div>
              <span className={`badge ${STATUS_COLOR[req.status]}`}>
                {STATUS_LABEL[req.status]}
              </span>
              {(fileCounts[req.id] ?? 0) > 0 && (
                <span className="file-badge">📎 {fileCounts[req.id]}</span>
              )}
            </div>
            <div className="card-body">
              <div className="student">{req.studentName ?? '— غير معروف —'}</div>
              <div className="meta">
                <span>{req.totalPages} صفحة</span>
                <span>•</span>
                <span>{req.options.copies} نسخة</span>
                <span>•</span>
                <span>{req.options.color ? 'ملوّن' : 'أبيض/أسود'}</span>
                <span>•</span>
                <span>{req.options.doubleSided ? 'وجهين' : 'وجه واحد'}</span>
                <span>•</span>
                <span className="price">{req.priceIqd.toLocaleString('ar-IQ')} د.ع</span>
              </div>
            </div>
            <div className="card-actions" onClick={(e) => e.stopPropagation()}>
              <button
                className="btn btn-view"
                disabled={busy === req.id}
                onClick={() => handleView(req)}
              >
                👁️ عرض
              </button>
              <button
                className="btn btn-print"
                disabled={
                  busy === req.id ||
                  req.status === 'done' ||
                  req.status === 'canceled' ||
                  req.status === 'blocked'
                }
                onClick={() => void handlePrint(req)}
                title={req.status === 'printing' ? 'إعادة طباعة' : 'طباعة'}
              >
                🖨️ {req.status === 'printing' ? 'إعادة طباعة' : 'طباعة'}
              </button>
              <button
                className="btn btn-ready"
                disabled={busy === req.id || req.status !== 'printing'}
                onClick={() => handleReady(req)}
              >
                ✅ جاهز
              </button>
              <button
                className="btn btn-delete"
                disabled={busy === req.id}
                onClick={() => void handleDelete(req)}
                title="حذف الطلب"
              >
                🗑️
              </button>
            </div>
          </article>
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
            صفحة {page + 1} من {Math.max(1, Math.ceil(total / PAGE_SIZE))} • الإجمالي {total}
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

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
