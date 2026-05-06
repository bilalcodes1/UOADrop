import { NextRequest } from 'next/server';
import { createHash } from 'node:crypto';
import { createDesktopToken, getAdminClient, json } from '../_lib';

type LibraryRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
};

type ActivationCodeRow = {
  id: string;
  library_id: string;
  expires_at: string | null;
  used_at: string | null;
  used_by_device_id: string | null;
  revoked_at: string | null;
};

function hashActivationCode(value: string): string {
  return createHash('sha256').update(String(value ?? '').trim()).digest('hex');
}

async function loadLibrary(libraryId: string): Promise<LibraryRow | null> {
  const { data, error } = await getAdminClient()
    .from('libraries')
    .select('id, slug, name, status')
    .eq('id', libraryId)
    .maybeSingle();
  if (error) throw error;
  return (data as LibraryRow | null) ?? null;
}

async function resolveActivationCode(passphrase: string, deviceId: string): Promise<LibraryRow | null> {
  const codeHash = hashActivationCode(passphrase);
  const { data, error } = await getAdminClient()
    .from('library_activation_codes')
    .select('id, library_id, expires_at, used_at, used_by_device_id, revoked_at')
    .eq('code_hash', codeHash)
    .maybeSingle();
  if (error) {
    const message = String(error.message ?? '');
    if (/library_activation_codes|schema cache|does not exist|relation/i.test(message)) return null;
    throw error;
  }
  const code = (data as ActivationCodeRow | null) ?? null;
  if (!code || code.revoked_at) return null;
  if (code.expires_at && new Date(code.expires_at).getTime() < Date.now()) return null;
  if (code.used_at && code.used_by_device_id !== deviceId) return null;

  const library = await loadLibrary(code.library_id);
  if (!library || library.status !== 'active') return null;

  if (!code.used_at) {
    const { error: updateError } = await getAdminClient()
      .from('library_activation_codes')
      .update({
        used_at: new Date().toISOString(),
        used_by_device_id: deviceId,
      })
      .eq('id', code.id);
    if (updateError) throw updateError;
  }

  return library;
}

async function resolveActivationLibrary(passphrase: string, deviceId: string): Promise<LibraryRow | null> {
  const codeLibrary = await resolveActivationCode(passphrase, deviceId);
  if (codeLibrary) return codeLibrary;
  return null;
}

async function recordDesktopDevice(deviceId: string, library: LibraryRow): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await getAdminClient()
    .from('desktop_devices')
    .upsert({
      device_id: deviceId,
      library_id: library.id,
      status: 'active',
      activated_at: now,
      last_seen_at: now,
      updated_at: now,
    }, { onConflict: 'device_id' });
  if (error) throw error;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { passphrase?: string; deviceId?: string };
    const deviceId = String(body.deviceId ?? '').trim().slice(0, 120);
    if (!deviceId) return json({ ok: false, error: 'missing_device_id' }, { status: 400 });
    const library = await resolveActivationLibrary(String(body.passphrase ?? ''), deviceId);
    if (!library) {
      return json({ ok: false, error: 'invalid_activation_password' }, { status: 401 });
    }
    await recordDesktopDevice(deviceId, library);

    return json({
      ok: true,
      token: createDesktopToken(deviceId, { id: library.id, slug: library.slug, name: library.name }),
      deviceId,
      libraryId: library.id,
      librarySlug: library.slug,
      libraryName: library.name,
      library: {
        id: library.id,
        slug: library.slug,
        name: library.name,
      },
      expiresInSeconds: 60 * 60 * 24 * 365,
    });
  } catch (err) {
    return json({ ok: false, error: 'server_error', details: String((err as Error)?.message ?? err).slice(0, 200) }, { status: 500 });
  }
}
