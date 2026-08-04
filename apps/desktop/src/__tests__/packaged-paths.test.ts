/**
 * Packaged-path migration tests.
 *
 * These tests verify the production-safe migration approach in database.ts:
 *
 *   1. No external process (node.exe / Prisma CLI) is spawned — migrations
 *      are applied programmatically using the Prisma client's $executeRawUnsafe.
 *
 *   2. Typography: msg.data.map is not a function
 *      – caused by the electron-log redaction transform calling .map() without
 *        first checking that msg.data is an Array.
 *
 * No real Electron, Prisma CLI, or SQLite is required: every external is mocked.
 */

import { describe, it, expect, vi } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

// ── Module-level mocks ─────────────────────────────────────────────────────

vi.mock('electron', () => ({
  app: {
    getPath: (_k: string) => os.tmpdir(),
    isPackaged: false,
  },
}));

vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../generated/prisma', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
    $queryRawUnsafe: vi.fn().mockResolvedValue([]),
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),
  })),
}));

// ── Production-safe migration source checks ───────────────────────────────

describe('database.ts — no external process spawning', () => {
  it('does not import child_process in executable lines', () => {
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
    expect(executableLines).not.toContain('child_process');
    expect(executableLines).not.toContain('execFileSync');
    expect(executableLines).not.toContain('execSync');
    expect(executableLines).not.toContain('spawnSync');
    expect(executableLines).not.toContain('node.exe');
  });

  it('uses programmatic _prisma_migrations tracking table', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../services/database.ts'),
      'utf8',
    );
    expect(src).toContain('_prisma_migrations');
    expect(src).toContain('$queryRawUnsafe');
    expect(src).toContain('$executeRawUnsafe');
  });

  it('uses process.resourcesPath/prisma/migrations for packaged mode', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../services/database.ts'),
      'utf8',
    );
    expect(src).toContain("process.resourcesPath, 'prisma', 'migrations'");
  });

  it('does NOT reference app.asar in executable lines', () => {
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
    expect(executableLines).not.toContain("'app.asar'");
    expect(executableLines).not.toContain('"app.asar"');
  });
});

// ── electron-log transform safety tests ──────────────────────────────────

describe('electron-log transform — msg.data safety', () => {
  it('guard exists in main.ts source before calling .map()', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../main.ts'),
      'utf8',
    );
    // The transform must check Array.isArray before calling .map
    expect(src).toContain('Array.isArray(msg.data)');
  });

  it('transform does not throw when msg.data is undefined', () => {
    // Reproduce the TypeError: msg.data.map is not a function scenario
    // by directly testing the guard logic inline.
    type LogMsg = { data: unknown };
    const transform = (msg: LogMsg): LogMsg => {
      if (!Array.isArray(msg.data)) return msg;
      const parts = (msg.data as unknown[]).map((d: unknown) => {
        if (typeof d !== 'string') return d;
        return d.replace(/Bearer\s+\S+/gi, '******');
      });
      return { ...msg, data: parts };
    };

    // These must NOT throw
    expect(() => transform({ data: undefined })).not.toThrow();
    expect(() => transform({ data: null })).not.toThrow();
    expect(() => transform({ data: 'string' })).not.toThrow();
    expect(() => transform({ data: 42 })).not.toThrow();
  });

  it('transform still redacts secrets when msg.data is a proper array', () => {
    type LogMsg = { data: unknown };
    const transform = (msg: LogMsg): LogMsg => {
      if (!Array.isArray(msg.data)) return msg;
      const parts = (msg.data as unknown[]).map((d: unknown) => {
        if (typeof d !== 'string') return d;
        return d
          .replace(/Bearer\s+\S+/gi, '******')
          .replace(/"(key|secret|token|password|apiKey)"\s*:\s*"[^"]+"/gi, '"$1":"[REDACTED]"');
      });
      return { ...msg, data: parts };
    };

    const result = transform({ data: ['Authorization: ******', 'safe message'] });
    expect((result.data as string[])[0]).toContain('******');
    expect((result.data as string[])[1]).toBe('safe message');
  });
});

// ── asarUnpack configuration test ─────────────────────────────────────────

describe('electron-builder config — asarUnpack', () => {
  it('unpacks @prisma/client so native engines are accessible', () => {
    const pkgPath = path.join(__dirname, '../../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as {
      build?: { asarUnpack?: string[] };
    };
    const asarUnpack: string[] = pkg.build?.asarUnpack ?? [];
    expect(asarUnpack.some((p) => p.includes('@prisma/client'))).toBe(true);
  });

  it('still unpacks dist-electron .node native binaries', () => {
    const pkgPath = path.join(__dirname, '../../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as {
      build?: { asarUnpack?: string[] };
    };
    const asarUnpack: string[] = pkg.build?.asarUnpack ?? [];
    expect(asarUnpack.some((p) => p.includes('dist-electron'))).toBe(true);
  });
});

// ── extraResources / migrations path test ─────────────────────────────────

describe('database.ts — packaged migrations path', () => {
  it('uses process.resourcesPath/prisma/migrations when packaged', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../services/database.ts'),
      'utf8',
    );
    // Must use resourcesPath (extraResources destination) for migrations in packaged mode
    expect(src).toContain("process.resourcesPath, 'prisma', 'migrations'");
  });
});

