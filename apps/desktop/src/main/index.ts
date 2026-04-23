import { app, BrowserWindow, Notification, shell } from 'electron';
import { join } from 'node:path';
import { registerIpcHandlers } from './ipc';
import { startLocalServer } from './server';
import { startPrinterPolling } from './printer';
import { subscribe as subscribeBus, type AppEvent } from './events';

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
  registerIpcHandlers();
  createMainWindow();

  startLocalServer().catch(() => {
    // Phase 1.3: surface error in UI via IPC + toast
  });

  startPrinterPolling();

  // Native OS notifications on new requests / new uploaded files.
  // Uses system default notification sound (macOS, Windows, Linux).
  subscribeBus('requests:changed', (ev: AppEvent) => {
    if (ev.type !== 'requests:changed') return;
    if (!Notification.isSupported()) return;
    let title: string | null = null;
    let body = '';
    if (ev.reason === 'created') {
      title = 'UOADrop — طلب جديد';
      body = 'تم استلام طلب طباعة جديد. افتح اللوحة لعرض التفاصيل.';
    } else if (ev.reason === 'file-added') {
      title = 'UOADrop — ملف جديد';
      body = 'تم رفع ملف إضافي لطلب موجود.';
    }
    if (!title) return;
    try {
      const n = new Notification({
        title,
        body,
        silent: false, // play system default sound
      });
      n.on('click', () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.focus();
        }
      });
      n.show();
    } catch {
      /* ignore notification errors */
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
