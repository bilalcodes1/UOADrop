import { NextRequest } from 'next/server';
import nodemailer from 'nodemailer';
import { getAdminClient, isDesktopAuth, json, requireDesktopAuth, unwrapOnlineFileKey } from '../_lib';

export const dynamic = 'force-dynamic';

const EMAIL_HOST = process.env.EMAIL_HOST || 'smtp-relay.brevo.com';
const EMAIL_PORT = Number(process.env.EMAIL_PORT || 587);
const EMAIL_USER = process.env.EMAIL_USER || '';
const EMAIL_PASS = process.env.EMAIL_PASS || '';
const EMAIL_FROM = process.env.EMAIL_FROM || `UOADrop <${EMAIL_USER}>`;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const MAX_TITLE_LENGTH = 90;
const MAX_MESSAGE_LENGTH = 1600;

const REQUEST_SELECT = [
  'id',
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

type ContactRow = {
  student_email: string | null;
  telegram_chat_id: string | null;
};

type TelegramRequestRow = {
  id: string;
  ticket: string;
  student_name: string | null;
  status: string;
  price_iqd: number | null;
  final_price_confirmed_at: string | null;
  telegram_chat_id: string | null;
};

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

async function loadOnlineContacts(): Promise<{ emails: string[]; telegramChatIds: string[] }> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('print_requests')
    .select('student_email, telegram_chat_id')
    .eq('source', 'online')
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

function buildEmailHtml(title: string, message: string): string {
  const safeTitle = escapeHtml(title || 'إعلان من المكتبة');
  const safeMessage = escapeHtml(message).replace(/\n/g, '<br />');
  return `
    <div dir="rtl" style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;line-height:1.8;color:#0f172a;">
      <div style="border:1px solid #e5e7eb;border-radius:18px;padding:22px;background:#ffffff;">
        <p style="margin:0 0 10px;color:#4f46e5;font-weight:700;">UOADrop</p>
        <h2 style="margin:0 0 16px;color:#111827;">${safeTitle}</h2>
        <p style="margin:0;color:#334155;white-space:normal;">${safeMessage}</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <p style="margin:0;color:#64748b;font-size:12px;">هذه رسالة جماعية لطلبات الرفع الأونلاين في UOADrop.</p>
      </div>
    </div>
  `;
}

async function sendEmails(emails: string[], title: string, message: string): Promise<{ sent: number; failed: number; skipped: boolean }> {
  if (emails.length === 0) return { sent: 0, failed: 0, skipped: false };
  if (!EMAIL_USER || !EMAIL_PASS) return { sent: 0, failed: emails.length, skipped: true };
  const transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: EMAIL_PORT,
    secure: EMAIL_PORT === 465,
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
  });
  const subject = title ? `UOADrop — ${title}` : 'UOADrop — إعلان من المكتبة';
  const html = buildEmailHtml(title, message);
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

async function sendTelegramMessages(chatIds: string[], title: string, message: string): Promise<{ sent: number; failed: number; skipped: boolean }> {
  if (chatIds.length === 0) return { sent: 0, failed: 0, skipped: false };
  if (!TELEGRAM_BOT_TOKEN) return { sent: 0, failed: chatIds.length, skipped: true };
  const text = ['📢 إعلان من UOADrop', title ? `العنوان: ${title}` : '', message].filter(Boolean).join('\n\n');
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

async function handleAnnouncement(body: AnnouncementBody) {
  const contacts = await loadOnlineContacts();
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

  const emailResult = sendEmail ? await sendEmails(contacts.emails, title, message) : { sent: 0, failed: 0, skipped: false };
  const telegramResult = sendTelegram ? await sendTelegramMessages(contacts.telegramChatIds, title, message) : { sent: 0, failed: 0, skipped: false };
  return json({
    ok: true,
    counts,
    sent: { emails: emailResult.sent, telegram: telegramResult.sent },
    failed: { emails: emailResult.failed, telegram: telegramResult.failed },
    skipped: { emails: emailResult.skipped, telegram: telegramResult.skipped },
  });
}

async function handleTelegramNotification(body: TelegramNotificationBody) {
  const requestId = String(body.requestId ?? '').trim();
  const event = body.event;
  if (!requestId || (event !== 'linked' && event !== 'ready')) {
    return json({ ok: false, error: 'missing_request_id_or_event' }, { status: 400 });
  }
  if (!TELEGRAM_BOT_TOKEN) {
    return json({ ok: false, error: 'missing_telegram_bot_token' }, { status: 500 });
  }

  const { data, error } = await getAdminClient()
    .from('print_requests')
    .select('id, ticket, student_name, status, price_iqd, final_price_confirmed_at, telegram_chat_id')
    .eq('id', requestId)
    .eq('source', 'online')
    .maybeSingle();
  const row = (data as TelegramRequestRow | null) ?? null;
  if (error || !row) return json({ ok: false, error: 'not_found' }, { status: 404 });

  const chatId = normalizeChatId(row.telegram_chat_id);
  if (!chatId) return json({ ok: false, error: 'no_chat' });

  const lines: string[] = [];
  if (event === 'linked') {
    lines.push(
      '✅ تم ربط إشعارات UOADrop بنجاح',
      `مرحباً ${formatStudentName(row.student_name)}`,
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
      `رقم التذكرة: ${row.ticket}`,
      priceLine,
      'يرجى مراجعة المكتبة لاستلام الطلب.',
    );
  }

  const resp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: lines.join('\n'), parse_mode: 'HTML', disable_web_page_preview: true }),
  });
  if (!resp.ok) {
    const details = await resp.text().catch(() => '');
    return json({ ok: false, error: 'telegram_failed', details: details.slice(0, 200) }, { status: 502 });
  }
  return json({ ok: true });
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

    if (path.length === 1 && path[0] === 'status') {
      const { count, error } = await admin
        .from('print_requests')
        .select('*', { count: 'exact', head: true })
        .eq('source', 'online')
        .in('status', ['pending', 'printing', 'ready']);
      if (error) throw error;
      return json({ ok: true, deviceId: auth.deviceId, pendingOnlineRequests: count ?? 0 });
    }

    if (path.length === 1 && path[0] === 'requests') {
      const mode = req.nextUrl.searchParams.get('mode') ?? 'active';
      let query = admin.from('print_requests').select(REQUEST_SELECT).eq('source', 'online').order('created_at', { ascending: false });
      if (mode === 'active') query = query.in('status', ['pending', 'printing', 'ready']);
      const { data, error } = await query.limit(500);
      if (error) throw error;
      return json({ ok: true, rows: data ?? [] });
    }

    if (path.length === 2 && path[0] === 'requests') {
      const { data, error } = await admin
        .from('print_requests')
        .select(REQUEST_SELECT)
        .eq('id', path[1])
        .eq('source', 'online')
        .maybeSingle();
      if (error) throw error;
      return json({ ok: true, row: data ?? null });
    }

    if (path.length === 3 && path[0] === 'requests' && path[2] === 'files') {
      const { data, error } = await admin
        .from('request_files')
        .select(FILE_SELECT)
        .eq('request_id', path[1]);
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
    const { error } = await getAdminClient()
      .from('print_requests')
      .update(patch)
      .eq('id', path[1])
      .eq('source', 'online');
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
      const { error } = await admin
        .from('payment_settings')
        .upsert([
          { key: 'qicard', account_number: String(body.qiCard ?? '').trim(), updated_at: now },
          { key: 'zaincash', account_number: String(body.zainCash ?? '').trim(), updated_at: now },
        ], { onConflict: 'key' });
      if (error) throw error;
      return json({ ok: true });
    }

    if (path.length === 1 && path[0] === 'announcement') {
      const body = (await req.json().catch(() => ({}))) as AnnouncementBody;
      return handleAnnouncement(body);
    }

    if (path.length === 1 && path[0] === 'telegram') {
      const body = (await req.json().catch(() => ({}))) as TelegramNotificationBody;
      return handleTelegramNotification(body);
    }

    if (path.length === 3 && path[0] === 'requests' && path[2] === 'cleanup') {
      const requestId = path[1];
      const { data, error } = await admin
        .from('request_files')
        .select('storage_path')
        .eq('request_id', requestId);
      if (error) throw error;
      const storagePaths = [...new Set(((data ?? []) as Array<{ storage_path: string | null }>).map((file) => file.storage_path).filter(Boolean) as string[])];
      if (storagePaths.length > 0) {
        const { error: storageError } = await admin.storage.from('print-files').remove(storagePaths);
        if (storageError) throw storageError;
      }
      const { error: filesError } = await admin.from('request_files').delete().eq('request_id', requestId);
      if (filesError) throw filesError;
      return json({ ok: true, removedFiles: storagePaths.length });
    }

    return json({ ok: false, error: 'not_found' }, { status: 404 });
  } catch (err) {
    return json({ ok: false, error: 'server_error', details: String((err as Error)?.message ?? err).slice(0, 200) }, { status: 500 });
  }
}
