// Renderer-side type declaration for the preload-exposed API.
// Kept in-sync with src/preload/index.ts manually.

import type {
  PrintRequest,
  PrinterStatus,
  RequestFile,
  RequestStatus,
} from '@uoadrop/shared';

declare global {
  interface Window {
    api: {
      unlock: (
        pin: string,
      ) => Promise<{ ok: boolean; locked: boolean; remaining: number; lockoutMinutes?: number }>;
      seed: () => Promise<{ seeded: boolean; count: number }>;
      listRequests: () => Promise<{ items: PrintRequest[] }>;
      setRequestStatus: (id: string, status: RequestStatus) => Promise<{ ok: true }>;
      listRequestFiles: (requestId: string) => Promise<{ items: RequestFile[] }>;
      deleteRequest: (id: string) => Promise<{ deletedFiles: number }>;
      addFileToRequest: (requestId: string, filePath: string) => Promise<RequestFile>;
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
