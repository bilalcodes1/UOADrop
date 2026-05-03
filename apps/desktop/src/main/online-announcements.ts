import { getSupabaseRuntimeConfig, getWebBaseUrl } from './runtime-config';

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

function getAnnouncementUrl(): string {
  const base = getWebBaseUrl();
  return base ? `${base}/api/notify/announcement` : '';
}

async function postAnnouncement(body: Record<string, unknown>): Promise<OnlineAnnouncementResult> {
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
  return postAnnouncement({ dryRun: true });
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
