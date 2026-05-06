#!/usr/bin/env node

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TOKEN) {
  console.error('Missing TELEGRAM_BOT_TOKEN env var');
  process.exit(1);
}

const res = await fetch(`https://api.telegram.org/bot${TOKEN}/getWebhookInfo`);
const payload = await res.json();

if (!payload.ok) {
  console.log(JSON.stringify({ ok: false, description: payload.description ?? null }, null, 2));
  process.exit(1);
}

const result = payload.result ?? {};
console.log(JSON.stringify({
  ok: true,
  url: result.url ?? null,
  hasCustomCertificate: Boolean(result.has_custom_certificate),
  pendingUpdateCount: result.pending_update_count ?? 0,
  lastErrorDate: result.last_error_date ?? null,
  lastErrorMessage: result.last_error_message ?? null,
  maxConnections: result.max_connections ?? null,
  allowedUpdates: result.allowed_updates ?? null,
}, null, 2));

if (result.last_error_message) process.exit(1);
