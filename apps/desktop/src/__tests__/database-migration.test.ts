import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

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

const mockPrismaExecuteRawUnsafe = vi.fn().mockResolvedValue(undefined);
const mockPrismaConnect = vi.fn().mockResolvedValue(undefined);
const mockPrismaDisconnect = vi.fn().mockResolvedValue(undefined);

vi.mock('../generated/prisma', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    $executeRawUnsafe: mockPrismaExecuteRawUnsafe,
    $queryRawUnsafe: vi.fn().mockResolvedValue([]),
    $connect: mockPrismaConnect,
    $disconnect: mockPrismaDisconnect,
  })),
}));

function makeTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
}

function makeTempDbPath(): string {
  return path.join(makeTempDir('migration-db'), 'mindflow.db');
}

function writeDummyDb(dbPath: string): void {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('CREATE TABLE keep_me(value TEXT); INSERT INTO keep_me(value) VALUES (\'before\');');
  db.close();
}

function writeMigration(migrationsDir: string, name: string, sql: string): void {
  const dir = path.join(migrationsDir, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'migration.sql'), sql, 'utf8');
}

async function loadDatabaseModule() {
  return import('../services/database');
}

describe('database.ts migration runner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrismaExecuteRawUnsafe.mockResolvedValue(undefined);
    mockPrismaConnect.mockResolvedValue(undefined);
    mockPrismaDisconnect.mockResolvedValue(undefined);
  });

  it('does not contain naive semicolon splitting in source', async () => {
    const src = fs.readFileSync(path.join(__dirname, '../services/database.ts'), 'utf8');
    expect(src).not.toContain(".split(';')");
    expect(src).toContain('sqlite.exec(sql)');
  });

  it('applies full migration scripts with BEGIN/COMMIT, PRAGMA, triggers, and semicolons in strings', async () => {
    const dbPath = makeTempDbPath();
    const migrationsDir = makeTempDir('migrations');
    writeMigration(migrationsDir, '20260804123314_init', `
      -- comment with semicolon ;
      PRAGMA foreign_keys=OFF;
      BEGIN;
      CREATE TABLE "notes" (
        "id" INTEGER PRIMARY KEY,
        "body" TEXT NOT NULL
      );
      CREATE TABLE "audit" (
        "id" INTEGER PRIMARY KEY,
        "noteId" INTEGER NOT NULL,
        "message" TEXT NOT NULL
      );
      CREATE TRIGGER "notes_audit_insert" AFTER INSERT ON "notes" BEGIN
        INSERT INTO "audit" ("noteId", "message")
        VALUES (NEW."id", 'created;still-string');
      END;
      INSERT INTO "notes" ("body") VALUES ('hello;world');
      COMMIT;
      PRAGMA foreign_keys=ON;
    `);

    const { __privateForTests } = await loadDatabaseModule();
    await __privateForTests.applyMigrationsSQL(dbPath, migrationsDir);

    const db = new DatabaseSync(dbPath);
    expect(db.prepare('SELECT body FROM notes').get()).toEqual({ body: 'hello;world' });
    expect(db.prepare('SELECT message FROM audit').get()).toEqual({ message: 'created;still-string' });
    expect(db.prepare('SELECT COUNT(*) AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL').get()).toEqual({ count: 1 });
    db.close();
  });

  it('records migrations once and skips already applied entries', async () => {
    const dbPath = makeTempDbPath();
    const migrationsDir = makeTempDir('migrations-once');
    writeMigration(migrationsDir, '20260804123314_init', 'CREATE TABLE "once_table" ("id" INTEGER PRIMARY KEY);');

    const { __privateForTests } = await loadDatabaseModule();
    await __privateForTests.applyMigrationsSQL(dbPath, migrationsDir);
    await __privateForTests.applyMigrationsSQL(dbPath, migrationsDir);

    const db = new DatabaseSync(dbPath);
    expect(db.prepare('SELECT COUNT(*) AS count FROM "_prisma_migrations" WHERE migration_name = ?').get('20260804123314_init')).toEqual({ count: 1 });
    db.close();
  });

  it('reproduces prior cannot commit error with naive per-statement execution', async () => {
    const sql = `
      BEGIN;
      CREATE TABLE t(id INTEGER PRIMARY KEY, body TEXT);
      INSERT INTO t(body) VALUES ('semi;colon');
      COMMIT;
    `;

    const naiveStatements = sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const prismaLikeExec = vi.fn(async (statement: string) => {
      if (statement === 'COMMIT') {
        throw new Error('Raw query failed. Code: 1\nMessage: cannot commit - no transaction is active');
      }
    });

    await expect((async () => {
      for (const statement of naiveStatements) {
        await prismaLikeExec(statement);
      }
    })()).rejects.toThrow(/cannot commit - no transaction is active/);
  });

  it('restores backup after failed migration on existing database', async () => {
    const dbPath = makeTempDbPath();
    writeDummyDb(dbPath);
    const before = fs.readFileSync(dbPath);
    const migrationsDir = makeTempDir('migrations-fail');
    writeMigration(migrationsDir, '20260804123314_init', `
      BEGIN;
      CREATE TABLE broken_table(id INTEGER PRIMARY KEY);
      INSERT INTO missing_table(id) VALUES (1);
      COMMIT;
    `);

    const { __privateForTests } = await loadDatabaseModule();
    await expect(__privateForTests.runMigrations(dbPath, migrationsDir)).rejects.toThrow(/Database migration failed/);
    expect(fs.readFileSync(dbPath)).toEqual(before);

    const db = new DatabaseSync(dbPath);
    expect(db.prepare('SELECT value FROM keep_me').get()).toEqual({ value: 'before' });
    db.close();
  });

  it('applies pragmas via Prisma after connect', async () => {
    const { __privateForTests } = await loadDatabaseModule();
    await __privateForTests.applySqlitePragmas({
      $executeRawUnsafe: mockPrismaExecuteRawUnsafe,
    } as never);

    const rawCalls = mockPrismaExecuteRawUnsafe.mock.calls.map((call) => call[0] as string);
    expect(rawCalls.some((s) => s.includes('journal_mode=WAL'))).toBe(true);
    expect(rawCalls.some((s) => s.includes('busy_timeout'))).toBe(true);
    expect(rawCalls.some((s) => s.includes('foreign_keys=ON'))).toBe(true);
    expect(rawCalls.some((s) => s.includes('synchronous=NORMAL'))).toBe(true);
  });
});
