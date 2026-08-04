import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createRequire } from 'node:module';

process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({ module: 'commonjs' });

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-script-test-'));

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(tempRoot, `${prefix}-`));
}

function makeTempDbPath() {
  return path.join(makeTempDir('db'), 'mindflow.db');
}

function writeDummyDb(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('CREATE TABLE keep_me(value TEXT); INSERT INTO keep_me(value) VALUES (\'before\');');
  db.close();
}

function writeMigration(migrationsDir, name, sql) {
  const dir = path.join(migrationsDir, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'migration.sql'), sql, 'utf8');
}

const { build } = await import('esbuild');
const require = createRequire(import.meta.url);
const electronPath = require.resolve('electron');
const electronLogPath = require.resolve('electron-log/main');
const prismaPath = path.join(process.cwd(), 'src/generated/prisma/index.js');

const bundleOutfile = path.join(tempRoot, 'database-test-bundle.mjs');
await build({
  entryPoints: [path.join(process.cwd(), 'src/services/database.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: bundleOutfile,
  external: ['node:sqlite'],
  alias: {
    electron: electronPath,
    'electron-log/main': electronLogPath,
    '../generated/prisma': prismaPath,
  },
});

const { __privateForTests } = await import(`file://${bundleOutfile}`);

async function testFullScriptExecution() {
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

  await __privateForTests.applyMigrationsSQL(dbPath, migrationsDir);

  const db = new DatabaseSync(dbPath);
  assert.deepEqual(db.prepare('SELECT body FROM notes').get(), { body: 'hello;world' });
  assert.deepEqual(db.prepare('SELECT message FROM audit').get(), { message: 'created;still-string' });
  assert.deepEqual(db.prepare('SELECT COUNT(*) AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL').get(), { count: 1 });
  db.close();
}

async function testAppliedOnce() {
  const dbPath = makeTempDbPath();
  const migrationsDir = makeTempDir('migrations-once');
  writeMigration(migrationsDir, '20260804123314_init', 'CREATE TABLE "once_table" ("id" INTEGER PRIMARY KEY);');

  await __privateForTests.applyMigrationsSQL(dbPath, migrationsDir);
  await __privateForTests.applyMigrationsSQL(dbPath, migrationsDir);

  const db = new DatabaseSync(dbPath);
  assert.deepEqual(
    db.prepare('SELECT COUNT(*) AS count FROM "_prisma_migrations" WHERE migration_name = ?').get('20260804123314_init'),
    { count: 1 },
  );
  db.close();
}

async function testNaiveRegression() {
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

  let err;
  for (const statement of naiveStatements) {
    if (statement === 'COMMIT') {
      err = new Error('Raw query failed. Code: 1\nMessage: cannot commit - no transaction is active');
      break;
    }
  }

  assert.ok(err);
  assert.match(err.message, /cannot commit - no transaction is active/);
}

async function testBackupRestore() {
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

  await assert.rejects(
    __privateForTests.runMigrations(dbPath, migrationsDir),
    /Database migration failed/,
  );

  assert.deepEqual(fs.readFileSync(dbPath), before);
  const db = new DatabaseSync(dbPath);
  assert.deepEqual(db.prepare('SELECT value FROM keep_me').get(), { value: 'before' });
  db.close();
}

async function testPragmas() {
  const calls = [];
  await __privateForTests.applySqlitePragmas({
    $executeRawUnsafe: async (sql) => {
      calls.push(sql);
    },
  });

  assert.ok(calls.some((sql) => sql.includes('journal_mode=WAL')));
  assert.ok(calls.some((sql) => sql.includes('busy_timeout')));
  assert.ok(calls.some((sql) => sql.includes('foreign_keys=ON')));
  assert.ok(calls.some((sql) => sql.includes('synchronous=NORMAL')));
}

const src = fs.readFileSync(new URL('../src/services/database.ts', import.meta.url), 'utf8');
assert.ok(!src.includes(".split(';')"));
assert.ok(src.includes('sqlite.exec(sql)'));

await testFullScriptExecution();
await testAppliedOnce();
await testNaiveRegression();
await testBackupRestore();
await testPragmas();

console.log('database migration regression tests passed');
