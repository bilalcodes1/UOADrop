import { useEffect, useState } from 'react';
import type { PrintRequest, RequestStatus } from '@uoadrop/shared';

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
  const [requests, setRequests] = useState<PrintRequest[]>([]);
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

  const refresh = async (): Promise<void> => {
    const res = await window.api.listRequests();
    setRequests(res.items);
  };

  useEffect(() => {
    window.api.seed().then(() => refresh());
    const id = setInterval(() => refresh(), 3000);
    return () => clearInterval(id);
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
    const res = await window.api.chooseFile();
    if (res.canceled || res.filePaths.length === 0) {
      setBusy(null);
      return;
    }

    const chosen = res.filePaths[0]!;
    await window.api.addFileToRequest(req.id, chosen);
    const printRes = await window.api.printFile(chosen);
    if (printRes.ok) {
      await window.api.setRequestStatus(req.id, 'printing');
      updateStatus(req.id, 'printing');
      showToast(printRes.hint ?? `بدأت طباعة ${req.ticket}`);
    } else {
      const hint = printRes.hint?.trim();
      if (printRes.error === 'NO_PRINTERS_CONFIGURED') {
        showToast(hint ?? 'فشل الطباعة: لا توجد طابعات مُضافة للنظام');
      } else {
        showToast(hint ? `فشل الطباعة: ${hint}` : `فشل الطباعة: ${printRes.error}`);
      }
    }
    setBusy(null);
  };

  const handleReady = (req: PrintRequest): void => {
    window.api.setRequestStatus(req.id, 'ready').then(() => refresh());
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
