import type { PrintRequest } from '@uoadrop/shared';
import { logRequestEvent } from './db';
import { getWebBaseUrl } from './runtime-config';

function getEmailNotifyUrl(): string {
  const base = getWebBaseUrl();
  return base ? `${base}/api/notify/email` : '';
}

export async function notifyEmailReceived(request: PrintRequest): Promise<void> {
  if (!request.studentEmail) return;
  const url = getEmailNotifyUrl();
  if (!url) return;

  let ok = false;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: request.id, event: 'received' }),
    });
    ok = res.ok;
  } catch {
    ok = false;
  }

  logRequestEvent({
    requestId: request.id,
    type: 'status_changed',
    actor: 'system',
    status: request.status,
    details: { notification: 'email_received', ok },
  });
}

export async function notifyEmailReady(request: PrintRequest): Promise<void> {
  if (!request.studentEmail) return;
  const url = getEmailNotifyUrl();
  if (!url) return;

  let ok = false;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: request.id, event: 'ready' }),
    });
    ok = res.ok;
  } catch {
    ok = false;
  }

  logRequestEvent({
    requestId: request.id,
    type: 'ready',
    actor: 'system',
    status: request.status,
    details: { notification: 'email_ready', ok },
  });
}
