import { contextBridge, ipcRenderer } from 'electron';
import type {
  OnlineImportState,
  PaymentStatus,
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

export interface OnlineAnnouncementResult {
  ok: boolean;
  error?: string;
  details?: string;
  counts?: {
    emails: number;
    telegram: number;
    totalChannels: number;
  };
  sent?: {
    emails: number;
    telegram: number;
  };
  failed?: {
    emails: number;
    telegram: number;
  };
  skipped?: {
    emails: boolean;
    telegram: boolean;
  };
}

export interface DashboardStats {
  total: number;
  online: number;
  local: number;
  ready: number;
  paymentPending: number;
  unpriced: number;
  repairNeeded: number;
}

export interface OnlineModeStatus {
  enabled: boolean;
  reason: 'enabled' | 'activation_required' | 'missing_gateway_url';
  activated: boolean;
  deviceId: string;
  libraryId?: string;
  librarySlug?: string;
  libraryName?: string;
  webBaseUrl: string;
  hasGatewayUrl: boolean;
  hasDesktopToken: boolean;
}

export interface OnlineModeActivationResult {
  ok: boolean;
  error?: 'invalid_activation_password' | 'activation_write_failed' | 'activation_network_error' | 'missing_gateway_url' | 'server_error';
  status: OnlineModeStatus;
}

export interface OnlineGatewayDiagnostics {
  ok: boolean;
  serverReachable: boolean;
  error?: string;
  pendingOnlineRequests?: number;
  status: OnlineModeStatus;
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
    source?: 'local' | 'online';
    payment?: 'pending' | 'verified' | 'rejected' | 'unpaid' | 'unpriced';
    limit?: number;
    offset?: number;
  }): Promise<{ items: PrintRequest[]; total: number }> =>
    ipcRenderer.invoke('requests:listPaged', args),

  getDashboardStats: (): Promise<DashboardStats> =>
    ipcRenderer.invoke('dashboard:stats'),

  getOnlineModeStatus: (): Promise<OnlineModeStatus> =>
    ipcRenderer.invoke('online:getStatus'),

  getOnlineDiagnostics: (): Promise<OnlineGatewayDiagnostics> =>
    ipcRenderer.invoke('online:diagnostics'),

  activateOnlineMode: (passphrase: string): Promise<OnlineModeActivationResult> =>
    ipcRenderer.invoke('online:activate', passphrase),

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

  markRequestDone: (id: string): Promise<{ ok: boolean; request?: PrintRequest; error?: string }> =>
    ipcRenderer.invoke('requests:markDone', id),

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

  changePin: (
    currentPin: string,
    newPin: string,
  ): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('settings:changePin', currentPin, newPin),

  getPaymentAccounts: (): Promise<{ qiCard: string; zainCash: string }> =>
    ipcRenderer.invoke('settings:getPaymentAccounts'),

  setPaymentAccounts: (
    accounts: { qiCard?: string; zainCash?: string },
  ): Promise<{ ok: boolean; synced?: boolean; error?: string }> =>
    ipcRenderer.invoke('settings:setPaymentAccounts', accounts),

  setPaymentStatus: (
    id: string,
    status: PaymentStatus,
  ): Promise<{ ok: boolean; request?: PrintRequest; error?: string }> =>
    ipcRenderer.invoke('requests:setPaymentStatus', id, status),

  getOnlineAnnouncementPreview: (): Promise<OnlineAnnouncementResult> =>
    ipcRenderer.invoke('announcements:onlinePreview'),

  sendOnlineAnnouncement: (args: {
    title?: string;
    message?: string;
    channels?: { email?: boolean; telegram?: boolean };
  }): Promise<OnlineAnnouncementResult> =>
    ipcRenderer.invoke('announcements:sendOnline', args),
};

contextBridge.exposeInMainWorld('api', api);

export type Api = typeof api;
