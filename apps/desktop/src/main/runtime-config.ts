import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';

type DesktopRuntimeConfig = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  supabaseServiceRoleKey?: string;
  onlineModeEnabled?: boolean;
  onlineDeviceId?: string;
  telegramBotToken?: string;
  notifyServerUrl?: string; // e.g. https://uoadrop.example.com/api/notify/telegram
  webBaseUrl?: string; // e.g. https://uoadrop.example.com
  onlineEncryptionPrivateKey?: string;
  onlineEncryptionPrivateKeyBase64?: string;
};

export type OnlineModeReason = 'enabled' | 'disabled_by_config' | 'missing_online_device_id' | 'device_not_authorized';

export type OnlineModeStatus = {
  enabled: boolean;
  reason: OnlineModeReason;
  deviceId: string;
  configuredDeviceId: string;
  onlineModeEnabled: boolean;
  hasSupabaseUrl: boolean;
  hasSupabaseAnonKey: boolean;
  hasServiceRoleKey: boolean;
  hasWebBaseUrl: boolean;
  hasNotifyServerUrl: boolean;
};

let cachedConfig: DesktopRuntimeConfig | null | undefined;
let cachedOnlineDeviceId: string | undefined;

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

function readOptionalBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return null;
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return null;
}

function normalizeOnlineDeviceId(value: string): string {
  return value.trim().toLowerCase();
}

export function getDesktopOnlineDeviceId(): string {
  if (cachedOnlineDeviceId) return cachedOnlineDeviceId;
  const userDataPath = app.getPath('userData');
  const filePath = join(userDataPath, 'online-device-id');
  try {
    if (existsSync(filePath)) {
      const existing = normalizeOnlineDeviceId(readFileSync(filePath, 'utf8'));
      if (existing) {
        cachedOnlineDeviceId = existing;
        return existing;
      }
    }
  } catch {
  }

  const generated = normalizeOnlineDeviceId(randomUUID());
  try {
    mkdirSync(userDataPath, { recursive: true });
    writeFileSync(filePath, `${generated}\n`, 'utf8');
  } catch {
  }
  cachedOnlineDeviceId = generated;
  return generated;
}

export function getOnlineModeStatus(): OnlineModeStatus {
  const runtimeConfig = getDesktopRuntimeConfig();
  const deviceId = getDesktopOnlineDeviceId();
  const configuredDeviceId = String(process.env.UOADROP_ONLINE_DEVICE_ID ?? runtimeConfig.onlineDeviceId ?? '').trim();
  const onlineModeEnabled = readOptionalBoolean(process.env.UOADROP_ONLINE_MODE_ENABLED)
    ?? readOptionalBoolean(runtimeConfig.onlineModeEnabled)
    ?? false;
  const hasSupabaseUrl = Boolean(String(process.env.VITE_SUPABASE_URL ?? runtimeConfig.supabaseUrl ?? '').trim());
  const hasSupabaseAnonKey = Boolean(String(process.env.VITE_SUPABASE_ANON_KEY ?? runtimeConfig.supabaseAnonKey ?? '').trim());
  const hasServiceRoleKey = Boolean(String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? runtimeConfig.supabaseServiceRoleKey ?? '').trim());
  const hasWebBaseUrl = Boolean(String(process.env.UOADROP_WEB_BASE_URL ?? runtimeConfig.webBaseUrl ?? '').trim());
  const hasNotifyServerUrl = Boolean(String(process.env.UOADROP_NOTIFY_SERVER_URL ?? runtimeConfig.notifyServerUrl ?? '').trim());
  const normalizedConfiguredDeviceId = normalizeOnlineDeviceId(configuredDeviceId);
  let reason: OnlineModeReason = 'enabled';
  if (!onlineModeEnabled) {
    reason = 'disabled_by_config';
  } else if (!normalizedConfiguredDeviceId) {
    reason = 'missing_online_device_id';
  } else if (normalizeOnlineDeviceId(deviceId) !== normalizedConfiguredDeviceId) {
    reason = 'device_not_authorized';
  }

  return {
    enabled: reason === 'enabled',
    reason,
    deviceId,
    configuredDeviceId,
    onlineModeEnabled,
    hasSupabaseUrl,
    hasSupabaseAnonKey,
    hasServiceRoleKey,
    hasWebBaseUrl,
    hasNotifyServerUrl,
  };
}

export function isOnlineModeAuthorized(): boolean {
  return getOnlineModeStatus().enabled;
}

export function getSupabaseRuntimeConfig(): {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
} {
  if (!isOnlineModeAuthorized()) return { url: '', anonKey: '', serviceRoleKey: '' };
  const runtimeConfig = getDesktopRuntimeConfig();
  return {
    url: String(process.env.VITE_SUPABASE_URL ?? runtimeConfig.supabaseUrl ?? '').trim(),
    anonKey: String(process.env.VITE_SUPABASE_ANON_KEY ?? runtimeConfig.supabaseAnonKey ?? '').trim(),
    serviceRoleKey: String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? runtimeConfig.supabaseServiceRoleKey ?? '').trim(),
  };
}

export function hasProductionServiceRoleKey(): boolean {
  return Boolean(getSupabaseRuntimeConfig().serviceRoleKey);
}

export function getTelegramRuntimeConfig(): { botToken: string } {
  if (!isOnlineModeAuthorized()) return { botToken: '' };
  const runtimeConfig = getDesktopRuntimeConfig();
  return {
    botToken: String(process.env.TELEGRAM_BOT_TOKEN ?? runtimeConfig.telegramBotToken ?? '').trim(),
  };
}

export function getNotifyServerUrl(): string {
  if (!isOnlineModeAuthorized()) return '';
  const runtimeConfig = getDesktopRuntimeConfig();
  return String(process.env.UOADROP_NOTIFY_SERVER_URL ?? runtimeConfig.notifyServerUrl ?? '').trim();
}

export function getWebBaseUrl(): string {
  if (!isOnlineModeAuthorized()) return '';
  const runtimeConfig = getDesktopRuntimeConfig();
  return String(process.env.UOADROP_WEB_BASE_URL ?? runtimeConfig.webBaseUrl ?? '').trim().replace(/\/$/, '');
}

export function getOnlineEncryptionPrivateKey(): string {
  if (!isOnlineModeAuthorized()) return '';
  const runtimeConfig = getDesktopRuntimeConfig();
  const raw = String(process.env.UOADROP_ENCRYPTION_PRIVATE_KEY ?? runtimeConfig.onlineEncryptionPrivateKey ?? '').trim();
  if (raw) return raw.replace(/\\n/g, '\n');

  const encoded = String(process.env.UOADROP_ENCRYPTION_PRIVATE_KEY_BASE64 ?? runtimeConfig.onlineEncryptionPrivateKeyBase64 ?? '').trim();
  if (!encoded) return '';

  try {
    return Buffer.from(encoded, 'base64').toString('utf8').trim().replace(/\\n/g, '\n');
  } catch {
    return '';
  }
}
