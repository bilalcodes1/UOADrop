import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL as string;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN as string;

function assertEnv() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing Supabase server env');
  if (!TELEGRAM_BOT_TOKEN) throw new Error('Missing TELEGRAM_BOT_TOKEN');
}

export async function POST(req: NextRequest) {
  try {
    assertEnv();
    const update = await req.json();
    const chatId = String(update?.message?.chat?.id ?? '');
    const text: string = String(update?.message?.text ?? '').trim();
    if (!chatId || !text.startsWith('/start')) return NextResponse.json({ ok: true });

    const parts = text.split(/\s+/, 2);
    const ticket = String(parts[1] ?? '').trim().toUpperCase().slice(0, 12);
    if (!ticket) {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: '👋 أهلاً! لتفعيل إشعارات طلبك، استخدم الرابط الموجود في صفحة الطلب بعد رفع ملفاتك.',
        }),
      });
      return NextResponse.json({ ok: true });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    const { data: row } = await admin
      .from('print_requests')
      .select('id, ticket, student_name, status, telegram_chat_id')
      .eq('ticket', ticket)
      .single();

    if (!row) {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: `لم أجد تذكرة بهذا الرقم: ${ticket}` }),
      });
      return NextResponse.json({ ok: true });
    }

    // Update chat id if not already set or changed
    await admin
      .from('print_requests')
      .update({ telegram_chat_id: chatId, updated_at: new Date().toISOString() })
      .eq('id', row.id);

    // Send confirmation via notify endpoint (reuse logic)
    try {
      const baseUrl = process.env.WEB_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || '';
      const notifyUrl = baseUrl ? `${baseUrl.replace(/\/$/, '')}/api/notify/telegram` : '';
      if (notifyUrl) {
        await fetch(notifyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestId: row.id, event: 'linked' }),
        });
      }
    } catch {}

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
