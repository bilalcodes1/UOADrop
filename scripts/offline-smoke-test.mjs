#!/usr/bin/env node

const BASE_URL = process.env.UOADROP_OFFLINE_BASE_URL || 'http://127.0.0.1:3737';

async function readJson(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text.slice(0, 200) };
  }
}

function assert(condition, message, details) {
  if (!condition) {
    const error = new Error(message);
    error.details = details;
    throw error;
  }
}

const results = [];

async function step(name, fn) {
  try {
    const value = await fn();
    results.push({ name, ok: true, ...value });
    return value;
  } catch (error) {
    results.push({
      name,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      details: error?.details ?? null,
    });
    throw error;
  }
}

let requestId = '';
let ticket = '';

await step('health', async () => {
  const res = await fetch(`${BASE_URL}/health`);
  const body = await readJson(res);
  assert(res.ok && body.ok === true, 'health check failed', { status: res.status, body });
  return { status: res.status };
});

await step('create local request', async () => {
  const res = await fetch(`${BASE_URL}/api/requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      studentName: 'Offline Smoke Test',
      notes: 'offline smoke test',
      options: { copies: 1, color: false, doubleSided: true },
      totalPages: 0,
    }),
  });
  const body = await readJson(res);
  assert(res.ok && body.request?.id && body.request?.source === 'local', 'create request failed', { status: res.status, body });
  requestId = body.request.id;
  ticket = body.request.ticket;
  return { status: res.status, requestId, ticket, source: body.request.source, requestStatus: body.request.status };
});

await step('upload valid pdf file', async () => {
  const pdfBytes = new Uint8Array([
    0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a,
    0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a,
    0x31, 0x20, 0x30, 0x20, 0x6f, 0x62, 0x6a, 0x0a,
    0x3c, 0x3c, 0x3e, 0x3e, 0x0a,
    0x65, 0x6e, 0x64, 0x6f, 0x62, 0x6a, 0x0a,
    0x74, 0x72, 0x61, 0x69, 0x6c, 0x65, 0x72, 0x0a,
    0x3c, 0x3c, 0x3e, 0x3e, 0x0a,
    0x25, 0x25, 0x45, 0x4f, 0x46, 0x0a,
  ]);
  const form = new FormData();
  form.append('options', JSON.stringify({ copies: 1, color: false, doubleSided: true }));
  form.append('file', new Blob([pdfBytes], { type: 'application/pdf' }), 'offline-smoke.pdf');
  const res = await fetch(`${BASE_URL}/api/requests/${requestId}/files`, {
    method: 'POST',
    body: form,
  });
  const body = await readJson(res);
  assert(res.ok && body.ok === true && body.file?.id, 'upload file failed', { status: res.status, body });
  return { status: res.status, fileId: body.file.id, sizeBytes: body.file.sizeBytes, requestStatus: body.request?.status };
});

await step('reject invalid magic bytes', async () => {
  const form = new FormData();
  form.append('file', new Blob([new TextEncoder().encode('not a pdf')], { type: 'application/pdf' }), 'fake.pdf');
  const res = await fetch(`${BASE_URL}/api/requests/${requestId}/files`, {
    method: 'POST',
    body: form,
  });
  const body = await readJson(res);
  assert(res.status === 400 && body.error === 'MAGIC_MISMATCH', 'invalid magic was not rejected', { status: res.status, body });
  return { status: res.status, error: body.error };
});

await step('fetch request with files count', async () => {
  const res = await fetch(`${BASE_URL}/api/requests/${requestId}`);
  const body = await readJson(res);
  assert(res.ok && body.request?.id === requestId && body.filesCount === 1, 'request fetch failed', { status: res.status, body });
  return { status: res.status, filesCount: body.filesCount, filesDone: body.filesDone, requestStatus: body.request.status };
});

await step('public status route is disabled', async () => {
  const res = await fetch(`${BASE_URL}/requests/${requestId}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'printing' }),
  });
  const body = await readJson(res);
  assert(res.status === 410 && body.error === 'deprecated_use_desktop_dashboard', 'public status route is not disabled', { status: res.status, body });
  return { status: res.status, error: body.error };
});

await step('verify request remains pending after disabled route', async () => {
  const res = await fetch(`${BASE_URL}/api/requests/${requestId}`);
  const body = await readJson(res);
  assert(res.ok && body.request?.status === 'pending', 'pending verification failed', { status: res.status, body });
  return { status: res.status, requestStatus: body.request.status, ticket: body.request.ticket };
});

const allOk = results.every((result) => result.ok);
console.log(JSON.stringify({ baseUrl: BASE_URL, allOk, requestId, ticket, results }, null, 2));
process.exit(allOk ? 0 : 1);
