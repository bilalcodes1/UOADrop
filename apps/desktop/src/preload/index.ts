import { contextBridge, ipcRenderer } from 'electron';
import type {
  OnlineImportState,
  PrinterStatus,
  PrintRequest,
  RequestEvent,
  RequestFile,
  RequestSourceOfTruth,
  RequestStatus,
} from '@uoadrop/shared';

export interface PrinterStatusPayload {
  status: PrinterStatus;
  printerName: string | null;
  count?: number;
}

export interface PrinterEvent {
  id: number;
  event: string;
  status: string;
  printerName: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export const api = {
  unlock: (
    pin: string,
  ): Promise<{ ok: boolean; locked: boolean; remaining: number; lockoutMinutes?: number }> =>
    ipcRenderer.invoke('security:unlock', pin),

  listRequests: (): Promise<{ items: PrintRequest[] }> =>
    ipcRenderer.invoke('requests:list'),

  listRequestsPaged: (args: {
    statuses?: RequestStatus[];
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: PrintRequest[]; total: number }> =>
    ipcRenderer.invoke('requests:listPaged', args),

  setRequestStatus: (id: string, status: RequestStatus): Promise<{ ok: true }> =>
    ipcRenderer.invoke('requests:setStatus', id, status),

  setRequestPrice: (id: string, priceIqd: number): Promise<{ ok: true }> =>
    ipcRenderer.invoke('requests:setPrice', id, priceIqd),

  setRequestWorkflowMeta: (args: {
    id: string;
    sourceOfTruth?: RequestSourceOfTruth;
    importState?: OnlineImportState | null;
    deskReceivedAt?: string | null;
    printedAt?: string | null;
    pickedUpAt?: string | null;
    finalPriceConfirmedAt?: string | null;
    onlineFilesCleanupAt?: string | null;
  }): Promise<{ ok: true }> =>
    ipcRenderer.invoke('requests:setWorkflowMeta', args),

  listRequestFiles: (requestId: string): Promise<{ items: RequestFile[] }> =>
    ipcRenderer.invoke('requests:files', requestId),

  listRequestEvents: (requestId: string, limit?: number): Promise<{ items: RequestEvent[] }> =>
    ipcRenderer.invoke('requests:events', requestId, limit),

  setRequestFileOptions: (fileId: string, options: RequestFile['options']): Promise<{ ok: true }> =>
    ipcRenderer.invoke('requests:setFileOptions', fileId, options),

  queueRequestPrint: (id: string): Promise<{ ok: boolean; error?: string; hint?: string }> =>
    ipcRenderer.invoke('requests:queuePrint', id),

  repairOnlineFiles: (id: string): Promise<{ ok: boolean; request?: PrintRequest; error?: string; repairedFiles?: number }> =>
    ipcRenderer.invoke('requests:repairOnlineFiles', id),

  completeRequestPickup: (id: string, pin: string): Promise<{ ok: boolean; request?: PrintRequest; error?: string; locked?: boolean; remaining?: number; lockoutMinutes?: number }> =>
    ipcRenderer.invoke('requests:completePickup', id, pin),

  deleteRequest: (id: string): Promise<{ deletedFiles: number }> =>
    ipcRenderer.invoke('requests:delete', id),

  addFileToRequest: (requestId: string, filePath: string): Promise<RequestFile> =>
    ipcRenderer.invoke('requests:addFile', requestId, filePath),

  openFile: (filePath: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('file:open', filePath),

  printFile: (
    filePath: string,
  ): Promise<{ ok: boolean; error?: string | null; hint?: string }> =>
    ipcRenderer.invoke('file:print', filePath),

  chooseFile: (): Promise<{ canceled: boolean; filePaths: string[] }> =>
    ipcRenderer.invoke('file:choose'),

  printerStatus: (): Promise<PrinterStatusPayload> =>
    ipcRenderer.invoke('printer:status'),

  printerEvents: (limit?: number): Promise<{ items: PrinterEvent[] }> =>
    ipcRenderer.invoke('printer:events', limit),

  onPrinterStatusUpdate: (cb: (payload: PrinterStatusPayload) => void): (() => void) => {
    const handler = (_e: unknown, payload: PrinterStatusPayload): void => cb(payload);
    ipcRenderer.on('printer:status-update', handler);
    return () => ipcRenderer.removeListener('printer:status-update', handler);
  },

  onRequestsChanged: (
    cb: (ev: { reason: string; requestId?: string; payload?: PrintRequest; file?: RequestFile }) => void,
  ): (() => void) => {
    const handler = (_e: unknown, ev: unknown): void => cb(ev as any);
    ipcRenderer.on('requests:changed', handler);
    return () => ipcRenderer.removeListener('requests:changed', handler);
  },
};

contextBridge.exposeInMainWorld('api', api);

export type Api = typeof api;
