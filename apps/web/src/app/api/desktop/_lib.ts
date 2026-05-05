import { NextRequest, NextResponse } from 'next/server';
import { createHmac, randomBytes, timingSafeEqual, constants as cryptoConstants, privateDecrypt } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
export const DESKTOP_ACTIVATION_PASSWORD = String(process.env.UOADROP_DESKTOP_ACTIVATION_PASSWORD ?? '').trim();
export const DESKTOP_TOKEN_SECRET = String(process.env.UOADROP_DESKTOP_TOKEN_SECRET ?? '').trim();
export const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 365;
export const DESKTOP_TOKEN_TYPE = 'uoadrop-desktop';
export const ONLINE_FILE_ENCRYPTION_ALGORITHM = 'AES-256-GCM+RSA-OAEP-SHA256';
const BLOCKED_DESKTOP_ACTIVATION_PASSWORDS = new Set(['bilalcodes1']);

export type DesktopTokenPayload = {
  typ: typeof DESKTOP_TOKEN_TYPE;
  deviceId: string;
  libraryId?: string;
  librarySlug?: string;
  libraryName?: string;
  iat: number;
  exp: number;
  nonce: string;
};

export type DesktopAuth = {
  deviceId: string;
  libraryId?: string;
  librarySlug?: string;
  libraryName?: string;
  payload: DesktopTokenPayload;
};

export function json(data: unknown, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, {
    ...init,
    headers: {
      'Cache-Control': 'no-store',
      ...(init?.headers ?? {}),
    },
  });
}

export function assertServerEnv(): void {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('missing_supabase_server_env');
  if (!DESKTOP_TOKEN_SECRET) throw new Error('missing_desktop_token_secret');
  if (DESKTOP_TOKEN_SECRET.length < 32) throw new Error('weak_desktop_token_secret');
}

export function assertActivationEnv(): void {
  if (!DESKTOP_ACTIVATION_PASSWORD) throw new Error('missing_desktop_activation_password');
  if (DESKTOP_ACTIVATION_PASSWORD.length < 12 || BLOCKED_DESKTOP_ACTIVATION_PASSWORDS.has(DESKTOP_ACTIVATION_PASSWORD)) {
    throw new Error('weak_desktop_activation_password');
  }
  if (!DESKTOP_TOKEN_SECRET) throw new Error('missing_desktop_token_secret');
  if (DESKTOP_TOKEN_SECRET.length < 32) throw new Error('weak_desktop_token_secret');
}

export function getAdminClient() {
  assertServerEnv();
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

function base64UrlEncode(value: Buffer | string): string {
  return Buffer.from(value).toString('base64url');
}

function base64UrlDecode(value: string): Buffer {
  return Buffer.from(value, 'base64url');
}

function signPayload(encodedPayload: string): string {
  return createHmac('sha256', DESKTOP_TOKEN_SECRET).update(encodedPayload).digest('base64url');
}

export function createDesktopToken(
  deviceId: string,
  library?: { id?: string | null; slug?: string | null; name?: string | null },
): string {
  assertServerEnv();
  const now = Math.floor(Date.now() / 1000);
  const payload: DesktopTokenPayload = {
    typ: DESKTOP_TOKEN_TYPE,
    deviceId: String(deviceId || '').trim().slice(0, 120),
    ...(library?.id ? { libraryId: String(library.id).trim() } : {}),
    ...(library?.slug ? { librarySlug: String(library.slug).trim().slice(0, 120) } : {}),
    ...(library?.name ? { libraryName: String(library.name).trim().slice(0, 180) } : {}),
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
    nonce: randomBytes(16).toString('base64url'),
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  return `${encodedPayload}.${signPayload(encodedPayload)}`;
}

function getBearerToken(req: NextRequest): string {
  const authorization = req.headers.get('authorization') ?? '';
  return authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : '';
}

export function verifyDesktopToken(token: string): DesktopAuth | null {
  if (!token || !DESKTOP_TOKEN_SECRET) return null;
  const [encodedPayload, signature] = token.split('.', 2);
  if (!encodedPayload || !signature) return null;
  const expected = signPayload(encodedPayload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload).toString('utf8')) as Partial<DesktopTokenPayload>;
    if (payload.typ !== DESKTOP_TOKEN_TYPE) return null;
    if (!payload.deviceId || typeof payload.deviceId !== 'string') return null;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return {
      deviceId: payload.deviceId,
      libraryId: typeof payload.libraryId === 'string' ? payload.libraryId : undefined,
      librarySlug: typeof payload.librarySlug === 'string' ? payload.librarySlug : undefined,
      libraryName: typeof payload.libraryName === 'string' ? payload.libraryName : undefined,
      payload: payload as DesktopTokenPayload,
    };
  } catch {
    return null;
  }
}

export function requireDesktopAuth(req: NextRequest): DesktopAuth | NextResponse {
  const auth = verifyDesktopToken(getBearerToken(req));
  if (!auth) return json({ ok: false, error: 'unauthorized' }, { status: 401 });
  return auth;
}

export function isDesktopAuth(value: DesktopAuth | NextResponse): value is DesktopAuth {
  return !(value instanceof NextResponse);
}

export function verifyActivationPassword(passphrase: string): boolean {
  assertActivationEnv();
  const actual = Buffer.from(String(passphrase ?? '').trim());
  const expected = Buffer.from(DESKTOP_ACTIVATION_PASSWORD);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function decodeBase64Buffer(value: string): Buffer {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  return Buffer.from(padded, 'base64');
}

function getOnlineEncryptionPrivateKey(): string {
  const raw = String(process.env.UOADROP_ENCRYPTION_PRIVATE_KEY ?? '').trim();
  if (raw) return raw.replace(/\\n/g, '\n');
  const encoded = String(process.env.UOADROP_ENCRYPTION_PRIVATE_KEY_BASE64 ?? '').trim();
  if (!encoded) return '';
  try {
    return Buffer.from(encoded, 'base64').toString('utf8').trim().replace(/\\n/g, '\n');
  } catch {
    return '';
  }
}

export function unwrapOnlineFileKey(file: {
  encryption_algorithm?: string | null;
  encrypted_key?: string | null;
}): string | null {
  if (!file.encryption_algorithm && !file.encrypted_key) return null;
  if (file.encryption_algorithm !== ONLINE_FILE_ENCRYPTION_ALGORITHM || !file.encrypted_key) {
    throw new Error('unsupported_online_file_encryption');
  }
  const privateKey = getOnlineEncryptionPrivateKey();
  if (!privateKey) throw new Error('missing_online_private_key');
  const key = privateDecrypt(
    {
      key: privateKey,
      padding: cryptoConstants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    decodeBase64Buffer(file.encrypted_key),
  );
  return key.toString('base64');
}
