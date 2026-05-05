import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';

type DesktopRuntimeConfig = {
  desktopGatewayUrl?: string;
  webBaseUrl?: string; // e.g. https://uoadrop.example.com
};

export type OnlineModeReason = 'enabled' | 'activation_required' | 'missing_gateway_url';

export type OnlineModeStatus = {
  enabled: boolean;
  reason: OnlineModeReason;
  activated: boolean;
  deviceId: string;
  libraryId?: string;
  librarySlug?: string;
  libraryName?: string;
  webBaseUrl: string;
  hasGatewayUrl: boolean;
  hasDesktopToken: boolean;
};

export type OnlineModeActivationResult = {
  ok: boolean;
  error?: 'invalid_activation_password' | 'activation_write_failed' | 'activation_network_error' | 'missing_gateway_url' | 'server_error';
  status: OnlineModeStatus;
};

export type OnlineGatewayDiagnostics = {
  ok: boolean;
  serverReachable: boolean;
  error?: string;
  pendingOnlineRequests?: number;
  status: OnlineModeStatus;
};

type OnlineModeActivationRecord = {
  activated: boolean;
  activatedAt: string;
  deviceId: string;
  token: string;
  webBaseUrl: string;
  libraryId?: string;
  librarySlug?: string;
  libraryName?: string;
};

export type DesktopGatewayConfig = {
  baseUrl: string;
  token: string;
  deviceId: string;
  libraryId?: string;
  librarySlug?: string;
  libraryName?: string;
};

const DEFAULT_WEB_BASE_URL = 'https://uoadrop.vercel.app';

let cachedConfig: DesktopRuntimeConfig | null | undefined;
let cachedOnlineActivationRecord: OnlineModeActivationRecord | null | undefined;
let cachedDesktopDeviceId: string | undefined;

function readJsonConfig(filePath: string): DesktopRuntimeConfig | null {
  try {
    if (!existsSync(filePath)) return null;
    const raw = readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as DesktopRuntimeConfig;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function getCandidateConfigPaths(): string[] {
  const userDataPath = app.getPath('userData');
  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  const cwd = process.cwd();
  return [
    process.env.UOADROP_RUNTIME_CONFIG ?? '',
    join(userDataPath, 'runtime-config.json'),
    resolve(cwd, 'apps/desktop/resources/runtime-config.json'),
    resolve(cwd, 'resources/runtime-config.json'),
    ...(typeof resourcesPath === 'string'
      ? [
          join(resourcesPath, 'runtime-config.json'),
          join(resourcesPath, 'resources', 'runtime-config.json'),
        ]
      : []),
    join(dirname(app.getPath('exe')), 'runtime-config.json'),
  ].filter(Boolean);
}

export function getDesktopRuntimeConfig(): DesktopRuntimeConfig {
  if (cachedConfig !== undefined) return cachedConfig ?? {};
  for (const filePath of getCandidateConfigPaths()) {
    const config = readJsonConfig(filePath);
    if (config) {
      cachedConfig = config;
      return config;
    }
  }
  cachedConfig = {};
  return cachedConfig;
}

function getOnlineActivationPath(): string {
  return join(app.getPath('userData'), 'online-mode-activation.json');
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/$/, '');
}

function normalizeWebBaseUrl(value: string): string {
  return normalizeBaseUrl(value).replace(/\/api\/desktop$/i, '');
}

export function getDesktopDeviceId(): string {
  if (cachedDesktopDeviceId) return cachedDesktopDeviceId;
  const userDataPath = app.getPath('userData');
  const filePath = join(userDataPath, 'desktop-device-id');
  try {
    if (existsSync(filePath)) {
      const existing = readFileSync(filePath, 'utf8').trim();
      if (existing) {
        cachedDesktopDeviceId = existing;
        return existing;
      }
    }
  } catch {
  }

  const generated = randomUUID();
  try {
    mkdirSync(userDataPath, { recursive: true });
    writeFileSync(filePath, `${generated}\n`, 'utf8');
  } catch {
  }
  cachedDesktopDeviceId = generated;
  return generated;
}

export function getDesktopGatewayBaseUrl(): string {
  const runtimeConfig = getDesktopRuntimeConfig();
  return normalizeWebBaseUrl(String(
    process.env.UOADROP_DESKTOP_GATEWAY_URL
      ?? runtimeConfig.desktopGatewayUrl
      ?? process.env.UOADROP_WEB_BASE_URL
      ?? runtimeConfig.webBaseUrl
      ?? DEFAULT_WEB_BASE_URL,
  ));
}

function getOnlineActivationRecord(): OnlineModeActivationRecord | null {
  if (cachedOnlineActivationRecord !== undefined) return cachedOnlineActivationRecord;
  try {
    const filePath = getOnlineActivationPath();
    if (existsSync(filePath)) {
      const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as Partial<OnlineModeActivationRecord>;
      if (parsed.activated === true && parsed.token && parsed.deviceId) {
        cachedOnlineActivationRecord = {
          activated: true,
          activatedAt: String(parsed.activatedAt ?? ''),
          deviceId: String(parsed.deviceId),
          token: String(parsed.token),
          webBaseUrl: normalizeWebBaseUrl(String(parsed.webBaseUrl || getDesktopGatewayBaseUrl())),
          ...(parsed.libraryId ? { libraryId: String(parsed.libraryId) } : {}),
          ...(parsed.librarySlug ? { librarySlug: String(parsed.librarySlug) } : {}),
          ...(parsed.libraryName ? { libraryName: String(parsed.libraryName) } : {}),
        };
        return cachedOnlineActivationRecord;
      }
    }
  } catch {
  }
  cachedOnlineActivationRecord = null;
  return cachedOnlineActivationRecord;
}

function isOnlineModeActivated(): boolean {
  return Boolean(getOnlineActivationRecord()?.token);
}

export async function activateOnlineMode(passphrase: string): Promise<OnlineModeActivationResult> {
  const webBaseUrl = getDesktopGatewayBaseUrl();
  if (!webBaseUrl) return { ok: false, error: 'missing_gateway_url', status: getOnlineModeStatus() };
  const deviceId = getDesktopDeviceId();
  let token = '';
  let activationPayload: {
    libraryId?: string;
    librarySlug?: string;
    libraryName?: string;
    library?: { id?: string; slug?: string; name?: string };
  } = {};
  try {
    const res = await fetch(`${webBaseUrl}/api/desktop/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passphrase, deviceId }),
    });
    const payload = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      token?: string;
      error?: OnlineModeActivationResult['error'];
      libraryId?: string;
      librarySlug?: string;
      libraryName?: string;
      library?: { id?: string; slug?: string; name?: string };
    };
    if (!res.ok || !payload.ok || !payload.token) {
      return { ok: false, error: payload.error ?? 'server_error', status: getOnlineModeStatus() };
    }
    token = payload.token;
    activationPayload = payload;
  } catch {
    return { ok: false, error: 'activation_network_error', status: getOnlineModeStatus() };
  }

  try {
    const userDataPath = app.getPath('userData');
    const record: OnlineModeActivationRecord = {
      activated: true,
      activatedAt: new Date().toISOString(),
      deviceId,
      token,
      webBaseUrl,
      ...(activationPayload.libraryId || activationPayload.library?.id ? { libraryId: String(activationPayload.libraryId || activationPayload.library?.id) } : {}),
      ...(activationPayload.librarySlug || activationPayload.library?.slug ? { librarySlug: String(activationPayload.librarySlug || activationPayload.library?.slug) } : {}),
      ...(activationPayload.libraryName || activationPayload.library?.name ? { libraryName: String(activationPayload.libraryName || activationPayload.library?.name) } : {}),
    };
    mkdirSync(userDataPath, { recursive: true });
    writeFileSync(getOnlineActivationPath(), `${JSON.stringify(record, null, 2)}\n`, 'utf8');
    cachedOnlineActivationRecord = record;
    return { ok: true, status: getOnlineModeStatus() };
  } catch {
    return { ok: false, error: 'activation_write_failed', status: getOnlineModeStatus() };
  }
}

export function getOnlineModeStatus(): OnlineModeStatus {
  const activationRecord = getOnlineActivationRecord();
  const webBaseUrl = activationRecord?.webBaseUrl || getDesktopGatewayBaseUrl();
  const activated = isOnlineModeActivated();
  let reason: OnlineModeReason = activated ? 'enabled' : 'activation_required';
  if (!webBaseUrl) reason = 'missing_gateway_url';

  return {
    enabled: activated && Boolean(webBaseUrl),
    reason,
    activated,
    deviceId: activationRecord?.deviceId || getDesktopDeviceId(),
    ...(activationRecord?.libraryId ? { libraryId: activationRecord.libraryId } : {}),
    ...(activationRecord?.librarySlug ? { librarySlug: activationRecord.librarySlug } : {}),
    ...(activationRecord?.libraryName ? { libraryName: activationRecord.libraryName } : {}),
    webBaseUrl,
    hasGatewayUrl: Boolean(webBaseUrl),
    hasDesktopToken: Boolean(activationRecord?.token),
  };
}

export function isOnlineModeAuthorized(): boolean {
  return getOnlineModeStatus().enabled;
}

export function getDesktopGatewayConfig(): DesktopGatewayConfig | null {
  if (!isOnlineModeAuthorized()) return null;
  const activationRecord = getOnlineActivationRecord();
  if (!activationRecord?.token) return null;
  return {
    baseUrl: activationRecord.webBaseUrl || getDesktopGatewayBaseUrl(),
    token: activationRecord.token,
    deviceId: activationRecord.deviceId,
    ...(activationRecord.libraryId ? { libraryId: activationRecord.libraryId } : {}),
    ...(activationRecord.librarySlug ? { librarySlug: activationRecord.librarySlug } : {}),
    ...(activationRecord.libraryName ? { libraryName: activationRecord.libraryName } : {}),
  };
}

export async function checkOnlineGatewayDiagnostics(): Promise<OnlineGatewayDiagnostics> {
  const status = getOnlineModeStatus();
  const config = getDesktopGatewayConfig();
  if (!status.enabled || !config) {
    return { ok: false, serverReachable: false, error: status.reason, status };
  }

  try {
    const res = await fetch(`${config.baseUrl}/api/desktop/status`, {
      headers: {
        Authorization: `Bearer ${config.token}`,
      },
    });
    const payload = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; details?: string; pendingOnlineRequests?: number };
    if (!res.ok || payload.ok === false) {
      return {
        ok: false,
        serverReachable: true,
        error: payload.details || payload.error || `http_${res.status}`,
        status: getOnlineModeStatus(),
      };
    }
    return {
      ok: true,
      serverReachable: true,
      pendingOnlineRequests: payload.pendingOnlineRequests ?? 0,
      status: getOnlineModeStatus(),
    };
  } catch (err) {
    return {
      ok: false,
      serverReachable: false,
      error: String((err as Error)?.message ?? err).slice(0, 200),
      status: getOnlineModeStatus(),
    };
  }
}
