import type { PrintRequest } from '@uoadrop/shared';
import { logRequestEvent } from './db';
import { getDesktopGatewayConfig } from './runtime-config';

let started = false;

type TelegramNotificationEvent = 'linked' | 'ready';

function isConfigured(): boolean {
  return Boolean(getDesktopGatewayConfig());
}

async function sendGatewayTelegramEvent(requestId: string, event: TelegramNotificationEvent): Promise<boolean> {
  const config = getDesktopGatewayConfig();
  if (!config) return false;
  try {
    const res = await fetch(`${config.baseUrl}/api/desktop/telegram`, {
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

export async function notifyTelegramRequestReceived(request: PrintRequest): Promise<void> {
  const ok = await sendGatewayTelegramEvent(request.id, 'linked');
  logRequestEvent({
    requestId: request.id,
    type: 'status_changed',
    actor: 'system',
    status: request.status,
    details: { notification: 'telegram_request_received', ok },
  });
}

export async function notifyTelegramReady(request: PrintRequest): Promise<void> {
  const ok = await sendGatewayTelegramEvent(request.id, 'ready');
  logRequestEvent({
    requestId: request.id,
    type: 'ready',
    actor: 'system',
    status: request.status,
    details: { notification: 'telegram_ready', ok },
  });
}

export function startTelegramNotificationService(): void {
  if (started) return;
  if (!isConfigured()) {
    // eslint-disable-next-line no-console
    console.warn('[UOADrop] Telegram notifications disabled: desktop gateway activation is missing.');
    return;
  }

  started = true;
  // eslint-disable-next-line no-console
  console.log('[UOADrop] Telegram configured — notifications routed via Desktop Gateway.');
}

export function stopTelegramNotificationService(): void {
  started = false;
}
