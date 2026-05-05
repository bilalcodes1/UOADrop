import { app } from 'electron';
import { createDecipheriv, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import type { PaymentMethod, PaymentStatus, PrintRequest } from '@uoadrop/shared';
import { getDesktopGatewayConfig, getOnlineModeStatus } from './runtime-config';
import {
  getRequestById,
  importOnlineRequest,
  logRequestEvent,
  syncRequestPaymentSubmission,
  setRequestWorkflowMeta,
} from './db';
import { countFilePages } from './page-counter';
import { emit as emitAppEvent } from './events';
import { notifyEmailReceived } from './email-notify';
import { notifyTelegramRequestReceived } from './telegram';

type GatewayRequestRow = {
  id: string;
  library_id?: string | null;
  ticket: string;
  student_name: string | null;
  student_email: string | null;
  telegram_chat_id: string | null;
  notes: string | null;
  status: string;
  price_iqd: number;
  total_pages: number;
  source: 'local' | 'online';
  desk_received_at: string | null;
  source_of_truth: 'supabase_intake' | 'desktop' | null;
  import_state: 'pending' | 'download_started' | 'downloaded' | 'imported' | 'cleanup_pending' | 'cleanup_done' | null;
  created_at: string;
  updated_at: string;
  printed_at: string | null;
  picked_up_at: string | null;
  final_price_confirmed_at: string | null;
  online_files_cleanup_at: string | null;
  payment_method: string | null;
  payment_transaction_ref: string | null;
  payment_status: string | null;
  payment_submitted_at: string | null;
  payment_verified_at: string | null;
};

type GatewayFileRow = {
  id: string;
  library_id?: string | null;
  request_id: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number;
  storage_path: string;
  copies: number;
  color: boolean;
  double_sided: boolean;
  pages_per_sheet: number;
  page_range: string | null;
  encryption_algorithm: string | null;
  encryption_key_id: string | null;
  encryption_iv: string | null;
  encrypted_key: string | null;
  encrypted_size_bytes: number | null;
  signed_url?: string | null;
  decryption_key_base64?: string | null;
};

type GatewayMirrorPatch = Partial<Pick<
  GatewayRequestRow,
  | 'status'
  | 'price_iqd'
  | 'total_pages'
  | 'desk_received_at'
  | 'printed_at'
  | 'picked_up_at'
  | 'source_of_truth'
  | 'import_state'
  | 'final_price_confirmed_at'
  | 'online_files_cleanup_at'
  | 'payment_status'
  | 'payment_verified_at'
>>;

type ImportedLocalFile = {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  localPath: string;
  sha256: string;
  magicByteVerified: boolean;
  pages?: number;
  options: {
    copies: number;
    color: boolean;
    doubleSided: boolean;
    pagesPerSheet?: 1 | 2 | 4;
    pageRange?: string;
  };
};

const INTAKE_POLL_MS = 5_000;
const CLEANUP_POLL_MS = 15 * 60 * 1000;
const FILE_LIST_RETRIES = 8;
const FILE_LIST_DELAY_MS = 1_200;
const DOWNLOAD_RETRIES = 8;
const DOWNLOAD_DELAY_MS = 1_000;
const ONLINE_FILE_ENCRYPTION_ALGORITHM = 'AES-256-GCM+RSA-OAEP-SHA256';
const AES_GCM_AUTH_TAG_BYTES = 16;

let started = false;
let intakeBusy = false;
let cleanupBusy = false;
const processingIds = new Set<string>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function gatewayRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T | null> {
  const onlineStatus = getOnlineModeStatus();
  if (!onlineStatus.enabled) return null;
  const config = getDesktopGatewayConfig();
  if (!config) return null;
  const res = await fetch(`${config.baseUrl}/api/desktop${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.token}`,
      ...(init?.headers ?? {}),
    },
  });
  const payload = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; details?: string } & T;
  if (!res.ok || payload.ok === false) {
    throw new Error(payload.details || payload.error || `desktop_gateway_${res.status}`);
  }
  return payload;
}

export async function syncPaymentAccountsToGateway(accounts: {
  qiCard: string;
  zainCash: string;
}): Promise<{ ok: boolean; error?: string }> {
  const onlineStatus = getOnlineModeStatus();
  if (!onlineStatus.enabled) return { ok: false, error: onlineStatus.reason };
  try {
    const res = await gatewayRequest<{ ok: boolean; error?: string }>('/payment-settings', {
      method: 'POST',
      body: JSON.stringify(accounts),
    });
    return res?.ok ? { ok: true } : { ok: false, error: res?.error ?? 'missing_gateway_config' };
  } catch (err) {
    return { ok: false, error: String((err as Error)?.message ?? err).slice(0, 200) };
  }
}

function safeSegment(value: string): string {
  return String(value)
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 120) || 'item';
}

function safeFilename(filename: string): string {
  return basename(filename)
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(-180) || 'file';
}

export function getPersistentOnlineFilePath(args: {
  requestId: string;
  fileId: string;
  filename: string;
}): string {
  return join(
    app.getPath('userData'),
    'online-requests',
    safeSegment(args.requestId),
    `${safeSegment(args.fileId)}-${safeFilename(args.filename)}`,
  );
}

export async function downloadOnlineFileToRequestStore(args: {
  url: string;
  requestId: string;
  fileId: string;
  filename: string;
}): Promise<string> {
  const onlineStatus = getOnlineModeStatus();
  if (!onlineStatus.enabled) throw new Error(onlineStatus.reason);
  const dest = getPersistentOnlineFilePath(args);
  await mkdir(dirname(dest), { recursive: true });
  const res = await fetch(args.url);
  if (!res.ok) {
    throw new Error(`Download failed: ${res.status}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buffer);
  return dest;
}

function decodeBase64Buffer(value: string): Buffer {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  return Buffer.from(padded, 'base64');
}

function isEncryptedOnlineFile(file: GatewayFileRow): boolean {
  return Boolean(file.encryption_algorithm || file.encrypted_key || file.encryption_iv);
}

async function decryptOnlineFileAtPath(file: GatewayFileRow, localPath: string): Promise<void> {
  if (!isEncryptedOnlineFile(file)) return;
  if (file.encryption_algorithm !== ONLINE_FILE_ENCRYPTION_ALGORITHM) {
    throw new Error(`Unsupported online file encryption algorithm: ${file.encryption_algorithm ?? 'missing'}`);
  }
  if (!file.encrypted_key || !file.encryption_iv) {
    throw new Error('Encrypted online file is missing encryption metadata');
  }

  let aesKey = file.decryption_key_base64 ? decodeBase64Buffer(file.decryption_key_base64) : null;
  if (!aesKey) {
    throw new Error('Missing online file decryption key from gateway');
  }

  const encrypted = await readFile(localPath);
  if (encrypted.length <= AES_GCM_AUTH_TAG_BYTES) {
    throw new Error('Encrypted online file payload is too small');
  }

  const iv = decodeBase64Buffer(file.encryption_iv);
  const ciphertext = encrypted.subarray(0, encrypted.length - AES_GCM_AUTH_TAG_BYTES);
  const authTag = encrypted.subarray(encrypted.length - AES_GCM_AUTH_TAG_BYTES);
  const decipher = createDecipheriv('aes-256-gcm', aesKey, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  await writeFile(localPath, decrypted);
}

function buildMirrorPatchFromLocal(request: PrintRequest): GatewayMirrorPatch {
  return {
    desk_received_at: request.deskReceivedAt ?? new Date().toISOString(),
    total_pages: request.totalPages,
    price_iqd: request.priceIqd,
    status: request.status,
    source_of_truth: 'desktop',
    import_state: request.onlineFilesCleanupAt ? 'cleanup_done' : 'cleanup_pending',
    final_price_confirmed_at: request.finalPriceConfirmedAt ?? null,
    printed_at: request.printedAt ?? null,
    picked_up_at: request.pickedUpAt ?? null,
    online_files_cleanup_at: request.onlineFilesCleanupAt ?? null,
    payment_status: request.paymentStatus ?? null,
    payment_verified_at: request.paymentVerifiedAt ?? null,
  };
}

function parsePaymentMethod(value: string | null): PaymentMethod | null {
  return value === 'qicard' || value === 'zaincash' ? value : null;
}

function parsePaymentStatus(value: string | null): PaymentStatus | null {
  return value === 'pending' || value === 'verified' || value === 'rejected' ? value : null;
}

function syncLocalPaymentFromRemoteRow(row: GatewayRequestRow): PrintRequest | null {
  const paymentMethod = parsePaymentMethod(row.payment_method);
  const paymentStatus = parsePaymentStatus(row.payment_status);
  if (!paymentMethod || !paymentStatus || !row.payment_transaction_ref) return null;

  const result = syncRequestPaymentSubmission({
    id: row.id,
    paymentMethod,
    paymentTransactionRef: row.payment_transaction_ref,
    paymentStatus,
    paymentSubmittedAt: row.payment_submitted_at,
    paymentVerifiedAt: row.payment_verified_at,
  });

  if (result.ok && result.changed && result.request) {
    emitAppEvent({ type: 'requests:changed', reason: 'payment-submitted', requestId: row.id, payload: result.request });
  }

  return result.request ?? null;
}

async function patchMirror(requestId: string, patch: GatewayMirrorPatch): Promise<void> {
  await gatewayRequest<{ ok: boolean }>(`/requests/${encodeURIComponent(requestId)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

async function listRemoteFiles(requestId: string): Promise<GatewayFileRow[]> {
  let files: GatewayFileRow[] = [];
  for (let attempt = 0; attempt < FILE_LIST_RETRIES; attempt += 1) {
    const payload = await gatewayRequest<{ ok: boolean; files: GatewayFileRow[] }>(`/requests/${encodeURIComponent(requestId)}/files`);
    files = payload?.files ?? [];
    if (files.length > 0) break;
    await sleep(FILE_LIST_DELAY_MS);
  }
  return files;
}

async function getRemoteRequestRow(requestId: string): Promise<GatewayRequestRow | null> {
  const payload = await gatewayRequest<{ ok: boolean; row: GatewayRequestRow | null }>(`/requests/${encodeURIComponent(requestId)}`);
  return payload?.row ?? null;
}

async function prepareLocalFiles(requestId: string, files: GatewayFileRow[]): Promise<ImportedLocalFile[]> {
  const localFiles: ImportedLocalFile[] = [];

  for (const file of files) {
    let localPath: string | null = null;

    for (let attempt = 0; attempt < DOWNLOAD_RETRIES; attempt += 1) {
      if (file.signed_url) {
        try {
          localPath = await downloadOnlineFileToRequestStore({
            url: file.signed_url,
            requestId,
            fileId: file.id,
            filename: file.filename,
          });
          await decryptOnlineFileAtPath(file, localPath);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          // eslint-disable-next-line no-console
          console.warn(`[UOADrop] Online file download/decrypt failed for ${requestId}/${file.id}: ${message}`);
          localPath = null;
        }
      }

      if (localPath) break;
      await sleep(DOWNLOAD_DELAY_MS);
    }

    if (!localPath) continue;

    const buffer = await readFile(localPath);
    const sha256 = createHash('sha256').update(buffer).digest('hex');

    const ext = extname(file.filename || localPath).toLowerCase();
    const pages = await countFilePages(localPath, ext);

    localFiles.push({
      filename: file.filename,
      mimeType: file.mime_type ?? 'application/octet-stream',
      sizeBytes: file.size_bytes,
      localPath,
      sha256,
      magicByteVerified: false,
      pages,
      options: {
        copies: file.copies,
        color: file.color,
        doubleSided: file.double_sided,
        ...(file.pages_per_sheet === 1 || file.pages_per_sheet === 2 || file.pages_per_sheet === 4
          ? { pagesPerSheet: file.pages_per_sheet }
          : {}),
        ...(file.page_range ? { pageRange: file.page_range } : {}),
      },
    });
  }

  return localFiles;
}

async function cleanupRemoteSource(requestId: string): Promise<boolean> {
  try {
    const res = await gatewayRequest<{ ok: boolean }>(`/requests/${encodeURIComponent(requestId)}/cleanup`, { method: 'POST' });
    return Boolean(res?.ok);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[UOADrop] Cleanup failed for ${requestId}: ${String((err as Error)?.message ?? err).slice(0, 200)}`);
    return false;
  }
}

async function cleanupRemoteTracking(requestId: string): Promise<boolean> {
  try {
    const res = await gatewayRequest<{ ok: boolean }>(`/requests/${encodeURIComponent(requestId)}/tracking-cleanup`, { method: 'POST' });
    return Boolean(res?.ok);
  } catch {
    return false;
  }
}

async function importPendingRow(row: GatewayRequestRow): Promise<PrintRequest | null> {
  if (row.source !== 'online' || row.status !== 'pending' || row.source_of_truth === 'desktop' || row.desk_received_at) {
    return null;
  }
  if (processingIds.has(row.id)) return null;

  processingIds.add(row.id);
  try {
    await patchMirror(row.id, {
      import_state: 'download_started',
      source_of_truth: 'supabase_intake',
    });

    const existing = getRequestById(row.id);
    if (existing) {
      const synced = syncLocalPaymentFromRemoteRow(row) ?? existing;
      await patchMirror(row.id, buildMirrorPatchFromLocal(synced));
      return synced;
    }

    const files = await listRemoteFiles(row.id);
    if (files.length === 0) return null;

    const localFiles = await prepareLocalFiles(row.id, files);
    if (localFiles.length !== files.length) return null;

    await patchMirror(row.id, {
      import_state: 'downloaded',
      source_of_truth: 'supabase_intake',
    });

    const primaryFile = files[0];
    const imported = importOnlineRequest({
      request: {
        id: row.id,
        ticket: row.ticket,
        studentName: row.student_name,
        studentEmail: row.student_email,
        telegramChatId: row.telegram_chat_id,
        notes: row.notes,
        status: 'pending',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        priceIqd: row.price_iqd,
        totalPages: row.total_pages,
        options: primaryFile
          ? {
              copies: primaryFile.copies,
              color: primaryFile.color,
              doubleSided: primaryFile.double_sided,
              ...(primaryFile.pages_per_sheet === 1 || primaryFile.pages_per_sheet === 2 || primaryFile.pages_per_sheet === 4
                ? { pagesPerSheet: primaryFile.pages_per_sheet }
                : {}),
              ...(primaryFile.page_range ? { pageRange: primaryFile.page_range } : {}),
            }
          : undefined,
      },
      files: localFiles,
    });

    const deskReceivedAt = imported.deskReceivedAt ?? new Date().toISOString();
    setRequestWorkflowMeta({
      id: row.id,
      sourceOfTruth: 'desktop',
      importState: 'cleanup_pending',
      deskReceivedAt,
      finalPriceConfirmedAt: imported.finalPriceConfirmedAt ?? null,
    });

    const localAfterImport = getRequestById(row.id);
    const payload = localAfterImport
      ? {
          ...buildMirrorPatchFromLocal(localAfterImport),
          import_state: 'cleanup_pending' as const,
          source_of_truth: 'desktop' as const,
        }
      : {
          desk_received_at: deskReceivedAt,
          total_pages: imported.totalPages,
          price_iqd: imported.priceIqd,
          status: imported.status,
          source_of_truth: 'desktop' as const,
          import_state: 'cleanup_pending' as const,
          final_price_confirmed_at: imported.finalPriceConfirmedAt ?? null,
        };

    await patchMirror(row.id, payload);

    let cleanupAt: string | null = null;
    if (await cleanupRemoteSource(row.id)) {
      cleanupAt = new Date().toISOString();
      await patchMirror(row.id, {
        import_state: 'cleanup_done',
        online_files_cleanup_at: cleanupAt,
        source_of_truth: 'desktop',
      });
      setRequestWorkflowMeta({
        id: row.id,
        sourceOfTruth: 'desktop',
        importState: 'cleanup_done',
        onlineFilesCleanupAt: cleanupAt,
      });
      logRequestEvent({
        requestId: row.id,
        type: 'cleanup_done',
        actor: 'system',
      });
    }

    const syncedPayment = syncLocalPaymentFromRemoteRow(row);
    const finalRequest = syncedPayment ?? getRequestById(row.id) ?? {
      ...imported,
      importState: cleanupAt ? 'cleanup_done' : 'cleanup_pending',
      sourceOfTruth: 'desktop',
      deskReceivedAt,
      onlineFilesCleanupAt: cleanupAt ?? undefined,
    };
    emitAppEvent({ type: 'requests:changed', reason: 'created', requestId: finalRequest.id, payload: finalRequest });
    if (finalRequest.telegramChatId) void notifyTelegramRequestReceived(finalRequest);
    if (finalRequest.studentEmail) void notifyEmailReceived(finalRequest);
    return finalRequest;
  } finally {
    processingIds.delete(row.id);
  }
}

export async function repairOnlineRequestLocalFiles(requestId: string): Promise<{
  ok: boolean;
  request?: PrintRequest;
  error?: string;
  repairedFiles?: number;
}> {
  const onlineStatus = getOnlineModeStatus();
  if (!onlineStatus.enabled) return { ok: false, error: onlineStatus.reason };
  const current = getRequestById(requestId);
  if (!current) return { ok: false, error: 'not_found' };
  if (current.source !== 'online') return { ok: false, error: 'not_online' };
  if (current.onlineFilesCleanupAt) return { ok: false, error: 'remote_cleanup_done' };

  const remoteRow = await getRemoteRequestRow(requestId);
  if (!remoteRow) return { ok: false, error: 'remote_request_missing' };

  const remoteFiles = await listRemoteFiles(requestId);
  if (remoteFiles.length === 0) return { ok: false, error: 'remote_files_missing' };

  const localFiles = await prepareLocalFiles(requestId, remoteFiles);
  if (localFiles.length === 0) return { ok: false, error: 'repair_download_failed' };

  importOnlineRequest({
    request: {
      id: current.id,
      ticket: current.ticket,
      studentName: current.studentName ?? remoteRow.student_name,
      status: current.status,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
      priceIqd: current.priceIqd,
      totalPages: current.totalPages,
      options: current.options,
    },
    files: localFiles,
  });

  setRequestWorkflowMeta({
    id: requestId,
    sourceOfTruth: 'desktop',
    importState: current.onlineFilesCleanupAt ? 'cleanup_done' : 'cleanup_pending',
    deskReceivedAt: current.deskReceivedAt ?? remoteRow.desk_received_at ?? new Date().toISOString(),
    finalPriceConfirmedAt: current.finalPriceConfirmedAt ?? null,
    printedAt: current.printedAt ?? null,
    pickedUpAt: current.pickedUpAt ?? null,
    onlineFilesCleanupAt: current.onlineFilesCleanupAt ?? null,
  });
  await syncOnlineRequestMirrorFromLocal(requestId);
  logRequestEvent({
    requestId,
    type: 'status_changed',
    actor: 'system',
    status: current.status,
    details: { repairedFiles: localFiles.length, repair: true },
  });
  const repaired = getRequestById(requestId);
  emitAppEvent({ type: 'requests:changed', reason: 'files-repaired', requestId, payload: repaired ?? undefined });
  return { ok: true, request: repaired ?? undefined, repairedFiles: localFiles.length };
}

export async function syncOnlineRequestMirrorFromLocal(
  requestId: string,
  patch?: GatewayMirrorPatch,
): Promise<void> {
  const onlineStatus = getOnlineModeStatus();
  if (!onlineStatus.enabled) return;
  const current = getRequestById(requestId);
  if (!current || current.source !== 'online') return;
  await patchMirror(requestId, {
    ...buildMirrorPatchFromLocal(current),
    ...(patch ?? {}),
  });
}

export async function cancelOnlineRequestMirror(request: PrintRequest): Promise<void> {
  const onlineStatus = getOnlineModeStatus();
  if (!onlineStatus.enabled) return;
  if (request.source !== 'online') return;
  await patchMirror(request.id, {
    ...buildMirrorPatchFromLocal({ ...request, status: 'canceled' }),
    status: 'canceled',
    source_of_truth: 'desktop',
  });
}

export async function cleanupDeliveredOnlineTracking(requestId: string): Promise<void> {
  const current = getRequestById(requestId);
  if (!current || current.source !== 'online' || current.status !== 'done' || !current.pickedUpAt) return;
  await cleanupRemoteTracking(requestId);
}

async function runIntakePass(): Promise<void> {
  if (intakeBusy) return;
  if (!getDesktopGatewayConfig()) return;
  intakeBusy = true;
  try {
    const payload = await gatewayRequest<{ ok: boolean; rows: GatewayRequestRow[] }>('/requests?mode=active');
    const rows = payload?.rows ?? [];
    for (const row of rows) {
      syncLocalPaymentFromRemoteRow(row);
      await importPendingRow(row);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[UOADrop] Online intake pass failed (non-fatal)', err);
  } finally {
    intakeBusy = false;
  }
}

async function runCleanupPass(): Promise<void> {
  if (cleanupBusy) return;
  if (!getDesktopGatewayConfig()) return;
  cleanupBusy = true;
  try {
    const payload = await gatewayRequest<{ ok: boolean; rows: GatewayRequestRow[] }>('/requests?mode=all');
    const rows = payload?.rows ?? [];
    const cleanupCandidates = rows.filter((row) =>
      row.source_of_truth === 'desktop'
      && !!row.desk_received_at
      && !row.online_files_cleanup_at,
    );

    for (const row of cleanupCandidates) {
      const cleaned = await cleanupRemoteSource(row.id);
      if (!cleaned) continue;

      const cleanupAt = new Date().toISOString();
      await patchMirror(row.id, {
        import_state: 'cleanup_done',
        online_files_cleanup_at: cleanupAt,
        source_of_truth: 'desktop',
      });
      setRequestWorkflowMeta({
        id: row.id,
        sourceOfTruth: 'desktop',
        importState: 'cleanup_done',
        onlineFilesCleanupAt: cleanupAt,
      });
      logRequestEvent({
        requestId: row.id,
        type: 'cleanup_done',
        actor: 'system',
      });
      const updated = getRequestById(row.id);
      emitAppEvent({ type: 'requests:changed', reason: 'workflow-meta', requestId: row.id, payload: updated ?? undefined });
    }

    const trackingCleanupCandidates = rows.filter((row) =>
      row.source_of_truth === 'desktop'
      && row.status === 'done'
      && !!row.picked_up_at,
    );

    for (const row of trackingCleanupCandidates) {
      await cleanupRemoteTracking(row.id);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[UOADrop] Online cleanup pass failed (non-fatal)', err);
  } finally {
    cleanupBusy = false;
  }
}

async function runStartupSync(): Promise<void> {
  if (!getDesktopGatewayConfig()) return;
  try {
    const payload = await gatewayRequest<{ ok: boolean; rows: GatewayRequestRow[] }>('/requests?mode=active');
    const rows = payload?.rows ?? [];
    let synced = 0;
    for (const row of rows) {
      const paymentSynced = syncLocalPaymentFromRemoteRow(row);
      const local = getRequestById(row.id);
      if (!local || local.source !== 'online') {
        if (paymentSynced) synced += 1;
        continue;
      }
      if (local.status !== row.status) {
        await patchMirror(row.id, buildMirrorPatchFromLocal(local));
        synced += 1;
      } else if (paymentSynced) {
        synced += 1;
      }
    }
    if (synced > 0) {
      // eslint-disable-next-line no-console
      console.log(`[UOADrop] Startup sync: synchronized ${synced} online requests`);
    }
  } catch {
    // eslint-disable-next-line no-console
    console.warn('[UOADrop] Startup sync failed (non-fatal)');
  }
}

export function startOnlineWorkflowService(): void {
  if (started) return;
  const onlineStatus = getOnlineModeStatus();
  if (!onlineStatus.enabled) {
    console.warn(`[UOADrop] Online workflow disabled: ${onlineStatus.reason}.`);
    return;
  }
  if (!getDesktopGatewayConfig()) {
    // eslint-disable-next-line no-console
    console.warn('[UOADrop] Online workflow disabled: desktop gateway activation is missing.');
    return;
  }
  started = true;
  void runStartupSync();
  void runIntakePass();
  void runCleanupPass();
  setInterval(() => {
    void runIntakePass();
  }, INTAKE_POLL_MS);
  setInterval(() => {
    void runCleanupPass();
  }, CLEANUP_POLL_MS);
}

export async function getLocalFileSha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  return createHash('sha256').update(buffer).digest('hex');
}
