import { app } from 'electron';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import type { PrintRequest } from '@uoadrop/shared';
import { getSupabaseRuntimeConfig, hasProductionServiceRoleKey } from './runtime-config';
import {
  getRequestById,
  importOnlineRequest,
  logRequestEvent,
  setRequestWorkflowMeta,
} from './db';
import { emit as emitAppEvent } from './events';

type SupabaseRequestRow = {
  id: string;
  ticket: string;
  student_name: string | null;
  student_email: string | null;
  pickup_pin_hash: string | null;
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
};

type SupabaseFileRow = {
  id: string;
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
};

type SupabaseMirrorPatch = Partial<Pick<
  SupabaseRequestRow,
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
>>;

type ImportedLocalFile = {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  localPath: string;
  sha256: string;
  magicByteVerified: boolean;
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
const ONLINE_FILE_RETENTION_HOURS = 48;

let supabase: SupabaseClient | null = null;
let started = false;
let intakeBusy = false;
let cleanupBusy = false;
const processingIds = new Set<string>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readSupabaseConfig(): { url: string; key: string } | null {
  const { url, anonKey, serviceRoleKey } = getSupabaseRuntimeConfig();
  const key = serviceRoleKey || anonKey;
  if (!url || !key) return null;
  return { url, key };
}

function getSupabaseClient(): SupabaseClient | null {
  if (supabase) return supabase;
  const config = readSupabaseConfig();
  if (!config) return null;
  supabase = createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 10 } },
  });
  return supabase;
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

function buildMirrorPatchFromLocal(request: PrintRequest): SupabaseMirrorPatch {
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
  };
}

async function patchMirror(requestId: string, patch: SupabaseMirrorPatch): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  const { error } = await client
    .from('print_requests')
    .update(patch)
    .eq('id', requestId)
    .eq('source', 'online');
  if (error) throw error;
}

async function listRemoteFiles(requestId: string): Promise<SupabaseFileRow[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  let files: SupabaseFileRow[] = [];
  for (let attempt = 0; attempt < FILE_LIST_RETRIES; attempt += 1) {
    const { data } = await client
      .from('request_files')
      .select('*')
      .eq('request_id', requestId);
    files = (data ?? []) as SupabaseFileRow[];
    if (files.length > 0) break;
    await sleep(FILE_LIST_DELAY_MS);
  }
  return files;
}

async function getRemoteRequestRow(requestId: string): Promise<SupabaseRequestRow | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client
    .from('print_requests')
    .select('*')
    .eq('id', requestId)
    .eq('source', 'online')
    .maybeSingle();
  if (error || !data) return null;
  return data as SupabaseRequestRow;
}

async function prepareLocalFiles(requestId: string, files: SupabaseFileRow[]): Promise<ImportedLocalFile[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  const localFiles: ImportedLocalFile[] = [];

  for (const file of files) {
    let localPath: string | null = null;

    for (let attempt = 0; attempt < DOWNLOAD_RETRIES; attempt += 1) {
      const { data, error } = await client.storage
        .from('print-files')
        .createSignedUrl(file.storage_path, 60 * 60 * 24 * 7);

      if (!error && data?.signedUrl) {
        try {
          localPath = await downloadOnlineFileToRequestStore({
            url: data.signedUrl,
            requestId,
            fileId: file.id,
            filename: file.filename,
          });
        } catch {
          localPath = null;
        }
      }

      if (localPath) break;
      await sleep(DOWNLOAD_DELAY_MS);
    }

    if (!localPath) continue;

    const buffer = await readFile(localPath);
    const sha256 = createHash('sha256').update(buffer).digest('hex');

    localFiles.push({
      filename: file.filename,
      mimeType: file.mime_type ?? 'application/octet-stream',
      sizeBytes: file.size_bytes,
      localPath,
      sha256,
      magicByteVerified: false,
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

async function cleanupRemoteSource(requestId: string, files: SupabaseFileRow[]): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;
  const storagePaths = [...new Set(files.map((file) => file.storage_path).filter(Boolean))];

  if (storagePaths.length > 0) {
    const { error: storageErr } = await client.storage
      .from('print-files')
      .remove(storagePaths);
    if (storageErr) return false;
  }

  const { error: filesErr } = await client
    .from('request_files')
    .delete()
    .eq('request_id', requestId);

  return !filesErr;
}

async function importPendingRow(row: SupabaseRequestRow): Promise<PrintRequest | null> {
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
      await patchMirror(row.id, buildMirrorPatchFromLocal(existing));
      return existing;
    }

    const files = await listRemoteFiles(row.id);
    if (files.length === 0) return null;

    const localFiles = await prepareLocalFiles(row.id, files);
    if (localFiles.length === 0) return null;

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
        pinHash: row.pickup_pin_hash,
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

    const finalRequest = getRequestById(row.id) ?? { ...imported, importState: 'cleanup_pending', sourceOfTruth: 'desktop', deskReceivedAt };
    emitAppEvent({ type: 'requests:changed', reason: 'created', requestId: finalRequest.id, payload: finalRequest });
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
      pinHash: current.pinHash || remoteRow.pickup_pin_hash,
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
  patch?: SupabaseMirrorPatch,
): Promise<void> {
  const current = getRequestById(requestId);
  if (!current || current.source !== 'online') return;
  await patchMirror(requestId, {
    ...buildMirrorPatchFromLocal(current),
    ...(patch ?? {}),
  });
}

async function runIntakePass(): Promise<void> {
  if (intakeBusy) return;
  const client = getSupabaseClient();
  if (!client) return;
  intakeBusy = true;
  try {
    const { data } = await client
      .from('print_requests')
      .select('*')
      .eq('source', 'online')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    const rows = (data ?? []) as SupabaseRequestRow[];
    for (const row of rows) {
      await importPendingRow(row);
    }
  } catch {
  } finally {
    intakeBusy = false;
  }
}

async function runCleanupPass(): Promise<void> {
  if (cleanupBusy) return;
  const client = getSupabaseClient();
  if (!client) return;
  cleanupBusy = true;
  try {
    const cutoff = new Date(Date.now() - ONLINE_FILE_RETENTION_HOURS * 60 * 60 * 1000).toISOString();
    const { data } = await client
      .from('print_requests')
      .select('*')
      .eq('source', 'online')
      .order('created_at', { ascending: false });

    const rows = (data ?? []) as SupabaseRequestRow[];
    const cleanupCandidates = rows.filter((row) =>
      row.source_of_truth === 'desktop'
      && !!row.desk_received_at
      && row.desk_received_at <= cutoff
      && !row.online_files_cleanup_at,
    );

    for (const row of cleanupCandidates) {
      const { data: filesData } = await client
        .from('request_files')
        .select('*')
        .eq('request_id', row.id);
      const files = (filesData ?? []) as SupabaseFileRow[];
      const cleaned = await cleanupRemoteSource(row.id, files);
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
  } catch {
  } finally {
    cleanupBusy = false;
  }
}

export function startOnlineWorkflowService(): void {
  if (started) return;
  if (app.isPackaged && !hasProductionServiceRoleKey()) {
    // eslint-disable-next-line no-console
    console.error('[UOADrop] Online workflow disabled: SUPABASE_SERVICE_ROLE_KEY is required in packaged desktop builds.');
    return;
  }
  if (!getSupabaseClient()) {
    // eslint-disable-next-line no-console
    console.warn('[UOADrop] Online workflow disabled: Supabase runtime configuration is incomplete.');
    return;
  }
  started = true;
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
