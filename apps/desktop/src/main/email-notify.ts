import type { PrintRequest } from '@uoadrop/shared';
import { logRequestEvent } from './db';
import { getDesktopGatewayConfig } from './runtime-config';

type EmailNotificationEvent = 'received' | 'ready';

async function sendGatewayEmailEvent(requestId: string, event: EmailNotificationEvent): Promise<boolean> {
  const config = getDesktopGatewayConfig();
  if (!config) return false;
  try {
    const res = await fetch(`${config.baseUrl}/api/desktop/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.token}`,
      },
      body: JSON.stringify({ requestId, event }),
    });
    const payload = (await res.json().catch(() => ({}))) as { ok?: boolean };
    return res.ok && payload.ok !== false;
  } catch {
    return false;
  }
}

export async function notifyEmailReceived(request: PrintRequest): Promise<void> {
  if (!request.studentEmail) return;
  const ok = await sendGatewayEmailEvent(request.id, 'received');

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
  const ok = await sendGatewayEmailEvent(request.id, 'ready');

  logRequestEvent({
    requestId: request.id,
    type: 'ready',
    actor: 'system',
    status: request.status,
    details: { notification: 'email_ready', ok },
  });
}
