/**
 * Database service — initialises the Prisma SQLite client and runs migrations.
 * The database file lives in the Electron userData directory.
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

  _prisma = new PrismaClient({
    datasources: { db: { url: `file:${dbPath}` } },
  });

  // Run migrations programmatically using the migration engine.
  // For production, we use `prisma migrate deploy` which applies all pending migrations.
  await runMigrations(dbPath);

  await _prisma.$connect();
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

async function runMigrations(dbPath: string): Promise<void> {
  const schemaPath = app.isPackaged
    ? path.join(process.resourcesPath, 'prisma', 'schema.prisma')
    : path.join(__dirname, '..', '..', 'prisma', 'schema.prisma');
  const prismaBin = resolvePrismaCli();

  try {
    execFileSync(prismaBin, ['migrate', 'deploy', '--schema', schemaPath], {
      env: {
        ...process.env,
        DESKTOP_DATABASE_URL: `file:${dbPath}`,
      },
      timeout: 30_000,
      stdio: 'pipe',
    });
    log.info('[db] Migrations applied');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn('[db] Migration warning (will attempt db push fallback):', msg);
    try {
      execFileSync(prismaBin, ['db', 'push', '--schema', schemaPath, '--skip-generate', '--accept-data-loss'], {
        env: { ...process.env, DESKTOP_DATABASE_URL: `file:${dbPath}` },
        timeout: 30_000,
        stdio: 'pipe',
      });
      log.info('[db] db push fallback succeeded');
    } catch (pushErr: unknown) {
      log.error('[db] db push also failed:', pushErr instanceof Error ? pushErr.message : String(pushErr));
    }
  }
}

function resolvePrismaCli(): string {
  const localBin = path.join(process.cwd(), 'node_modules', '.bin', process.platform === 'win32' ? 'prisma.cmd' : 'prisma');
  if (fs.existsSync(localBin)) {
    return localBin;
  }
  const packagedCli = path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', '.bin', process.platform === 'win32' ? 'prisma.cmd' : 'prisma');
  if (fs.existsSync(packagedCli)) {
    return packagedCli;
  }
  throw new Error('Prisma CLI not found for desktop migrations');
}
