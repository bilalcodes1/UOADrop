#!/usr/bin/env node

const BASE_URL = process.env.UOADROP_PRODUCTION_BASE_URL || 'https://uoadrop.vercel.app';

const checks = [
  {
    name: 'reject default activation password',
    method: 'POST',
    path: '/api/desktop/activate',
    body: { passphrase: 'bilalcodes1', deviceId: 'audit-device' },
    expectedStatuses: [401, 500],
    expectedErrors: ['invalid_activation_password', 'weak_desktop_activation_password'],
  },
  {
    name: 'desktop status requires token',
    method: 'GET',
    path: '/api/desktop/status',
    expectedStatuses: [401],
    expectedErrors: ['unauthorized'],
  },
  {
    name: 'legacy email route is gone',
    method: 'POST',
    path: '/api/notify/email',
    body: {},
    expectedStatuses: [410],
    expectedErrors: ['deprecated_use_desktop_gateway'],
  },
  {
    name: 'legacy telegram route is gone',
    method: 'POST',
    path: '/api/notify/telegram',
    body: {},
    expectedStatuses: [410],
    expectedErrors: ['deprecated_use_desktop_gateway'],
  },
  {
    name: 'legacy delayed route is gone',
    method: 'POST',
    path: '/api/notify/delayed',
    body: {},
    expectedStatuses: [410],
    expectedErrors: ['deprecated_use_cron_endpoint'],
  },
  {
    name: 'telegram webhook requires secret header',
    method: 'POST',
    path: '/api/telegram/webhook',
    body: {},
    expectedStatuses: [401],
    expectedErrors: ['unauthorized'],
  },
];

async function request(check) {
  const res = await fetch(`${BASE_URL}${check.path}`, {
    method: check.method,
    headers: { 'Content-Type': 'application/json' },
    body: check.body === undefined ? undefined : JSON.stringify(check.body),
  });
  const text = await res.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text.slice(0, 200) };
  }
  const error = typeof payload.error === 'string' ? payload.error : null;
  const ok = check.expectedStatuses.includes(res.status)
    && (!check.expectedErrors?.length || check.expectedErrors.includes(error));
  return {
    name: check.name,
    path: check.path,
    status: res.status,
    error,
    ok,
  };
}

const results = [];
for (const check of checks) {
  try {
    results.push(await request(check));
  } catch (error) {
    results.push({
      name: check.name,
      path: check.path,
      status: null,
      error: error instanceof Error ? error.message : String(error),
      ok: false,
    });
  }
}

const allOk = results.every((result) => result.ok);
console.log(JSON.stringify({ baseUrl: BASE_URL, allOk, results }, null, 2));
if (!allOk) process.exit(1);
