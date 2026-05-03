import { NextRequest } from 'next/server';
import { createDesktopToken, json, verifyActivationPassword } from '../_lib';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { passphrase?: string; deviceId?: string };
    const deviceId = String(body.deviceId ?? '').trim().slice(0, 120);
    if (!deviceId) return json({ ok: false, error: 'missing_device_id' }, { status: 400 });
    if (!verifyActivationPassword(String(body.passphrase ?? ''))) {
      return json({ ok: false, error: 'invalid_activation_password' }, { status: 401 });
    }

    return json({
      ok: true,
      token: createDesktopToken(deviceId),
      deviceId,
      expiresInSeconds: 60 * 60 * 24 * 365,
    });
  } catch (err) {
    return json({ ok: false, error: 'server_error', details: String((err as Error)?.message ?? err).slice(0, 200) }, { status: 500 });
  }
}
