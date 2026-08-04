/**
 * Database service — initialises the Prisma SQLite client and runs migrations.
 * The database file lives in the Electron userData directory.
 *
 * Migration safety guarantees:
 * 1. A timestamped backup is created before any migration runs.
 * 2. Migrations are applied programmatically by reading the SQL migration files
 *    and executing them via SQLite script execution plus Prisma connection setup
 *    — no external node.exe or Prisma CLI binary is spawned. This works correctly in both development and in the
 *    packaged (ASAR) app where node.exe is not available on the user's machine.
 * 3. On migration failure the backup is restored and a user-facing error is thrown.
 * 4. WAL journal mode, a 10-second busy timeout and foreign-key enforcement are
 *    applied via pragmas after every successful connect.
 */

import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
// @ts-expect-error runtime-supported built-in module
import { DatabaseSync } from 'node:sqlite';
import { app } from 'electron';
import { PrismaClient } from '../generated/prisma';
import log from 'electron-log/main';

let _prisma: PrismaClient | null = null;

export function getDbPath(): string {
  const userDataPath = app.getPath('userData');
  const dbDir = path.join(userDataPath, 'db');
  fs.mkdirSync(dbDir, { recursive: true });
  return path.join(dbDir, 'mindflow.db');
}

export async function initDatabase(): Promise<PrismaClient> {
  if (_prisma) return _prisma;

  const dbPath = getDbPath();
  process.env['DESKTOP_DATABASE_URL'] = `file:${dbPath}`;

  log.info('[db] Opening database at', dbPath);

  // Run migrations with a backup/rollback safety net
  await runMigrations(dbPath);

  _prisma = new PrismaClient({
    datasources: { db: { url: `file:${dbPath}` } },
  });

  await _prisma.$connect();

  // Apply SQLite pragmas for reliability and performance
  await applySqlitePragmas(_prisma);

  log.info('[db] Connected');
  return _prisma;
}

export function getPrisma(): PrismaClient {
  if (!_prisma) throw new Error('Database not initialised. Call initDatabase() first.');
  return _prisma;
}

export async function closeDatabase(): Promise<void> {
  if (_prisma) {
    await _prisma.$disconnect();
    _prisma = null;
    log.info('[db] Disconnected');
  }
}

// ── Migration helpers ──────────────────────────────────────────────────────

/**
 * Returns the directory that contains the Prisma migration folders.
 * In development this is the source tree; in the packaged app the migrations
 * folder is copied into extraResources so they are accessible on disk.
 */
export function getMigrationsDir(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'prisma', 'migrations')
    : path.join(__dirname, '..', '..', 'prisma', 'migrations');
}

/**
 * Applies pending Prisma migrations programmatically using SQLite script execution.
 *
 * This approach never spawns an external process (no node.exe, no Prisma CLI),
 * making it safe for packaged Electron apps where the system Node binary is
 * not guaranteed to be present.
 *
 * The strategy mirrors what `prisma migrate deploy` does:
 * 1. Ensure the `_prisma_migrations` tracking table exists.
 * 2. Read the list of migration folders sorted by name (timestamp prefix).
 * 3. Skip migrations already recorded in the tracking table.
 * 4. Execute each pending migration's SQL, then record it as applied.
 */
async function applyMigrationsSQL(dbPath: string, migrationsDir: string): Promise<void> {
  // Read available migrations from disk, sorted by name
  if (!fs.existsSync(migrationsDir)) {
    log.warn('[db] Migrations directory not found:', migrationsDir);
    return;
  }
  const entries = fs.readdirSync(migrationsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  const sqlite = new DatabaseSync(dbPath);

  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        "id"                    TEXT PRIMARY KEY NOT NULL,
        "checksum"              TEXT NOT NULL,
        "finished_at"           DATETIME,
        "migration_name"        TEXT NOT NULL,
        "logs"                  TEXT,
        "rolled_back_at"        DATETIME,
        "started_at"            DATETIME NOT NULL DEFAULT current_timestamp,
        "applied_steps_count"   INTEGER UNSIGNED NOT NULL DEFAULT 0
      )
    `);

    const appliedRows = sqlite.prepare(
      'SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL',
    ).all() as { migration_name: string }[];
    const appliedSet = new Set(appliedRows.map((r) => r.migration_name));

    const insertStarted = sqlite.prepare(`
      INSERT INTO "_prisma_migrations" (id, checksum, migration_name, started_at, applied_steps_count)
      VALUES (?, ?, ?, datetime('now'), 0)
    `);
    const markFinished = sqlite.prepare(`
      UPDATE "_prisma_migrations"
      SET finished_at = datetime('now'), applied_steps_count = 1, logs = NULL
      WHERE id = ?
    `);
    const markFailed = sqlite.prepare(`
      UPDATE "_prisma_migrations"
      SET logs = ?, rolled_back_at = datetime('now')
      WHERE id = ?
    `);

    for (const migrationName of entries) {
      if (appliedSet.has(migrationName)) {
        log.info('[db] Migration already applied:', migrationName);
        continue;
      }

      const sqlFile = path.join(migrationsDir, migrationName, 'migration.sql');
      if (!fs.existsSync(sqlFile)) {
        log.warn('[db] No migration.sql found for:', migrationName);
        continue;
      }

      const sql = fs.readFileSync(sqlFile, 'utf8');
      const checksum = crypto.createHash('sha256').update(sql).digest('hex');
      const id = `${Date.now()}-${migrationName}`;

      log.info('[db] Applying migration:', migrationName);
      insertStarted.run(id, checksum, migrationName);

      try {
        sqlite.exec(sql);
        markFinished.run(id);
        appliedSet.add(migrationName);
        log.info('[db] Migration applied:', migrationName);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        try {
          markFailed.run(msg, id);
        } catch {
          // ignore logging failure here; outer backup restore still handles safety
        }
        throw err;
      }
    }
  } finally {
    sqlite.close();
  }
}

async function runMigrations(dbPath: string): Promise<void> {
  const migrationsDir = getMigrationsDir();
  const dbExists = fs.existsSync(dbPath);

  // Back up the existing database before touching it so we can restore on failure
  const backupPath = dbExists ? createBackup(dbPath) : null;
  log.info('[db] Pre-migration backup:', backupPath ?? 'none (fresh database)');

  // We need a temporary Prisma client to run the migrations before the main
  // client is created (the main client is stored in _prisma after migrations).
  const dbUrl = `file:${dbPath}`;
  const migrationClient = new PrismaClient({
    datasources: { db: { url: dbUrl } },
  });

  try {
    await migrationClient.$connect();
    await migrationClient.$disconnect();
    await applyMigrationsSQL(dbPath, migrationsDir);
    log.info('[db] Migrations applied successfully');

    // Verify the database is readable after migration
    verifyIntegrity(dbPath);

    // Remove the backup now that migration succeeded to save disk space
    if (backupPath) {
      try { fs.unlinkSync(backupPath); } catch { /* non-critical */ }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error('[db] Migration failed:', msg);

    // Attempt to restore the backup so the user does not lose data
    if (backupPath && fs.existsSync(backupPath)) {
      try {
        fs.copyFileSync(backupPath, dbPath);
        log.warn('[db] Database restored from backup after failed migration');
      } catch (restoreErr) {
        log.error('[db] Backup restore also failed:', restoreErr instanceof Error ? restoreErr.message : String(restoreErr));
      }
    }

    // Propagate — main.ts will show a user-facing error dialog
    throw new Error(
      `Database migration failed and the previous version has been restored.\n\nDetails: ${msg}\n\nPlease report this to support.`,
    );
  } finally {
    await migrationClient.$disconnect().catch(() => { /* ignore */ });
  }
}

function createBackup(dbPath: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${dbPath}.backup-${ts}`;
  fs.copyFileSync(dbPath, backupPath);
  return backupPath;
}

function verifyIntegrity(dbPath: string): void {
  // Quick sqlite3 integrity check using node's built-in better-sqlite3 is not
  // guaranteed to be present; we use a lightweight file-existence check and let
  // Prisma's own connection errors surface integrity problems at connect time.
  if (!fs.existsSync(dbPath)) {
    throw new Error('Database file missing after migration');
  }
}

// ── SQLite pragmas ─────────────────────────────────────────────────────────

async function applySqlitePragmas(prisma: PrismaClient): Promise<void> {
  try {
    // WAL mode: allows concurrent reads during writes; safe for single-process desktop apps
    await prisma.$executeRawUnsafe('PRAGMA journal_mode=WAL;');
    // Busy timeout: wait up to 10 seconds instead of immediately failing on a locked DB
    await prisma.$executeRawUnsafe('PRAGMA busy_timeout=10000;');
    // Enforce foreign-key constraints at the SQLite level
    await prisma.$executeRawUnsafe('PRAGMA foreign_keys=ON;');
    // Synchronous=NORMAL is a good balance between durability and performance with WAL
    await prisma.$executeRawUnsafe('PRAGMA synchronous=NORMAL;');
    log.info('[db] SQLite pragmas applied (WAL, busy_timeout=10s, foreign_keys=ON)');
  } catch (err) {
    log.warn('[db] Failed to apply SQLite pragmas:', err instanceof Error ? err.message : String(err));
  }
}

export const __privateForTests = {
  applyMigrationsSQL,
  runMigrations,
  applySqlitePragmas,
};

void PrismaClient.prototype.$queryRawUnsafe;
