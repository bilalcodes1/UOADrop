import { useState } from 'react';
import type { PrintRequest, RequestStatus } from '@uoadrop/shared';

// Mock data (Phase 1.3 will replace with SQLite query)
const MOCK_REQUESTS: PrintRequest[] = [
  {
    id: 'req-001',
    ticket: 'A7K9',
    studentName: 'ملاك أحمد',
    pinHash: '$2b$12$mock',
    status: 'pending',
    options: { copies: 2, color: false, doubleSided: true },
    totalPages: 14,
    priceIqd: 2800,
    createdAt: new Date(Date.now() - 3 * 60_000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 60_000).toISOString(),
  },
  {
    id: 'req-002',
    ticket: 'B3M1',
    studentName: 'بلال علي',
    pinHash: '$2b$12$mock',
    status: 'printing',
    options: { copies: 1, color: true, doubleSided: false },
    totalPages: 8,
    priceIqd: 2000,
    createdAt: new Date(Date.now() - 8 * 60_000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 60_000).toISOString(),
  },
  {
    id: 'req-003',
    ticket: 'C9F4',
    studentName: 'سارة محمد',
    pinHash: '$2b$12$mock',
    status: 'ready',
    options: { copies: 3, color: false, doubleSided: true },
    totalPages: 22,
    priceIqd: 6600,
    createdAt: new Date(Date.now() - 15 * 60_000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 60_000).toISOString(),
  },
];

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

export function Dashboard(): JSX.Element {
  const [requests, setRequests] = useState<PrintRequest[]>(MOCK_REQUESTS);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string): void => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const updateStatus = (id: string, status: RequestStatus): void => {
    setRequests((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, status, updatedAt: new Date().toISOString() } : r,
      ),
    );
  };

  const handleView = async (req: PrintRequest): Promise<void> => {
    setBusy(req.id);
    // Phase 1.3: fetch real file path from DB
    showToast(`[mock] عرض ملفات الطلب ${req.ticket}`);
    setBusy(null);
  };

  const handlePrint = async (req: PrintRequest): Promise<void> => {
    setBusy(req.id);
    // Phase 1.3: pick actual file path from DB
    const res = await window.api.chooseFile();
    if (res.canceled || res.filePaths.length === 0) {
      setBusy(null);
      return;
    }
    const printRes = await window.api.printFile(res.filePaths[0]!);
    if (printRes.ok) {
      updateStatus(req.id, 'printing');
      showToast(printRes.hint ?? `بدأت طباعة ${req.ticket}`);
    } else {
      showToast(`فشل الطباعة: ${printRes.error}`);
    }
    setBusy(null);
  };

  const handleReady = (req: PrintRequest): void => {
    updateStatus(req.id, 'ready');
    showToast(`الطلب ${req.ticket} أصبح جاهزاً — أُرسل الإشعار للطالب`);
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

      <main className="list">
        {requests.length === 0 && (
          <div className="empty">لا توجد طلبات حالياً</div>
        )}
        {requests.map((req) => (
          <article key={req.id} className="request-card">
            <div className="card-top">
              <div className="ticket">#{req.ticket}</div>
              <span className={`badge ${STATUS_COLOR[req.status]}`}>
                {STATUS_LABEL[req.status]}
              </span>
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
            <div className="card-actions">
              <button
                className="btn btn-view"
                disabled={busy === req.id}
                onClick={() => handleView(req)}
              >
                👁️ عرض
              </button>
              <button
                className="btn btn-print"
                disabled={busy === req.id || req.status !== 'pending'}
                onClick={() => handlePrint(req)}
              >
                🖨️ طباعة
              </button>
              <button
                className="btn btn-ready"
                disabled={busy === req.id || req.status !== 'printing'}
                onClick={() => handleReady(req)}
              >
                ✅ جاهز
              </button>
            </div>
          </article>
        ))}
      </main>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
