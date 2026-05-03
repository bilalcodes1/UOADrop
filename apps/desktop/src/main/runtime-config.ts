import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash, timingSafeEqual } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';

type DesktopRuntimeConfig = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  supabaseServiceRoleKey?: string;
  telegramBotToken?: string;
  notifyServerUrl?: string; // e.g. https://uoadrop.example.com/api/notify/telegram
  webBaseUrl?: string; // e.g. https://uoadrop.example.com
  onlineEncryptionPrivateKey?: string;
  onlineEncryptionPrivateKeyBase64?: string;
};

export type OnlineModeReason = 'enabled' | 'activation_required';

export type OnlineModeStatus = {
  enabled: boolean;
  reason: OnlineModeReason;
  activated: boolean;
  hasSupabaseUrl: boolean;
  hasSupabaseAnonKey: boolean;
  hasServiceRoleKey: boolean;
  hasWebBaseUrl: boolean;
  hasNotifyServerUrl: boolean;
};

export type OnlineModeActivationResult = {
  ok: boolean;
  error?: 'invalid_activation_password' | 'activation_write_failed';
  status: OnlineModeStatus;
};

type OnlineModeActivationRecord = {
  activated: boolean;
  activatedAt: string;
  passphraseHash: string;
};

const ONLINE_ACTIVATION_PASSPHRASE_HASH = 'fd482f9780b2c21ae943c2aa7c29d822624f5cea7f5fc694ea9abfbfb5ec9207';

let cachedConfig: DesktopRuntimeConfig | null | undefined;
let cachedOnlineActivation: boolean | undefined;

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

function hashActivationPassphrase(value: string): string {
  return createHash('sha256').update(value.trim(), 'utf8').digest('hex');
}

function isValidActivationPassphrase(value: string): boolean {
  const actual = Buffer.from(hashActivationPassphrase(value), 'hex');
  const expected = Buffer.from(ONLINE_ACTIVATION_PASSPHRASE_HASH, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function isOnlineModeActivated(): boolean {
  if (cachedOnlineActivation !== undefined) return cachedOnlineActivation;
  try {
    const filePath = getOnlineActivationPath();
    if (existsSync(filePath)) {
      const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as Partial<OnlineModeActivationRecord>;
      cachedOnlineActivation = parsed.activated === true && parsed.passphraseHash === ONLINE_ACTIVATION_PASSPHRASE_HASH;
      return cachedOnlineActivation;
    }
  } catch {
  }
  cachedOnlineActivation = false;
  return cachedOnlineActivation;
}

export function activateOnlineMode(passphrase: string): OnlineModeActivationResult {
  if (!isValidActivationPassphrase(passphrase)) {
    return { ok: false, error: 'invalid_activation_password', status: getOnlineModeStatus() };
  }

  try {
    const userDataPath = app.getPath('userData');
    const record: OnlineModeActivationRecord = {
      activated: true,
      activatedAt: new Date().toISOString(),
      passphraseHash: ONLINE_ACTIVATION_PASSPHRASE_HASH,
    };
    mkdirSync(userDataPath, { recursive: true });
    writeFileSync(getOnlineActivationPath(), `${JSON.stringify(record, null, 2)}\n`, 'utf8');
    cachedOnlineActivation = true;
    return { ok: true, status: getOnlineModeStatus() };
  } catch {
    return { ok: false, error: 'activation_write_failed', status: getOnlineModeStatus() };
  }
}

export function getOnlineModeStatus(): OnlineModeStatus {
  const runtimeConfig = getDesktopRuntimeConfig();
  const activated = isOnlineModeActivated();
  const hasSupabaseUrl = Boolean(String(process.env.VITE_SUPABASE_URL ?? runtimeConfig.supabaseUrl ?? '').trim());
  const hasSupabaseAnonKey = Boolean(String(process.env.VITE_SUPABASE_ANON_KEY ?? runtimeConfig.supabaseAnonKey ?? '').trim());
  const hasServiceRoleKey = Boolean(String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? runtimeConfig.supabaseServiceRoleKey ?? '').trim());
  const hasWebBaseUrl = Boolean(String(process.env.UOADROP_WEB_BASE_URL ?? runtimeConfig.webBaseUrl ?? '').trim());
  const hasNotifyServerUrl = Boolean(String(process.env.UOADROP_NOTIFY_SERVER_URL ?? runtimeConfig.notifyServerUrl ?? '').trim());
  const reason: OnlineModeReason = activated ? 'enabled' : 'activation_required';

  return {
    enabled: activated,
    reason,
    activated,
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
