import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import { emit, subscribe } from './events';
import { createWriteStream, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import { app } from 'electron';
import { createHash } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import QRCode from 'qrcode';
import {
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_MB,
  MAX_FILES_PER_REQUEST,
  detectMagic,
  isAllowedExtension,
  isAllowedMime,
} from '@uoadrop/shared';
import {
  addRequestFile,
  createRequest,
  deleteRequest,
  existsRequestFileBySha256,
  findAbandonedRequests,
  findExpiredCompletedRequests,
  findExpiredReadyRequests,
  getRequestById,
  getDb,
  listRequests,
  listRequestFiles,
  listStoredFilesForPageRecount,
  purgeLegacySeedData,
  purgeOldPinAttempts,
  recalcRequestPages,
  setRequestFilePages,
  setRequestStatus,
} from './db';
import { countFilePages } from './page-counter';
import {
  ABANDONED_UPLOAD_TTL_HOURS,
  COMPLETED_REQUEST_RETENTION_DAYS,
  READY_REQUEST_RETENTION_DAYS,
} from '@uoadrop/shared';

const DEFAULT_PORT = 3737;
const PUBLISHED_ONLINE_UPLOAD_URL = 'https://uoadrop.vercel.app/';

function getDataDir(): string {
  if (app.isPackaged) return join(app.getPath('userData'), 'data');
  return resolve(process.cwd(), './data');
}

function getUploadsDir(): string {
  return resolve(getDataDir(), './uploads');
}

async function backfillStoredPageCounts(): Promise<void> {
  const supported = new Set(['.pdf', '.pptx', '.jpg', '.jpeg', '.png']);
  const touchedRequestIds = new Set<string>();

  for (const file of listStoredFilesForPageRecount()) {
    touchedRequestIds.add(file.requestId);
    if (file.pages > 0 || !file.localPath || !existsSync(file.localPath)) continue;
    const ext = extname(file.filename || file.localPath).toLowerCase();
    if (!supported.has(ext)) continue;
    const pages = await countFilePages(file.localPath, ext);
    if (pages > 0) setRequestFilePages(file.id, pages);
  }

  for (const requestId of touchedRequestIds) {
    recalcRequestPages(requestId);
  }
}

export async function startLocalServer(): Promise<{ port: number }> {
  // Ensure DB initializes on server start
  getDb();
  purgeLegacySeedData();

  mkdirSync(getUploadsDir(), { recursive: true });
  await backfillStoredPageCounts();

  const server = Fastify({
    logger: false,
    bodyLimit: (MAX_FILE_SIZE_MB + 1) * 1024 * 1024,
  });

  await server.register(rateLimit, {
    global: false,
    timeWindow: '1 minute',
    max: 60,
  });

  await server.register(websocket);

  server.get('/ws', { websocket: true } as any, (conn: any) => {
    const socket = (conn?.socket ?? conn) as { send: (m: string) => void; on: (ev: string, cb: () => void) => void };
    const send = (obj: unknown): void => {
      try { socket.send(JSON.stringify(obj)); } catch { /* ignore */ }
    };
    send({ type: 'hello', at: new Date().toISOString() });

    const unsubReq = subscribe('requests:changed', (ev) => send(ev));
    const unsubPr = subscribe('printer:changed', (ev) => send(ev));

    const cleanup = (): void => {
      unsubReq();
      unsubPr();
    };
    socket.on('close', cleanup);
    socket.on('error', cleanup);
  });

  await server.register(multipart, {
    limits: {
      fileSize: MAX_FILE_SIZE_MB * 1024 * 1024,
      files: 1, // one part per upload request
      fieldSize: 1024 * 1024,
    },
  });

  const getStudentHtml = (): string => {
    const studentHtmlPath = resolveResourcePath('student.html');
    return studentHtmlPath && existsSync(studentHtmlPath)
      ? readFileSync(studentHtmlPath, 'utf8')
      : '<!doctype html><html><body><h1>UOADrop</h1><p>student.html not found</p></body></html>';
  };

  const sendResourceAsset = (reply: any, filename: string, contentType: string) => {
    const assetPath = resolveResourcePath(filename);
    if (!assetPath) {
      reply.code(404);
      return { ok: false, error: `${filename} not found` };
    }
    reply.header('content-type', contentType);
    reply.header('cache-control', 'public, max-age=86400');
    return readFileSync(assetPath);
  };

  server.get('/', async (_req, reply) => {
    reply.header('content-type', 'text/html; charset=utf-8');
    reply.header('cache-control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    reply.header('pragma', 'no-cache');
    reply.header('expires', '0');
    return getStudentHtml();
  });

  server.get('/health', async () => ({ ok: true }));

  server.get('/uoadrop-logo.png', async (_req: any, reply: any) => sendResourceAsset(reply, 'uoadrop-logo.png', 'image/png'));

  server.get('/university-of-anbar.svg', async (_req: any, reply: any) => sendResourceAsset(reply, 'university-of-anbar.svg', 'image/svg+xml'));

  server.get('/cs-college.svg', async (_req: any, reply: any) => sendResourceAsset(reply, 'cs-college.svg', 'image/svg+xml'));

  const currentPort = Number(process.env.DESKTOP_PORT ?? DEFAULT_PORT);

  server.get('/qr', async (req: any, reply: any) => {
    const url =
      (req.query?.url as string | undefined) ?? defaultUploadUrl(currentPort);
    const png = await QRCode.toBuffer(url, { width: 512, margin: 1 });
    reply.header('content-type', 'image/png');
    return png;
  });

  server.get('/wall-sign', async (_req: any, reply: any) => {
    const url = defaultUploadUrl(currentPort);
    const dataUrl = await QRCode.toDataURL(url, { width: 420, margin: 1 });
    reply.header('content-type', 'text/html; charset=utf-8');
    return [
      '<!doctype html>',
      '<html lang="ar" dir="rtl"><head>',
      '<meta charset="utf-8"/>',
      '<meta name="viewport" content="width=device-width, initial-scale=1"/>',
      '<title>UOADrop — ملصق الحائط</title>',
      '<style>',
      ':root{--primary:#4f46e5;--primary-dark:#312e81;--accent:#22c55e;--text:#0f172a;--muted:#64748b;--line:#dbe4f0;--surface:#ffffff;--soft:#f8fafc}',
      '@page { size: A4; margin: 14mm; }',
      '*{box-sizing:border-box}',
      'body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Tahoma,sans-serif;color:var(--text);margin:0;background:linear-gradient(180deg,#eef2ff 0%,#f8fafc 100%);padding:14mm}',
      '.poster{max-width:760px;margin:0 auto;padding:28px;border-radius:36px;background:linear-gradient(180deg,#ffffff 0%,#fbfdff 100%);border:1px solid rgba(148,163,184,.22);box-shadow:0 28px 64px rgba(15,23,42,.10)}',
      '.hero{display:grid;grid-template-columns:auto minmax(0,1fr);gap:18px;align-items:center;padding:22px 24px;border-radius:28px;background:linear-gradient(135deg,#0f172a 0%,#1e1b4b 100%);color:#fff}',
      '.brand-mark{width:96px;height:96px;border-radius:28px;display:flex;align-items:center;justify-content:center;padding:10px;background:linear-gradient(180deg,rgba(255,255,255,.18) 0%,rgba(255,255,255,.1) 100%);border:1px solid rgba(255,255,255,.16);box-shadow:0 16px 28px rgba(15,23,42,.16);overflow:hidden}',
      '.brand-mark img{width:72px;height:72px;display:block;object-fit:contain;transform:scale(3);transform-origin:center}',
      '.hero-kicker{display:inline-flex;align-items:center;justify-content:center;min-height:28px;padding:6px 10px;border-radius:999px;background:rgba(255,255,255,.10);font-size:11px;font-weight:800;color:rgba(255,255,255,.85)}',
      '.hero h1{margin:10px 0 6px;font-size:34px;line-height:1.15;letter-spacing:-.04em}',
      '.hero p{margin:0;color:rgba(255,255,255,.78);font-size:15px;line-height:1.8}',
      '.grid{display:grid;grid-template-columns:minmax(0,1.02fr) minmax(280px,.82fr);gap:18px;margin-top:18px}',
      '.panel{border:1px solid var(--line);border-radius:28px;background:linear-gradient(180deg,#fff 0%,#f8fbff 100%);padding:22px}',
      '.panel h2{margin:0 0 8px;font-size:24px;line-height:1.25}',
      '.panel p{margin:0;color:var(--muted);font-size:14px;line-height:1.9}',
      '.qr-card{text-align:center;display:grid;gap:14px;align-content:start}',
      '.qr-shell{display:inline-flex;align-items:center;justify-content:center;padding:14px;border-radius:28px;background:#fff;border:1px solid var(--line);box-shadow:0 18px 40px rgba(79,70,229,.10)}',
      '.qr-shell img{display:block;width:100%;max-width:284px;height:auto}',
      '.url-box{padding:14px 16px;border-radius:18px;background:#f8fafc;border:1px solid var(--line)}',
      '.url-label{display:block;color:var(--muted);font-size:12px;font-weight:800;margin-bottom:6px}',
      '.url{display:block;direction:ltr;text-align:center;font-family:SFMono-Regular,Menlo,monospace;color:var(--primary-dark);font-size:15px;font-weight:800;word-break:break-all}',
      '.poster-mode{display:inline-flex;align-items:center;justify-content:center;min-height:34px;margin-top:14px;padding:7px 14px;border-radius:999px;background:rgba(15,23,42,.06);border:1px solid rgba(148,163,184,.24);color:#0f172a;font-size:12px;font-weight:800}',
      '.steps{display:grid;gap:12px;margin-top:16px}',
      '.step{display:grid;grid-template-columns:auto minmax(0,1fr);gap:12px;align-items:start;padding:14px 16px;border-radius:20px;background:var(--soft);border:1px solid var(--line)}',
      '.step-no{width:34px;height:34px;border-radius:999px;display:flex;align-items:center;justify-content:center;background:rgba(79,70,229,.10);color:var(--primary);font-size:14px;font-weight:900}',
      '.step strong{display:block;font-size:15px;margin-bottom:4px}',
      '.step span{display:block;color:var(--muted);font-size:13px;line-height:1.8}',
      '.quick-list{display:grid;gap:10px;margin-top:16px}',
      '.quick-item{padding:14px 16px;border-radius:20px;background:linear-gradient(180deg,#f9fbff 0%,#f8fafc 100%);border:1px solid var(--line)}',
      '.quick-item strong{display:block;font-size:14px;margin-bottom:4px}',
      '.quick-item span{display:block;color:var(--muted);font-size:13px;line-height:1.8}',
      '.footer-bar{margin-top:18px;padding:16px 18px;border-radius:22px;background:linear-gradient(135deg,rgba(79,70,229,.08) 0%,rgba(34,197,94,.08) 100%);border:1px solid rgba(79,70,229,.10);display:flex;justify-content:space-between;align-items:center;gap:16px}',
      '.footer-copy strong{display:block;font-size:16px;margin-bottom:4px}',
      '.footer-copy span{display:block;color:var(--muted);font-size:13px;line-height:1.7}',
      '.print-btn{padding:12px 18px;border-radius:16px;border:0;background:var(--primary);color:#fff;font-size:14px;font-weight:800;font-family:inherit;cursor:pointer;box-shadow:0 16px 32px rgba(79,70,229,.18)}',
      '@media print { body{background:#fff;padding:0}.poster{box-shadow:none;border-color:#dbe4f0}.footer-bar{background:#fff}.actions{display:none} }',
      '@media (max-width: 720px){body{padding:10px}.poster{padding:16px;border-radius:24px}.hero{grid-template-columns:1fr;text-align:center}.brand-mark{margin:0 auto}.grid{grid-template-columns:1fr}.footer-bar{flex-direction:column;align-items:stretch}.print-btn{width:100%}}',
      '</style></head><body>',
      '<div class="poster">',
      '<section class="hero">',
      '<div class="brand-mark">',
      '<img src="/uoadrop-logo.png" alt="UOADrop" />',
      '</div>',
      '<div>',
      '<span class="hero-kicker">UOADrop</span>',
      '<h1>ارفع ملفاتك للطباعة خلال دقيقة</h1>',
      '<p>امسح الرمز أو افتح الرابط المباشر، ثم أرسل الملفات من هاتفك داخل شبكة المكتبة.</p>',
      '</div>',
      '</section>',
      '<div class="grid">',
      '<section class="panel qr-card">',
      '<h2>امسح الرمز</h2>',
      '<div class="qr-shell"><img alt="QR" src="' + dataUrl + '"/></div>',
      '<div class="url-box"><span class="url-label">أو افتح الرابط مباشرة</span><span class="url">' + url + '</span></div>',
      '<span class="poster-mode">ملصق أوفلاين</span>',
      '</section>',
      '<section class="panel">',
      '<h2>طريقة الاستخدام</h2>',
      '<div class="steps">',
      '<div class="step"><div class="step-no">1</div><div><strong>اتصل بواي فاي المكتبة</strong><span>افتح الشبكة المحلية الخاصة بالنظام داخل المكتبة.</span></div></div>',
      '<div class="step"><div class="step-no">2</div><div><strong>افتح صفحة الرفع</strong><span>امسح QR أو اكتب الرابط الظاهر هنا في المتصفح.</span></div></div>',
      '<div class="step"><div class="step-no">3</div><div><strong>أرسل الملفات</strong><span>أدخل اسمك، اختر الملفات، ثم اضغط إرسال الطلب.</span></div></div>',
      '</div>',
      '<div class="quick-list">',
      '<div class="quick-item"><strong>الحد الأعلى</strong><span>حتى 10 ملفات في الطلب الواحد.</span></div>',
      '<div class="quick-item"><strong>بعد الإرسال</strong><span>احتفظ برقم التذكرة ورمز الاستلام.</span></div>',
      '</div>',
      '</section>',
      '</div>',
      '<div class="footer-bar actions">',
      '<div class="footer-copy"><strong>جاهز للطباعة والتعليق</strong><span>نسخة متناسقة مع هوية UOADrop وبحجم مناسب لورقة A4.</span></div>',
      '<button class="print-btn" onclick="window.print()">طباعة الملصق</button>',
      '</div>',
      '</div>',
      '</body></html>',
    ].join('\n');
  });

  server.get('/online-wall-sign', async (_req: any, reply: any) => {
    const url = PUBLISHED_ONLINE_UPLOAD_URL;
    const dataUrl = await QRCode.toDataURL(url, { width: 420, margin: 1 });
    reply.header('content-type', 'text/html; charset=utf-8');
    return [
      '<!doctype html>',
      '<html lang="ar" dir="rtl"><head>',
      '<meta charset="utf-8"/>',
      '<meta name="viewport" content="width=device-width, initial-scale=1"/>',
      '<title>UOADrop — ملصق الحائط</title>',
      '<style>',
      ':root{--primary:#4f46e5;--primary-dark:#312e81;--accent:#22c55e;--text:#0f172a;--muted:#64748b;--line:#dbe4f0;--surface:#ffffff;--soft:#f8fafc}',
      '@page { size: A4; margin: 14mm; }',
      '*{box-sizing:border-box}',
      'body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Tahoma,sans-serif;color:var(--text);margin:0;background:linear-gradient(180deg,#eef2ff 0%,#f8fafc 100%);padding:14mm}',
      '.poster{max-width:760px;margin:0 auto;padding:28px;border-radius:36px;background:linear-gradient(180deg,#ffffff 0%,#fbfdff 100%);border:1px solid rgba(148,163,184,.22);box-shadow:0 28px 64px rgba(15,23,42,.10)}',
      '.hero{display:grid;grid-template-columns:auto minmax(0,1fr);gap:18px;align-items:center;padding:22px 24px;border-radius:28px;background:linear-gradient(135deg,#0f172a 0%,#1e1b4b 100%);color:#fff}',
      '.brand-mark{width:96px;height:96px;border-radius:28px;display:flex;align-items:center;justify-content:center;padding:10px;background:linear-gradient(180deg,rgba(255,255,255,.18) 0%,rgba(255,255,255,.1) 100%);border:1px solid rgba(255,255,255,.16);box-shadow:0 16px 28px rgba(15,23,42,.16);overflow:hidden}',
      '.brand-mark img{width:72px;height:72px;display:block;object-fit:contain;transform:scale(3);transform-origin:center}',
      '.hero-kicker{display:inline-flex;align-items:center;justify-content:center;min-height:28px;padding:6px 10px;border-radius:999px;background:rgba(255,255,255,.10);font-size:11px;font-weight:800;color:rgba(255,255,255,.85)}',
      '.hero h1{margin:10px 0 6px;font-size:34px;line-height:1.15;letter-spacing:-.04em}',
      '.hero p{margin:0;color:rgba(255,255,255,.78);font-size:15px;line-height:1.8}',
      '.grid{display:grid;grid-template-columns:minmax(0,1.02fr) minmax(280px,.82fr);gap:18px;margin-top:18px}',
      '.panel{border:1px solid var(--line);border-radius:28px;background:linear-gradient(180deg,#fff 0%,#f8fbff 100%);padding:22px}',
      '.panel h2{margin:0 0 8px;font-size:24px;line-height:1.25}',
      '.panel p{margin:0;color:var(--muted);font-size:14px;line-height:1.9}',
      '.qr-card{text-align:center;display:grid;gap:14px;align-content:start}',
      '.qr-shell{display:inline-flex;align-items:center;justify-content:center;padding:14px;border-radius:28px;background:#fff;border:1px solid var(--line);box-shadow:0 18px 40px rgba(79,70,229,.10)}',
      '.qr-shell img{display:block;width:100%;max-width:284px;height:auto}',
      '.url-box{padding:14px 16px;border-radius:18px;background:#f8fafc;border:1px solid var(--line)}',
      '.url-label{display:block;color:var(--muted);font-size:12px;font-weight:800;margin-bottom:6px}',
      '.url{display:block;direction:ltr;text-align:center;font-family:SFMono-Regular,Menlo,monospace;color:var(--primary-dark);font-size:15px;font-weight:800;word-break:break-all}',
      '.poster-mode{display:inline-flex;align-items:center;justify-content:center;min-height:34px;margin-top:14px;padding:7px 14px;border-radius:999px;background:rgba(79,70,229,.10);border:1px solid rgba(79,70,229,.18);color:#4338ca;font-size:12px;font-weight:800}',
      '.steps{display:grid;gap:12px;margin-top:16px}',
      '.step{display:grid;grid-template-columns:auto minmax(0,1fr);gap:12px;align-items:start;padding:14px 16px;border-radius:20px;background:var(--soft);border:1px solid var(--line)}',
      '.step-no{width:34px;height:34px;border-radius:999px;display:flex;align-items:center;justify-content:center;background:rgba(79,70,229,.10);color:var(--primary);font-size:14px;font-weight:900}',
      '.step strong{display:block;font-size:15px;margin-bottom:4px}',
      '.step span{display:block;color:var(--muted);font-size:13px;line-height:1.8}',
      '.quick-list{display:grid;gap:10px;margin-top:16px}',
      '.quick-item{padding:14px 16px;border-radius:20px;background:linear-gradient(180deg,#f9fbff 0%,#f8fafc 100%);border:1px solid var(--line)}',
      '.quick-item strong{display:block;font-size:14px;margin-bottom:4px}',
      '.quick-item span{display:block;color:var(--muted);font-size:13px;line-height:1.8}',
      '.footer-bar{margin-top:18px;padding:16px 18px;border-radius:22px;background:linear-gradient(135deg,rgba(79,70,229,.08) 0%,rgba(34,197,94,.08) 100%);border:1px solid rgba(79,70,229,.10);display:flex;justify-content:space-between;align-items:center;gap:16px}',
      '.footer-copy strong{display:block;font-size:16px;margin-bottom:4px}',
      '.footer-copy span{display:block;color:var(--muted);font-size:13px;line-height:1.7}',
      '.print-btn{padding:12px 18px;border-radius:16px;border:0;background:var(--primary);color:#fff;font-size:14px;font-weight:800;font-family:inherit;cursor:pointer;box-shadow:0 16px 32px rgba(79,70,229,.18)}',
      '@media print { body{background:#fff;padding:0}.poster{box-shadow:none;border-color:#dbe4f0}.footer-bar{background:#fff}.actions{display:none} }',
      '@media (max-width: 720px){body{padding:10px}.poster{padding:16px;border-radius:24px}.hero{grid-template-columns:1fr;text-align:center}.brand-mark{margin:0 auto}.grid{grid-template-columns:1fr}.footer-bar{flex-direction:column;align-items:stretch}.print-btn{width:100%}}',
      '</style></head><body>',
      '<div class="poster">',
      '<section class="hero">',
      '<div class="brand-mark">',
      '<img src="/uoadrop-logo.png" alt="UOADrop" />',
      '</div>',
      '<div>',
      '<span class="hero-kicker">UOADrop</span>',
      '<h1>ارفع ملفاتك للطباعة خلال دقيقة</h1>',
      '<p>امسح الرمز أو افتح الرابط المباشر، ثم أرسل الملفات من هاتفك أو حاسوبك.</p>',
      '</div>',
      '</section>',
      '<div class="grid">',
      '<section class="panel qr-card">',
      '<h2>امسح الرمز</h2>',
      '<div class="qr-shell"><img alt="QR" src="' + dataUrl + '"/></div>',
      '<div class="url-box"><span class="url-label">أو افتح الرابط مباشرة</span><span class="url">' + url + '</span></div>',
      '<span class="poster-mode">ملصق أونلاين</span>',
      '</section>',
      '<section class="panel">',
      '<h2>طريقة الاستخدام</h2>',
      '<div class="steps">',
      '<div class="step"><div class="step-no">1</div><div><strong>افتح صفحة الرفع</strong><span>امسح QR أو اكتب الرابط الظاهر هنا في المتصفح.</span></div></div>',
      '<div class="step"><div class="step-no">2</div><div><strong>أرسل الملفات</strong><span>أدخل اسمك، اختر الملفات، ثم اضغط إرسال الطلب.</span></div></div>',
      '<div class="step"><div class="step-no">3</div><div><strong>بعد الإرسال</strong><span>احتفظ برقم التذكرة ورمز الاستلام لتحتاجهما عند مراجعة المكتبة.</span></div></div>',
      '</div>',
      '<div class="quick-list">',
      '<div class="quick-item"><strong>الحد الأعلى</strong><span>حتى 10 ملفات في الطلب الواحد.</span></div>',
      '<div class="quick-item"><strong>بعد الإرسال</strong><span>احتفظ برقم التذكرة ورمز الاستلام.</span></div>',
      '</div>',
      '</section>',
      '</div>',
      '<div class="footer-bar actions">',
      '<div class="footer-copy"><strong>جاهز للطباعة والتعليق</strong><span>نسخة متناسقة مع هوية UOADrop وبحجم مناسب لورقة A4.</span></div>',
      '<button class="print-btn" onclick="window.print()">طباعة الملصق</button>',
      '</div>',
      '</div>',
      '</body></html>',
    ].join('\n');
  });

  server.get('/requests', async () => ({ items: listRequests() }));

  server.post(
    '/api/requests',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (req: any, reply: any) => {
      const body = (req.body ?? {}) as any;

      const rawName = typeof body.studentName === 'string' ? body.studentName.trim() : '';
      const studentName = rawName.length > 0 ? rawName.slice(0, 80) : '';

      if (!studentName) {
        return reply.code(400).send({ ok: false, error: 'student name is required' });
      }

      const rawNotes = typeof body.notes === 'string' ? body.notes.trim() : '';
      const notes = rawNotes.length > 0 ? rawNotes.slice(0, 500) : undefined;

      const options = normalizePrintOptionsPayload((body?.options ?? {}) as Record<string, unknown>);
      const totalPages = clampInt(body.totalPages ?? 0, 0, 500, 0);

      if (!Number.isFinite(totalPages) || totalPages < 0) {
        return reply.code(400).send({ ok: false, error: 'invalid body' });
      }

      const created = createRequest({
        studentName,
        notes,
        options,
        totalPages,
        priceIqd: 0,
      });

      emit({ type: 'requests:changed', reason: 'created', requestId: created.request.id, payload: created.request });
      return reply.send(created);
    },
  );

  server.get('/api/requests/:id', async (req: any, reply: any) => {
    const { id } = req.params as { id: string };
    const request = getRequestById(id);
    if (!request) return reply.code(404).send({ ok: false, error: 'not_found' });
    const files = listRequestFiles(id);
    return reply.send({
      ok: true,
      request,
      filesCount: files.length,
      filesDone: files.length,
    });
  });

  server.post('/requests/:id/status', async (req: any, reply: any) => {
    const { id } = req.params as { id: string };
    const body = req.body as { status?: string };
    if (!body?.status) return reply.code(400).send({ ok: false, error: 'missing status' });
    setRequestStatus(id, body.status as any);
    emit({ type: 'requests:changed', reason: 'status', requestId: id });
    return { ok: true };
  });

  // Upload file for existing request (streaming + magic-bytes + whitelist)
  server.post(
    '/api/requests/:id/files',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (req: any, reply: any) => {
      const { id } = req.params as { id: string };

      // Enforce per-request file count
      const existing = listRequestFiles(id);
      if (existing.length >= MAX_FILES_PER_REQUEST) {
        return reply.code(400).send({
          ok: false,
          error: 'TOO_MANY_FILES',
          hint: `الحد الأقصى ${MAX_FILES_PER_REQUEST} ملفات للطلب الواحد`,
        });
      }

      const part = await (req as any).file();
      if (!part) return reply.code(400).send({ ok: false, error: 'missing file' });

      const rawOptions = Array.isArray(part.fields?.options)
        ? part.fields.options[part.fields.options.length - 1]?.value
        : part.fields?.options?.value;
      const fileOptions = normalizePrintOptionsPayload(parseMultipartOptions(rawOptions));

      const filename = part.filename ?? 'upload.bin';
      const ext = extname(filename).toLowerCase();
      const mime = part.mimetype ?? 'application/octet-stream';

      if (!isAllowedExtension(ext, ALLOWED_EXTENSIONS as unknown as string[])) {
        return reply.code(400).send({
          ok: false,
          error: 'EXT_NOT_ALLOWED',
          hint: 'نوع الملف غير مسموح',
        });
      }
      if (!isAllowedMime(mime, ALLOWED_MIME_TYPES as unknown as string[])) {
        return reply.code(400).send({
          ok: false,
          error: 'MIME_NOT_ALLOWED',
          hint: 'نوع MIME غير مسموح',
        });
      }

      const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const destPath = resolve(getUploadsDir(), `${Date.now()}-${safeName}`);

      const hash = createHash('sha256');
      const writer = createWriteStream(destPath);
      const maxBytes = MAX_FILE_SIZE_MB * 1024 * 1024;
      let bytes = 0;
      const head: number[] = [];
      let aborted: string | null = null;

      try {
        for await (const chunk of part.file as AsyncIterable<Buffer>) {
          if (head.length < 8) {
            for (let i = 0; i < chunk.length && head.length < 8; i++) {
              head.push(chunk[i]!);
            }
          }
          bytes += chunk.length;
          if (bytes > maxBytes) {
            aborted = 'TOO_LARGE';
            break;
          }
          hash.update(chunk);
          if (!writer.write(chunk)) {
            await new Promise<void>((r) => writer.once('drain', () => r()));
          }
        }
      } catch (err) {
        aborted = aborted ?? 'STREAM_ERROR';
      } finally {
        await new Promise<void>((r) => writer.end(() => r()));
      }

      if ((part as any).file?.truncated) {
        aborted = aborted ?? 'TOO_LARGE';
      }

      if (aborted) {
        await unlink(destPath).catch(() => {});
        return reply.code(400).send({
          ok: false,
          error: aborted,
          hint: aborted === 'TOO_LARGE' ? `الحد الأقصى ${MAX_FILE_SIZE_MB}MB للملف` : 'خطأ أثناء الرفع',
        });
      }

      const detected = detectMagic(Uint8Array.from(head));
      const extToKind: Record<string, string> = {
        '.pdf': 'pdf',
        '.png': 'png',
        '.jpg': 'jpg',
        '.jpeg': 'jpg',
        '.docx': 'docx',
        '.pptx': 'docx', // OOXML generic
        '.xlsx': 'docx', // OOXML generic
      };
      const expected = extToKind[ext];
      const magicOk = expected ? detected === expected : false;

      if (!magicOk) {
        await unlink(destPath).catch(() => {});
        return reply.code(400).send({
          ok: false,
          error: 'MAGIC_MISMATCH',
          hint: 'محتوى الملف لا يطابق الامتداد',
        });
      }

      const sha256Hex = hash.digest('hex');

      if (existsRequestFileBySha256(id, sha256Hex)) {
        // Idempotent retry — same file already saved for this request
        await unlink(destPath).catch(() => {});
        return { ok: true, dedup: true };
      }

      const pageCount = await countFilePages(destPath, ext);

      const savedFile = addRequestFile({
        requestId: id,
        localPath: destPath,
        filename: filename,
        mimeType: mime,
        sizeBytes: bytes,
        sha256: sha256Hex,
        magicByteVerified: true,
        pages: pageCount,
        options: fileOptions,
      });

      recalcRequestPages(id);
      const updatedRequest = getRequestById(id);

      emit({
        type: 'requests:changed',
        reason: 'file-added',
        requestId: id,
        file: savedFile,
        payload: updatedRequest ?? undefined,
      });
      return { ok: true, file: savedFile, request: updatedRequest };
    },
  );

  server.get('/requests/:id/files', async (req: any) => {
    const { id } = req.params as { id: string };
    return { items: listRequestFiles(id) };
  });

  await server.listen({ port: currentPort, host: '0.0.0.0' });

  startCleanupTask();

  return { port: currentPort };
}

function startCleanupTask(): void {
  const runOnce = (): void => {
    try {
      const abandonedMs = ABANDONED_UPLOAD_TTL_HOURS * 60 * 60 * 1000;
      const readyRetainMs = READY_REQUEST_RETENTION_DAYS * 24 * 60 * 60 * 1000;
      const retainMs = COMPLETED_REQUEST_RETENTION_DAYS * 24 * 60 * 60 * 1000;

      let deleted = 0;
      for (const id of findAbandonedRequests(abandonedMs)) {
        deleteRequest(id);
        deleted++;
      }
      for (const id of findExpiredReadyRequests(readyRetainMs)) {
        deleteRequest(id);
        deleted++;
      }
      for (const id of findExpiredCompletedRequests(retainMs)) {
        deleteRequest(id);
        deleted++;
      }
      const purgedAttempts = purgeOldPinAttempts(24 * 60 * 60 * 1000);
      if (deleted > 0 || purgedAttempts > 0) {
        // eslint-disable-next-line no-console
        console.log(
          `[UOADrop] cleanup: deleted ${deleted} requests, purged ${purgedAttempts} pin_attempts`,
        );
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[UOADrop] cleanup error', err);
    }
  };

  // Initial run shortly after startup, then hourly
  setTimeout(runOnce, 10_000).unref?.();
  setInterval(runOnce, 60 * 60 * 1000).unref?.();
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function normalizePrintOptionsPayload(source?: Record<string, unknown> | null): {
  copies: number;
  color: boolean;
  doubleSided: boolean;
  pagesPerSheet?: 1 | 2 | 4;
  pageRange?: string;
} {
  const pagesPerSheet = source?.pagesPerSheet === 1 || source?.pagesPerSheet === 2 || source?.pagesPerSheet === 4
    ? source.pagesPerSheet
    : undefined;
  const pageRange = typeof source?.pageRange === 'string' && source.pageRange.trim().length > 0
    ? source.pageRange.trim().slice(0, 120)
    : undefined;
  return {
    copies: clampInt(source?.copies, 1, 10, 1),
    color: !!source?.color,
    doubleSided: source?.doubleSided === undefined ? true : !!source.doubleSided,
    ...(pagesPerSheet ? { pagesPerSheet } : {}),
    ...(pageRange ? { pageRange } : {}),
  };
}

function parseMultipartOptions(value: unknown): Record<string, unknown> {
  if (typeof value !== 'string' || value.trim().length === 0) return {};
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function firstLanIpv4(): string | null {
  const ifs = networkInterfaces();
  for (const name of Object.keys(ifs)) {
    for (const addr of ifs[name] ?? []) {
      if (addr.family === 'IPv4' && !addr.internal) return addr.address;
    }
  }
  return null;
}

function defaultUploadUrl(port: number): string {
  const ip = firstLanIpv4() ?? 'localhost';
  return `http://${ip}:${port}/`;
}

function resolveResourcePath(filename: string): string | null {
  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  const candidates = [
    resolve(process.cwd(), 'apps/desktop/resources', filename),
    resolve(process.cwd(), 'resources', filename),
    resolve(__dirname, '../../resources', filename),
    resolve(__dirname, '../resources', filename),
    ...(typeof resourcesPath === 'string'
      ? [
          resolve(resourcesPath, 'resources', filename),
          resolve(resourcesPath, filename),
        ]
      : []),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}
