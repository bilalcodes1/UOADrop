import { contextBridge, ipcRenderer } from 'electron';
import type { PrinterStatus, PrintRequest, RequestFile, RequestStatus } from '@uoadrop/shared';

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

  listRequestFiles: (requestId: string): Promise<{ items: RequestFile[] }> =>
    ipcRenderer.invoke('requests:files', requestId),

  setRequestFileOptions: (fileId: string, options: RequestFile['options']): Promise<{ ok: true }> =>
    ipcRenderer.invoke('requests:setFileOptions', fileId, options),

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
