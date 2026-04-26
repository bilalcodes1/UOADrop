import { app, BrowserWindow, Notification, shell, session } from 'electron';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { registerIpcHandlers } from './ipc';
import { startOnlineWorkflowService } from './online-workflow';
import { startPrintQueueService } from './print-queue';
import { startTelegramNotificationService } from './telegram';
import { getSupabaseRuntimeConfig } from './runtime-config';
import { startLocalServer } from './server';
import { startPrinterPolling } from './printer';
import { subscribe as subscribeBus, type AppEvent } from './events';

// ─────────────────────────────────────────
// Cross-platform system "ding" — Electron Notification.silent=false is
// unreliable on unsigned macOS dev builds, so we trigger the system sound
// explicitly as a fallback. Non-blocking, failures are swallowed.
// ─────────────────────────────────────────
function playSystemDing(): void {
  try {
    if (process.platform === 'darwin') {
      const candidates = [
        '/System/Library/Sounds/Glass.aiff',
        '/System/Library/Sounds/Ping.aiff',
        '/System/Library/Sounds/Funk.aiff',
      ];
      const sound = candidates.find((p) => existsSync(p));
      if (sound) spawn('afplay', [sound], { detached: true, stdio: 'ignore' }).unref();
    } else if (process.platform === 'win32') {
      // PowerShell system sound
      spawn(
        'powershell',
        ['-c', '[System.Media.SystemSounds]::Asterisk.Play();'],
        { detached: true, stdio: 'ignore', windowsHide: true },
      ).unref();
    } else {
      // Linux: try paplay with freedesktop theme, fallback to beep via shell.
      spawn(
        'paplay',
        ['/usr/share/sounds/freedesktop/stereo/message.oga'],
        { detached: true, stdio: 'ignore' },
      ).unref();
    }
  } catch {
    /* ignore */
  }
}

const isDev = !app.isPackaged;

// ─────────────────────────────────────────
// Single-instance lock (docs/DECISIONS.md)
// ─────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

let mainWindow: BrowserWindow | null = null;

function getConnectSrcValues(): string[] {
  const values = ["'self'", 'ws://localhost:*', 'http://localhost:*'];
  const { url } = getSupabaseRuntimeConfig();
  if (!url) return values;
  try {
    const origin = new URL(url).origin;
    values.push(origin);
    if (origin.startsWith('https://')) {
      values.push(origin.replace('https://', 'wss://'));
    }
  } catch {
  }
  return [...new Set(values)];
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    title: 'UOADrop — لوحة المكتبة',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  // Block new-window / navigation away (security hardening)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (e, url) => {
    const allowed = ['http://localhost:', 'file://'];
    if (!allowed.some((p) => url.startsWith(p))) {
      e.preventDefault();
    }
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    mainWindow.webContents.openDevTools({ mode: 'right' });
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  // Allow Supabase HTTPS + Realtime WebSocket connections
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...details.responseHeaders };
    // Remove any existing CSP headers (case-insensitive)
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === 'content-security-policy') {
        delete headers[key];
      }
    }
    headers['Content-Security-Policy'] = [
      "default-src 'self'; " +
      `connect-src ${getConnectSrcValues().join(' ')}; ` +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: blob:; " +
      "font-src 'self' data:;",
    ];
    callback({ responseHeaders: headers });
  });

  registerIpcHandlers();
  createMainWindow();

  startLocalServer().catch(() => {
    // Phase 1.3: surface error in UI via IPC + toast
  });

  startPrinterPolling();
  startTelegramNotificationService();
  startOnlineWorkflowService();
  startPrintQueueService();

  // Native OS notifications on new requests / new uploaded files.
  // Uses system default notification sound (macOS, Windows, Linux).
  subscribeBus('requests:changed', (ev: AppEvent) => {
    if (ev.type !== 'requests:changed') return;

    // ── Push to renderer via IPC (instant, no WebSocket needed) ──
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('requests:changed', ev);
    }

    const isOfflineFileArrival = ev.reason === 'file-added';
    const isOnlineRequestArrival = ev.reason === 'created' && ev.payload?.source === 'online';

    if (!isOfflineFileArrival && !isOnlineRequestArrival) return;

    playSystemDing();
    if (!Notification.isSupported()) return;

    const title = isOnlineRequestArrival ? 'UOADrop — طلب أونلاين جديد' : 'UOADrop — ملف جديد';
    const body = isOnlineRequestArrival
      ? 'تم استلام طلب أونلاين جديد — افتح اللوحة للطباعة.'
      : 'تم استلام ملف جديد — افتح اللوحة للطباعة.';

    try {
      const n = new Notification({
        title,
        body,
        silent: true,
      });
      n.on('click', () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.focus();
        }
      });
      n.show();
    } catch { /* ignore */ }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
