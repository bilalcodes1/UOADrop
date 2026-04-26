// Renderer-side type declaration for the preload-exposed API.
// Kept in-sync with src/preload/index.ts manually.

import type {
  OnlineImportState,
  PrintRequest,
  PrinterStatus,
  RequestEvent,
  RequestFile,
  RequestSourceOfTruth,
  RequestStatus,
} from '@uoadrop/shared';

declare global {
  interface Window {
    api: {
      unlock: (
        pin: string,
      ) => Promise<{ ok: boolean; locked: boolean; remaining: number; lockoutMinutes?: number }>;
      listRequests: () => Promise<{ items: PrintRequest[] }>;
      listRequestsPaged: (args: {
        statuses?: RequestStatus[];
        search?: string;
        limit?: number;
        offset?: number;
      }) => Promise<{ items: PrintRequest[]; total: number }>;
      setRequestStatus: (id: string, status: RequestStatus) => Promise<{ ok: true }>;
      setRequestPrice: (id: string, priceIqd: number) => Promise<{ ok: true }>;
      setRequestWorkflowMeta: (args: {
        id: string;
        sourceOfTruth?: RequestSourceOfTruth;
        importState?: OnlineImportState | null;
        deskReceivedAt?: string | null;
        printedAt?: string | null;
        pickedUpAt?: string | null;
        finalPriceConfirmedAt?: string | null;
        onlineFilesCleanupAt?: string | null;
      }) => Promise<{ ok: true }>;
      listRequestFiles: (requestId: string) => Promise<{ items: RequestFile[] }>;
      listRequestEvents: (requestId: string, limit?: number) => Promise<{ items: RequestEvent[] }>;
      setRequestFileOptions: (fileId: string, options: RequestFile['options']) => Promise<{ ok: true }>;
      queueRequestPrint: (id: string) => Promise<{ ok: boolean; error?: string; hint?: string }>;
      repairOnlineFiles: (id: string) => Promise<{ ok: boolean; request?: PrintRequest; error?: string; repairedFiles?: number }>;
      completeRequestPickup: (id: string, pin: string) => Promise<{ ok: boolean; request?: PrintRequest; error?: string; locked?: boolean; remaining?: number; lockoutMinutes?: number }>;
      deleteRequest: (id: string) => Promise<{ deletedFiles: number }>;
      addFileToRequest: (requestId: string, filePath: string) => Promise<RequestFile>;
      openFile: (filePath: string) => Promise<{ ok: boolean; error?: string }>;
      printFile: (
        filePath: string,
      ) => Promise<{ ok: boolean; error?: string | null; hint?: string }>;
      chooseFile: () => Promise<{ canceled: boolean; filePaths: string[] }>;
      printerStatus: () => Promise<{
        status: PrinterStatus;
        printerName: string | null;
        count?: number;
      }>;
      printerEvents: (limit?: number) => Promise<{
        items: Array<{
          id: number;
          event: string;
          status: string;
          printerName: string | null;
          details: Record<string, unknown> | null;
          createdAt: string;
        }>;
      }>;
      onPrinterStatusUpdate: (
        cb: (payload: { status: PrinterStatus; printerName: string | null; count?: number }) => void,
      ) => () => void;
      onRequestsChanged: (
        cb: (ev: { reason: string; requestId?: string; payload?: PrintRequest; file?: RequestFile }) => void,
      ) => () => void;
    };
  }
}

export {};
