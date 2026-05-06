#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const activationPath = process.argv[2]
  || join(homedir(), 'Library/Application Support/@uoadrop/desktop/online-mode-activation.json');
const baseUrl = process.env.UOADROP_PRODUCTION_BASE_URL || 'https://uoadrop.vercel.app';
const record = JSON.parse(readFileSync(activationPath, 'utf8'));

if (!record.token) {
  console.error('Missing activation token');
  process.exit(1);
}

const res = await fetch(`${baseUrl}/api/desktop/telegram/webhook/sync`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${record.token}`,
  },
  body: JSON.stringify({ dropPendingUpdates: false }),
});

const payload = await res.json().catch(() => ({}));
console.log(JSON.stringify({
  status: res.status,
  ok: payload.ok ?? false,
  error: payload.error ?? null,
  details: payload.details ?? null,
  webhook: payload.webhook ?? null,
}, null, 2));

if (!res.ok || payload.ok === false) process.exit(1);
