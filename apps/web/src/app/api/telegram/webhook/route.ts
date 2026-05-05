import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';

async function supaRest(path: string, opts?: { method?: string; body?: unknown }) {
  const method = opts?.method ?? 'GET';
  const headers: Record<string, string> = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: method === 'PATCH' ? 'return=minimal' : 'return=representation',
  };
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers,
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Supabase ${method} ${path}: ${res.status} ${t.slice(0, 200)}`);
  }
  if (method === 'PATCH') return null;
  return res.json();
}

async function sendTg(chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

async function getLibraryName(libraryId: string | null): Promise<string> {
  if (!libraryId) return 'المكتبة';
  try {
    const rows = await supaRest(`/libraries?id=eq.${encodeURIComponent(libraryId)}&select=name,slug&limit=1`);
    const row = rows?.[0];
    return String(row?.name || row?.slug || 'المكتبة').trim() || 'المكتبة';
  } catch {
    return 'المكتبة';
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!TELEGRAM_WEBHOOK_SECRET) {
      console.error('[telegram-webhook] missing TELEGRAM_WEBHOOK_SECRET');
      return NextResponse.json({ ok: false, error: 'missing_telegram_webhook_secret' }, { status: 500 });
    }
    if (req.headers.get('x-telegram-bot-api-secret-token') !== TELEGRAM_WEBHOOK_SECRET) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }
    if (!SUPABASE_URL || !SUPABASE_KEY || !TELEGRAM_BOT_TOKEN) {
      console.error('[telegram-webhook] missing env vars');
      return NextResponse.json({ ok: false, error: 'config' }, { status: 500 });
    }

    const update = await req.json();
    const chatId = String(update?.message?.chat?.id ?? '');
    const text: string = String(update?.message?.text ?? '').trim();
    if (!chatId || !text.startsWith('/start')) return NextResponse.json({ ok: true });

    const parts = text.split(/\s+/, 2);
    const startValue = String(parts[1] ?? '').trim().slice(0, 80);
    if (!startValue) {
      await sendTg(chatId, '👋 أهلاً! لتفعيل إشعارات طلبك، استخدم الرابط الموجود في صفحة الطلب بعد رفع ملفاتك.');
      return NextResponse.json({ ok: true });
    }

    let rows: any[];
    try {
      const isRequestId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(startValue);
      const lookupColumn = isRequestId ? 'id' : 'ticket';
      const lookupValue = isRequestId ? startValue : startValue.toUpperCase().slice(0, 12);
      rows = await supaRest(`/print_requests?${lookupColumn}=eq.${encodeURIComponent(lookupValue)}&select=id,library_id,ticket,student_name,status,telegram_chat_id&limit=1`);
    } catch (err) {
      console.error('[telegram-webhook] supabase lookup error:', err);
      await sendTg(chatId, `⚠️ خطأ في البحث عن التذكرة، حاول مرة ثانية.`);
      return NextResponse.json({ ok: true });
    }

    const row = rows?.[0];
    if (!row) {
      await sendTg(chatId, `لم أجد طلباً بهذا الرابط.`);
      return NextResponse.json({ ok: true });
    }

    // Update chat id
    try {
      await supaRest(`/print_requests?id=eq.${row.id}`, {
        method: 'PATCH',
        body: { telegram_chat_id: chatId, updated_at: new Date().toISOString() },
      });
    } catch (err) {
      console.error('[telegram-webhook] supabase update error:', err);
    }

    // Send confirmation directly
    const name = (row.student_name ?? '').trim() || 'الطالب';
    const libraryName = await getLibraryName(row.library_id ?? null);
    const lines = [
      `✅ تم ربط إشعارات ${libraryName} بنجاح`,
      `مرحباً ${name}`,
      `المكتبة: ${libraryName}`,
      `رقم التذكرة: ${row.ticket}`,
      'سنرسل لك تحديثاً عندما يصبح الطلب جاهزاً للاستلام.',
    ];

    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: lines.join('\n') }),
    });

    // If request is already ready, send ready notification too
    if (row.status === 'ready') {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: [
            '📦 طلبك جاهز للاستلام',
            `مرحباً ${name}`,
            `المكتبة: ${libraryName}`,
            `رقم التذكرة: ${row.ticket}`,
            `يرجى مراجعة ${libraryName} لاستلام الطلب.`,
          ].join('\n'),
        }),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
