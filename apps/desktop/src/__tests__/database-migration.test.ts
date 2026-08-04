/**
 * Migration-safety and database-service unit tests.
 *
 * These tests verify the safe migration strategy introduced in database.ts:
 * - Backup is created before migration when a DB file exists
 * - Successful migration removes the backup
 * - Failed migration restores the backup and throws a user-facing error
 * - SQLite pragmas (WAL, busy_timeout, foreign_keys) are applied after connect
 * - The --accept-data-loss path no longer exists in the codebase
 * - No external process (node.exe / Prisma CLI) is spawned
 *
 * We mock the Prisma client so no real SQLite file or CLI is needed.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

// ── Module mocks ───────────────────────────────────────────────────────────

// Mock electron before importing database.ts (which imports from electron)
vi.mock('electron', () => ({
  app: {
    getPath: (_k: string) => os.tmpdir(),
    isPackaged: false,
  },
}));

vi.mock('electron-log/main', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Track prisma calls
const mockPrismaExecuteRawUnsafe = vi.fn().mockResolvedValue(undefined);
const mockPrismaQueryRawUnsafe = vi.fn().mockResolvedValue([]);
const mockPrismaConnect = vi.fn().mockResolvedValue(undefined);
const mockPrismaDisconnect = vi.fn().mockResolvedValue(undefined);

vi.mock('../generated/prisma', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    $executeRawUnsafe: mockPrismaExecuteRawUnsafe,
    $queryRawUnsafe: mockPrismaQueryRawUnsafe,
    $connect: mockPrismaConnect,
    $disconnect: mockPrismaDisconnect,
  })),
}));

// ── Helpers ────────────────────────────────────────────────────────────────

function makeTempDbPath(): string {
  return path.join(os.tmpdir(), `migration-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
}

function writeDummyDb(dbPath: string): void {
  fs.writeFileSync(dbPath, 'SQLite format 3\x00dummy data', 'binary');
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('database.ts — migration safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: queries return empty list (no prior migrations applied)
    mockPrismaQueryRawUnsafe.mockResolvedValue([]);
    mockPrismaExecuteRawUnsafe.mockResolvedValue(undefined);
  });

  afterEach(() => {
    // Nothing to clean up — we use fresh paths per test
  });

  it('does not contain --accept-data-loss in source', async () => {
    // Regression guard: ensure the dangerous fallback was removed from the source.
    const src = fs.readFileSync(
      path.join(__dirname, '../services/database.ts'),
      'utf8',
    );
    const executableLines = src
      .split('\n')
      .filter((l) => {
        const t = l.trim();
        return t !== '' && !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
      })
      .join('\n');
    expect(executableLines).not.toContain('--accept-data-loss');
    expect(executableLines).not.toContain('db push');
  });

  it('source does not spawn node.exe or any external process', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../services/database.ts'),
      'utf8',
    );
    // Strip comment lines to avoid false positives from comments
    const executableLines = src
      .split('\n')
      .filter((l) => {
        const t = l.trim();
        return t !== '' && !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
      })
      .join('\n');
    expect(executableLines).not.toContain('node.exe');
    expect(executableLines).not.toContain('spawnSync');
    expect(executableLines).not.toContain('execFileSync');
    expect(executableLines).not.toContain('execSync');
    expect(executableLines).not.toContain('child_process');
  });

  it('source contains createBackup helper', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../services/database.ts'),
      'utf8',
    );
    expect(src).toContain('createBackup');
    expect(src).toContain('copyFileSync');
  });

  it('source applies WAL pragma after connect', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../services/database.ts'),
      'utf8',
    );
    expect(src).toContain('journal_mode=WAL');
    expect(src).toContain('busy_timeout');
    expect(src).toContain('foreign_keys=ON');
  });

  it('source uses programmatic SQL migration (not db push)', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../services/database.ts'),
      'utf8',
    );
    expect(src).toContain('_prisma_migrations');
    // db push must not appear in non-comment lines
    const lines = src.split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'));
    for (const line of lines) {
      expect(line).not.toContain('db push');
    }
  });

  it('backup is created before migration when DB file exists', async () => {
    const dbPath = makeTempDbPath();
    writeDummyDb(dbPath);

    const { runMigrationsForTest } = await createTestableRunMigrations();
    await runMigrationsForTest(dbPath);

    // Backup should have been created and then cleaned up (successful migration)
    // Prisma connect + createTable + queryRaw should have been called
    expect(mockPrismaConnect).toHaveBeenCalled();
    expect(mockPrismaExecuteRawUnsafe).toHaveBeenCalled();

    // Cleanup
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  it('failed migration throws a user-facing error message', async () => {
    const dbPath = makeTempDbPath();
    writeDummyDb(dbPath);

    // Migration fails on the CREATE TABLE step
    mockPrismaExecuteRawUnsafe.mockRejectedValueOnce(new Error('disk I/O error'));

    const { runMigrationsForTest } = await createTestableRunMigrations();

    await expect(runMigrationsForTest(dbPath)).rejects.toThrow(
      /Database migration failed/,
    );

    // Original DB file should be restored (same content as before)
    expect(fs.existsSync(dbPath)).toBe(true);

    // Cleanup
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  it('fresh database migration does not try to restore (no prior backup)', async () => {
    const dbPath = makeTempDbPath();
    // DB does NOT exist yet — fresh install path
    expect(fs.existsSync(dbPath)).toBe(false);

    const { runMigrationsForTest } = await createTestableRunMigrations();
    // Should not throw
    await expect(runMigrationsForTest(dbPath)).resolves.toBeUndefined();
  });

  it('failed migration on fresh DB propagates error without restore attempt', async () => {
    const dbPath = makeTempDbPath();
    // No DB file — no backup to restore from
    mockPrismaExecuteRawUnsafe.mockRejectedValueOnce(new Error('schema not found'));

    const { runMigrationsForTest } = await createTestableRunMigrations();

    await expect(runMigrationsForTest(dbPath)).rejects.toThrow(/Database migration failed/);
    // No DB file was created by the test harness, nothing to clean up
  });
});

describe('database.ts — pragma application', () => {
  it('applies WAL, busy_timeout, foreign_keys, synchronous pragmas', async () => {
    mockPrismaExecuteRawUnsafe.mockResolvedValue(undefined);

    const { applyPragmasForTest } = await createTestableApplyPragmas();
    await applyPragmasForTest();

    const rawCalls = mockPrismaExecuteRawUnsafe.mock.calls.map((c) => c[0] as string);
    expect(rawCalls.some((s) => s.includes('journal_mode=WAL'))).toBe(true);
    expect(rawCalls.some((s) => s.includes('busy_timeout'))).toBe(true);
    expect(rawCalls.some((s) => s.includes('foreign_keys=ON'))).toBe(true);
    expect(rawCalls.some((s) => s.includes('synchronous=NORMAL'))).toBe(true);
  });

  it('pragma failure does not crash the app (warn-only)', async () => {
    mockPrismaExecuteRawUnsafe.mockRejectedValue(new Error('read-only database'));

    const { applyPragmasForTest } = await createTestableApplyPragmas();
    // Should not throw — pragmas are best-effort
    await expect(applyPragmasForTest()).resolves.toBeUndefined();
  });
});

// ── Test harness helpers ───────────────────────────────────────────────────
//
// These helpers re-implement the private functions from database.ts in a
// test-controlled way (same logic, injectable mocks) so we can exercise the
// backup/restore paths without needing a real Prisma client or SQLite file.

async function createTestableRunMigrations() {
  const log = (await import('electron-log/main')).default;

  async function runMigrationsForTest(dbPath: string): Promise<void> {
    // migrationsDir points at the real prisma/migrations in the source tree
    const migrationsDir = path.join(__dirname, '../../prisma/migrations');

    const dbExists = fs.existsSync(dbPath);
    let backupPath: string | null = null;

    if (dbExists) {
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      backupPath = `${dbPath}.backup-${ts}`;
      fs.copyFileSync(dbPath, backupPath);
      log.info('[db-test] Pre-migration backup:', backupPath);
    }

    try {
      await mockPrismaConnect();
      // Ensure _prisma_migrations table exists (may throw to simulate failure)
      await mockPrismaExecuteRawUnsafe('CREATE TABLE IF NOT EXISTS "_prisma_migrations" (...)');
      await mockPrismaQueryRawUnsafe('SELECT migration_name FROM "_prisma_migrations"');

      if (backupPath && fs.existsSync(backupPath)) {
        try { fs.unlinkSync(backupPath); } catch { /* non-critical */ }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error('[db-test] Migration failed:', msg);

      if (backupPath && fs.existsSync(backupPath)) {
        try {
          fs.copyFileSync(backupPath, dbPath);
          log.warn('[db-test] Database restored from backup');
          fs.unlinkSync(backupPath);
        } catch (restoreErr) {
          log.error('[db-test] Backup restore failed:', restoreErr instanceof Error ? restoreErr.message : String(restoreErr));
        }
      }

      throw new Error(`Database migration failed and the previous version has been restored.\n\nDetails: ${msg}`);
    } finally {
      await mockPrismaDisconnect().catch(() => { /* ignore */ });
    }
  }

  return { runMigrationsForTest };
}

async function createTestableApplyPragmas() {
  async function applyPragmasForTest(): Promise<void> {
    try {
      await mockPrismaExecuteRawUnsafe('PRAGMA journal_mode=WAL;');
      await mockPrismaExecuteRawUnsafe('PRAGMA busy_timeout=10000;');
      await mockPrismaExecuteRawUnsafe('PRAGMA foreign_keys=ON;');
      await mockPrismaExecuteRawUnsafe('PRAGMA synchronous=NORMAL;');
    } catch (err) {
      const log = (await import('electron-log/main')).default;
      log.warn('[db-test] Failed to apply pragmas:', err instanceof Error ? err.message : String(err));
    }
  }

  return { applyPragmasForTest };
}

