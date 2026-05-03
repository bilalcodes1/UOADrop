import { createClient } from '@supabase/supabase-js';
import { getNotifyServerUrl, getOnlineModeStatus, getSupabaseRuntimeConfig, getWebBaseUrl } from './runtime-config';

export type OnlineAnnouncementCounts = {
  emails: number;
  telegram: number;
  totalChannels: number;
};

export type OnlineAnnouncementResult = {
  ok: boolean;
  error?: string;
  details?: string;
  counts?: OnlineAnnouncementCounts;
  sent?: {
    emails: number;
    telegram: number;
  };
  failed?: {
    emails: number;
    telegram: number;
  };
  skipped?: {
    emails: boolean;
    telegram: boolean;
  };
};

type OnlineAnnouncementArgs = {
  title?: string;
  message?: string;
  channels?: {
    email?: boolean;
    telegram?: boolean;
  };
};

type ContactRow = {
  student_email: string | null;
  telegram_chat_id: string | null;
};

type OnlineAnnouncementContacts = {
  emails: string[];
  telegramChatIds: string[];
};

function getAnnouncementUrl(): string {
  const base = getWebBaseUrl();
  if (base) return `${base}/api/notify/announcement`;
  const notifyUrl = getNotifyServerUrl();
  if (!notifyUrl) return '';
  try {
    return `${new URL(notifyUrl).origin}/api/notify/announcement`;
  } catch {
    return '';
  }
}

function normalizeEmail(value: string | null): string | null {
  const email = String(value ?? '').trim().toLowerCase();
  if (!email || !email.includes('@') || email.length > 180) return null;
  return email;
}

function normalizeChatId(value: string | null): string | null {
  const chatId = String(value ?? '').trim();
  if (!chatId || chatId.length > 80) return null;
  return chatId;
}

function buildCounts(contacts: OnlineAnnouncementContacts): OnlineAnnouncementCounts {
  return {
    emails: contacts.emails.length,
    telegram: contacts.telegramChatIds.length,
    totalChannels: contacts.emails.length + contacts.telegramChatIds.length,
  };
}

async function loadOnlineContactsFromSupabase(): Promise<OnlineAnnouncementContacts> {
  const onlineStatus = getOnlineModeStatus();
  if (!onlineStatus.enabled) throw new Error(onlineStatus.reason);
  const { url, serviceRoleKey } = getSupabaseRuntimeConfig();
  if (!url) throw new Error('missing_supabase_url');
  if (!serviceRoleKey) throw new Error('missing_service_role_key');

  const client = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  const { data, error } = await client
    .from('print_requests')
    .select('student_email, telegram_chat_id')
    .eq('source', 'online')
    .order('created_at', { ascending: false })
    .limit(5000);

  if (error) throw error;

  const emails = new Set<string>();
  const telegramChatIds = new Set<string>();
  for (const row of (data ?? []) as ContactRow[]) {
    const email = normalizeEmail(row.student_email);
    const chatId = normalizeChatId(row.telegram_chat_id);
    if (email) emails.add(email);
    if (chatId) telegramChatIds.add(chatId);
  }

  return {
    emails: [...emails],
    telegramChatIds: [...telegramChatIds],
  };
}

async function postAnnouncement(body: Record<string, unknown>): Promise<OnlineAnnouncementResult> {
  const onlineStatus = getOnlineModeStatus();
  if (!onlineStatus.enabled) return { ok: false, error: onlineStatus.reason };
  const url = getAnnouncementUrl();
  const serviceRoleKey = getSupabaseRuntimeConfig().serviceRoleKey;
  if (!url) return { ok: false, error: 'missing_web_base_url' };
  if (!serviceRoleKey) return { ok: false, error: 'missing_service_role_key' };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify(body),
    });
    const payload = (await res.json().catch(() => ({}))) as OnlineAnnouncementResult;
    if (!res.ok) return { ok: false, error: payload.error ?? `http_${res.status}`, details: payload.details };
    return payload;
  } catch (err) {
    return { ok: false, error: 'network_error', details: String((err as Error)?.message ?? err).slice(0, 200) };
  }
}

export async function getOnlineAnnouncementPreview(): Promise<OnlineAnnouncementResult> {
  const webResult = await postAnnouncement({ dryRun: true });
  if (webResult.ok) return webResult;

  try {
    const contacts = await loadOnlineContactsFromSupabase();
    return { ok: true, counts: buildCounts(contacts) };
  } catch (err) {
    return {
      ok: false,
      error: webResult.error ?? 'supabase_preview_error',
      details: webResult.details ?? String((err as Error)?.message ?? err).slice(0, 200),
    };
  }
}

export async function sendOnlineAnnouncement(args: OnlineAnnouncementArgs): Promise<OnlineAnnouncementResult> {
  const title = String(args.title ?? '').trim().slice(0, 90);
  const message = String(args.message ?? '').trim().slice(0, 1600);
  return postAnnouncement({
    title,
    message,
    channels: {
      email: args.channels?.email !== false,
      telegram: args.channels?.telegram !== false,
    },
  });
}
