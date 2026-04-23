import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import { createWriteStream, mkdirSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
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

  await server.register(multipart, {
    limits: {
      fileSize: MAX_FILE_SIZE_MB * 1024 * 1024,
      files: 1, // one part per upload request
      fieldSize: 1024 * 1024,
    },
  });

  server.get('/', async (_req, reply) => {
    reply.header('content-type', 'text/html; charset=utf-8');
    return [
      '<!doctype html>',
      '<html lang="ar" dir="rtl">',
      '  <head>',
      '    <meta charset="utf-8" />',
      '    <meta name="viewport" content="width=device-width, initial-scale=1" />',
      '    <title>UOADrop — رفع ملفات الطباعة</title>',
      '    <style>',
      '      body{font-family:-apple-system,Segoe UI,Tahoma,sans-serif;background:#f4f6f9;color:#1a2332;margin:0;padding:24px}',
      '      .card{max-width:720px;margin:0 auto;background:#fff;border:1px solid #e1e5eb;border-radius:12px;padding:20px;box-shadow:0 6px 20px rgba(0,0,0,.06)}',
      '      h1{margin:0 0 6px;color:#0b5cff;font-size:22px}',
      '      p{margin:0 0 14px;color:#64748b}',
      '      label{display:block;margin:12px 0 6px;font-weight:600}',
      '      input,select{width:100%;padding:10px 12px;border:1px solid #e1e5eb;border-radius:10px;font-size:14px}',
      '      .row{display:grid;grid-template-columns:1fr 1fr;gap:12px}',
      '      button{margin-top:16px;width:100%;padding:12px;border:0;border-radius:10px;background:#0b5cff;color:#fff;font-weight:700;font-size:15px}',
      '      .out{margin-top:14px;padding:12px;border-radius:10px;background:#0b5cff14;border:1px solid #0b5cff33;display:none}',
      '      code{font-family:SFMono-Regular,Menlo,monospace}',
      '    </style>',
      '  </head>',
      '  <body>',
      '    <div class="card">',
      '      <h1>رفع ملفات الطباعة</h1>',
      '      <p>املأ المعلومات ثم ارفع الملفات. بعد الإرسال ستحصل على رقم تذكرة + PIN للاستلام.</p>',
      '      <form id="f">',
      '        <label>الاسم</label>',
      '        <input name="studentName" placeholder="الاسم الثلاثي" />',
      '        <div class="row">',
      '          <div>',
      '            <label>عدد النسخ</label>',
      '            <input name="copies" type="number" min="1" value="1" required />',
      '          </div>',
      '          <div>',
      '            <label>نوع الطباعة</label>',
      '            <select name="color">',
      '              <option value="false" selected>أبيض/أسود</option>',
      '              <option value="true">ملوّن</option>',
      '            </select>',
      '          </div>',
      '        </div>',
      '        <div class="row">',
      '          <div>',
      '            <label>وجهين</label>',
      '            <select name="doubleSided">',
      '              <option value="true" selected>نعم</option>',
      '              <option value="false">لا</option>',
      '            </select>',
      '          </div>',
      '          <div>',
      '            <label>عدد الصفحات (تقريبي)</label>',
      '            <input name="totalPages" type="number" min="1" value="1" required />',
      '          </div>',
      '        </div>',
      '        <label>الملفات</label>',
      '        <input name="files" type="file" multiple required />',
      '        <button type="submit">إرسال</button>',
      '      </form>',
      '      <div id="out" class="out"></div>',
      '    </div>',
      '    <script>',
      '      const f = document.getElementById("f");',
      '      const out = document.getElementById("out");',
      '      f.addEventListener("submit", async (e) => {',
      '        e.preventDefault();',
      '        out.style.display = "none";',
      '        out.textContent = "";',
      '        const fd = new FormData(f);',
      '        const studentName = fd.get("studentName") || "";',
      '        const copies = Number(fd.get("copies") || 1);',
      '        const color = (fd.get("color") || "false") === "true";',
      '        const doubleSided = (fd.get("doubleSided") || "true") === "true";',
      '        const totalPages = Number(fd.get("totalPages") || 1);',
      '        const createRes = await fetch("/api/requests", {',
      '          method: "POST",',
      '          headers: { "content-type": "application/json" },',
      '          body: JSON.stringify({ studentName, options: { copies, color, doubleSided }, totalPages })',
      '        });',
      '        if (!createRes.ok) {',
      '          out.style.display = "block";',
      '          out.textContent = "فشل إنشاء الطلب";',
      '          return;',
      '        }',
      '        const created = await createRes.json();',
      '        const requestId = created.request.id;',
      '        const files = fd.getAll("files");',
      '        for (const file of files) {',
      '          const up = new FormData();',
      '          up.append("file", file);',
      '          const r = await fetch("/api/requests/" + requestId + "/files", { method: "POST", body: up });',
      '          if (!r.ok) {',
      '            out.style.display = "block";',
      '            out.textContent = "فشل رفع ملف";',
      '            return;',
      '          }',
      '        }',
      '        out.style.display = "block";',
      '        out.innerHTML = "تم استلام طلبك ✅<br/>التذكرة: <code>" + created.request.ticket + "</code><br/>PIN: <code>" + created.pin + "</code>";',
      '        f.reset();',
      '      });',
      '    </script>',
      '  </body>',
      '</html>',
    ].join('\n');
  });

  server.get('/health', async () => ({ ok: true }));

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

      addRequestFile({
        requestId: id,
        localPath: destPath,
        filename: basename(destPath),
        mimeType: mime,
        sizeBytes: bytes,
        sha256: hash.digest('hex'),
        magicByteVerified: true,
      });

      return { ok: true };
    },
  );

  server.get('/requests/:id/files', async (req: any) => {
    const { id } = req.params as { id: string };
    return { items: listRequestFiles(id) };
  });

  const port = Number(process.env.DESKTOP_PORT ?? DEFAULT_PORT);
  await server.listen({ port, host: '0.0.0.0' });

  startCleanupTask();

  return { port };
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
