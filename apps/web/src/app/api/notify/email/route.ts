import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type RequestRow = {
  id: string;
  ticket: string;
  student_name: string | null;
  student_email: string | null;
  status: string;
  price_iqd: number | null;
  final_price_confirmed_at: string | null;
};

const SUPABASE_URL = process.env.SUPABASE_URL as string;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const RESEND_API_KEY = process.env.RESEND_API_KEY as string;
const EMAIL_FROM = process.env.EMAIL_FROM || 'UOADrop <noreply@uoadrop.app>';

function assertEnv() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing Supabase server env');
  if (!RESEND_API_KEY) throw new Error('Missing RESEND_API_KEY');
}

function formatName(name?: string | null): string {
  return (name ?? '').trim() || 'الطالب';
}

type EmailEvent = 'received' | 'ready';

function buildSubject(event: EmailEvent, ticket: string): string {
  switch (event) {
    case 'received':
      return `UOADrop — تم استلام طلبك #${ticket}`;
    case 'ready':
      return `UOADrop — طلبك جاهز للاستلام #${ticket}`;
    default:
      return `UOADrop — تحديث طلبك #${ticket}`;
  }
}

function buildHtml(event: EmailEvent, row: RequestRow): string {
  const name = formatName(row.student_name);
  const ticket = row.ticket;

  if (event === 'received') {
    return `
      <div dir="rtl" style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
        <h2 style="color:#2563eb;">✅ تم استلام طلبك</h2>
        <p>مرحباً ${name}،</p>
        <p>تم استلام طلب الطباعة الخاص بك بنجاح.</p>
        <table style="margin:16px 0;border-collapse:collapse;">
          <tr><td style="padding:4px 12px;font-weight:bold;">رقم التذكرة</td><td style="padding:4px 12px;">${ticket}</td></tr>
        </table>
        <p>سنرسل لك بريداً إلكترونياً عندما يصبح طلبك جاهزاً للاستلام.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <p style="color:#6b7280;font-size:12px;">UOADrop — نظام طباعة المكتبة الجامعية</p>
      </div>
    `;
  }

  // ready
  const hasFinal =
    Boolean(row.final_price_confirmed_at) &&
    typeof row.price_iqd === 'number' &&
    row.price_iqd > 0;
  const priceLine = hasFinal
    ? `${Number(row.price_iqd ?? 0).toLocaleString('ar-IQ')} د.ع`
    : 'يتم تأكيده من موظف المكتبة';

  return `
    <div dir="rtl" style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <h2 style="color:#16a34a;">📦 طلبك جاهز للاستلام</h2>
      <p>مرحباً ${name}،</p>
      <p>طلب الطباعة الخاص بك جاهز. يرجى مراجعة المكتبة لاستلامه.</p>
      <table style="margin:16px 0;border-collapse:collapse;">
        <tr><td style="padding:4px 12px;font-weight:bold;">رقم التذكرة</td><td style="padding:4px 12px;">${ticket}</td></tr>
        <tr><td style="padding:4px 12px;font-weight:bold;">السعر النهائي</td><td style="padding:4px 12px;">${priceLine}</td></tr>
      </table>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
      <p style="color:#6b7280;font-size:12px;">UOADrop — نظام طباعة المكتبة الجامعية</p>
    </div>
  `;
}

export async function POST(req: NextRequest) {
  try {
    assertEnv();
    const { requestId, event } = (await req.json()) as {
      requestId?: string;
      event?: EmailEvent;
    };
    if (!requestId || !event) {
      return NextResponse.json({ ok: false, error: 'missing requestId/event' }, { status: 400 });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data, error } = await admin
      .from('print_requests')
      .select(
        [
          'id',
          'ticket',
          'student_name',
          'student_email',
          'status',
          'price_iqd',
          'final_price_confirmed_at',
        ].join(', '),
      )
      .eq('id', requestId)
      .single();

    const row = data as unknown as RequestRow | null;
    if (error || !row) {
      return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 });
    }

    const email = row.student_email;
    if (!email) {
      return NextResponse.json({ ok: false, error: 'no email' }, { status: 200 });
    }

    const subject = buildSubject(event, row.ticket);
    const html = buildHtml(event, row);

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: email,
        subject,
        html,
      }),
    });

    if (!resp.ok) {
      const t = await resp.text().catch(() => '');
      return NextResponse.json(
        { ok: false, error: 'email_failed', details: t.slice(0, 200) },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
