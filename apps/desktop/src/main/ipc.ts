import { ipcMain, BrowserWindow, shell, dialog } from 'electron';
import { basename } from 'node:path';
import { stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import type { PrinterStatus } from '@uoadrop/shared';
import { PIN_LOCKOUT_MINUTES, PIN_MAX_ATTEMPTS } from '@uoadrop/shared';
import {
  addRequestFile,
  deleteRequest,
  ensureLibrarianPin,
  listPrinterEvents,
  listRequestFiles,
  listRequests,
  listRequestsPaged,
  recentFailedPinAttempts,
  recordPinAttempt,
  seedIfEmpty,
  setRequestStatus,
  verifyLibrarianPin,
} from './db';
import { getCachedPrinterStatus } from './printer';
import { emit as emitAppEvent } from './events';

const NO_PRINTERS_ERROR = 'NO_PRINTERS_CONFIGURED';

export function registerIpcHandlers(): void {
  // Ensure DB has initial rows (dev)
  seedIfEmpty();

  // Ensure librarian PIN exists; log generated PIN for dev only
  const { generatedPin } = ensureLibrarianPin();
  if (generatedPin) {
    // eslint-disable-next-line no-console
    console.log(`[UOADrop] Generated librarian PIN (dev): ${generatedPin}`);
  }

  ipcMain.handle('security:unlock', async (_e, pin: string) => {
    const scope = 'librarian';
    const windowMs = PIN_LOCKOUT_MINUTES * 60 * 1000;
    const failures = recentFailedPinAttempts(scope, windowMs);
    if (failures >= PIN_MAX_ATTEMPTS) {
      return {
        ok: false,
        locked: true,
        remaining: 0,
        lockoutMinutes: PIN_LOCKOUT_MINUTES,
      };
    }
    const res = verifyLibrarianPin(String(pin ?? ''));
    recordPinAttempt(scope, res.ok);
    const remaining = Math.max(0, PIN_MAX_ATTEMPTS - (res.ok ? 0 : failures + 1));
    return { ok: res.ok, locked: false, remaining };
  });

  ipcMain.handle('requests:seed', async () => seedIfEmpty());
  ipcMain.handle('requests:list', async () => ({ items: listRequests() }));
  ipcMain.handle(
    'requests:listPaged',
    async (
      _e,
      args: {
        statuses?: string[];
        search?: string;
        limit?: number;
        offset?: number;
      },
    ) =>
      listRequestsPaged({
        statuses: args?.statuses as any,
        search: args?.search,
        limit: args?.limit,
        offset: args?.offset,
      }),
  );
  ipcMain.handle('requests:setStatus', async (_e, id: string, status: string) => {
    const res = setRequestStatus(id, status as any);
    emitAppEvent({ type: 'requests:changed', reason: 'status', requestId: id });
    return res;
  });
  ipcMain.handle('requests:files', async (_e, requestId: string) => ({
    items: listRequestFiles(requestId),
  }));

  ipcMain.handle('requests:delete', async (_e, id: string) => {
    const res = deleteRequest(id);
    emitAppEvent({ type: 'requests:changed', reason: 'deleted', requestId: id });
    return res;
  });

  ipcMain.handle('requests:addFile', async (_e, requestId: string, filePath: string) => {
    const st = await stat(filePath);
    const buf = await (await import('node:fs/promises')).readFile(filePath);
    const sha256 = createHash('sha256').update(buf).digest('hex');
    const mimeType = 'application/octet-stream';
    const res = addRequestFile({
      requestId,
      localPath: filePath,
      filename: basename(filePath),
      mimeType,
      sizeBytes: st.size,
      sha256,
      magicByteVerified: false,
    });
    emitAppEvent({ type: 'requests:changed', reason: 'file-added', requestId });
    return res;
  });

  // ─────────────────────────────────────────
  // file:open — open file with OS default app
  // ─────────────────────────────────────────
  ipcMain.handle('file:open', async (_e, filePath: string) => {
    const err = await shell.openPath(filePath);
    if (err) return { ok: false, error: err };
    return { ok: true };
  });

  // ─────────────────────────────────────────
  // file:print — open in OS default app; user prints via Ctrl/Cmd+P.
  //
  // Why not webContents.print?
  //   On macOS, NSPrintPanel invoked from a hidden 1x1 BrowserWindow often
  //   fails to deliver the cancel callback, hanging the renderer indefinitely.
  //   shell.openPath is deterministic, instant, and gives users the full
  //   native print dialog + content preview (Preview.app, Image Viewer, Word…).
  // ─────────────────────────────────────────
  ipcMain.handle('file:print', async (_e, filePath: string) => {
    try {
      const anyWin = BrowserWindow.getAllWindows()[0];
      if (anyWin) {
        const printers = await anyWin.webContents.getPrintersAsync();
        if (!printers || printers.length === 0) {
          return {
            ok: false,
            error: NO_PRINTERS_ERROR,
            hint: 'لا توجد طابعات مُضافة للنظام. أضف طابعة من إعدادات النظام ثم أعد المحاولة.',
          };
        }
      }
    } catch {
      /* best-effort printer probe */
    }

    const openErr = await shell.openPath(filePath);
    if (openErr) return { ok: false, error: openErr };
    return {
      ok: true,
      hint:
        process.platform === 'darwin'
          ? 'افتح الملف واضغط Cmd+P للطباعة'
          : 'افتح الملف واضغط Ctrl+P للطباعة',
    };
  });

  // ─────────────────────────────────────────
  // printer:status — cached from poller (Phase 1.9)
  // ─────────────────────────────────────────
  ipcMain.handle(
    'printer:status',
    async (): Promise<{ status: PrinterStatus; printerName: string | null }> =>
      getCachedPrinterStatus(),
  );

  ipcMain.handle('printer:events', async (_e, limit?: number) => ({
    items: listPrinterEvents(typeof limit === 'number' ? limit : 50),
  }));

  // ─────────────────────────────────────────
  // file:choose — open file picker (for testing)
  // ─────────────────────────────────────────
  ipcMain.handle('file:choose', async () => {
    const res = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Documents', extensions: ['pdf', 'docx', 'pptx', 'xlsx'] },
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png'] },
      ],
    });
    return { canceled: res.canceled, filePaths: res.filePaths };
  });
}
