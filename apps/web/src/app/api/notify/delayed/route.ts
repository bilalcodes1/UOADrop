import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ ok: false, error: 'deprecated_use_cron_endpoint' }, { status: 410 });
}
