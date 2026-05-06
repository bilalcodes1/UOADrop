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

type DeleteLibraryBody = {
  confirmation?: string;
};

type DatabaseError = {
  code?: string;
  message?: string;
  details?: string;
};

const ADMIN_PASSWORD = String(process.env.UOADROP_ADMIN_PASSWORD ?? '').trim();
const ACTIVATION_CODE_SELECT = 'id, library_id, label, display_code, expires_at, used_at, used_by_device_id, revoked_at, created_at, libraries(name, slug)';
const ACTIVATION_CODE_SELECT_FALLBACK = 'id, library_id, label, expires_at, used_at, used_by_device_id, revoked_at, created_at, libraries(name, slug)';
const ACTIVATION_CODE_ROW_SELECT = 'id, library_id, label, display_code, expires_at, used_at, used_by_device_id, revoked_at, created_at';
const ACTIVATION_CODE_ROW_SELECT_FALLBACK = 'id, library_id, label, expires_at, used_at, used_by_device_id, revoked_at, created_at';

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

function resolveLibrarySlug(slugValue: string | undefined, nameValue: string): string {
  const preferred = normalizeSlug(slugValue ?? '');
  const fallback = normalizeSlug(nameValue);
  const base = preferred || fallback;
  if (!base) return nameValue ? `library-${randomBytes(3).toString('hex')}` : '';
  if (base.length >= 3) return base;
  return normalizeSlug(`${base}-library`);
}

function normalizeName(value: string): string {
  return String(value ?? '').trim().slice(0, 160);
}

function isUniqueViolation(error: unknown): boolean {
  const value = error as DatabaseError;
  const text = `${value?.message ?? ''} ${value?.details ?? ''}`;
  return value?.code === '23505' || /duplicate key|unique constraint/i.test(text);
}

function isMissingColumn(error: unknown, column: string): boolean {
  const value = error as DatabaseError;
  const text = `${value?.message ?? ''} ${value?.details ?? ''}`;
  return value?.code === 'PGRST204' || (new RegExp(`\\b${column}\\b`, 'i').test(text) && /schema cache|does not exist|column/i.test(text));
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
      const primary = await admin
        .from('library_activation_codes')
        .select(ACTIVATION_CODE_SELECT)
        .order('created_at', { ascending: false })
        .limit(200);
      let data: unknown = primary.data;
      let error: unknown = primary.error;
      if (isMissingColumn(error, 'display_code')) {
        const fallback = await admin
          .from('library_activation_codes')
          .select(ACTIVATION_CODE_SELECT_FALLBACK)
          .order('created_at', { ascending: false })
          .limit(200);
        data = fallback.data;
        error = fallback.error;
      }
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
      const slug = resolveLibrarySlug(body.slug, name);
      if (!name || slug.length < 3) return json({ ok: false, error: 'invalid_library' }, { status: 400 });
      const { data, error } = await admin
        .from('libraries')
        .insert({ name, slug, status: 'active' })
        .select('id, slug, name, status, created_at, updated_at')
        .single();
      if (isUniqueViolation(error)) return json({ ok: false, error: 'library_exists' }, { status: 409 });
      if (error) throw error;
      await admin.from('payment_settings').upsert([
        { library_id: data.id, key: 'qicard', account_number: '' },
        { library_id: data.id, key: 'zaincash', account_number: '' },
      ], { onConflict: 'library_id,key' });
      return json({ ok: true, library: data });
    }

    if (path.length === 3 && path[0] === 'libraries' && path[2] === 'activation-codes') {
      const libraryId = String(path[1] ?? '');
      const body = (await req.json().catch(() => ({}))) as ActivationCodeBody;
      const code = generateActivationCode();
      const expiresAt = resolveActivationExpiry(body.expiresInDays);
      const primary = await admin
        .from('library_activation_codes')
        .insert({
          library_id: libraryId,
          code_hash: hashActivationCode(code),
          display_code: code,
          label: normalizeName(body.label ?? ''),
          expires_at: expiresAt,
        })
        .select(ACTIVATION_CODE_ROW_SELECT)
        .single();
      if (isMissingColumn(primary.error, 'display_code')) {
        const fallback = await admin
          .from('library_activation_codes')
          .insert({
            library_id: libraryId,
            code_hash: hashActivationCode(code),
            label: normalizeName(body.label ?? ''),
            expires_at: expiresAt,
          })
          .select(ACTIVATION_CODE_ROW_SELECT_FALLBACK)
          .single();
        if (fallback.error) throw fallback.error;
        const fallbackRow = fallback.data as Record<string, unknown> | null;
        const activationCode = fallbackRow ? { ...fallbackRow, display_code: code } : fallbackRow;
        return json({ ok: true, activationCode, code });
      }
      if (primary.error) throw primary.error;
      return json({ ok: true, activationCode: primary.data, code });
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
      const primary = await admin
        .from('library_activation_codes')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', path[1])
        .select(ACTIVATION_CODE_ROW_SELECT)
        .single();
      let data: unknown = primary.data;
      let error: unknown = primary.error;
      if (isMissingColumn(error, 'display_code')) {
        const fallback = await admin
          .from('library_activation_codes')
          .update({ revoked_at: new Date().toISOString() })
          .eq('id', path[1])
          .select(ACTIVATION_CODE_ROW_SELECT_FALLBACK)
          .single();
        data = fallback.data;
        error = fallback.error;
      }
      if (error) throw error;
      return json({ ok: true, activationCode: data });
    }

    return json({ ok: false, error: 'not_found' }, { status: 404 });
  } catch (err) {
    return json({ ok: false, error: 'server_error', details: String((err as Error)?.message ?? err).slice(0, 200) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  try {
    const auth = requireAdmin(req);
    if (auth !== true) return auth;
    const path = getPath(ctx);
    const admin = getAdminClient();

    if (path.length === 2 && path[0] === 'libraries') {
      const body = (await req.json().catch(() => ({}))) as DeleteLibraryBody;
      const { data: library, error: libraryError } = await admin
        .from('libraries')
        .select('id, slug, name, status, created_at, updated_at')
        .eq('id', path[1])
        .maybeSingle();
      if (libraryError) throw libraryError;
      if (!library) return json({ ok: false, error: 'not_found' }, { status: 404 });
      const confirmation = String(body.confirmation ?? '').trim();
      if (confirmation !== library.name && confirmation !== library.slug) {
        return json({ ok: false, error: 'delete_confirmation_failed' }, { status: 400 });
      }
      const { data: files, error: filesError } = await admin
        .from('request_files')
        .select('storage_path')
        .eq('library_id', library.id);
      if (filesError) throw filesError;
      const storagePaths = [...new Set((files ?? [])
        .map((file) => String(file.storage_path ?? '').trim())
        .filter(Boolean))];
      for (let index = 0; index < storagePaths.length; index += 100) {
        const { error } = await admin.storage.from('print-files').remove(storagePaths.slice(index, index + 100));
        if (error) throw error;
      }
      const cleanup = [
        ['request_files', 'library_id'],
        ['print_requests', 'library_id'],
        ['desktop_devices', 'library_id'],
        ['library_activation_codes', 'library_id'],
        ['payment_settings', 'library_id'],
      ] as const;
      for (const [table, column] of cleanup) {
        const { error } = await admin.from(table).delete().eq(column, library.id);
        if (error) throw error;
      }
      const { error } = await admin.from('libraries').delete().eq('id', library.id);
      if (error) throw error;
      return json({ ok: true, library });
    }

    return json({ ok: false, error: 'not_found' }, { status: 404 });
  } catch (err) {
    return json({ ok: false, error: 'server_error', details: String((err as Error)?.message ?? err).slice(0, 200) }, { status: 500 });
  }
}
