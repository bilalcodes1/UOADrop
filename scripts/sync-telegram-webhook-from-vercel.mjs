#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://uoadrop.vercel.app/api/telegram/webhook';

function readEnvFile(filePath, name) {
  const text = readFileSync(filePath, 'utf8');
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = text.match(new RegExp(`^\\s*(?:export\\s+)?${escapedName}\\s*=\\s*(.*)\\s*$`, 'm'));
  if (!match) return '';
  let value = match[1].trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return value.replace(/\\n/g, '\n');
}

function listEnvNames(filePath) {
  const text = readFileSync(filePath, 'utf8');
  return text
    .split(/\r?\n/)
    .map((entry) => entry.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1])
    .filter(Boolean)
    .sort();
}

const tempDir = mkdtempSync(join(tmpdir(), 'uoadrop-vercel-env-'));
const envFile = join(tempDir, 'production.env');

try {
  execFileSync('pnpm', ['dlx', 'vercel@latest', 'env', 'pull', envFile, '--environment=production'], {
    stdio: ['ignore', 'ignore', 'inherit'],
  });

  const token = readEnvFile(envFile, 'TELEGRAM_BOT_TOKEN');
  const secret = readEnvFile(envFile, 'TELEGRAM_WEBHOOK_SECRET');
  if (!token || !secret) {
    console.log(JSON.stringify({
      ok: false,
      missing: [
        !token ? 'TELEGRAM_BOT_TOKEN' : null,
        !secret ? 'TELEGRAM_WEBHOOK_SECRET' : null,
      ].filter(Boolean),
      availableNames: listEnvNames(envFile),
    }, null, 2));
    process.exit(1);
  }

  const setRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: WEBHOOK_URL,
      secret_token: secret,
      allowed_updates: ['message'],
      drop_pending_updates: false,
    }),
  });
  const setPayload = await setRes.json().catch(() => ({}));

  const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  const infoPayload = await infoRes.json().catch(() => ({}));
  const result = infoPayload.result ?? {};

  const output = {
    setWebhookOk: Boolean(setPayload.ok),
    webhookUrl: result.url ?? null,
    pendingUpdateCount: result.pending_update_count ?? null,
    lastErrorDate: result.last_error_date ?? null,
    lastErrorMessage: result.last_error_message ?? null,
    allowedUpdates: result.allowed_updates ?? null,
  };
  console.log(JSON.stringify(output, null, 2));

  if (!setPayload.ok || result.last_error_message) process.exit(1);
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
