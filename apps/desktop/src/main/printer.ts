import { BrowserWindow } from 'electron';
import type { PrinterStatus } from '@uoadrop/shared';
import { logPrinterEvent } from './db';

// Electron's PrinterInfo.status differs per OS; fallback to coarse mapping.
interface PollState {
  lastStatus: PrinterStatus;
  lastPrinterName: string | null;
}

const state: PollState = {
  lastStatus: 'unknown',
  lastPrinterName: null,
};

let interval: NodeJS.Timeout | null = null;

async function queryPrintersOnce(): Promise<{
  status: PrinterStatus;
  printerName: string | null;
  count: number;
}> {
  const win = BrowserWindow.getAllWindows()[0];
  if (!win) return { status: 'unknown', printerName: null, count: 0 };
  try {
    const printers = await win.webContents.getPrintersAsync();
    if (!printers || printers.length === 0) {
      return { status: 'offline', printerName: null, count: 0 };
    }
    // Pick the default if present, else first one.
    const def = printers.find((p) => p.isDefault) ?? printers[0]!;
    // PrinterInfo.status is a number on Win/Linux and 0 on macOS; non-zero usually means a problem.
    const raw = (def as any).status as number | undefined;
    // CUPS printer-state: 3=idle(ready), 4=processing, 5=stopped.
    // Windows/Linux expose different bitflags; treat 0/undefined as ready.
    let mapped: PrinterStatus = 'ready';
    if (typeof raw === 'number') {
      if (raw === 4) mapped = 'printing';
      else if (raw === 5) mapped = 'error';
      // 3 / 0 / undefined → ready
    }
    return {
      status: mapped,
      printerName: def.displayName ?? def.name ?? null,
      count: printers.length,
    };
  } catch {
    return { status: 'unknown', printerName: null, count: 0 };
  }
}

export function getCachedPrinterStatus(): {
  status: PrinterStatus;
  printerName: string | null;
} {
  return { status: state.lastStatus, printerName: state.lastPrinterName };
}

export function startPrinterPolling(intervalMs = 15_000): void {
  if (interval) return;
  const tick = async (): Promise<void> => {
    const res = await queryPrintersOnce();
    const changed =
      res.status !== state.lastStatus || res.printerName !== state.lastPrinterName;
    state.lastStatus = res.status;
    state.lastPrinterName = res.printerName;

    if (changed) {
      logPrinterEvent({
        event: 'status-change',
        status: res.status,
        printerName: res.printerName,
        details: { count: res.count },
      });
      const win = BrowserWindow.getAllWindows()[0];
      win?.webContents.send('printer:status-update', {
        status: res.status,
        printerName: res.printerName,
        count: res.count,
      });
    }
  };
  // Run once shortly after startup, then on interval
  setTimeout(() => void tick(), 3_000);
  interval = setInterval(() => void tick(), intervalMs);
  interval.unref?.();
}

export function stopPrinterPolling(): void {
  if (interval) clearInterval(interval);
  interval = null;
}
