import Database from 'better-sqlite3';
import { mkdirSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { PrintRequest, RequestFile, RequestStatus } from '@uoadrop/shared';
import { PIN_BCRYPT_ROUNDS, PIN_LENGTH } from '@uoadrop/shared';
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
  const rows = d.prepare(`PRAGMA table_info(print_requests)`).all() as Array<{ name: string }>;
  const columns = rows.map((row) => row.name);
  if (!columns.includes('pickup_pin')) {
    d.exec(`ALTER TABLE print_requests ADD COLUMN pickup_pin TEXT`);
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
      pin_hash TEXT NOT NULL,
      status TEXT NOT NULL,
      options_json TEXT NOT NULL,
      total_pages INTEGER NOT NULL,
      price_iqd INTEGER NOT NULL,
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

    CREATE INDEX IF NOT EXISTS idx_request_files_request_id ON request_files(request_id);
    CREATE INDEX IF NOT EXISTS idx_print_requests_status ON print_requests(status);
    CREATE INDEX IF NOT EXISTS idx_pin_attempts_scope_time ON pin_attempts(scope, created_at);
    CREATE INDEX IF NOT EXISTS idx_printer_events_created_at ON printer_events(created_at);
  `);

  ensureRequestFilesPagesColumn(d);
  ensureRequestFilesOptionsColumn(d);
  ensurePrintRequestsPickupPinColumn(d);
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

export function ensureLibrarianPin(): { generatedPin: string | null } {
  // If env override is set, trust it and mirror into settings.
  const envHash = process.env.LIBRARIAN_PIN_HASH;
  if (envHash && envHash.length > 0) {
    setSetting(LIBRARIAN_PIN_KEY, envHash);
    return { generatedPin: null };
  }

  const existing = getSetting(LIBRARIAN_PIN_KEY);
  if (existing) return { generatedPin: null };

  const pin = generatePin();
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

export function verifyStudentPinByTicket(
  ticket: string,
  pin: string,
): { ok: boolean; requestId: string | null; status: RequestStatus | null } {
  const d = getDb();
  const row = d
    .prepare('SELECT id, pin_hash, status FROM print_requests WHERE ticket = ?')
    .get(ticket) as { id: string; pin_hash: string; status: RequestStatus } | undefined;
  if (!row) return { ok: false, requestId: null, status: null };
  const ok = bcrypt.compareSync(pin, row.pin_hash);
  return { ok, requestId: row.id, status: row.status };
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

function generatePin(): string {
  let out = '';
  for (let i = 0; i < PIN_LENGTH; i++) out += Math.floor(Math.random() * 10).toString();
  return out;
}

export function createRequest(args: {
  studentName: string;
  options: PrintRequest['options'];
  totalPages: number;
  priceIqd: number;
}): { request: PrintRequest; pin: string } {
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

  const pin = generatePin();
  const pinHash = bcrypt.hashSync(pin, PIN_BCRYPT_ROUNDS);

  const normalizedOptions = normalizePrintOptions(args.options);
  const optionsJson = JSON.stringify(normalizedOptions);
  const status: RequestStatus = 'pending';

  d.prepare(
    `INSERT INTO print_requests (
      id, ticket, student_name, pickup_pin, pin_hash, status, options_json,
      total_pages, price_iqd, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    ticket,
    args.studentName ?? null,
    pin,
    pinHash,
    status,
    optionsJson,
    args.totalPages,
    args.priceIqd,
    now,
    now,
  );

  const request: PrintRequest = {
    id,
    ticket,
    studentName: args.studentName,
    pickupPin: pin,
    pinHash,
    status,
    options: normalizedOptions,
    totalPages: args.totalPages,
    priceIqd: args.priceIqd,
    createdAt: now,
    updatedAt: now,
  };

  return { request, pin };
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
      `SELECT id, ticket, student_name, pickup_pin, pin_hash, status, options_json, total_pages, price_iqd, created_at, updated_at
       FROM print_requests
       ${whereSql}
       ORDER BY datetime(created_at) DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset) as Array<{
    id: string;
    ticket: string;
    student_name: string | null;
    pickup_pin: string | null;
    pin_hash: string;
    status: RequestStatus;
    options_json: string;
    total_pages: number;
    price_iqd: number;
    created_at: string;
    updated_at: string;
  }>;

  const items: PrintRequest[] = rows.map((r) => ({
    id: r.id,
    ticket: r.ticket,
    studentName: r.student_name ?? undefined,
    pickupPin: r.pickup_pin ?? undefined,
    pinHash: r.pin_hash,
    status: r.status,
    options: normalizePrintOptions(parsePrintOptionsJson(r.options_json)),
    totalPages: r.total_pages,
    priceIqd: r.price_iqd,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));

  return { items, total: totalRow.c };
}

export function listRequests(): PrintRequest[] {
  const d = getDb();
  const rows = d
    .prepare(
      `SELECT id, ticket, student_name, pickup_pin, pin_hash, status, options_json, total_pages, price_iqd, created_at, updated_at
       FROM print_requests
       ORDER BY datetime(created_at) DESC`,
    )
    .all() as Array<{
    id: string;
    ticket: string;
    student_name: string | null;
    pickup_pin: string | null;
    pin_hash: string;
    status: RequestStatus;
    options_json: string;
    total_pages: number;
    price_iqd: number;
    created_at: string;
    updated_at: string;
  }>;

  return rows.map((r) => ({
    id: r.id,
    ticket: r.ticket,
    studentName: r.student_name ?? undefined,
    pickupPin: r.pickup_pin ?? undefined,
    pinHash: r.pin_hash,
    status: r.status,
    options: normalizePrintOptions(parsePrintOptionsJson(r.options_json)),
    totalPages: r.total_pages,
    priceIqd: r.price_iqd,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export function getRequestById(id: string): PrintRequest | null {
  const d = getDb();
  const row = d
    .prepare(
      `SELECT id, ticket, student_name, pickup_pin, pin_hash, status, options_json, total_pages, price_iqd, created_at, updated_at
       FROM print_requests
       WHERE id = ?
       LIMIT 1`,
    )
    .get(id) as {
    id: string;
    ticket: string;
    student_name: string | null;
    pickup_pin: string | null;
    pin_hash: string;
    status: RequestStatus;
    options_json: string;
    total_pages: number;
    price_iqd: number;
    created_at: string;
    updated_at: string;
  } | undefined;

  if (!row) return null;

  return {
    id: row.id,
    ticket: row.ticket,
    studentName: row.student_name ?? undefined,
    pickupPin: row.pickup_pin ?? undefined,
    pinHash: row.pin_hash,
    status: row.status,
    options: normalizePrintOptions(parsePrintOptionsJson(row.options_json)),
    totalPages: row.total_pages,
    priceIqd: row.price_iqd,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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
  d.prepare('UPDATE print_requests SET status = ?, updated_at = ? WHERE id = ?').run(status, now, id);
  return { ok: true };
}

export function setRequestPrice(id: string, priceIqd: number): { ok: true } {
  const d = getDb();
  const now = new Date().toISOString();
  d.prepare('UPDATE print_requests SET price_iqd = ?, updated_at = ? WHERE id = ?').run(priceIqd, now, id);
  return { ok: true };
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
  const files = listRequestFiles(id);
  const tx = d.transaction(() => {
    d.prepare('DELETE FROM request_files WHERE request_id = ?').run(id);
    d.prepare('DELETE FROM print_requests WHERE id = ?').run(id);
  });
  tx();
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
