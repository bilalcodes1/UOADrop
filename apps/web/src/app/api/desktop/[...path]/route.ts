import { NextRequest } from 'next/server';
import nodemailer from 'nodemailer';
import { getAdminClient, isDesktopAuth, json, requireDesktopAuth, unwrapOnlineFileKey, type DesktopAuth } from '../_lib';

export const dynamic = 'force-dynamic';

const EMAIL_HOST = process.env.EMAIL_HOST || 'smtp-relay.brevo.com';
const EMAIL_PORT = Number(process.env.EMAIL_PORT || 587);
const EMAIL_USER = process.env.EMAIL_USER || '';
const EMAIL_PASS = process.env.EMAIL_PASS || '';
const EMAIL_FROM = process.env.EMAIL_FROM || `UOADrop <${EMAIL_USER}>`;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';
const TELEGRAM_WEBHOOK_URL = process.env.TELEGRAM_WEBHOOK_URL || `${(process.env.WEB_BASE_URL || 'https://uoadrop.vercel.app').replace(/\/+$/, '')}/api/telegram/webhook`;
const MAX_TITLE_LENGTH = 90;
const MAX_MESSAGE_LENGTH = 1600;

const REQUEST_SELECT = [
  'id',
  'library_id',
  'ticket',
  'student_name',
  'student_email',
  'telegram_chat_id',
  'notes',
  'status',
  'price_iqd',
  'total_pages',
  'source',
  'desk_received_at',
  'source_of_truth',
  'import_state',
  'created_at',
  'updated_at',
  'printed_at',
  'picked_up_at',
  'final_price_confirmed_at',
  'online_files_cleanup_at',
  'payment_method',
  'payment_transaction_ref',
  'payment_status',
  'payment_submitted_at',
  'payment_verified_at',
].join(', ');

const FILE_SELECT = [
  'id',
  'library_id',
  'request_id',
  'filename',
  'mime_type',
  'size_bytes',
  'storage_path',
  'copies',
  'color',
  'double_sided',
  'pages_per_sheet',
  'page_range',
  'encryption_algorithm',
  'encryption_key_id',
  'encryption_iv',
  'encrypted_key',
  'encrypted_size_bytes',
].join(', ');

type RouteContext = { params: { path?: string[] } };

type AnnouncementBody = {
  dryRun?: boolean;
  title?: string;
  message?: string;
  channels?: { email?: boolean; telegram?: boolean };
};

type TelegramNotificationBody = {
  requestId?: string;
  event?: 'linked' | 'ready';
};

type TelegramWebhookSyncBody = {
  dropPendingUpdates?: boolean;
};

type EmailNotificationBody = {
  requestId?: string;
  event?: 'received' | 'ready';
};

type ContactRow = {
  student_email: string | null;
  telegram_chat_id: string | null;
};

type TelegramRequestRow = {
  id: string;
  library_id: string | null;
  ticket: string;
  student_name: string | null;
  status: string;
  price_iqd: number | null;
  final_price_confirmed_at: string | null;
  telegram_chat_id: string | null;
};

type EmailRequestRow = {
  id: string;
  library_id: string | null;
  ticket: string;
  student_name: string | null;
  student_email: string | null;
  status: string;
  price_iqd: number | null;
  final_price_confirmed_at: string | null;
};

function applyLibraryScope<T extends { eq: (column: string, value: string) => T }>(query: T, auth: DesktopAuth): T {
  return auth.libraryId ? query.eq('library_id', auth.libraryId) : query;
}

async function requestBelongsToAuth(admin: ReturnType<typeof getAdminClient>, requestId: string, auth: DesktopAuth): Promise<boolean> {
  if (!auth.libraryId) return true;
  const { data, error } = await admin
    .from('print_requests')
    .select('id')
    .eq('id', requestId)
    .eq('source', 'online')
    .eq('library_id', auth.libraryId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

async function touchDesktopDevice(admin: ReturnType<typeof getAdminClient>, auth: DesktopAuth): Promise<void> {
  if (!auth.libraryId) return;
  await admin
    .from('desktop_devices')
    .update({ last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('device_id', auth.deviceId)
    .eq('library_id', auth.libraryId);
}

function normalizeText(value: unknown, maxLength: number): string {
  return String(value ?? '').trim().slice(0, maxLength);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  }[char] ?? char));
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

function formatStudentName(name?: string | null): string {
  const normalized = String(name ?? '').trim();
  return normalized || 'الطالب';
}

async function resolveLibraryDisplayName(
  admin: ReturnType<typeof getAdminClient>,
  libraryId?: string | null,
  auth?: DesktopAuth,
): Promise<string> {
  const fallback = String(auth?.libraryName || auth?.librarySlug || '').trim() || 'المكتبة';
  if (!libraryId) return fallback;
  const { data } = await admin
    .from('libraries')
    .select('name, slug')
    .eq('id', libraryId)
    .maybeSingle();
  const row = data as { name?: string | null; slug?: string | null } | null;
  return String(row?.name || row?.slug || fallback).trim() || fallback;
}

function sanitizePatch(body: Record<string, unknown>): Record<string, unknown> {
  const allowed = new Set([
    'status',
    'price_iqd',
    'total_pages',
    'desk_received_at',
    'printed_at',
    'picked_up_at',
    'source_of_truth',
    'import_state',
    'final_price_confirmed_at',
    'online_files_cleanup_at',
    'payment_status',
    'payment_verified_at',
  ]);
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body ?? {})) {
    if (allowed.has(key)) patch[key] = value;
  }
  patch.updated_at = new Date().toISOString();
  return patch;
}

async function loadOnlineContacts(auth: DesktopAuth): Promise<{ emails: string[]; telegramChatIds: string[] }> {
  const admin = getAdminClient();
  let query = admin
    .from('print_requests')
    .select('student_email, telegram_chat_id')
    .eq('source', 'online');
  query = applyLibraryScope(query, auth);
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(5000);
  if (error) throw error;

  const emails = new Set<string>();
  const telegram = new Set<string>();
  for (const row of (data ?? []) as ContactRow[]) {
    const email = normalizeEmail(row.student_email);
    const chatId = normalizeChatId(row.telegram_chat_id);
    if (email) emails.add(email);
    if (chatId) telegram.add(chatId);
  }
  return { emails: [...emails], telegramChatIds: [...telegram] };
}

function buildEmailHtml(title: string, message: string, libraryName: string): string {
  const safeTitle = escapeHtml(title || 'إعلان من المكتبة');
  const safeMessage = escapeHtml(message).replace(/\n/g, '<br />');
  const safeLibraryName = escapeHtml(libraryName);
  return `
    <div dir="rtl" style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;line-height:1.8;color:#0f172a;">
      <div style="border:1px solid #e5e7eb;border-radius:18px;padding:22px;background:#ffffff;">
        <p style="margin:0 0 10px;color:#4f46e5;font-weight:700;">UOADrop — ${safeLibraryName}</p>
        <h2 style="margin:0 0 16px;color:#111827;">${safeTitle}</h2>
        <p style="margin:0;color:#334155;white-space:normal;">${safeMessage}</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <p style="margin:0;color:#64748b;font-size:12px;">هذه رسالة جماعية لطلبات الرفع الأونلاين في ${safeLibraryName}.</p>
      </div>
    </div>
  `;
}

async function sendEmails(emails: string[], title: string, message: string, libraryName: string): Promise<{ sent: number; failed: number; skipped: boolean }> {
  if (emails.length === 0) return { sent: 0, failed: 0, skipped: false };
  if (!EMAIL_USER || !EMAIL_PASS) return { sent: 0, failed: emails.length, skipped: true };
  const transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: EMAIL_PORT,
    secure: EMAIL_PORT === 465,
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
  });
  const subject = title ? `UOADrop — ${libraryName} — ${title}` : `UOADrop — ${libraryName} — إعلان من المكتبة`;
  const html = buildEmailHtml(title, message, libraryName);
  let sent = 0;
  let failed = 0;
  for (const email of emails) {
    try {
      await transporter.sendMail({ from: EMAIL_FROM, to: email, subject, html, text: `${title || 'إعلان من المكتبة'}\n\n${message}` });
      sent += 1;
    } catch {
      failed += 1;
    }
  }
  return { sent, failed, skipped: false };
}

function buildRequestEmailSubject(event: EmailNotificationBody['event'], ticket: string, libraryName: string): string {
  return event === 'ready'
    ? `UOADrop — ${libraryName} — طلبك جاهز للاستلام #${ticket}`
    : `UOADrop — ${libraryName} — تم استلام طلبك #${ticket}`;
}

function buildRequestEmailHtml(event: EmailNotificationBody['event'], row: EmailRequestRow, libraryName: string): string {
  const name = formatStudentName(row.student_name);
  const safeLibraryName = escapeHtml(libraryName);
  if (event === 'received') {
    return `
      <div dir="rtl" style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
        <h2 style="color:#2563eb;">✅ تم استلام طلبك</h2>
        <p>مرحباً ${escapeHtml(name)}،</p>
        <p>تم استلام طلب الطباعة الخاص بك بنجاح في ${safeLibraryName}.</p>
        <table style="margin:16px 0;border-collapse:collapse;">
          <tr><td style="padding:4px 12px;font-weight:bold;">المكتبة</td><td style="padding:4px 12px;">${safeLibraryName}</td></tr>
          <tr><td style="padding:4px 12px;font-weight:bold;">رقم التذكرة</td><td style="padding:4px 12px;">${escapeHtml(row.ticket)}</td></tr>
        </table>
        <p>سنرسل لك بريداً إلكترونياً عندما يصبح طلبك جاهزاً للاستلام.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <p style="color:#6b7280;font-size:12px;">UOADrop — ${safeLibraryName}</p>
      </div>
    `;
  }

  const hasFinal = Boolean(row.final_price_confirmed_at) && typeof row.price_iqd === 'number' && row.price_iqd > 0;
  const priceLine = hasFinal
    ? `${Number(row.price_iqd ?? 0).toLocaleString('ar-IQ')} د.ع`
    : 'يتم تأكيده من موظف المكتبة';
  return `
    <div dir="rtl" style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
        <h2 style="color:#16a34a;">📦 طلبك جاهز للاستلام</h2>
        <p>مرحباً ${escapeHtml(name)}،</p>
      <p>طلب الطباعة الخاص بك جاهز. يرجى مراجعة ${safeLibraryName} لاستلامه.</p>
      <table style="margin:16px 0;border-collapse:collapse;">
        <tr><td style="padding:4px 12px;font-weight:bold;">المكتبة</td><td style="padding:4px 12px;">${safeLibraryName}</td></tr>
        <tr><td style="padding:4px 12px;font-weight:bold;">رقم التذكرة</td><td style="padding:4px 12px;">${escapeHtml(row.ticket)}</td></tr>
        <tr><td style="padding:4px 12px;font-weight:bold;">السعر النهائي</td><td style="padding:4px 12px;">${escapeHtml(priceLine)}</td></tr>
      </table>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
      <p style="color:#6b7280;font-size:12px;">UOADrop — ${safeLibraryName}</p>
    </div>
  `;
}

async function sendTelegramMessages(chatIds: string[], title: string, message: string, libraryName: string): Promise<{ sent: number; failed: number; skipped: boolean }> {
  if (chatIds.length === 0) return { sent: 0, failed: 0, skipped: false };
  if (!TELEGRAM_BOT_TOKEN) return { sent: 0, failed: chatIds.length, skipped: true };
  const text = [`📢 إعلان من ${libraryName}`, title ? `العنوان: ${title}` : '', message].filter(Boolean).join('\n\n');
  let sent = 0;
  let failed = 0;
  for (const chatId of chatIds) {
    try {
      const resp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      });
      if (resp.ok) sent += 1;
      else failed += 1;
    } catch {
      failed += 1;
    }
  }
  return { sent, failed, skipped: false };
}

async function handleEmailNotification(body: EmailNotificationBody, auth: DesktopAuth) {
  const requestId = String(body.requestId ?? '').trim();
  const event = body.event;
  if (!requestId || (event !== 'received' && event !== 'ready')) {
    return json({ ok: false, error: 'missing_request_id_or_event' }, { status: 400 });
  }
  if (!EMAIL_USER || !EMAIL_PASS) {
    return json({ ok: false, error: 'missing_email_env' }, { status: 500 });
  }

  const admin = getAdminClient();
  let query = admin
    .from('print_requests')
    .select('id, library_id, ticket, student_name, student_email, status, price_iqd, final_price_confirmed_at')
    .eq('id', requestId)
    .eq('source', 'online');
  query = applyLibraryScope(query, auth);
  const { data, error } = await query
    .maybeSingle();
  const row = (data as EmailRequestRow | null) ?? null;
  if (error || !row) return json({ ok: false, error: 'not_found' }, { status: 404 });

  const email = normalizeEmail(row.student_email);
  if (!email) return json({ ok: false, error: 'no_email' });
  const libraryName = await resolveLibraryDisplayName(admin, row.library_id, auth);

  const transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: EMAIL_PORT,
    secure: EMAIL_PORT === 465,
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
  });
  await transporter.sendMail({
    from: EMAIL_FROM,
    to: email,
    subject: buildRequestEmailSubject(event, row.ticket, libraryName),
    html: buildRequestEmailHtml(event, row, libraryName),
  });
  return json({ ok: true });
}

async function handleAnnouncement(body: AnnouncementBody, auth: DesktopAuth) {
  const admin = getAdminClient();
  const contacts = await loadOnlineContacts(auth);
  const libraryName = await resolveLibraryDisplayName(admin, auth.libraryId, auth);
  const counts = {
    emails: contacts.emails.length,
    telegram: contacts.telegramChatIds.length,
    totalChannels: contacts.emails.length + contacts.telegramChatIds.length,
  };
  if (body.dryRun) return json({ ok: true, counts });

  const title = normalizeText(body.title, MAX_TITLE_LENGTH);
  const message = normalizeText(body.message, MAX_MESSAGE_LENGTH);
  const sendEmail = body.channels?.email !== false;
  const sendTelegram = body.channels?.telegram !== false;
  if (!message) return json({ ok: false, error: 'missing_message' }, { status: 400 });
  if (!sendEmail && !sendTelegram) return json({ ok: false, error: 'no_channels' }, { status: 400 });

  const emailResult = sendEmail ? await sendEmails(contacts.emails, title, message, libraryName) : { sent: 0, failed: 0, skipped: false };
  const telegramResult = sendTelegram ? await sendTelegramMessages(contacts.telegramChatIds, title, message, libraryName) : { sent: 0, failed: 0, skipped: false };
  return json({
    ok: true,
    counts,
    sent: { emails: emailResult.sent, telegram: telegramResult.sent },
    failed: { emails: emailResult.failed, telegram: telegramResult.failed },
    skipped: { emails: emailResult.skipped, telegram: telegramResult.skipped },
  });
}

async function handleTelegramNotification(body: TelegramNotificationBody, auth: DesktopAuth) {
  const requestId = String(body.requestId ?? '').trim();
  const event = body.event;
  if (!requestId || (event !== 'linked' && event !== 'ready')) {
    return json({ ok: false, error: 'missing_request_id_or_event' }, { status: 400 });
  }
  if (!TELEGRAM_BOT_TOKEN) {
    return json({ ok: false, error: 'missing_telegram_bot_token' }, { status: 500 });
  }

  const admin = getAdminClient();
  let query = admin
    .from('print_requests')
    .select('id, library_id, ticket, student_name, status, price_iqd, final_price_confirmed_at, telegram_chat_id')
    .eq('id', requestId)
    .eq('source', 'online');
  query = applyLibraryScope(query, auth);
  const { data, error } = await query
    .maybeSingle();
  const row = (data as TelegramRequestRow | null) ?? null;
  if (error || !row) return json({ ok: false, error: 'not_found' }, { status: 404 });

  const chatId = normalizeChatId(row.telegram_chat_id);
  if (!chatId) return json({ ok: false, error: 'no_chat' });
  const libraryName = await resolveLibraryDisplayName(admin, row.library_id, auth);

  const lines: string[] = [];
  if (event === 'linked') {
    lines.push(
      `✅ تم ربط إشعارات ${libraryName} بنجاح`,
      `مرحباً ${formatStudentName(row.student_name)}`,
      `المكتبة: ${libraryName}`,
      `رقم التذكرة: ${row.ticket}`,
      'سنرسل لك تحديثاً عندما يصبح الطلب جاهزاً للاستلام.',
    );
  } else {
    const hasFinal = Boolean(row.final_price_confirmed_at) && typeof row.price_iqd === 'number' && row.price_iqd > 0;
    const priceLine = hasFinal
      ? `السعر النهائي: ${Number(row.price_iqd ?? 0).toLocaleString('ar-IQ')} د.ع`
      : 'السعر النهائي: يتم تأكيده من موظف المكتبة';
    lines.push(
      '📦 طلبك جاهز للاستلام',
      `مرحباً ${formatStudentName(row.student_name)}`,
      `المكتبة: ${libraryName}`,
      `رقم التذكرة: ${row.ticket}`,
      priceLine,
      `يرجى مراجعة ${libraryName} لاستلام الطلب.`,
    );
  }

  const resp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: lines.join('\n'), disable_web_page_preview: true }),
  });
  if (!resp.ok) {
    const details = await resp.text().catch(() => '');
    return json({ ok: false, error: 'telegram_failed', details: details.slice(0, 200) }, { status: 502 });
  }
  return json({ ok: true });
}

async function handleTelegramWebhookSync(body: TelegramWebhookSyncBody) {
  if (!TELEGRAM_BOT_TOKEN) {
    return json({ ok: false, error: 'missing_telegram_bot_token' }, { status: 500 });
  }
  if (!TELEGRAM_WEBHOOK_SECRET) {
    return json({ ok: false, error: 'missing_telegram_webhook_secret' }, { status: 500 });
  }

  const setResp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: TELEGRAM_WEBHOOK_URL,
      secret_token: TELEGRAM_WEBHOOK_SECRET,
      allowed_updates: ['message'],
      drop_pending_updates: Boolean(body.dropPendingUpdates),
    }),
  });
  const setPayload = (await setResp.json().catch(() => ({}))) as { ok?: boolean; description?: string };
  if (!setResp.ok || !setPayload.ok) {
    return json({ ok: false, error: 'telegram_set_webhook_failed', details: setPayload.description ?? `http_${setResp.status}` }, { status: 502 });
  }

  const infoResp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`);
  const infoPayload = (await infoResp.json().catch(() => ({}))) as {
    ok?: boolean;
    result?: {
      url?: string;
      pending_update_count?: number;
      last_error_date?: number;
      last_error_message?: string;
      allowed_updates?: string[];
    };
  };
  if (!infoResp.ok || !infoPayload.ok) {
    return json({ ok: false, error: 'telegram_webhook_info_failed' }, { status: 502 });
  }
  const info = infoPayload.result ?? {};
  return json({
    ok: true,
    webhook: {
      url: info.url ?? null,
      pendingUpdateCount: info.pending_update_count ?? 0,
      lastErrorDate: info.last_error_date ?? null,
      lastErrorMessage: info.last_error_message ?? null,
      allowedUpdates: info.allowed_updates ?? null,
    },
  });
}

function getPath(ctx: RouteContext): string[] {
  return ctx.params.path ?? [];
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  try {
    const auth = requireDesktopAuth(req);
    if (!isDesktopAuth(auth)) return auth;
    const path = getPath(ctx);
    const admin = getAdminClient();
    await touchDesktopDevice(admin, auth);

    if (path.length === 1 && path[0] === 'status') {
      let query = admin
        .from('print_requests')
        .select('*', { count: 'exact', head: true })
        .eq('source', 'online')
        .in('status', ['pending', 'printing', 'ready']);
      query = applyLibraryScope(query, auth);
      const { count, error } = await query;
      if (error) throw error;
      return json({
        ok: true,
        deviceId: auth.deviceId,
        libraryId: auth.libraryId ?? null,
        librarySlug: auth.librarySlug ?? null,
        libraryName: auth.libraryName ?? null,
        pendingOnlineRequests: count ?? 0,
      });
    }

    if (path.length === 1 && path[0] === 'requests') {
      const mode = req.nextUrl.searchParams.get('mode') ?? 'active';
      let query = admin.from('print_requests').select(REQUEST_SELECT).eq('source', 'online').order('created_at', { ascending: false });
      if (mode === 'active') query = query.in('status', ['pending', 'printing', 'ready']);
      query = applyLibraryScope(query, auth);
      const { data, error } = await query.limit(500);
      if (error) throw error;
      return json({ ok: true, rows: data ?? [] });
    }

    if (path.length === 2 && path[0] === 'requests') {
      let query = admin
        .from('print_requests')
        .select(REQUEST_SELECT)
        .eq('id', path[1])
        .eq('source', 'online');
      query = applyLibraryScope(query, auth);
      const { data, error } = await query
        .maybeSingle();
      if (error) throw error;
      return json({ ok: true, row: data ?? null });
    }

    if (path.length === 3 && path[0] === 'requests' && path[2] === 'files') {
      const requestId = String(path[1] ?? '');
      const belongs = await requestBelongsToAuth(admin, requestId, auth);
      if (!belongs) return json({ ok: false, error: 'not_found' }, { status: 404 });
      let query = admin
        .from('request_files')
        .select(FILE_SELECT)
        .eq('request_id', requestId);
      query = applyLibraryScope(query, auth);
      const { data, error } = await query;
      if (error) throw error;
      const files = [];
      for (const file of (data ?? []) as Array<Record<string, any>>) {
        const { data: signed, error: signError } = await admin.storage
          .from('print-files')
          .createSignedUrl(String(file.storage_path), 60 * 60 * 24);
        if (signError) throw signError;
        files.push({
          ...file,
          signed_url: signed?.signedUrl ?? null,
          decryption_key_base64: unwrapOnlineFileKey(file),
        });
      }
      return json({ ok: true, files });
    }

    return json({ ok: false, error: 'not_found' }, { status: 404 });
  } catch (err) {
    return json({ ok: false, error: 'server_error', details: String((err as Error)?.message ?? err).slice(0, 200) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const auth = requireDesktopAuth(req);
    if (!isDesktopAuth(auth)) return auth;
    const path = getPath(ctx);
    if (!(path.length === 2 && path[0] === 'requests')) return json({ ok: false, error: 'not_found' }, { status: 404 });
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const patch = sanitizePatch(body);
    let query = getAdminClient()
      .from('print_requests')
      .update(patch)
      .eq('id', path[1])
      .eq('source', 'online');
    query = applyLibraryScope(query, auth);
    const { error } = await query;
    if (error) throw error;
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: 'server_error', details: String((err as Error)?.message ?? err).slice(0, 200) }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const auth = requireDesktopAuth(req);
    if (!isDesktopAuth(auth)) return auth;
    const path = getPath(ctx);
    const admin = getAdminClient();

    if (path.length === 1 && path[0] === 'payment-settings') {
      const body = (await req.json().catch(() => ({}))) as { qiCard?: string; zainCash?: string };
      const now = new Date().toISOString();
      const libraryPatch = auth.libraryId ? { library_id: auth.libraryId } : {};
      const { error } = await admin
        .from('payment_settings')
        .upsert([
          { ...libraryPatch, key: 'qicard', account_number: String(body.qiCard ?? '').trim(), updated_at: now },
          { ...libraryPatch, key: 'zaincash', account_number: String(body.zainCash ?? '').trim(), updated_at: now },
        ], { onConflict: 'library_id,key' });
      if (error) throw error;
      return json({ ok: true });
    }

    if (path.length === 1 && path[0] === 'announcement') {
      const body = (await req.json().catch(() => ({}))) as AnnouncementBody;
      return handleAnnouncement(body, auth);
    }

    if (path.length === 1 && path[0] === 'telegram') {
      const body = (await req.json().catch(() => ({}))) as TelegramNotificationBody;
      return handleTelegramNotification(body, auth);
    }

    if (path.length === 3 && path[0] === 'telegram' && path[1] === 'webhook' && path[2] === 'sync') {
      const body = (await req.json().catch(() => ({}))) as TelegramWebhookSyncBody;
      return handleTelegramWebhookSync(body);
    }

    if (path.length === 1 && path[0] === 'email') {
      const body = (await req.json().catch(() => ({}))) as EmailNotificationBody;
      return handleEmailNotification(body, auth);
    }

    if (path.length === 3 && path[0] === 'requests' && path[2] === 'cleanup') {
      const requestId = String(path[1] ?? '');
      const belongs = await requestBelongsToAuth(admin, requestId, auth);
      if (!belongs) return json({ ok: false, error: 'not_found' }, { status: 404 });
      let filesQuery = admin
        .from('request_files')
        .select('storage_path')
        .eq('request_id', requestId);
      filesQuery = applyLibraryScope(filesQuery, auth);
      const { data, error } = await filesQuery;
      if (error) throw error;
      const storagePaths = [...new Set(((data ?? []) as Array<{ storage_path: string | null }>).map((file) => file.storage_path).filter(Boolean) as string[])];
      if (storagePaths.length > 0) {
        const { error: storageError } = await admin.storage.from('print-files').remove(storagePaths);
        if (storageError) throw storageError;
      }
      let deleteQuery = admin.from('request_files').delete().eq('request_id', requestId);
      deleteQuery = applyLibraryScope(deleteQuery, auth);
      const { error: filesError } = await deleteQuery;
      if (filesError) throw filesError;
      return json({ ok: true, removedFiles: storagePaths.length });
    }

    if (path.length === 3 && path[0] === 'requests' && path[2] === 'tracking-cleanup') {
      const requestId = String(path[1] ?? '');
      const belongs = await requestBelongsToAuth(admin, requestId, auth);
      if (!belongs) return json({ ok: false, error: 'not_found' }, { status: 404 });
      let requestQuery = admin
        .from('print_requests')
        .select('id, status, picked_up_at')
        .eq('id', requestId)
        .eq('source', 'online');
      requestQuery = applyLibraryScope(requestQuery, auth);
      const { data: requestRow, error: requestError } = await requestQuery.maybeSingle();
      if (requestError) throw requestError;
      if (!requestRow) return json({ ok: false, error: 'not_found' }, { status: 404 });
      if (requestRow.status !== 'done' || !requestRow.picked_up_at) {
        return json({ ok: false, error: 'not_delivered' }, { status: 409 });
      }

      let filesQuery = admin
        .from('request_files')
        .select('storage_path')
        .eq('request_id', requestId);
      filesQuery = applyLibraryScope(filesQuery, auth);
      const { data, error } = await filesQuery;
      if (error) throw error;
      const storagePaths = [...new Set(((data ?? []) as Array<{ storage_path: string | null }>).map((file) => file.storage_path).filter(Boolean) as string[])];
      if (storagePaths.length > 0) {
        const { error: storageError } = await admin.storage.from('print-files').remove(storagePaths);
        if (storageError) throw storageError;
      }
      let deleteFilesQuery = admin.from('request_files').delete().eq('request_id', requestId);
      deleteFilesQuery = applyLibraryScope(deleteFilesQuery, auth);
      const { error: filesError } = await deleteFilesQuery;
      if (filesError) throw filesError;
      let deleteRequestQuery = admin.from('print_requests').delete().eq('id', requestId).eq('source', 'online');
      deleteRequestQuery = applyLibraryScope(deleteRequestQuery, auth);
      const { error: deleteError } = await deleteRequestQuery;
      if (deleteError) throw deleteError;
      return json({ ok: true, removedFiles: storagePaths.length, removedTracking: true });
    }

    return json({ ok: false, error: 'not_found' }, { status: 404 });
  } catch (err) {
    return json({ ok: false, error: 'server_error', details: String((err as Error)?.message ?? err).slice(0, 200) }, { status: 500 });
  }
}
