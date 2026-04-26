import type { OnlineImportState, PrintQueueState, PrintRequest, RequestSourceOfTruth } from './types';

export function getRequestSourceOfTruth(request: Pick<PrintRequest, 'source' | 'deskReceivedAt' | 'sourceOfTruth'>): RequestSourceOfTruth {
  if (request.sourceOfTruth) return request.sourceOfTruth;
  if (request.source === 'online' && !request.deskReceivedAt) return 'supabase_intake';
  return 'desktop';
}

export function isDeskReceived(request: Pick<PrintRequest, 'source' | 'deskReceivedAt' | 'sourceOfTruth'>): boolean {
  return getRequestSourceOfTruth(request) === 'desktop';
}

export function hasFinalPrice(request: Pick<PrintRequest, 'priceIqd' | 'finalPriceConfirmedAt'>): boolean {
  return Number.isFinite(request.priceIqd) && request.priceIqd > 0 && Boolean(request.finalPriceConfirmedAt);
}

export function canMoveToReady(request: Pick<PrintRequest, 'status' | 'priceIqd' | 'finalPriceConfirmedAt'>): boolean {
  return request.status === 'printing' && hasFinalPrice(request);
}

export function canMarkDone(request: Pick<PrintRequest, 'status'>): boolean {
  return request.status === 'ready';
}

export function getOnlineImportState(
  request: Pick<PrintRequest, 'source' | 'importState' | 'deskReceivedAt' | 'onlineFilesCleanupAt'>,
): OnlineImportState | undefined {
  if (request.source !== 'online') return undefined;
  if (request.importState) return request.importState;
  if (request.onlineFilesCleanupAt) return 'cleanup_done';
  if (request.deskReceivedAt) return 'imported';
  return 'pending';
}

export function isPrintQueueBusy(
  request: Pick<PrintRequest, 'printQueueState'>,
): boolean {
  return request.printQueueState === 'queued' || request.printQueueState === 'spooling';
}

export function getPrintQueueState(
  request: Pick<PrintRequest, 'printQueueState'>,
): PrintQueueState {
  return request.printQueueState ?? 'idle';
}
