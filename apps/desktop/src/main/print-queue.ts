import { BrowserWindow, shell } from 'electron';
import { existsSync } from 'node:fs';
import type { PrintRequest, RequestFile } from '@uoadrop/shared';
import {
  getRequestById,
  listRequestFiles,
  listRequestsNeedingQueueRecovery,
  listRequestsWithMissingLocalFiles,
  logRequestEvent,
  setRequestPrintQueueState,
  setRequestStatus,
} from './db';
import { emit as emitAppEvent } from './events';
import { syncOnlineRequestMirrorFromLocal } from './online-workflow';

type QueueRequestResult = {
  ok: boolean;
  error?: string;
  hint?: string;
};

type PendingJob = {
  requestId: string;
  queuedAt: string;
};

const queue: PendingJob[] = [];
let processing = false;
let started = false;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function probePrinterAvailability(): Promise<{ ok: boolean; error?: string; hint?: string }> {
  try {
    const anyWin = BrowserWindow.getAllWindows()[0];
    if (!anyWin) {
      return { ok: false, error: 'NO_WINDOW', hint: 'نافذة التطبيق غير جاهزة بعد.' };
    }
    const printers = await anyWin.webContents.getPrintersAsync();
    if (!printers || printers.length === 0) {
      return {
        ok: false,
        error: 'NO_PRINTERS_CONFIGURED',
        hint: 'لا توجد طابعات مُضافة للنظام. أضف طابعة من إعدادات النظام ثم أعد المحاولة.',
      };
    }
    return { ok: true };
  } catch {
    return { ok: true };
  }
}

function emitRequestChange(reason: string, requestId: string): void {
  const payload = getRequestById(requestId) ?? undefined;
  emitAppEvent({ type: 'requests:changed', reason, requestId, payload });
}

function getPrintableFiles(requestId: string): RequestFile[] {
  return listRequestFiles(requestId).filter((file) => file.localPath && existsSync(file.localPath));
}

async function processNextJob(): Promise<void> {
  if (processing) return;
  const next = queue.shift();
  if (!next) return;
  processing = true;

  try {
    const request = getRequestById(next.requestId);
    if (!request) {
      processing = false;
      void processNextJob();
      return;
    }

    const files = getPrintableFiles(next.requestId);
    if (files.length === 0) {
      setRequestPrintQueueState({
        id: next.requestId,
        state: 'failed',
        error: 'missing_local_files',
      });
      logRequestEvent({
        requestId: next.requestId,
        type: 'print_failed',
        actor: 'system',
        status: request.status,
        details: { queueError: 'missing_local_files' },
      });
      emitRequestChange('print-queue-failed', next.requestId);
      return;
    }

    const printerProbe = await probePrinterAvailability();
    if (!printerProbe.ok) {
      setRequestPrintQueueState({
        id: next.requestId,
        state: 'failed',
        error: printerProbe.error ?? 'NO_PRINTERS_CONFIGURED',
      });
      logRequestEvent({
        requestId: next.requestId,
        type: 'print_failed',
        actor: 'system',
        status: request.status,
        details: { queueError: printerProbe.error ?? 'NO_PRINTERS_CONFIGURED' },
      });
      emitRequestChange('print-queue-failed', next.requestId);
      return;
    }

    setRequestPrintQueueState({ id: next.requestId, state: 'spooling', error: null });
    logRequestEvent({
      requestId: next.requestId,
      type: 'print_spooling',
      actor: 'system',
      status: request.status,
    });
    emitRequestChange('print-queue-spooling', next.requestId);

    let lastOpenError: string | undefined;
    for (const file of files) {
      const openErr = await shell.openPath(file.localPath!);
      if (openErr) {
        lastOpenError = openErr;
        break;
      }
      await sleep(250);
    }

    if (lastOpenError) {
      setRequestPrintQueueState({ id: next.requestId, state: 'failed', error: lastOpenError });
      logRequestEvent({
        requestId: next.requestId,
        type: 'print_failed',
        actor: 'system',
        status: request.status,
        details: { queueError: lastOpenError },
      });
      emitRequestChange('print-queue-failed', next.requestId);
      return;
    }

    if (request.status !== 'printing') {
      setRequestStatus(next.requestId, 'printing');
    } else {
      setRequestPrintQueueState({ id: next.requestId, state: 'idle', error: null });
    }
    if (request.source === 'online') {
      await syncOnlineRequestMirrorFromLocal(next.requestId, {
        status: 'printing',
        source_of_truth: 'desktop',
      });
    }
    emitRequestChange('print-queue-complete', next.requestId);
  } finally {
    processing = false;
    if (queue.length > 0) {
      void processNextJob();
    }
  }
}

export async function enqueueRequestPrint(requestId: string): Promise<QueueRequestResult> {
  const request = getRequestById(requestId);
  if (!request) return { ok: false, error: 'not_found' };
  if (request.status === 'done' || request.status === 'canceled' || request.status === 'blocked') {
    return { ok: false, error: 'invalid_status' };
  }
  if (request.printQueueState === 'queued' || request.printQueueState === 'spooling' || queue.some((job) => job.requestId === requestId)) {
    return { ok: false, error: 'already_queued', hint: 'الطلب موجود بالفعل في طابور الطباعة.' };
  }

  const files = getPrintableFiles(requestId);
  if (files.length === 0) {
    setRequestPrintQueueState({ id: requestId, state: 'failed', error: 'missing_local_files' });
    emitRequestChange('print-queue-failed', requestId);
    return { ok: false, error: 'missing_local_files' };
  }

  setRequestPrintQueueState({ id: requestId, state: 'queued', error: null });
  logRequestEvent({
    requestId,
    type: 'print_queued',
    actor: 'librarian',
    status: request.status,
  });
  queue.push({ requestId, queuedAt: new Date().toISOString() });
  emitRequestChange('print-queued', requestId);
  void processNextJob();
  return { ok: true, hint: queue.length > 0 ? 'تمت إضافة الطلب إلى طابور الطباعة.' : 'جارٍ تجهيز الطلب للطباعة.' };
}

async function reconcileInterruptedQueue(): Promise<void> {
  const interrupted = listRequestsNeedingQueueRecovery();
  for (const request of interrupted) {
    setRequestPrintQueueState({
      id: request.id,
      state: 'failed',
      error: 'restart_interrupted',
    });
    logRequestEvent({
      requestId: request.id,
      type: 'print_recovered',
      actor: 'system',
      status: request.status,
      details: { queueError: 'restart_interrupted' },
    });
    emitRequestChange('print-queue-recovered', request.id);
  }
}

async function reconcileMissingLocalFiles(): Promise<void> {
  const requests = listRequestsWithMissingLocalFiles().filter((request) => request.status === 'pending' || request.status === 'printing');
  for (const request of requests) {
    setRequestPrintQueueState({
      id: request.id,
      state: 'failed',
      error: 'missing_local_files',
    });
    logRequestEvent({
      requestId: request.id,
      type: 'print_failed',
      actor: 'system',
      status: request.status,
      details: { queueError: 'missing_local_files', missingFiles: request.missingFiles },
    });
    emitRequestChange('local-files-missing', request.id);
  }
}

export function startPrintQueueService(): void {
  if (started) return;
  started = true;
  void reconcileInterruptedQueue();
  void reconcileMissingLocalFiles();
}
