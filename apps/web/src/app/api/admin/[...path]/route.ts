import { NextRequest } from 'next/server';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { getAdminClient, json } from '../../desktop/_lib';

export const dynamic = 'force-dynamic';

type RouteContext = { params: { path?: string[] } };

type LibraryBody = {
  name?: string;
  slug?: string;
  status?: string;
};

type ActivationCodeBody = {
  label?: string;
  expiresInDays?: number | null;
};

const ADMIN_PASSWORD = String(process.env.UOADROP_ADMIN_PASSWORD ?? '').trim();

function getPath(ctx: RouteContext): string[] {
  return ctx.params.path ?? [];
}

function getBearer(req: NextRequest): string {
  const header = req.headers.get('authorization') ?? '';
  return header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
}

function requireAdmin(req: NextRequest): true | ReturnType<typeof json> {
  if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12) {
    return json({ ok: false, error: 'missing_admin_password' }, { status: 500 });
  }
  const provided = getBearer(req) || String(req.headers.get('x-admin-password') ?? '').trim();
  const actual = Buffer.from(provided);
  const expected = Buffer.from(ADMIN_PASSWORD);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  return true;
}

function normalizeSlug(value: string): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function normalizeName(value: string): string {
  return String(value ?? '').trim().slice(0, 160);
}

function hashActivationCode(value: string): string {
  return createHash('sha256').update(String(value ?? '').trim()).digest('hex');
}

function generateActivationCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(10);
  const body = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
  return `UOA-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8)}`;
}

function resolveActivationExpiry(value: number | null | undefined): string | null {
  if (value === null) return null;
  const expiresInDays = Number(value ?? 7);
  if (!Number.isFinite(expiresInDays) || expiresInDays <= 0) return null;
  return new Date(Date.now() + Math.min(expiresInDays, 365) * 24 * 60 * 60 * 1000).toISOString();
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  try {
    const auth = requireAdmin(req);
    if (auth !== true) return auth;
    const path = getPath(ctx);
    const admin = getAdminClient();

    if (path.length === 0 || (path.length === 1 && path[0] === 'status')) {
      return json({ ok: true });
    }

    if (path.length === 1 && path[0] === 'libraries') {
      const { data, error } = await admin
        .from('libraries')
        .select('id, slug, name, status, created_at, updated_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return json({ ok: true, libraries: data ?? [] });
    }

    if (path.length === 1 && path[0] === 'devices') {
      const { data, error } = await admin
        .from('desktop_devices')
        .select('id, device_id, library_id, name, status, activated_at, last_seen_at, created_at, updated_at, libraries(name, slug)')
        .order('last_seen_at', { ascending: false, nullsFirst: false })
        .limit(200);
      if (error) throw error;
      return json({ ok: true, devices: data ?? [] });
    }

    if (path.length === 1 && path[0] === 'activation-codes') {
      const { data, error } = await admin
        .from('library_activation_codes')
        .select('id, library_id, label, expires_at, used_at, used_by_device_id, revoked_at, created_at, libraries(name, slug)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return json({ ok: true, activationCodes: data ?? [] });
    }

    return json({ ok: false, error: 'not_found' }, { status: 404 });
  } catch (err) {
    return json({ ok: false, error: 'server_error', details: String((err as Error)?.message ?? err).slice(0, 200) }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const auth = requireAdmin(req);
    if (auth !== true) return auth;
    const path = getPath(ctx);
    const admin = getAdminClient();

    if (path.length === 1 && path[0] === 'libraries') {
      const body = (await req.json().catch(() => ({}))) as LibraryBody;
      const name = normalizeName(body.name ?? '');
      const slug = normalizeSlug(body.slug || name);
      if (!name || slug.length < 3) return json({ ok: false, error: 'invalid_library' }, { status: 400 });
      const { data, error } = await admin
        .from('libraries')
        .insert({ name, slug, status: 'active' })
        .select('id, slug, name, status, created_at, updated_at')
        .single();
      if (error) throw error;
      const { error: paymentError } = await admin.from('payment_settings').insert([
        { library_id: data.id, key: 'qicard', account_number: '' },
        { library_id: data.id, key: 'zaincash', account_number: '' },
      ]);
      if (paymentError) throw paymentError;
      return json({ ok: true, library: data });
    }

    if (path.length === 3 && path[0] === 'libraries' && path[2] === 'activation-codes') {
      const libraryId = String(path[1] ?? '');
      const body = (await req.json().catch(() => ({}))) as ActivationCodeBody;
      const code = generateActivationCode();
      const expiresAt = resolveActivationExpiry(body.expiresInDays);
      const { data, error } = await admin
        .from('library_activation_codes')
        .insert({
          library_id: libraryId,
          code_hash: hashActivationCode(code),
          label: normalizeName(body.label ?? ''),
          expires_at: expiresAt,
        })
        .select('id, library_id, label, expires_at, used_at, used_by_device_id, revoked_at, created_at')
        .single();
      if (error) throw error;
      return json({ ok: true, activationCode: data, code });
    }

    return json({ ok: false, error: 'not_found' }, { status: 404 });
  } catch (err) {
    return json({ ok: false, error: 'server_error', details: String((err as Error)?.message ?? err).slice(0, 200) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const auth = requireAdmin(req);
    if (auth !== true) return auth;
    const path = getPath(ctx);
    const admin = getAdminClient();

    if (path.length === 2 && path[0] === 'libraries') {
      const body = (await req.json().catch(() => ({}))) as LibraryBody;
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (typeof body.name === 'string') patch.name = normalizeName(body.name);
      if (typeof body.status === 'string' && ['active', 'disabled'].includes(body.status)) patch.status = body.status;
      const { data, error } = await admin
        .from('libraries')
        .update(patch)
        .eq('id', path[1])
        .select('id, slug, name, status, created_at, updated_at')
        .single();
      if (error) throw error;
      return json({ ok: true, library: data });
    }

    if (path.length === 2 && path[0] === 'activation-codes') {
      const { data, error } = await admin
        .from('library_activation_codes')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', path[1])
        .select('id, library_id, label, expires_at, used_at, used_by_device_id, revoked_at, created_at')
        .single();
      if (error) throw error;
      return json({ ok: true, activationCode: data });
    }

    return json({ ok: false, error: 'not_found' }, { status: 404 });
  } catch (err) {
    return json({ ok: false, error: 'server_error', details: String((err as Error)?.message ?? err).slice(0, 200) }, { status: 500 });
  }
}
