import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type RequestRow = {
  id: string;
  ticket: string;
  student_name: string | null;
  status: string;
  price_iqd: number | null;
  final_price_confirmed_at: string | null;
  telegram_chat_id: string | null;
};

const SUPABASE_URL = process.env.SUPABASE_URL as string;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN as string;

function assertEnv() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing Supabase server env');
  if (!TELEGRAM_BOT_TOKEN) throw new Error('Missing TELEGRAM_BOT_TOKEN');
}

function formatName(name?: string | null): string {
  const n = (name ?? '').trim();
  return n || 'الطالب';
}

export async function POST(req: NextRequest) {
  try {
    assertEnv();
    const { requestId, event } = (await req.json()) as { requestId?: string; event?: 'linked' | 'ready' };
    if (!requestId || !event) {
      return NextResponse.json({ ok: false, error: 'missing requestId/event' }, { status: 400 });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    const { data, error } = await admin
      .from('print_requests')
      .select(
        [
          'id',
          'ticket',
          'student_name',
          'status',
          'price_iqd',
          'final_price_confirmed_at',
          'telegram_chat_id',
        ].join(', '),
      )
      .eq('id', requestId)
      .single();

    const row = (data as unknown) as RequestRow | null;
    if (error || !row) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 });

    const chatId = row.telegram_chat_id as string | null;
    if (!chatId) return NextResponse.json({ ok: false, error: 'no chat' }, { status: 200 });

    const lines: string[] = [];
    if (event === 'linked') {
      lines.push(
        '✅ تم ربط إشعارات UOADrop بنجاح',
        `مرحباً ${formatName(row.student_name)}`,
        `رقم التذكرة: ${row.ticket}`,
        'سنرسل لك تحديثاً عندما يصبح الطلب جاهزاً للاستلام.',
      );
    } else if (event === 'ready') {
      const hasFinal = Boolean(row.final_price_confirmed_at) && typeof row.price_iqd === 'number' && row.price_iqd > 0;
      const priceLine = hasFinal
        ? `السعر النهائي: ${Number(row.price_iqd ?? 0).toLocaleString('ar-IQ')} د.ع`
        : 'السعر النهائي: يتم تأكيده من موظف المكتبة';
      lines.push(
        '📦 طلبك جاهز للاستلام',
        `مرحباً ${formatName(row.student_name)}`,
        `رقم التذكرة: ${row.ticket}`,
        priceLine,
      );
      lines.push('يرجى مراجعة المكتبة لاستلام الطلب.');
    }

    const resp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: lines.join('\n'), parse_mode: 'HTML', disable_web_page_preview: true }),
    });

    if (!resp.ok) {
      const t = await resp.text().catch(() => '');
      return NextResponse.json({ ok: false, error: 'telegram_failed', details: t.slice(0, 200) }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
