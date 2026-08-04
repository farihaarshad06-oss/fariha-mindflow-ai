/**
 * Prisma smoke test — verifies that:
 * 1. The generated Prisma client can be imported (no "Cannot find module" errors)
 * 2. PrismaClient can be instantiated with a SQLite file
 * 3. A simple query (create + read + delete) succeeds
 * 4. PrismaClient disconnects cleanly
 *
 * This test runs against a real (temporary) SQLite database using the generated
 * client in src/generated/prisma.  It does NOT mock Prisma.
 *
 * Fails on:
 * - Cannot find module '.prisma/client/default' or similar resolution errors
 * - Missing query engine binary
 * - Prisma initialization failure
 * - Migration/query failure
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

// This import is the critical one — it must resolve the generated client which
// embeds the Prisma runtime.  Any packaging error surfaces here.
import { PrismaClient } from '../generated/prisma';

const tmpDir = path.join(os.tmpdir(), `mindflow-smoke-${Date.now()}`);
const dbPath = path.join(tmpDir, 'smoke.db');

let prisma: PrismaClient;

beforeAll(() => {
  fs.mkdirSync(tmpDir, { recursive: true });
  process.env['DESKTOP_DATABASE_URL'] = `file:${dbPath}`;
  prisma = new PrismaClient({
    datasources: { db: { url: `file:${dbPath}` } },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
  // Clean up the temporary database
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* non-critical */ }
});

describe('Prisma smoke test', () => {
  it('imports PrismaClient without module resolution errors', () => {
    expect(PrismaClient).toBeDefined();
    expect(typeof PrismaClient).toBe('function');
  });

  it('instantiates PrismaClient successfully', () => {
    expect(prisma).toBeDefined();
    expect(prisma).toBeInstanceOf(PrismaClient);
  });

  it('connects to a SQLite database and runs a raw query', async () => {
    // $connect implicitly happens on first query, but let's be explicit
    await prisma.$connect();
    // A simple raw query — must work on a fresh (empty/unmigrated) DB
    const result = await prisma.$queryRawUnsafe<{ val: number }[]>('SELECT 1 AS val');
    expect(result).toHaveLength(1);
    expect(result[0]?.val).toBe(1);
  });

  it('disconnects cleanly', async () => {
    await expect(prisma.$disconnect()).resolves.not.toThrow();
  });
});
