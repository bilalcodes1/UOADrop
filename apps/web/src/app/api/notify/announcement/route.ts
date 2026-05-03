import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const EMAIL_HOST = process.env.EMAIL_HOST || 'smtp-relay.brevo.com';
const EMAIL_PORT = Number(process.env.EMAIL_PORT || 587);
const EMAIL_USER = process.env.EMAIL_USER || '';
const EMAIL_PASS = process.env.EMAIL_PASS || '';
const EMAIL_FROM = process.env.EMAIL_FROM || `UOADrop <${EMAIL_USER}>`;

const MAX_TITLE_LENGTH = 90;
const MAX_MESSAGE_LENGTH = 1600;

type ContactRow = {
  student_email: string | null;
  telegram_chat_id: string | null;
};

type AnnouncementBody = {
  dryRun?: boolean;
  title?: string;
  message?: string;
  channels?: {
    email?: boolean;
    telegram?: boolean;
  };
};

function isAuthorized(req: NextRequest): boolean {
  if (!SUPABASE_SERVICE_ROLE_KEY) return false;
  const authorization = req.headers.get('authorization') ?? '';
  return authorization === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
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

async function loadOnlineContacts(): Promise<{ emails: string[]; telegramChatIds: string[] }> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('missing_supabase_config');
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data, error } = await admin
    .from('print_requests')
    .select('student_email, telegram_chat_id')
    .eq('source', 'online')
    .order('created_at', { ascending: false })
    .limit(5000);

  if (error) throw error;

  const emailSet = new Set<string>();
  const telegramSet = new Set<string>();
  for (const row of (data ?? []) as ContactRow[]) {
    const email = normalizeEmail(row.student_email);
    const chatId = normalizeChatId(row.telegram_chat_id);
    if (email) emailSet.add(email);
    if (chatId) telegramSet.add(chatId);
  }

  return {
    emails: [...emailSet],
    telegramChatIds: [...telegramSet],
  };
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
      await transporter.sendMail({
        from: EMAIL_FROM,
        to: email,
        subject,
        html,
        text: `${title || 'إعلان من المكتبة'}\n\n${message}`,
      });
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

  const text = [
    '📢 إعلان من UOADrop',
    title ? `العنوان: ${title}` : '',
    message,
  ].filter(Boolean).join('\n\n');
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

export async function POST(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as AnnouncementBody;
    const contacts = await loadOnlineContacts();
    const counts = {
      emails: contacts.emails.length,
      telegram: contacts.telegramChatIds.length,
      totalChannels: contacts.emails.length + contacts.telegramChatIds.length,
    };

    if (body.dryRun) {
      return NextResponse.json({ ok: true, counts });
    }

    const title = normalizeText(body.title, MAX_TITLE_LENGTH);
    const message = normalizeText(body.message, MAX_MESSAGE_LENGTH);
    const sendEmail = body.channels?.email !== false;
    const sendTelegram = body.channels?.telegram !== false;

    if (!message) {
      return NextResponse.json({ ok: false, error: 'missing_message' }, { status: 400 });
    }
    if (!sendEmail && !sendTelegram) {
      return NextResponse.json({ ok: false, error: 'no_channels' }, { status: 400 });
    }

    const emailResult = sendEmail
      ? await sendEmails(contacts.emails, title, message)
      : { sent: 0, failed: 0, skipped: false };
    const telegramResult = sendTelegram
      ? await sendTelegramMessages(contacts.telegramChatIds, title, message)
      : { sent: 0, failed: 0, skipped: false };

    return NextResponse.json({
      ok: true,
      counts,
      sent: {
        emails: emailResult.sent,
        telegram: telegramResult.sent,
      },
      failed: {
        emails: emailResult.failed,
        telegram: telegramResult.failed,
      },
      skipped: {
        emails: emailResult.skipped,
        telegram: telegramResult.skipped,
      },
    });
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: 'server_error',
      details: String(err?.message ?? '').slice(0, 200),
    }, { status: 500 });
  }
}
