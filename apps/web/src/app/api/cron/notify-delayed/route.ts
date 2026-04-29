import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

/**
 * Scheduled cron endpoint – checks for online requests that have been pending for over
 * 3 minutes without being received by the desktop (desk_received_at is null).
 * Sends a one-time delay notification via Email and/or Telegram.
 *
 * Designed for Supabase pg_cron / external cron. Vercel Hobby keeps a daily fallback.
 */

const DELAY_THRESHOLD_MS = 3 * 60 * 1000;

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const EMAIL_HOST = process.env.EMAIL_HOST || 'smtp-relay.brevo.com';
const EMAIL_PORT = Number(process.env.EMAIL_PORT || 587);
const EMAIL_USER = process.env.EMAIL_USER || '';
const EMAIL_PASS = process.env.EMAIL_PASS || '';
const EMAIL_FROM = process.env.EMAIL_FROM || `UOADrop <${EMAIL_USER}>`;

type StaleRow = {
  id: string;
  ticket: string;
  student_name: string | null;
  student_email: string | null;
  telegram_chat_id: string | null;
  created_at: string;
};

function formatName(name?: string | null): string {
  return (name ?? '').trim() || 'الطالب';
}

async function sendTelegramDelay(row: StaleRow): Promise<boolean> {
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

async function sendEmailDelay(row: StaleRow): Promise<boolean> {
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

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && !isVercelCron) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
  });

  try {
    const cutoff = new Date(Date.now() - DELAY_THRESHOLD_MS).toISOString();

    const { data, error } = await supabase
      .from('print_requests')
      .select('id, ticket, student_name, student_email, telegram_chat_id, created_at')
      .eq('source', 'online')
      .eq('status', 'pending')
      .is('desk_received_at', null)
      .is('delay_notified_at', null)
      .lt('created_at', cutoff);

    if (error) {
      console.error('[notify-delayed] query error:', error.message);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const rows = (data ?? []) as StaleRow[];
    if (rows.length === 0) {
      return NextResponse.json({ ok: true, notified: 0 });
    }

    let notified = 0;
    for (const row of rows) {
      const emailSent = await sendEmailDelay(row);
      const telegramSent = await sendTelegramDelay(row);

      if (emailSent || telegramSent) {
        await supabase
          .from('print_requests')
          .update({ delay_notified_at: new Date().toISOString() })
          .eq('id', row.id);
        notified += 1;
        console.log(`[notify-delayed] notified ${row.ticket} (email=${emailSent}, tg=${telegramSent})`);
      }
    }

    return NextResponse.json({ ok: true, notified, checked: rows.length });
  } catch (err: any) {
    console.error('[notify-delayed] error:', err?.message ?? err);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
