// Renderer-side type declaration for the preload-exposed API.
// Kept in-sync with src/preload/index.ts manually.

import type { PrinterStatus } from '@uoadrop/shared';

declare global {
  interface Window {
    api: {
      openFile: (filePath: string) => Promise<{ ok: boolean; error?: string }>;
      printFile: (
        filePath: string,
      ) => Promise<{ ok: boolean; error?: string | null; hint?: string }>;
      chooseFile: () => Promise<{ canceled: boolean; filePaths: string[] }>;
      printerStatus: () => Promise<PrinterStatus>;
    };
  }
}

export {};
