import { contextBridge, ipcRenderer } from 'electron';
import type { PrinterStatus, PrintRequest, RequestFile, RequestStatus } from '@uoadrop/shared';

export const api = {
  unlock: (
    pin: string,
  ): Promise<{ ok: boolean; locked: boolean; remaining: number; lockoutMinutes?: number }> =>
    ipcRenderer.invoke('security:unlock', pin),

  seed: (): Promise<{ seeded: boolean; count: number }> =>
    ipcRenderer.invoke('requests:seed'),

  listRequests: (): Promise<{ items: PrintRequest[] }> =>
    ipcRenderer.invoke('requests:list'),

  setRequestStatus: (id: string, status: RequestStatus): Promise<{ ok: true }> =>
    ipcRenderer.invoke('requests:setStatus', id, status),

  listRequestFiles: (requestId: string): Promise<{ items: RequestFile[] }> =>
    ipcRenderer.invoke('requests:files', requestId),

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

  printerStatus: (): Promise<PrinterStatus> =>
    ipcRenderer.invoke('printer:status'),
};

contextBridge.exposeInMainWorld('api', api);

export type Api = typeof api;
