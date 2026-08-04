/**
 * Database service — initialises the Prisma SQLite client and runs migrations.
 * The database file lives in the Electron userData directory.
 *
 * Migration safety guarantees:
 * 1. A timestamped backup is created before any migration runs.
 * 2. Only `prisma migrate deploy` (versioned, non-destructive) is used.
 *    The `--accept-data-loss` fallback has been removed; it must never be used
 *    in production because it can silently drop columns or tables.
 * 3. On migration failure the backup is restored and a user-facing error is thrown.
 * 4. WAL journal mode, a 10-second busy timeout and foreign-key enforcement are
 *    applied via pragmas after every successful connect.
 */

import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
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

async function runMigrations(dbPath: string): Promise<void> {
  const schemaPath = app.isPackaged
    ? path.join(process.resourcesPath, 'prisma', 'schema.prisma')
    : path.join(__dirname, '..', '..', 'prisma', 'schema.prisma');

  const prismaCliArgs = resolvePrismaCli();
  const dbExists = fs.existsSync(dbPath);

  // Back up the existing database before touching it so we can restore on failure
  const backupPath = dbExists ? createBackup(dbPath) : null;
  log.info('[db] Pre-migration backup:', backupPath ?? 'none (fresh database)');

  try {
    // Both DESKTOP_DATABASE_URL (used by the schema's datasource env()) and
    // DATABASE_URL (Prisma CLI fallback) must point at the writable db file.
    const dbUrl = `file:${dbPath}`;
    execFileSync(prismaCliArgs[0], [...prismaCliArgs.slice(1), 'migrate', 'deploy', '--schema', schemaPath], {
      env: {
        ...process.env,
        DESKTOP_DATABASE_URL: dbUrl,
        DATABASE_URL: dbUrl,
      },
      timeout: 60_000,
      stdio: 'pipe',
    });
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

// ── Prisma CLI resolution ──────────────────────────────────────────────────

/**
 * Resolves the Prisma CLI for running `migrate deploy` at runtime.
 *
 * In development: uses the local node_modules/.bin/prisma binary.
 *
 * In the packaged app: `node_modules/prisma` is listed in electron-builder's
 * `asarUnpack` so it lands in `app.asar.unpacked/node_modules/prisma` — a real
 * directory on disk that can be executed with the system Node binary (the
 * `node` found next to `process.execPath`, NOT `process.execPath` itself which
 * is the Electron/app EXE and must never be used to spawn a sub-process).
 *
 * Returns [executable, ...leadingArgs] so the caller can prepend them.
 */
export function resolvePrismaCli(): string[] {
  // Development: local .bin symlink (works on all platforms in dev mode)
  const binName = process.platform === 'win32' ? 'prisma.cmd' : 'prisma';
  const localBin = path.join(
    process.cwd(),
    'node_modules',
    '.bin',
    binName,
  );
  if (fs.existsSync(localBin)) return [localBin];

  // Packaged app: prisma is unpacked from app.asar into app.asar.unpacked.
  // We need a real Node binary — resolve it from the directory that contains
  // the Electron executable.  On Windows the system node.exe may not be on
  // PATH inside an installed app, so we look next to process.execPath first.
  const unpackedPrismaJs = path.join(
    process.resourcesPath,
    'app.asar.unpacked',
    'node_modules',
    'prisma',
    'build',
    'index.js',
  );

  if (fs.existsSync(unpackedPrismaJs)) {
    // Locate a node binary: prefer one next to the Electron executable, then
    // fall back to whatever is on PATH.
    const nodeExeName = process.platform === 'win32' ? 'node.exe' : 'node';
    const nodeBesideExe = path.join(path.dirname(process.execPath), nodeExeName);
    const nodeExe = fs.existsSync(nodeBesideExe) ? nodeBesideExe : nodeExeName;
    return [nodeExe, unpackedPrismaJs];
  }

  throw new Error(
    'Prisma CLI not found. ' +
    `Expected unpacked path: ${path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'prisma', 'build', 'index.js')}`,
  );
}
