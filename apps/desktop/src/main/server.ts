import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import { mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { addRequestFile, getDb, listRequests, listRequestFiles, seedIfEmpty, setRequestStatus } from './db';

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

  server.get('/health', async () => ({ ok: true }));

  server.get('/requests', async () => ({ items: listRequests() }));

  server.post('/requests/:id/status', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { status?: string };
    if (!body?.status) return reply.code(400).send({ ok: false, error: 'missing status' });
    setRequestStatus(id, body.status as any);
    return { ok: true };
  });

  // Upload file for existing request (Phase 1.4+: validate magic bytes & type)
  server.post('/requests/:id/files', async (req, reply) => {
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

  server.get('/requests/:id/files', async (req) => {
    const { id } = req.params as { id: string };
    return { items: listRequestFiles(id) };
  });

  const port = Number(process.env.DESKTOP_PORT ?? DEFAULT_PORT);
  await server.listen({ port, host: '0.0.0.0' });
  return { port };
}
