import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Vercel Cron – pings Supabase every 5 days to prevent the free-tier
 * project from being paused due to inactivity.
 *
 * Configured in vercel.json → crons.
 */
export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
  }

  const supabase = createClient(url, key);

  // Simple lightweight query — just count 1 row
  const { count, error } = await supabase
    .from('print_requests')
    .select('*', { count: 'exact', head: true })
    .limit(1);

  if (error) {
    console.error('[keep-alive] Supabase ping failed:', error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  console.log(`[keep-alive] Supabase pinged OK — ${count} requests in DB`);
  return NextResponse.json({ ok: true, count, ts: new Date().toISOString() });
}
