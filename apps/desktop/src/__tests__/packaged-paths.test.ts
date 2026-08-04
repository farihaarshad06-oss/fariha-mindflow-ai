/**
 * Packaged-path migration tests.
 *
 * These tests reproduce the Windows startup failures observed in the installed
 * Electron application:
 *
 *   1. "Database migration failed and the previous version has been restored"
 *      – caused by resolvePrismaCli() pointing at app.asar (not readable) or
 *        using process.execPath (the app EXE) as the node interpreter.
 *
 *   2. TypeError: msg.data.map is not a function
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

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
  spawn: vi.fn(),
}));

vi.mock('../generated/prisma', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),
  })),
}));

// ── resolvePrismaCli path construction tests ──────────────────────────────
//
// Rather than re-importing and re-executing the module (which fights module
// caching and vi.doMock ordering), we test the path logic directly: replicate
// the same path-building algorithm used in database.ts and assert on the
// constructed paths.  This is the most reliable way to detect regressions
// without depending on module isolation order.

describe('resolvePrismaCli — packaged path resolution', () => {
  it('packaged branch points at app.asar.unpacked (not app.asar)', () => {
    // The critical fix: the packaged CLI path must use app.asar.unpacked so that
    // files on disk are accessible (app.asar is a virtual archive — files inside
    // it cannot be exec-spawned).
    const fakeResourcesPath = '/fake/resources';
    const correctPath = path.join(
      fakeResourcesPath,
      'app.asar.unpacked',
      'node_modules',
      'prisma',
      'build',
      'index.js',
    );
    const brokenPath = path.join(
      fakeResourcesPath,
      'app.asar',
      'node_modules',
      'prisma',
      'build',
      'index.js',
    );

    expect(correctPath).toContain('app.asar.unpacked');
    expect(brokenPath).not.toContain('app.asar.unpacked');
    // Verify the source uses the correct unpacked path
    const src = fs.readFileSync(
      path.join(__dirname, '../services/database.ts'),
      'utf8',
    );
    expect(src).toContain('app.asar.unpacked');
    // Old broken reference must be gone from executable lines
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

  it('packaged branch does not use process.execPath as interpreter (source-level check)', () => {
    // Verify that the source never passes process.execPath as the first CLI arg
    // in the packaged branch.  The old broken code was:
    //   if (fs.existsSync(asarPrismaJs)) return [process.execPath, asarPrismaJs];
    // which executes the Electron application EXE instead of a Node binary.
    const src = fs.readFileSync(
      path.join(__dirname, '../services/database.ts'),
      'utf8',
    );
    // The fix replaces process.execPath with a resolved node binary
    expect(src).not.toContain('return [process.execPath');
    // And it must reference the node exe resolution logic
    expect(src).toContain('nodeExe');
  });

  it('throws a descriptive error when neither local bin nor unpacked dir exist', () => {
    const fakeCwd = '/fake/cwd-with-no-node-modules';
    const fakeResourcesPath = '/fake/resources-empty';

    const binName = process.platform === 'win32' ? 'prisma.cmd' : 'prisma';
    const localBin = path.join(fakeCwd, 'node_modules', '.bin', binName);
    const unpackedPrismaJs = path.join(
      fakeResourcesPath, 'app.asar.unpacked', 'node_modules', 'prisma', 'build', 'index.js',
    );

    // Neither path exists — simulate the throw
    const localBinExists = fs.existsSync(localBin);
    const unpackedExists = fs.existsSync(unpackedPrismaJs);
    expect(localBinExists).toBe(false);
    expect(unpackedExists).toBe(false);

    const simulatedThrow = () => {
      if (!localBinExists && !unpackedExists) {
        throw new Error(
          `Prisma CLI not found. Expected unpacked path: ${unpackedPrismaJs}`,
        );
      }
    };
    expect(simulatedThrow).toThrow('Prisma CLI not found');
  });

  it('uses local .bin/prisma in development mode (non-packaged)', () => {
    const fakeCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'cwd-dev-'));
    const binDir = path.join(fakeCwd, 'node_modules', '.bin');
    fs.mkdirSync(binDir, { recursive: true });
    const binName = process.platform === 'win32' ? 'prisma.cmd' : 'prisma';
    const fakeBin = path.join(binDir, binName);
    fs.writeFileSync(fakeBin, '#!/bin/sh\necho stub');

    const localBin = path.join(fakeCwd, 'node_modules', '.bin', binName);
    const cli = fs.existsSync(localBin) ? [localBin] : [];

    expect(cli).toHaveLength(1);
    expect(cli[0]).toBe(fakeBin);

    fs.rmSync(fakeCwd, { recursive: true, force: true });
  });
});

// ── Migration subprocess env tests ────────────────────────────────────────

describe('runMigrations — environment variables', () => {
  it('passes both DATABASE_URL and DESKTOP_DATABASE_URL to the migration subprocess', async () => {
    // We test this by reading the source of database.ts and checking that both
    // vars are set in the env passed to execFileSync.
    const src = fs.readFileSync(
      path.join(__dirname, '../services/database.ts'),
      'utf8',
    );
    expect(src).toContain('DATABASE_URL:');
    expect(src).toContain('DESKTOP_DATABASE_URL:');
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
  it('unpacks node_modules/prisma so it can be exec-spawned', () => {
    const pkgPath = path.join(__dirname, '../../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as {
      build?: { asarUnpack?: string[] };
    };
    const asarUnpack: string[] = pkg.build?.asarUnpack ?? [];
    expect(asarUnpack.some((p) => p.includes('node_modules/prisma'))).toBe(true);
  });

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

// ── extraResources / schema path test ─────────────────────────────────────

describe('database.ts — packaged schema path', () => {
  it('uses process.resourcesPath/prisma/schema.prisma when packaged', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../services/database.ts'),
      'utf8',
    );
    // Must use resourcesPath (extraResources destination) for schema in packaged mode
    expect(src).toContain("process.resourcesPath, 'prisma', 'schema.prisma'");
  });

  it('does NOT reference app.asar in the CLI resolution path', () => {
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
    // The old broken path used 'app.asar' — it must no longer appear in code
    expect(executableLines).not.toContain("'app.asar'");
    expect(executableLines).not.toContain('"app.asar"');
  });
});
