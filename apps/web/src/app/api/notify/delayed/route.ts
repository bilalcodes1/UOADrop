import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const DELAY_THRESHOLD_MS = 3 * 60 * 1000;

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const EMAIL_HOST = process.env.EMAIL_HOST || 'smtp-relay.brevo.com';
const EMAIL_PORT = Number(process.env.EMAIL_PORT || 587);
const EMAIL_USER = process.env.EMAIL_USER || '';
const EMAIL_PASS = process.env.EMAIL_PASS || '';
const EMAIL_FROM = process.env.EMAIL_FROM || `UOADrop <${EMAIL_USER}>`;

type DelayedRow = {
  id: string;
  ticket: string;
  student_name: string | null;
  student_email: string | null;
  telegram_chat_id: string | null;
  source: string | null;
  status: string | null;
  desk_received_at: string | null;
  delay_notified_at: string | null;
  created_at: string;
};

function formatName(name?: string | null): string {
  return (name ?? '').trim() || 'الطالب';
}

async function sendTelegramDelay(row: DelayedRow): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !row.telegram_chat_id) return false;

  try {
    const lines = [
      '⏳ تنبيه — تأخر استلام الطلب',
      `مرحباً ${formatName(row.student_name)}`,
      `رقم التذكرة: ${row.ticket}`,
      '',
      'يبدو أن المكتبة غير متصلة بالإنترنت حالياً.',
      'طلبك محفوظ بأمان وسيتم استلامه تلقائياً فور عودة الاتصال.',
      'لا داعي لإعادة الرفع.',
    ];

    const resp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: row.telegram_chat_id,
        text: lines.join('\n'),
        disable_web_page_preview: true,
      }),
    });

    return resp.ok;
  } catch {
    return false;
  }
}

async function sendEmailDelay(row: DelayedRow): Promise<boolean> {
  if (!EMAIL_USER || !EMAIL_PASS || !row.student_email) return false;

  try {
    const transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: EMAIL_PORT,
      secure: EMAIL_PORT === 465,
      auth: { user: EMAIL_USER, pass: EMAIL_PASS },
    });

    const html = `
      <div dir="rtl" style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
        <h2 style="color:#d97706;">⏳ تأخر استلام طلبك</h2>
        <p>مرحباً ${formatName(row.student_name)}،</p>
        <p>يبدو أن المكتبة غير متصلة بالإنترنت حالياً، لذلك لم يتم استلام طلبك بعد.</p>
        <table style="margin:16px 0;border-collapse:collapse;">
          <tr><td style="padding:4px 12px;font-weight:bold;">رقم التذكرة</td><td style="padding:4px 12px;">${row.ticket}</td></tr>
        </table>
        <p><strong>لا داعي لإعادة الرفع</strong> — طلبك محفوظ بأمان وسيتم استلامه تلقائياً فور عودة اتصال المكتبة.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <p style="color:#6b7280;font-size:12px;">UOADrop — نظام طباعة المكتبة الجامعية</p>
      </div>
    `;

    await transporter.sendMail({
      from: EMAIL_FROM,
      to: row.student_email,
      subject: `UOADrop — تأخر استلام طلبك #${row.ticket}`,
      html,
    });

    return true;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return NextResponse.json({ ok: false, error: 'Supabase not configured' }, { status: 500 });
    }

    const { requestId, ticket } = (await req.json()) as { requestId?: string; ticket?: string };
    if (!requestId || !ticket) {
      return NextResponse.json({ ok: false, error: 'missing requestId/ticket' }, { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
    const { data, error } = await supabase
      .from('print_requests')
      .select('id, ticket, student_name, student_email, telegram_chat_id, source, status, desk_received_at, delay_notified_at, created_at')
      .eq('id', requestId)
      .eq('ticket', ticket)
      .single();

    if (error || !data) {
      return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 });
    }

    const row = data as DelayedRow;
    if (row.source !== 'online' || row.status !== 'pending') {
      return NextResponse.json({ ok: true, skipped: 'not_pending_online' });
    }

    if (row.desk_received_at) {
      return NextResponse.json({ ok: true, skipped: 'already_received' });
    }

    if (row.delay_notified_at) {
      return NextResponse.json({ ok: true, skipped: 'already_notified' });
    }

    const createdAtMs = Date.parse(row.created_at);
    if (!Number.isFinite(createdAtMs) || Date.now() - createdAtMs < DELAY_THRESHOLD_MS) {
      return NextResponse.json({ ok: true, skipped: 'too_early' });
    }

    const emailSent = await sendEmailDelay(row);
    const telegramSent = await sendTelegramDelay(row);

    if (emailSent || telegramSent) {
      await supabase
        .from('print_requests')
        .update({ delay_notified_at: new Date().toISOString() })
        .eq('id', row.id);
    }

    return NextResponse.json({ ok: true, emailSent, telegramSent });
  } catch (err: any) {
    console.error('[delayed-notify] error:', err?.message ?? err);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
