import { app } from 'electron';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

type DesktopRuntimeConfig = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  supabaseServiceRoleKey?: string;
  telegramBotToken?: string;
  notifyServerUrl?: string; // e.g. https://uoadrop.example.com/api/notify/telegram
  webBaseUrl?: string; // e.g. https://uoadrop.example.com
};

let cachedConfig: DesktopRuntimeConfig | null | undefined;

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

export function getSupabaseRuntimeConfig(): {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
} {
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
  const runtimeConfig = getDesktopRuntimeConfig();
  return {
    botToken: String(process.env.TELEGRAM_BOT_TOKEN ?? runtimeConfig.telegramBotToken ?? '').trim(),
  };
}

export function getNotifyServerUrl(): string {
  const runtimeConfig = getDesktopRuntimeConfig();
  return String(process.env.UOADROP_NOTIFY_SERVER_URL ?? runtimeConfig.notifyServerUrl ?? '').trim();
}

export function getWebBaseUrl(): string {
  const runtimeConfig = getDesktopRuntimeConfig();
  return String(process.env.UOADROP_WEB_BASE_URL ?? runtimeConfig.webBaseUrl ?? '').trim().replace(/\/$/, '');
}
