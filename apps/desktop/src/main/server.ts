import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import { mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { addRequestFile, createRequest, getDb, listRequests, listRequestFiles, seedIfEmpty, setRequestStatus } from './db';

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
    bodyLimit: 50 * 1024 * 1024,
  });

  await server.register(multipart);

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

  server.post('/api/requests', async (req: any, reply: any) => {
    const body = req.body as any;
    const studentName = (body?.studentName as string | undefined) ?? undefined;
    const options = body?.options as any;
    const totalPages = Number(body?.totalPages ?? 1);

    if (!options || !Number.isFinite(totalPages) || totalPages < 1) {
      return reply.code(400).send({ ok: false, error: 'invalid body' });
    }

    // Simple pricing (Phase 1.5+: central pricing rules)
    const perPage = options.color ? 250 : 100;
    const priceIqd = perPage * totalPages * (Number(options.copies ?? 1) || 1);

    const created = createRequest({
      studentName,
      options: {
        copies: Number(options.copies ?? 1) || 1,
        color: !!options.color,
        doubleSided: !!options.doubleSided,
      },
      totalPages,
      priceIqd,
    });

    return reply.send(created);
  });

  server.post('/requests/:id/status', async (req: any, reply: any) => {
    const { id } = req.params as { id: string };
    const body = req.body as { status?: string };
    if (!body?.status) return reply.code(400).send({ ok: false, error: 'missing status' });
    setRequestStatus(id, body.status as any);
    return { ok: true };
  });

  // Upload file for existing request (Phase 1.4+: validate magic bytes & type)
  server.post('/api/requests/:id/files', async (req: any, reply: any) => {
    const { id } = req.params as { id: string };

    const part = await (req as any).file();
    if (!part) return reply.code(400).send({ ok: false, error: 'missing file' });

    const filename = part.filename ?? 'upload.bin';
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const destPath = resolve(getUploadsDir(), `${Date.now()}-${safeName}`);

    // Dev-only: keep it simple by buffering whole file.
    const buf: Buffer = await part.toBuffer();
    const sha256 = createHash('sha256').update(buf).digest('hex');

    await writeFile(destPath, buf);

    addRequestFile({
      requestId: id,
      localPath: destPath,
      filename: basename(destPath),
      mimeType: part.mimetype ?? 'application/octet-stream',
      sizeBytes: buf.length,
      sha256,
      magicByteVerified: false,
    });

    return { ok: true };
  });

  server.get('/requests/:id/files', async (req: any) => {
    const { id } = req.params as { id: string };
    return { items: listRequestFiles(id) };
  });

  const port = Number(process.env.DESKTOP_PORT ?? DEFAULT_PORT);
  await server.listen({ port, host: '0.0.0.0' });
  return { port };
}
