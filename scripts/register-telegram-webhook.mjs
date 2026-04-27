#!/usr/bin/env node
/**
 * One-time script to register the Telegram webhook URL.
 *
 * Usage:
 *   TELEGRAM_BOT_TOKEN=xxx node scripts/register-telegram-webhook.mjs
 *
 * Or with .env:
 *   node scripts/register-telegram-webhook.mjs
 */

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://uoadrop.vercel.app/api/telegram/webhook';

if (!TOKEN) {
  console.error('Missing TELEGRAM_BOT_TOKEN env var');
  process.exit(1);
}

async function main() {
  console.log(`Setting webhook to: ${WEBHOOK_URL}`);

  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: WEBHOOK_URL,
      allowed_updates: ['message'],
      drop_pending_updates: true,
    }),
  });

  const data = await res.json();
  console.log('Response:', JSON.stringify(data, null, 2));

  if (data.ok) {
    console.log('✅ Webhook registered successfully!');
  } else {
    console.error('❌ Failed to register webhook');
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
