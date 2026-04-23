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
      seed: () => Promise<{ seeded: boolean; count: number }>;
      listRequests: () => Promise<{ items: PrintRequest[] }>;
      setRequestStatus: (id: string, status: RequestStatus) => Promise<{ ok: true }>;
      listRequestFiles: (requestId: string) => Promise<{ items: RequestFile[] }>;
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
