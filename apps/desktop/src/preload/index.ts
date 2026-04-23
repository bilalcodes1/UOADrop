import { contextBridge, ipcRenderer } from 'electron';
import type { PrinterStatus } from '@uoadrop/shared';

export const api = {
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
