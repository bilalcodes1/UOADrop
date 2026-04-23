import { ipcMain, BrowserWindow, shell, dialog } from 'electron';
import { extname } from 'node:path';
import type { PrinterStatus } from '@uoadrop/shared';

const CHROMIUM_NATIVE_EXT = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.bmp'];
const NO_PRINTERS_ERROR = 'NO_PRINTERS_CONFIGURED';

export function registerIpcHandlers(): void {
  // ─────────────────────────────────────────
  // file:open — open file with OS default app
  // ─────────────────────────────────────────
  ipcMain.handle('file:open', async (_e, filePath: string) => {
    const err = await shell.openPath(filePath);
    if (err) return { ok: false, error: err };
    return { ok: true };
  });

  // ─────────────────────────────────────────
  // file:print — native print dialog
  //   PDF/image → chromium in-app dialog
  //   DOCX/PPTX → OS opens, user presses Ctrl/Cmd+P
  // ─────────────────────────────────────────
  ipcMain.handle('file:print', async (_e, filePath: string) => {
    const ext = extname(filePath).toLowerCase();

    if (CHROMIUM_NATIVE_EXT.includes(ext)) {
      const win = new BrowserWindow({ show: false, width: 1, height: 1 });
      try {
        await win.loadFile(filePath);
        const printers = await win.webContents.getPrintersAsync();
        if (!printers || printers.length === 0) {
          win.close();
          return {
            ok: false,
            error: NO_PRINTERS_ERROR,
            hint: 'لا توجد طابعات مُضافة للنظام. أضف طابعة من إعدادات النظام ثم أعد المحاولة.',
          };
        }
        await new Promise<void>((r) => setTimeout(r, 350));
        return await new Promise((resolve) => {
          win.webContents.print({ silent: false }, (success, errorType) => {
            win.close();
            resolve({ ok: success, error: success ? null : errorType });
          });
        });
      } catch (err) {
        win.close();
        return { ok: false, error: String(err) };
      }
    }

    // Non-native formats: open in default app, user prints manually
    const openErr = await shell.openPath(filePath);
    if (openErr) return { ok: false, error: openErr };
    return {
      ok: true,
      hint: 'اضغط Ctrl+P (Windows) أو Cmd+P (Mac) داخل التطبيق الذي فُتح',
    };
  });

  // ─────────────────────────────────────────
  // printer:status — placeholder (Phase 1.3: wire up real query)
  // ─────────────────────────────────────────
  ipcMain.handle('printer:status', async (): Promise<PrinterStatus> => {
    // TODO: use node-printer or platform-specific query (wmic/lpstat)
    return 'unknown';
  });

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
