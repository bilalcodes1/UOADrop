import Database from 'better-sqlite3';
import { mkdirSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type {
  OnlineImportState,
  PrintQueueState,
  PrintRequest,
  RequestEvent,
  RequestEventType,
  RequestFile,
  RequestSourceOfTruth,
  RequestStatus,
} from '@uoadrop/shared';
import { PIN_BCRYPT_ROUNDS, PIN_LOCKOUT_MINUTES, PIN_MAX_ATTEMPTS } from '@uoadrop/shared';
import bcrypt from 'bcryptjs';

let db: Database.Database | null = null;

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function normalizePrintOptions(
  source?: Partial<PrintRequest['options']> | null,
  fallback?: Partial<PrintRequest['options']> | null,
): PrintRequest['options'] {
  const merged = { ...(fallback ?? {}), ...(source ?? {}) };
  const pagesPerSheet = merged.pagesPerSheet === 1 || merged.pagesPerSheet === 2 || merged.pagesPerSheet === 4
    ? merged.pagesPerSheet
    : undefined;
  const pageRange = typeof merged.pageRange === 'string' && merged.pageRange.trim().length > 0
    ? merged.pageRange.trim().slice(0, 120)
    : undefined;
  return {
    copies: clampInt(merged.copies, 1, 10, 1),
    color: !!merged.color,
    doubleSided: merged.doubleSided === undefined ? true : !!merged.doubleSided,
    ...(pagesPerSheet ? { pagesPerSheet } : {}),
    ...(pageRange ? { pageRange } : {}),
  };
}

function parsePrintOptionsJson(raw?: string | null): Partial<PrintRequest['options']> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Partial<PrintRequest['options']>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function parseJsonRecord(raw?: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function getPrintRequestsColumnNames(d: Database.Database): string[] {
  const rows = d.prepare(`PRAGMA table_info(print_requests)`).all() as Array<{ name: string }>;
  return rows.map((row) => row.name);
}

function getRequestFilesColumnNames(d: Database.Database): string[] {
  const rows = d.prepare(`PRAGMA table_info(request_files)`).all() as Array<{ name: string }>;
  return rows.map((row) => row.name);
}

function ensureRequestFilesPagesColumn(d: Database.Database): void {
  const columns = getRequestFilesColumnNames(d);
  if (!columns.includes('pages')) {
    d.exec(`ALTER TABLE request_files ADD COLUMN pages INTEGER NOT NULL DEFAULT 0`);
  }
}

function ensureRequestFilesOptionsColumn(d: Database.Database): void {
  const columns = getRequestFilesColumnNames(d);
  if (!columns.includes('options_json')) {
    d.exec(`ALTER TABLE request_files ADD COLUMN options_json TEXT`);
  }
}

function ensurePrintRequestsPickupPinColumn(d: Database.Database): void {
  const columns = getPrintRequestsColumnNames(d);
  if (!columns.includes('pickup_pin')) {
    d.exec(`ALTER TABLE print_requests ADD COLUMN pickup_pin TEXT`);
  }
}

function ensurePrintRequestsSourceColumn(d: Database.Database): void {
  const columns = getPrintRequestsColumnNames(d);
  if (!columns.includes('source')) {
    d.exec(`ALTER TABLE print_requests ADD COLUMN source TEXT NOT NULL DEFAULT 'local'`);
  }
}

function ensurePrintRequestsDeskReceivedColumn(d: Database.Database): void {
  const columns = getPrintRequestsColumnNames(d);
  if (!columns.includes('desk_received_at')) {
    d.exec(`ALTER TABLE print_requests ADD COLUMN desk_received_at TEXT`);
  }
}

function ensurePrintRequestsPrintedAtColumn(d: Database.Database): void {
  const columns = getPrintRequestsColumnNames(d);
  if (!columns.includes('printed_at')) {
    d.exec(`ALTER TABLE print_requests ADD COLUMN printed_at TEXT`);
  }
}

function ensurePrintRequestsPickedUpAtColumn(d: Database.Database): void {
  const columns = getPrintRequestsColumnNames(d);
  if (!columns.includes('picked_up_at')) {
    d.exec(`ALTER TABLE print_requests ADD COLUMN picked_up_at TEXT`);
  }
}

function ensurePrintRequestsSourceOfTruthColumn(d: Database.Database): void {
  const columns = getPrintRequestsColumnNames(d);
  if (!columns.includes('source_of_truth')) {
    d.exec(`ALTER TABLE print_requests ADD COLUMN source_of_truth TEXT NOT NULL DEFAULT 'desktop'`);
  }
}

function ensurePrintRequestsImportStateColumn(d: Database.Database): void {
  const columns = getPrintRequestsColumnNames(d);
  if (!columns.includes('import_state')) {
    d.exec(`ALTER TABLE print_requests ADD COLUMN import_state TEXT`);
  }
}

function ensurePrintRequestsFinalPriceConfirmedAtColumn(d: Database.Database): void {
  const columns = getPrintRequestsColumnNames(d);
  if (!columns.includes('final_price_confirmed_at')) {
    d.exec(`ALTER TABLE print_requests ADD COLUMN final_price_confirmed_at TEXT`);
  }
}

function ensurePrintRequestsOnlineFilesCleanupAtColumn(d: Database.Database): void {
  const columns = getPrintRequestsColumnNames(d);
  if (!columns.includes('online_files_cleanup_at')) {
    d.exec(`ALTER TABLE print_requests ADD COLUMN online_files_cleanup_at TEXT`);
  }
}

function ensurePrintRequestsPrintQueueStateColumn(d: Database.Database): void {
  const columns = getPrintRequestsColumnNames(d);
  if (!columns.includes('print_queue_state')) {
    d.exec(`ALTER TABLE print_requests ADD COLUMN print_queue_state TEXT NOT NULL DEFAULT 'idle'`);
  }
}

function ensurePrintRequestsPrintQueueErrorColumn(d: Database.Database): void {
  const columns = getPrintRequestsColumnNames(d);
  if (!columns.includes('print_queue_error')) {
    d.exec(`ALTER TABLE print_requests ADD COLUMN print_queue_error TEXT`);
  }
}

function ensurePrintRequestsPrintQueueUpdatedAtColumn(d: Database.Database): void {
  const columns = getPrintRequestsColumnNames(d);
  if (!columns.includes('print_queue_updated_at')) {
    d.exec(`ALTER TABLE print_requests ADD COLUMN print_queue_updated_at TEXT`);
  }
}

function ensurePrintRequestsStudentEmailColumn(d: Database.Database): void {
  const columns = getPrintRequestsColumnNames(d);
  if (!columns.includes('student_email')) {
    d.exec(`ALTER TABLE print_requests ADD COLUMN student_email TEXT`);
  }
}

function ensurePrintRequestsTelegramChatIdColumn(d: Database.Database): void {
  const columns = getPrintRequestsColumnNames(d);
  if (!columns.includes('telegram_chat_id')) {
    d.exec(`ALTER TABLE print_requests ADD COLUMN telegram_chat_id TEXT`);
  }
}

function getDbPath(): string {
  // Dev-only (Option A): relative path in repo
  const configured = process.env.DESKTOP_DB_PATH;
  return resolve(process.cwd(), configured ?? './data/uoadrop.db');
}

export function getDb(): Database.Database {
  if (db) return db;

  const dbPath = getDbPath();
  mkdirSync(dirname(dbPath), { recursive: true });

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');

  initSchema(db);
  return db;
}

function initSchema(d: Database.Database): void {
  d.exec(`
    CREATE TABLE IF NOT EXISTS print_requests (
      id TEXT PRIMARY KEY,
      ticket TEXT NOT NULL UNIQUE,
      student_name TEXT,
      student_email TEXT,
      telegram_chat_id TEXT,
      source TEXT NOT NULL DEFAULT 'local',
      pin_hash TEXT NOT NULL,
      status TEXT NOT NULL,
      options_json TEXT NOT NULL,
      total_pages INTEGER NOT NULL,
      price_iqd INTEGER NOT NULL,
      desk_received_at TEXT,
      printed_at TEXT,
      picked_up_at TEXT,
      source_of_truth TEXT NOT NULL DEFAULT 'desktop',
      import_state TEXT,
      final_price_confirmed_at TEXT,
      online_files_cleanup_at TEXT,
      print_queue_state TEXT NOT NULL DEFAULT 'idle',
      print_queue_error TEXT,
      print_queue_updated_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS request_files (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      local_path TEXT NOT NULL,
      sha256 TEXT NOT NULL,
      magic_byte_verified INTEGER NOT NULL DEFAULT 0,
      options_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (request_id) REFERENCES print_requests(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pin_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scope TEXT NOT NULL,
      ok INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS printer_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event TEXT NOT NULL,
      status TEXT NOT NULL,
      printer_name TEXT,
      details_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS request_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      actor TEXT NOT NULL,
      status TEXT,
      details_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_request_files_request_id ON request_files(request_id);
    CREATE INDEX IF NOT EXISTS idx_print_requests_status ON print_requests(status);
    CREATE INDEX IF NOT EXISTS idx_pin_attempts_scope_time ON pin_attempts(scope, created_at);
    CREATE INDEX IF NOT EXISTS idx_printer_events_created_at ON printer_events(created_at);
    CREATE INDEX IF NOT EXISTS idx_request_events_request_id_created_at ON request_events(request_id, created_at DESC);
  `);

  ensureRequestFilesPagesColumn(d);
  ensureRequestFilesOptionsColumn(d);
  ensurePrintRequestsPickupPinColumn(d);
  ensurePrintRequestsSourceColumn(d);
  ensurePrintRequestsDeskReceivedColumn(d);
  ensurePrintRequestsPrintedAtColumn(d);
  ensurePrintRequestsPickedUpAtColumn(d);
  ensurePrintRequestsSourceOfTruthColumn(d);
  ensurePrintRequestsImportStateColumn(d);
  ensurePrintRequestsFinalPriceConfirmedAtColumn(d);
  ensurePrintRequestsOnlineFilesCleanupAtColumn(d);
  ensurePrintRequestsPrintQueueStateColumn(d);
  ensurePrintRequestsPrintQueueErrorColumn(d);
  ensurePrintRequestsPrintQueueUpdatedAtColumn(d);
  ensurePrintRequestsStudentEmailColumn(d);
  ensurePrintRequestsTelegramChatIdColumn(d);
}

export interface PrinterEventRow {
  id: number;
  event: string;
  status: string;
  printerName: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export function logPrinterEvent(args: {
  event: string;
  status: string;
  printerName?: string | null;
  details?: Record<string, unknown> | null;
}): void {
  const d = getDb();
  d.prepare(
    `INSERT INTO printer_events(event, status, printer_name, details_json, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(
    args.event,
    args.status,
    args.printerName ?? null,
    args.details ? JSON.stringify(args.details) : null,
    new Date().toISOString(),
  );
}

export function listPrinterEvents(limit = 50): PrinterEventRow[] {
  const d = getDb();
  const rows = d
    .prepare(
      `SELECT id, event, status, printer_name, details_json, created_at
       FROM printer_events
       ORDER BY id DESC
       LIMIT ?`,
    )
    .all(limit) as Array<{
    id: number;
    event: string;
    status: string;
    printer_name: string | null;
    details_json: string | null;
    created_at: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    event: r.event,
    status: r.status,
    printerName: r.printer_name,
    details: r.details_json ? (JSON.parse(r.details_json) as Record<string, unknown>) : null,
    createdAt: r.created_at,
  }));
}

type RequestRow = {
  id: string;
  ticket: string;
  student_name: string | null;
  student_email: string | null;
  telegram_chat_id: string | null;
  source: 'local' | 'online';
  pickup_pin: string | null;
  pin_hash: string;
  status: RequestStatus;
  options_json: string;
  total_pages: number;
  price_iqd: number;
  desk_received_at: string | null;
  printed_at: string | null;
  picked_up_at: string | null;
  source_of_truth: RequestSourceOfTruth | null;
  import_state: OnlineImportState | null;
  final_price_confirmed_at: string | null;
  online_files_cleanup_at: string | null;
  print_queue_state: PrintQueueState | null;
  print_queue_error: string | null;
  print_queue_updated_at: string | null;
  file_count: number;
  created_at: string;
  updated_at: string;
};

function buildPrintRequest(row: RequestRow): PrintRequest {
  return {
    id: row.id,
    ticket: row.ticket,
    source: row.source,
    studentName: row.student_name ?? undefined,
    studentEmail: row.student_email ?? undefined,
    telegramChatId: row.telegram_chat_id ?? undefined,
    status: row.status,
    options: normalizePrintOptions(parsePrintOptionsJson(row.options_json)),
    totalPages: row.total_pages,
    priceIqd: row.price_iqd,
    sourceOfTruth: row.source_of_truth ?? undefined,
    importState: row.import_state ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deskReceivedAt: row.desk_received_at ?? undefined,
    printedAt: row.printed_at ?? undefined,
    pickedUpAt: row.picked_up_at ?? undefined,
    finalPriceConfirmedAt: row.final_price_confirmed_at ?? undefined,
    onlineFilesCleanupAt: row.online_files_cleanup_at ?? undefined,
    fileCount: row.file_count ?? 0,
    printQueueState: row.print_queue_state ?? 'idle',
    printQueueError: row.print_queue_error ?? undefined,
    printQueueUpdatedAt: row.print_queue_updated_at ?? undefined,
  };
}

export function logRequestEvent(args: {
  requestId: string;
  type: RequestEventType;
  actor: 'system' | 'student' | 'librarian';
  status?: RequestStatus;
  details?: Record<string, unknown> | null;
}): void {
  const d = getDb();
  d.prepare(
    `INSERT INTO request_events(request_id, event_type, actor, status, details_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    args.requestId,
    args.type,
    args.actor,
    args.status ?? null,
    args.details ? JSON.stringify(args.details) : null,
    new Date().toISOString(),
  );
}

export function listRequestEvents(requestId: string, limit = 50): RequestEvent[] {
  const d = getDb();
  const rows = d
    .prepare(
      `SELECT id, request_id, event_type, actor, status, details_json, created_at
       FROM request_events
       WHERE request_id = ?
       ORDER BY id DESC
       LIMIT ?`,
    )
    .all(requestId, limit) as Array<{
    id: number;
    request_id: string;
    event_type: RequestEventType;
    actor: 'system' | 'student' | 'librarian';
    status: RequestStatus | null;
    details_json: string | null;
    created_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    requestId: row.request_id,
    type: row.event_type,
    actor: row.actor,
    status: row.status ?? undefined,
    details: parseJsonRecord(row.details_json),
    createdAt: row.created_at,
  }));
}

function getSetting(key: string): string | null {
  const d = getDb();
  const row = d.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

function setSetting(key: string, value: string): void {
  const d = getDb();
  const now = new Date().toISOString();
  d.prepare(
    `INSERT INTO settings(key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`,
  ).run(key, value, now);
}

const LIBRARIAN_PIN_KEY = 'librarian_pin_hash';

function generateLibrarianPin(): string {
  let out = '';
  for (let i = 0; i < 6; i++) out += Math.floor(Math.random() * 10).toString();
  return out;
}

export function ensureLibrarianPin(): { generatedPin: string | null } {
  // If env override is set, trust it and mirror into settings.
  const envHash = process.env.LIBRARIAN_PIN_HASH;
  if (envHash && envHash.length > 0) {
    setSetting(LIBRARIAN_PIN_KEY, envHash);
    return { generatedPin: null };
  }

  const existing = getSetting(LIBRARIAN_PIN_KEY);
  if (existing) return { generatedPin: null };

  const pin = generateLibrarianPin();
  const hash = bcrypt.hashSync(pin, PIN_BCRYPT_ROUNDS);
  setSetting(LIBRARIAN_PIN_KEY, hash);
  return { generatedPin: pin };
}

export function verifyLibrarianPin(pin: string): { ok: boolean } {
  const hash = getSetting(LIBRARIAN_PIN_KEY);
  if (!hash) return { ok: false };
  return { ok: bcrypt.compareSync(pin, hash) };
}

export function recordPinAttempt(scope: string, ok: boolean): void {
  const d = getDb();
  d.prepare('INSERT INTO pin_attempts(scope, ok, created_at) VALUES (?, ?, ?)').run(
    scope,
    ok ? 1 : 0,
    new Date().toISOString(),
  );
}

export function recentFailedPinAttempts(scope: string, withinMs: number): number {
  const d = getDb();
  const since = new Date(Date.now() - withinMs).toISOString();
  const row = d
    .prepare('SELECT COUNT(1) as c FROM pin_attempts WHERE scope = ? AND ok = 0 AND created_at >= ?')
    .get(scope, since) as { c: number };
  return row.c;
}

export function purgeLegacySeedData(): { deleted: number } {
  const d = getDb();
  const info = d.prepare("DELETE FROM print_requests WHERE pin_hash = '$2b$12$seed'").run();
  return { deleted: info.changes };
}

function generateTicket(): string {
  // Simple 4-char ticket: A-Z + 0-9
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 4; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export function createRequest(args: {
  studentName: string;
  options: PrintRequest['options'];
  totalPages: number;
  priceIqd: number;
}): { request: PrintRequest } {
  const d = getDb();
  const now = new Date().toISOString();
  const id = randomUUID();

  // Ensure unique ticket (best-effort)
  let ticket = generateTicket();
  const exists = d.prepare('SELECT 1 FROM print_requests WHERE ticket = ? LIMIT 1');
  for (let i = 0; i < 10; i++) {
    if (!exists.get(ticket)) break;
    ticket = generateTicket();
  }

  const normalizedOptions = normalizePrintOptions(args.options);
  const optionsJson = JSON.stringify(normalizedOptions);
  const status: RequestStatus = 'pending';

  d.prepare(
    `INSERT INTO print_requests (
      id, ticket, student_name, source, pickup_pin, pin_hash, status, options_json,
      total_pages, price_iqd, desk_received_at, printed_at, picked_up_at, source_of_truth,
      import_state, final_price_confirmed_at, online_files_cleanup_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    ticket,
    args.studentName ?? null,
    'local',
    null,
    '',
    status,
    optionsJson,
    args.totalPages,
    args.priceIqd,
    now,
    null,
    null,
    'desktop',
    null,
    args.priceIqd > 0 ? now : null,
    null,
    now,
    now,
  );

  const request: PrintRequest = {
    id,
    ticket,
    source: 'local',
    studentName: args.studentName,
    status,
    options: normalizedOptions,
    totalPages: args.totalPages,
    priceIqd: args.priceIqd,
    sourceOfTruth: 'desktop',
    createdAt: now,
    updatedAt: now,
    deskReceivedAt: now,
    finalPriceConfirmedAt: args.priceIqd > 0 ? now : undefined,
  };

  logRequestEvent({
    requestId: id,
    type: 'request_created',
    actor: 'student',
    status,
    details: { source: 'local' },
  });

  return { request };
}

export function existsRequestFileBySha256(requestId: string, sha256: string): boolean {
  const d = getDb();
  const row = d
    .prepare(
      'SELECT 1 as one FROM request_files WHERE request_id = ? AND sha256 = ? LIMIT 1',
    )
    .get(requestId, sha256) as { one: number } | undefined;
  return !!row;
}

export function listRequestsPaged(args: {
  statuses?: RequestStatus[];
  search?: string;
  limit?: number;
  offset?: number;
}): { items: PrintRequest[]; total: number } {
  const d = getDb();
  const where: string[] = [];
  const params: any[] = [];

  if (args.statuses && args.statuses.length > 0) {
    where.push(`status IN (${args.statuses.map(() => '?').join(',')})`);
    params.push(...args.statuses);
  }
  if (args.search && args.search.trim().length > 0) {
    where.push('(ticket LIKE ? OR COALESCE(student_name,"") LIKE ?)');
    const like = `%${args.search.trim()}%`;
    params.push(like, like);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = Math.max(1, Math.min(200, args.limit ?? 50));
  const offset = Math.max(0, args.offset ?? 0);

  const totalRow = d
    .prepare(`SELECT COUNT(1) as c FROM print_requests ${whereSql}`)
    .get(...params) as { c: number };

  const rows = d
    .prepare(
      `SELECT r.id, r.ticket, r.student_name, r.student_email, r.telegram_chat_id, r.source, r.pickup_pin, r.pin_hash, r.status, r.options_json,
              r.total_pages, r.price_iqd, r.desk_received_at, r.printed_at, r.picked_up_at, r.source_of_truth,
              r.import_state, r.final_price_confirmed_at, r.online_files_cleanup_at, r.print_queue_state,
              r.print_queue_error, r.print_queue_updated_at,
              (SELECT COUNT(1) FROM request_files rf WHERE rf.request_id = r.id) as file_count,
              r.created_at, r.updated_at
       FROM print_requests r
       ${whereSql}
       ORDER BY datetime(created_at) DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset) as RequestRow[];

  const items: PrintRequest[] = rows.map(buildPrintRequest);

  return { items, total: totalRow.c };
}

export function listRequests(): PrintRequest[] {
  const d = getDb();
  const rows = d
    .prepare(
      `SELECT r.id, r.ticket, r.student_name, r.student_email, r.telegram_chat_id, r.source, r.pickup_pin, r.pin_hash, r.status, r.options_json,
              r.total_pages, r.price_iqd, r.desk_received_at, r.printed_at, r.picked_up_at, r.source_of_truth,
              r.import_state, r.final_price_confirmed_at, r.online_files_cleanup_at, r.print_queue_state,
              r.print_queue_error, r.print_queue_updated_at,
              (SELECT COUNT(1) FROM request_files rf WHERE rf.request_id = r.id) as file_count,
              r.created_at, r.updated_at
       FROM print_requests r
       ORDER BY datetime(created_at) DESC`,
    )
    .all() as RequestRow[];

  return rows.map(buildPrintRequest);
}

export function getRequestById(id: string): PrintRequest | null {
  const d = getDb();
  const row = d
    .prepare(
      `SELECT r.id, r.ticket, r.student_name, r.student_email, r.telegram_chat_id, r.source, r.pickup_pin, r.pin_hash, r.status, r.options_json,
              r.total_pages, r.price_iqd, r.desk_received_at, r.printed_at, r.picked_up_at, r.source_of_truth,
              r.import_state, r.final_price_confirmed_at, r.online_files_cleanup_at, r.print_queue_state,
              r.print_queue_error, r.print_queue_updated_at,
              (SELECT COUNT(1) FROM request_files rf WHERE rf.request_id = r.id) as file_count,
              r.created_at, r.updated_at
       FROM print_requests r
       WHERE r.id = ?
       LIMIT 1`,
    )
    .get(id) as RequestRow | undefined;

  if (!row) return null;

  return row ? buildPrintRequest(row) : null;
}

export function getRequestByTicket(ticket: string): PrintRequest | null {
  const d = getDb();
  const normalizedTicket = ticket.trim().toUpperCase();
  if (!normalizedTicket) return null;
  const row = d
    .prepare(
      `SELECT r.id, r.ticket, r.student_name, r.student_email, r.telegram_chat_id, r.source, r.pickup_pin, r.pin_hash, r.status, r.options_json,
              r.total_pages, r.price_iqd, r.desk_received_at, r.printed_at, r.picked_up_at, r.source_of_truth,
              r.import_state, r.final_price_confirmed_at, r.online_files_cleanup_at, r.print_queue_state,
              r.print_queue_error, r.print_queue_updated_at,
              (SELECT COUNT(1) FROM request_files rf WHERE rf.request_id = r.id) as file_count,
              r.created_at, r.updated_at
       FROM print_requests r
       WHERE r.ticket = ?
       LIMIT 1`,
    )
    .get(normalizedTicket) as RequestRow | undefined;
  return row ? buildPrintRequest(row) : null;
}

export function linkRequestTelegramChat(requestId: string, telegramChatId: string): PrintRequest {
  const d = getDb();
  const now = new Date().toISOString();
  d.prepare(
    `UPDATE print_requests
     SET telegram_chat_id = ?,
         updated_at = ?
     WHERE id = ?`,
  ).run(telegramChatId.trim(), now, requestId);
  const request = getRequestById(requestId);
  if (!request) throw new Error(`Request not found: ${requestId}`);
  logRequestEvent({
    requestId,
    type: 'status_changed',
    actor: 'student',
    status: request.status,
    details: { telegramLinked: true },
  });
  return request;
}

export function importOnlineRequest(args: {
  request: {
    id: string;
    ticket: string;
    studentName?: string | null;
    studentEmail?: string | null;
    telegramChatId?: string | null;
    status: RequestStatus;
    createdAt: string;
    updatedAt: string;
    priceIqd?: number;
    options?: Partial<PrintRequest['options']>;
    totalPages?: number;
  };
  files: Array<{
    filename: string;
    mimeType: string;
    sizeBytes: number;
    localPath: string;
    sha256: string;
    magicByteVerified?: boolean;
    pages?: number;
    options?: Partial<PrintRequest['options']>;
  }>;
}): PrintRequest {
  const d = getDb();
  const normalizedOptions = normalizePrintOptions(args.request.options);
  const optionsJson = JSON.stringify(normalizedOptions);
  const now = new Date().toISOString();
  const importState: OnlineImportState = 'imported';

  d.prepare(
    `INSERT INTO print_requests (
      id, ticket, student_name, student_email, telegram_chat_id, source, pickup_pin, pin_hash, status, options_json,
      total_pages, price_iqd, desk_received_at, printed_at, picked_up_at, source_of_truth,
      import_state, final_price_confirmed_at, online_files_cleanup_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      ticket = excluded.ticket,
      student_name = excluded.student_name,
      student_email = excluded.student_email,
      telegram_chat_id = excluded.telegram_chat_id,
      source = excluded.source,
      pin_hash = excluded.pin_hash,
      status = excluded.status,
      options_json = excluded.options_json,
      total_pages = excluded.total_pages,
      price_iqd = excluded.price_iqd,
      desk_received_at = excluded.desk_received_at,
      source_of_truth = excluded.source_of_truth,
      import_state = excluded.import_state,
      final_price_confirmed_at = excluded.final_price_confirmed_at,
      online_files_cleanup_at = excluded.online_files_cleanup_at,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at`
  ).run(
    args.request.id,
    args.request.ticket,
    args.request.studentName ?? null,
    args.request.studentEmail ?? null,
    args.request.telegramChatId ?? null,
    'online',
    null,
    '',
    args.request.status,
    optionsJson,
    args.request.totalPages ?? 0,
    args.request.priceIqd ?? 0,
    now,
    args.request.status === 'ready' ? now : null,
    args.request.status === 'done' ? now : null,
    'desktop',
    importState,
    args.request.priceIqd && args.request.priceIqd > 0 ? now : null,
    null,
    args.request.createdAt,
    args.request.updatedAt || now,
  );

  d.prepare('DELETE FROM request_files WHERE request_id = ?').run(args.request.id);

  const insertFile = d.prepare(
    `INSERT INTO request_files (
      id, request_id, filename, mime_type, size_bytes, local_path, sha256, magic_byte_verified, pages, options_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  for (const file of args.files) {
    insertFile.run(
      randomUUID(),
      args.request.id,
      file.filename,
      file.mimeType,
      file.sizeBytes,
      file.localPath,
      file.sha256,
      file.magicByteVerified ? 1 : 0,
      file.pages ?? 0,
      JSON.stringify(normalizePrintOptions(file.options, normalizedOptions)),
      args.request.createdAt,
    );
  }

  recalcRequestPages(args.request.id);
  logRequestEvent({
    requestId: args.request.id,
    type: 'desk_received',
    actor: 'system',
    status: args.request.status,
    details: { source: 'online' },
  });
  return getRequestById(args.request.id)!;
}

function getRequestDefaultOptions(requestId: string): PrintRequest['options'] {
  const d = getDb();
  const row = d
    .prepare('SELECT options_json FROM print_requests WHERE id = ? LIMIT 1')
    .get(requestId) as { options_json: string } | undefined;
  return normalizePrintOptions(parsePrintOptionsJson(row?.options_json));
}

export function setRequestStatus(id: string, status: RequestStatus): { ok: true } {
  const d = getDb();
  const now = new Date().toISOString();
  d.prepare(
    `UPDATE print_requests
     SET status = ?,
         updated_at = ?,
         print_queue_state = CASE WHEN ? = 'printing' THEN 'idle' ELSE print_queue_state END,
         print_queue_error = CASE WHEN ? = 'printing' THEN NULL ELSE print_queue_error END,
         print_queue_updated_at = CASE WHEN ? = 'printing' THEN ? ELSE print_queue_updated_at END,
         printed_at = CASE WHEN ? = 'ready' AND printed_at IS NULL THEN ? ELSE printed_at END,
         picked_up_at = CASE WHEN ? = 'done' AND picked_up_at IS NULL THEN ? ELSE picked_up_at END
     WHERE id = ?`,
  ).run(status, now, status, status, status, now, status, now, status, now, id);
  logRequestEvent({
    requestId: id,
    type: status === 'printing' ? 'printing_started' : status === 'ready' ? 'ready' : status === 'done' ? 'picked_up' : 'status_changed',
    actor: 'librarian',
    status,
  });
  return { ok: true };
}

export function setRequestPrintQueueState(args: {
  id: string;
  state: PrintQueueState;
  error?: string | null;
}): { ok: true } {
  const d = getDb();
  const now = new Date().toISOString();
  d.prepare(
    `UPDATE print_requests
     SET print_queue_state = ?,
         print_queue_error = ?,
         print_queue_updated_at = ?,
         updated_at = ?
     WHERE id = ?`,
  ).run(args.state, args.error ?? null, now, now, args.id);
  return { ok: true };
}

export function listRequestsNeedingQueueRecovery(): PrintRequest[] {
  const d = getDb();
  const rows = d
    .prepare(
      `SELECT r.id, r.ticket, r.student_name, r.student_email, r.telegram_chat_id, r.source, r.pickup_pin, r.pin_hash, r.status, r.options_json,
              r.total_pages, r.price_iqd, r.desk_received_at, r.printed_at, r.picked_up_at, r.source_of_truth,
              r.import_state, r.final_price_confirmed_at, r.online_files_cleanup_at, r.print_queue_state,
              r.print_queue_error, r.print_queue_updated_at,
              (SELECT COUNT(1) FROM request_files rf WHERE rf.request_id = r.id) as file_count,
              r.created_at, r.updated_at
       FROM print_requests r
       WHERE r.print_queue_state IN ('queued', 'spooling')
       ORDER BY datetime(updated_at) ASC`,
    )
    .all() as RequestRow[];
  return rows.map(buildPrintRequest);
}

export function listRequestsWithMissingLocalFiles(): Array<PrintRequest & { missingFiles: number }> {
  const d = getDb();
  const rows = d
    .prepare(
      `SELECT r.id, r.ticket, r.student_name, r.student_email, r.telegram_chat_id, r.source, r.pickup_pin, r.pin_hash, r.status, r.options_json,
              r.total_pages, r.price_iqd, r.desk_received_at, r.printed_at, r.picked_up_at, r.source_of_truth,
              r.import_state, r.final_price_confirmed_at, r.online_files_cleanup_at, r.print_queue_state,
              r.print_queue_error, r.print_queue_updated_at, COUNT(f.id) as file_count, r.created_at, r.updated_at,
              SUM(CASE WHEN f.local_path IS NOT NULL AND f.local_path != '' THEN 0 ELSE 1 END) as missing_files
       FROM print_requests r
       JOIN request_files f ON f.request_id = r.id
       GROUP BY r.id
       HAVING missing_files > 0
       ORDER BY datetime(r.updated_at) DESC`,
    )
    .all() as Array<RequestRow & { missing_files: number }>;
  return rows.map((row) => ({ ...buildPrintRequest(row), missingFiles: row.missing_files }));
}

export function setRequestPrice(id: string, priceIqd: number): { ok: true } {
  const d = getDb();
  const now = new Date().toISOString();
  d.prepare(
    'UPDATE print_requests SET price_iqd = ?, final_price_confirmed_at = ?, updated_at = ? WHERE id = ?',
  ).run(priceIqd, now, now, id);
  logRequestEvent({
    requestId: id,
    type: 'price_set',
    actor: 'librarian',
    details: { priceIqd },
  });
  return { ok: true };
}

export function setRequestWorkflowMeta(args: {
  id: string;
  sourceOfTruth?: RequestSourceOfTruth;
  importState?: OnlineImportState | null;
  deskReceivedAt?: string | null;
  printedAt?: string | null;
  pickedUpAt?: string | null;
  finalPriceConfirmedAt?: string | null;
  onlineFilesCleanupAt?: string | null;
}): { ok: true } {
  const d = getDb();
  const current = getRequestById(args.id);
  if (!current) return { ok: true };
  const now = new Date().toISOString();
  d.prepare(
    `UPDATE print_requests
     SET source_of_truth = ?,
         import_state = ?,
         desk_received_at = ?,
         printed_at = ?,
         picked_up_at = ?,
         final_price_confirmed_at = ?,
         online_files_cleanup_at = ?,
         updated_at = ?
     WHERE id = ?`,
  ).run(
    args.sourceOfTruth ?? current.sourceOfTruth ?? 'desktop',
    args.importState ?? current.importState ?? null,
    args.deskReceivedAt ?? current.deskReceivedAt ?? null,
    args.printedAt ?? current.printedAt ?? null,
    args.pickedUpAt ?? current.pickedUpAt ?? null,
    args.finalPriceConfirmedAt ?? current.finalPriceConfirmedAt ?? null,
    args.onlineFilesCleanupAt ?? current.onlineFilesCleanupAt ?? null,
    now,
    args.id,
  );
  return { ok: true };
}

export function markRequestDone(id: string): {
  ok: boolean;
  request?: PrintRequest;
  error?: string;
} {
  const request = getRequestById(id);
  if (!request) return { ok: false, error: 'not_found' };
  if (request.status !== 'ready') return { ok: false, error: 'invalid_status' };

  const now = new Date().toISOString();
  const d = getDb();
  d.prepare(
    `UPDATE print_requests
     SET status = 'done', picked_up_at = ?, updated_at = ?
     WHERE id = ?`,
  ).run(now, now, id);
  logRequestEvent({
    requestId: id,
    type: 'picked_up',
    actor: 'librarian',
    status: 'done',
  });
  return { ok: true, request: getRequestById(id)! };
}

export function addRequestFile(args: {
  requestId: string;
  localPath: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  magicByteVerified: boolean;
  pages?: number;
  options?: Partial<PrintRequest['options']>;
}): RequestFile {
  const d = getDb();
  const now = new Date().toISOString();
  const id = randomUUID();
  const pages = args.pages ?? 0;
  const options = normalizePrintOptions(args.options, getRequestDefaultOptions(args.requestId));

  d.prepare(
    `INSERT INTO request_files (
      id, request_id, filename, mime_type, size_bytes, local_path, sha256, magic_byte_verified, pages, options_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    args.requestId,
    args.filename,
    args.mimeType,
    args.sizeBytes,
    args.localPath,
    args.sha256,
    args.magicByteVerified ? 1 : 0,
    pages,
    JSON.stringify(options),
    now,
  );

  logRequestEvent({
    requestId: args.requestId,
    type: 'file_added',
    actor: 'student',
    details: { filename: args.filename, pages },
  });

  return {
    id,
    requestId: args.requestId,
    filename: args.filename,
    mimeType: args.mimeType,
    sizeBytes: args.sizeBytes,
    pages,
    options,
    storagePath: '',
    localPath: args.localPath,
    sha256: args.sha256,
    magicByteVerified: args.magicByteVerified,
  };
}

export function setRequestFileOptions(id: string, options: Partial<PrintRequest['options']>): { ok: true } {
  const d = getDb();
  const row = d
    .prepare(
      `SELECT f.request_id, f.options_json, r.options_json as request_options_json
       FROM request_files f
       JOIN print_requests r ON r.id = f.request_id
       WHERE f.id = ?
       LIMIT 1`,
    )
    .get(id) as { request_id: string; options_json: string | null; request_options_json: string | null } | undefined;
  if (!row) return { ok: true };
  const nextOptions = normalizePrintOptions(
    options,
    parsePrintOptionsJson(row.options_json ?? row.request_options_json),
  );
  d.prepare('UPDATE request_files SET options_json = ? WHERE id = ?').run(JSON.stringify(nextOptions), id);
  return { ok: true };
}

export function recalcRequestPages(requestId: string): number {
  const d = getDb();
  const row = d
    .prepare('SELECT COALESCE(SUM(pages), 0) as total FROM request_files WHERE request_id = ?')
    .get(requestId) as { total: number };
  const total = row.total;
  d.prepare('UPDATE print_requests SET total_pages = ?, updated_at = ? WHERE id = ?')
    .run(total, new Date().toISOString(), requestId);
  return total;
}

export function listStoredFilesForPageRecount(): Array<{
  id: string;
  requestId: string;
  filename: string;
  localPath: string;
  pages: number;
}> {
  const d = getDb();
  const rows = d
    .prepare(
      `SELECT id, request_id, filename, local_path, COALESCE(pages, 0) as pages
       FROM request_files
       ORDER BY datetime(created_at) ASC`,
    )
    .all() as Array<{
    id: string;
    request_id: string;
    filename: string;
    local_path: string;
    pages: number;
  }>;

  return rows.map((row) => ({
    id: row.id,
    requestId: row.request_id,
    filename: row.filename,
    localPath: row.local_path,
    pages: row.pages ?? 0,
  }));
}

export function setRequestFilePages(id: string, pages: number): { ok: true } {
  const d = getDb();
  d.prepare('UPDATE request_files SET pages = ? WHERE id = ?').run(pages, id);
  return { ok: true };
}

export function deleteRequest(id: string): { deletedFiles: number } {
  const d = getDb();
  const request = getRequestById(id);
  const files = listRequestFiles(id);
  const tx = d.transaction(() => {
    d.prepare('DELETE FROM request_files WHERE request_id = ?').run(id);
    d.prepare('DELETE FROM print_requests WHERE id = ?').run(id);
  });
  tx();
  if (request) {
    logRequestEvent({
      requestId: id,
      type: 'deleted',
      actor: 'librarian',
      status: request.status,
      details: { deletedFiles: files.length },
    });
  }
  // Best-effort disk cleanup (ignore errors)
  for (const f of files) {
    if (f.localPath) {
      try {
        unlinkSync(f.localPath);
      } catch {
        // ignore
      }
    }
  }
  return { deletedFiles: files.length };
}

export function purgeOldPinAttempts(olderThanMs: number): number {
  const d = getDb();
  const cutoff = new Date(Date.now() - olderThanMs).toISOString();
  const info = d.prepare('DELETE FROM pin_attempts WHERE created_at < ?').run(cutoff);
  return info.changes;
}

export function findAbandonedRequests(olderThanMs: number): string[] {
  const d = getDb();
  const cutoff = new Date(Date.now() - olderThanMs).toISOString();
  const rows = d
    .prepare(
      `SELECT id FROM print_requests r
       WHERE status = 'pending'
         AND created_at < ?
         AND NOT EXISTS (SELECT 1 FROM request_files f WHERE f.request_id = r.id)`,
    )
    .all(cutoff) as Array<{ id: string }>;
  return rows.map((r) => r.id);
}

export function findExpiredCompletedRequests(olderThanMs: number): string[] {
  const d = getDb();
  const cutoff = new Date(Date.now() - olderThanMs).toISOString();
  const rows = d
    .prepare(
      "SELECT id FROM print_requests WHERE status IN ('done','canceled') AND updated_at < ?",
    )
    .all(cutoff) as Array<{ id: string }>;
  return rows.map((r) => r.id);
}

export function findExpiredReadyRequests(olderThanMs: number): string[] {
  const d = getDb();
  const cutoff = new Date(Date.now() - olderThanMs).toISOString();
  const rows = d
    .prepare(
      "SELECT id FROM print_requests WHERE status = 'ready' AND updated_at < ?",
    )
    .all(cutoff) as Array<{ id: string }>;
  return rows.map((r) => r.id);
}

export function listRequestFiles(requestId: string): RequestFile[] {
  const d = getDb();
  const rows = d
    .prepare(
      `SELECT f.id, f.request_id, f.filename, f.mime_type, f.size_bytes, f.local_path, f.sha256,
              f.magic_byte_verified, f.pages, f.options_json, r.options_json as request_options_json
       FROM request_files f
       JOIN print_requests r ON r.id = f.request_id
       WHERE f.request_id = ?
       ORDER BY datetime(f.created_at) ASC`,
    )
    .all(requestId) as Array<{
    id: string;
    request_id: string;
    filename: string;
    mime_type: string;
    size_bytes: number;
    local_path: string;
    sha256: string;
    magic_byte_verified: number;
    pages: number;
    options_json: string | null;
    request_options_json: string | null;
  }>;

  return rows.map((r) => ({
    id: r.id,
    requestId: r.request_id,
    filename: r.filename,
    mimeType: r.mime_type,
    sizeBytes: r.size_bytes,
    pages: r.pages ?? 0,
    options: normalizePrintOptions(
      parsePrintOptionsJson(r.options_json),
      parsePrintOptionsJson(r.request_options_json),
    ),
    storagePath: '',
    localPath: r.local_path,
    sha256: r.sha256,
    magicByteVerified: !!r.magic_byte_verified,
  }));
}
