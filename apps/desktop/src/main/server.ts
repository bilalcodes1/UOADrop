import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import { emit, subscribe } from './events';
import { createWriteStream, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import QRCode from 'qrcode';
import {
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_MB,
  MAX_FILES_PER_REQUEST,
  PIN_LOCKOUT_MINUTES,
  PIN_MAX_ATTEMPTS,
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
  getDb,
  listRequests,
  listRequestFiles,
  purgeOldPinAttempts,
  recentFailedPinAttempts,
  recordPinAttempt,
  seedIfEmpty,
  setRequestStatus,
  verifyStudentPinByTicket,
} from './db';
import {
  ABANDONED_UPLOAD_TTL_HOURS,
  COMPLETED_REQUEST_RETENTION_DAYS,
} from '@uoadrop/shared';

const DEFAULT_PORT = 3737;

function getDataDir(): string {
  return resolve(process.cwd(), './data');
}

function getUploadsDir(): string {
  return resolve(getDataDir(), './uploads');
}

export async function startLocalServer(): Promise<{ port: number }> {
  // Ensure DB initializes on server start
  getDb();
  seedIfEmpty();

  mkdirSync(getUploadsDir(), { recursive: true });

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

  const studentHtmlPath = resolveStudentHtmlPath();
  const studentHtml = studentHtmlPath && existsSync(studentHtmlPath)
    ? readFileSync(studentHtmlPath, 'utf8')
    : '<!doctype html><html><body><h1>UOADrop</h1><p>student.html not found</p></body></html>';

  server.get('/', async (_req, reply) => {
    reply.header('content-type', 'text/html; charset=utf-8');
    return studentHtml;
  });

  server.get('/health', async () => ({ ok: true }));

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
      '@page { size: A4; margin: 20mm; }',
      'body{font-family:-apple-system,Segoe UI,Tahoma,sans-serif;color:#1a2332;margin:0;padding:20mm;text-align:center}',
      '.sign{max-width:540px;margin:0 auto;border:1px solid #e1e5eb;border-radius:16px;padding:28px}',
      'h1{color:#0b5cff;font-size:28px;margin:0 0 6px}',
      '.sub{color:#64748b;margin:0 0 16px}',
      '.qr{margin:16px auto;display:inline-block;background:#fff;padding:10px;border-radius:12px;border:1px solid #e1e5eb}',
      '.qr img{display:block;width:300px;height:300px}',
      '.steps{text-align:right;margin:14px auto 0;max-width:520px;font-size:14px;line-height:1.9}',
      '.url{font-family:SFMono-Regular,Menlo,monospace;background:#f4f6f9;padding:6px 10px;border-radius:8px;display:inline-block}',
      '.actions{margin-top:12px}',
      '@media print { .actions{display:none} }',
      '</style></head><body>',
      '<div class="sign">',
      '<h1>UOADrop</h1>',
      '<p class="sub">ارفع ملفات الطباعة بسرعة عبر واي فاي المكتبة</p>',
      '<div class="qr"><img alt="QR" src="' + dataUrl + '"/></div>',
      '<p>أو افتح: <span class="url">' + url + '</span></p>',
      '<ol class="steps">',
      '<li>اتصل بشبكة الواي فاي: <b>UOADrop-Library</b></li>',
      '<li>امسح QR أو افتح الرابط أعلاه بالمتصفح</li>',
      '<li>املأ الفورم وارفع الملفات</li>',
      '<li>احفظ <b>التذكرة</b> و <b>PIN</b> للاستلام</li>',
      '</ol>',
      '<div class="actions"><button onclick="window.print()" style="padding:10px 16px;border-radius:10px;border:0;background:#0b5cff;color:#fff;font-weight:700">طباعة</button></div>',
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
      const studentName = rawName.length > 0 ? rawName.slice(0, 80) : undefined;

      const options = body?.options ?? {};
      const copies = clampInt(options.copies, 1, 10, 1);
      const totalPages = clampInt(body.totalPages, 1, 500, 1);
      const color = !!options.color;
      const doubleSided = options.doubleSided === undefined ? true : !!options.doubleSided;

      if (!Number.isFinite(totalPages) || totalPages < 1) {
        return reply.code(400).send({ ok: false, error: 'invalid body' });
      }

      // Simple pricing (Phase 1.5+: central pricing rules)
      const perPage = color ? 250 : 100;
      const priceIqd = perPage * totalPages * copies;

      const created = createRequest({
        studentName,
        options: { copies, color, doubleSided },
        totalPages,
        priceIqd,
      });

      emit({ type: 'requests:changed', reason: 'created', requestId: created.request.id });
      return reply.send(created);
    },
  );

  server.post(
    '/api/verify-pin',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (req: any, reply: any) => {
      const body = (req.body ?? {}) as { ticket?: string; pin?: string };
      const ticket = String(body.ticket ?? '').trim().toUpperCase().slice(0, 8);
      const pin = String(body.pin ?? '').trim();

      if (!ticket || !pin) {
        return reply.code(400).send({ ok: false, error: 'missing ticket or pin' });
      }

      const scope = `student:${ticket}`;
      const windowMs = PIN_LOCKOUT_MINUTES * 60 * 1000;
      const failures = recentFailedPinAttempts(scope, windowMs);
      if (failures >= PIN_MAX_ATTEMPTS) {
        return reply.code(429).send({
          ok: false,
          locked: true,
          remaining: 0,
          lockoutMinutes: PIN_LOCKOUT_MINUTES,
          hint: `تم تجميد التحقق لهذه التذكرة لمدة ${PIN_LOCKOUT_MINUTES} دقيقة`,
        });
      }

      const res = verifyStudentPinByTicket(ticket, pin);
      recordPinAttempt(scope, res.ok);
      const remaining = Math.max(0, PIN_MAX_ATTEMPTS - (res.ok ? 0 : failures + 1));

      if (!res.ok) {
        return reply.code(401).send({
          ok: false,
          locked: false,
          remaining,
          hint: res.requestId ? 'PIN خاطئ' : 'التذكرة غير موجودة',
        });
      }

      return {
        ok: true,
        remaining,
        requestId: res.requestId,
        status: res.status,
      };
    },
  );

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

      addRequestFile({
        requestId: id,
        localPath: destPath,
        filename: basename(destPath),
        mimeType: mime,
        sizeBytes: bytes,
        sha256: sha256Hex,
        magicByteVerified: true,
      });

      emit({ type: 'requests:changed', reason: 'file-added', requestId: id });
      return { ok: true };
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
      const retainMs = COMPLETED_REQUEST_RETENTION_DAYS * 24 * 60 * 60 * 1000;

      let deleted = 0;
      for (const id of findAbandonedRequests(abandonedMs)) {
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

function resolveStudentHtmlPath(): string | null {
  // Candidates: dev (cwd + repo), build dist, packaged app resources.
  const candidates = [
    resolve(process.cwd(), 'apps/desktop/resources/student.html'),
    resolve(process.cwd(), 'resources/student.html'),
    resolve(__dirname, '../../resources/student.html'),
    resolve(__dirname, '../resources/student.html'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return candidates[0] ?? null;
}
