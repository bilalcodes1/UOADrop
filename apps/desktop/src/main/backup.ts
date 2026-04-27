import { existsSync, mkdirSync, readdirSync, unlinkSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { app } from 'electron';
import { getDb } from './db';

const MAX_BACKUPS = 7; // keep last 7 daily backups
const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

let backupTimer: ReturnType<typeof setInterval> | null = null;

function getBackupDir(): string {
  if (app.isPackaged) return join(app.getPath('userData'), 'backups');
  return join(process.cwd(), 'data', 'backups');
}

function getDbPathFromConnection(): string {
  const db = getDb();
  const row = db.pragma('database_list') as Array<{ file: string }>;
  return row[0]?.file ?? '';
}

export function runBackup(): string | null {
  try {
    const dbPath = getDbPathFromConnection();
    if (!dbPath || !existsSync(dbPath)) return null;

    const backupDir = getBackupDir();
    mkdirSync(backupDir, { recursive: true });

    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const dest = join(backupDir, `uoadrop-${ts}.db`);

    // Use SQLite VACUUM INTO for a consistent backup
    const db = getDb();
    db.exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);

    // eslint-disable-next-line no-console
    console.log(`[UOADrop] Backup created: ${dest}`);

    // Prune old backups
    pruneOldBackups(backupDir);

    return dest;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[UOADrop] Backup failed:', err);
    return null;
  }
}

function pruneOldBackups(backupDir: string): void {
  try {
    const files = readdirSync(backupDir)
      .filter((f) => f.startsWith('uoadrop-') && f.endsWith('.db'))
      .sort()
      .reverse();

    for (const old of files.slice(MAX_BACKUPS)) {
      unlinkSync(join(backupDir, old));
      // eslint-disable-next-line no-console
      console.log(`[UOADrop] Pruned old backup: ${old}`);
    }
  } catch { /* ignore */ }
}

export function startAutoBackup(): void {
  // Run first backup after 30 seconds (let app initialize)
  setTimeout(() => runBackup(), 30_000);

  // Then every 24 hours
  backupTimer = setInterval(() => runBackup(), BACKUP_INTERVAL_MS);
}

export function stopAutoBackup(): void {
  if (backupTimer) {
    clearInterval(backupTimer);
    backupTimer = null;
  }
}
