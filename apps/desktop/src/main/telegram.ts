import type { PrintRequest } from '@uoadrop/shared';
import { getRequestByTicket, linkRequestTelegramChat, logRequestEvent } from './db';
import { getTelegramRuntimeConfig, getNotifyServerUrl } from './runtime-config';

type TelegramUpdate = {
  update_id: number;
  message?: {
    chat?: { id?: number | string };
    text?: string;
  };
};

let started = false;
let offset = 0;
let pollTimer: NodeJS.Timeout | null = null;

function getBotToken(): string {
  return getTelegramRuntimeConfig().botToken;
}

function isConfigured(): boolean {
  return Boolean(getBotToken());
}

function formatStudentName(request: PrintRequest): string {
  return request.studentName?.trim() || 'الطالب';
}

function buildTicketLine(request: PrintRequest): string {
  return `رقم التذكرة: ${request.ticket}`;
}

async function telegramRequest<T>(method: string, body: Record<string, unknown>): Promise<T | null> {
  const token = getBotToken();
  if (!token) return null;
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) return null;
    const data = await response.json() as { ok?: boolean; result?: T };
    return data.ok ? data.result ?? null : null;
  } catch {
    return null;
  }
}

export async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
  if (!chatId || !isConfigured()) return false;
  const result = await telegramRequest<unknown>('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  });
  return result !== null;
}

export async function notifyTelegramRequestReceived(request: PrintRequest): Promise<void> {
  if (!request.telegramChatId) return;
  let ok = false;
  const notifyUrl = getNotifyServerUrl();
  if (notifyUrl) {
    try {
      const res = await fetch(notifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: request.id, event: 'linked' }),
      });
      ok = res.ok;
    } catch {
      ok = false;
    }
  } else {
    // Dev fallback only if desktop bot token is configured
    ok = await sendTelegramMessage(
      request.telegramChatId,
      [
        `✅ تم ربط إشعارات UOADrop بنجاح`,
        `مرحباً ${formatStudentName(request)}`,
        buildTicketLine(request),
        `سنرسل لك تحديثاً عندما يصبح الطلب جاهزاً للاستلام.`,
      ].join('\n'),
    );
  }
  logRequestEvent({
    requestId: request.id,
    type: 'status_changed',
    actor: 'system',
    status: request.status,
    details: { notification: 'telegram_request_received', ok },
  });
}

export async function notifyTelegramReady(request: PrintRequest): Promise<void> {
  if (!request.telegramChatId) return;
  let ok = false;
  const notifyUrl = getNotifyServerUrl();
  if (notifyUrl) {
    try {
      const res = await fetch(notifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: request.id, event: 'ready' }),
      });
      ok = res.ok;
    } catch {
      ok = false;
    }
  } else {
    const priceLine = request.finalPriceConfirmedAt && request.priceIqd > 0
      ? `السعر النهائي: ${request.priceIqd.toLocaleString('ar-IQ')} د.ع`
      : `السعر النهائي: يتم تأكيده من موظف المكتبة`;
    ok = await sendTelegramMessage(
      request.telegramChatId,
      [
        `📦 طلبك جاهز للاستلام`,
        `مرحباً ${formatStudentName(request)}`,
        buildTicketLine(request),
        priceLine,
        request.pickupPin ? `PIN الاستلام: ${request.pickupPin}` : '',
        `يرجى مراجعة المكتبة لاستلام الطلب.`,
      ].filter(Boolean).join('\n'),
    );
  }
  logRequestEvent({
    requestId: request.id,
    type: 'ready',
    actor: 'system',
    status: request.status,
    details: { notification: 'telegram_ready', ok },
  });
}

async function handleStartCommand(chatId: string, text: string): Promise<void> {
  const [, rawTicket] = text.trim().split(/\s+/, 2);
  const ticket = String(rawTicket ?? '').trim().toUpperCase().slice(0, 12);
  if (!ticket) {
    await sendTelegramMessage(chatId, 'أرسل /start متبوعاً برقم التذكرة حتى يتم ربط الإشعارات.');
    return;
  }

  const request = getRequestByTicket(ticket);
  if (!request) {
    await sendTelegramMessage(chatId, `لم أجد تذكرة بهذا الرقم: ${ticket}`);
    return;
  }

  const linked = linkRequestTelegramChat(request.id, chatId);
  await notifyTelegramRequestReceived(linked);
  if (linked.status === 'ready') {
    await notifyTelegramReady(linked);
  }
}

async function pollTelegramUpdates(): Promise<void> {
  if (!isConfigured()) return;
  const updates = await telegramRequest<TelegramUpdate[]>('getUpdates', {
    offset: offset || undefined,
    timeout: 0,
    allowed_updates: ['message'],
  });
  if (!updates) return;

  for (const update of updates) {
    offset = Math.max(offset, update.update_id + 1);
    const chatId = update.message?.chat?.id;
    const text = update.message?.text?.trim() ?? '';
    if (!chatId || !text.startsWith('/start')) continue;
    await handleStartCommand(String(chatId), text);
  }
}

export function startTelegramNotificationService(): void {
  if (started) return;
  started = true;
  if (!isConfigured()) {
    // eslint-disable-next-line no-console
    console.warn('[UOADrop] Telegram notifications disabled: TELEGRAM_BOT_TOKEN is not configured.');
    return;
  }

  void pollTelegramUpdates();
  pollTimer = setInterval(() => {
    void pollTelegramUpdates();
  }, 5_000);
}

export function stopTelegramNotificationService(): void {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  started = false;
}
