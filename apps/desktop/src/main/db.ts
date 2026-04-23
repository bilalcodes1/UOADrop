import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { PrintRequest, RequestFile, RequestStatus } from '@uoadrop/shared';
import { PIN_BCRYPT_ROUNDS, PIN_LENGTH } from '@uoadrop/shared';
import bcrypt from 'bcryptjs';

let db: Database.Database | null = null;

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

    CREATE INDEX IF NOT EXISTS idx_request_files_request_id ON request_files(request_id);
    CREATE INDEX IF NOT EXISTS idx_print_requests_status ON print_requests(status);
    CREATE INDEX IF NOT EXISTS idx_pin_attempts_scope_time ON pin_attempts(scope, created_at);
  `);
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

export function seedIfEmpty(): { seeded: boolean; count: number } {
  const d = getDb();
  const count = d.prepare('SELECT COUNT(1) as c FROM print_requests').get() as { c: number };
  if (count.c > 0) return { seeded: false, count: count.c };

  const now = new Date().toISOString();

  const insertReq = d.prepare(`
    INSERT INTO print_requests (
      id, ticket, student_name, pin_hash, status, options_json,
      total_pages, price_iqd, created_at, updated_at
    ) VALUES (
      @id, @ticket, @student_name, @pin_hash, @status, @options_json,
      @total_pages, @price_iqd, @created_at, @updated_at
    )
  `);

  const rows: Array<Omit<PrintRequest, 'options'> & { options_json: string }> = [
    {
      id: 'req-001',
      ticket: 'A7K9',
      studentName: 'ملاك أحمد',
      pinHash: '$2b$12$seed',
      status: 'pending',
      options_json: JSON.stringify({ copies: 2, color: false, doubleSided: true }),
      totalPages: 14,
      priceIqd: 2800,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'req-002',
      ticket: 'B3M1',
      studentName: 'بلال علي',
      pinHash: '$2b$12$seed',
      status: 'printing',
      options_json: JSON.stringify({ copies: 1, color: true, doubleSided: false }),
      totalPages: 8,
      priceIqd: 2000,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'req-003',
      ticket: 'C9F4',
      studentName: 'سارة محمد',
      pinHash: '$2b$12$seed',
      status: 'ready',
      options_json: JSON.stringify({ copies: 3, color: false, doubleSided: true }),
      totalPages: 22,
      priceIqd: 6600,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const tx = d.transaction(() => {
    for (const r of rows) {
      insertReq.run({
        id: r.id,
        ticket: r.ticket,
        student_name: r.studentName ?? null,
        pin_hash: r.pinHash,
        status: r.status,
        options_json: r.options_json,
        total_pages: r.totalPages,
        price_iqd: r.priceIqd,
        created_at: r.createdAt,
        updated_at: r.updatedAt,
      });
    }
  });

  tx();
  return { seeded: true, count: rows.length };
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
  studentName?: string;
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

  const optionsJson = JSON.stringify(args.options);
  const status: RequestStatus = 'pending';

  d.prepare(
    `INSERT INTO print_requests (
      id, ticket, student_name, pin_hash, status, options_json,
      total_pages, price_iqd, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    ticket,
    args.studentName ?? null,
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
    pinHash,
    status,
    options: args.options,
    totalPages: args.totalPages,
    priceIqd: args.priceIqd,
    createdAt: now,
    updatedAt: now,
  };

  return { request, pin };
}

export function listRequests(): PrintRequest[] {
  const d = getDb();
  const rows = d
    .prepare(
      `SELECT id, ticket, student_name, pin_hash, status, options_json, total_pages, price_iqd, created_at, updated_at
       FROM print_requests
       ORDER BY datetime(created_at) DESC`,
    )
    .all() as Array<{
    id: string;
    ticket: string;
    student_name: string | null;
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
    pinHash: r.pin_hash,
    status: r.status,
    options: JSON.parse(r.options_json) as PrintRequest['options'],
    totalPages: r.total_pages,
    priceIqd: r.price_iqd,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export function setRequestStatus(id: string, status: RequestStatus): { ok: true } {
  const d = getDb();
  const now = new Date().toISOString();
  d.prepare('UPDATE print_requests SET status = ?, updated_at = ? WHERE id = ?').run(status, now, id);
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
}): RequestFile {
  const d = getDb();
  const now = new Date().toISOString();
  const id = randomUUID();

  d.prepare(
    `INSERT INTO request_files (
      id, request_id, filename, mime_type, size_bytes, local_path, sha256, magic_byte_verified, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    args.requestId,
    args.filename,
    args.mimeType,
    args.sizeBytes,
    args.localPath,
    args.sha256,
    args.magicByteVerified ? 1 : 0,
    now,
  );

  return {
    id,
    requestId: args.requestId,
    filename: args.filename,
    mimeType: args.mimeType,
    sizeBytes: args.sizeBytes,
    storagePath: '',
    localPath: args.localPath,
    sha256: args.sha256,
    magicByteVerified: args.magicByteVerified,
  };
}

export function listRequestFiles(requestId: string): RequestFile[] {
  const d = getDb();
  const rows = d
    .prepare(
      `SELECT id, request_id, filename, mime_type, size_bytes, local_path, sha256, magic_byte_verified
       FROM request_files
       WHERE request_id = ?
       ORDER BY datetime(created_at) ASC`,
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
  }>;

  return rows.map((r) => ({
    id: r.id,
    requestId: r.request_id,
    filename: r.filename,
    mimeType: r.mime_type,
    sizeBytes: r.size_bytes,
    storagePath: '',
    localPath: r.local_path,
    sha256: r.sha256,
    magicByteVerified: !!r.magic_byte_verified,
  }));
}
