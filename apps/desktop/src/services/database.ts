/**
 * Database service — initialises the Prisma SQLite client and runs migrations.
 * The database file lives in the Electron userData directory.
 */

import path from 'node:path';
import fs from 'node:fs';
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
  // Prisma migrate deploy applies migrations from the embedded migrations folder.
  // In development: migrations live at prisma/migrations/
  // In production (packaged): migrations are in resources/prisma/migrations/
  const { execSync } = await import('node:child_process');
  const { app: electronApp } = await import('electron');

  const schemaPath = electronApp.isPackaged
    ? path.join(process.resourcesPath, 'prisma', 'schema.prisma')
    : path.join(__dirname, '..', '..', 'prisma', 'schema.prisma');

  try {
    execSync(
      `npx prisma migrate deploy --schema="${schemaPath}"`,
      {
        env: {
          ...process.env,
          DESKTOP_DATABASE_URL: `file:${dbPath}`,
        },
        timeout: 30_000,
        stdio: 'pipe',
      }
    );
    log.info('[db] Migrations applied');
  } catch (err: unknown) {
    // If migration fails, log the error and try to continue with the existing schema.
    // This prevents crashes on first run if migrations directory is not yet present.
    const msg = err instanceof Error ? err.message : String(err);
    log.warn('[db] Migration warning (will attempt db push fallback):', msg);
    try {
      execSync(
        `npx prisma db push --schema="${schemaPath}" --skip-generate --accept-data-loss`,
        {
          env: { ...process.env, DESKTOP_DATABASE_URL: `file:${dbPath}` },
          timeout: 30_000,
          stdio: 'pipe',
        }
      );
      log.info('[db] db push fallback succeeded');
    } catch (pushErr: unknown) {
      log.error('[db] db push also failed:', pushErr instanceof Error ? pushErr.message : String(pushErr));
      // Continue — Prisma may still work if schema already exists
    }
  }
}
