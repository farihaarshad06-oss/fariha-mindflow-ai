/**
 * Bundles the Electron main and preload entry points with esbuild.
 *
 * Strategy: CommonJS output so Node.js can resolve all modules without
 * extensionless-import issues.  All internal service files are inlined into
 * two bundles (main.js and preload.js).  Only `electron` (and other native
 * modules) are kept external so they are still loaded by Electron at runtime.
 *
 * Prisma fix:
 * - The generated Prisma client lives in src/generated/prisma (custom output
 *   path configured in prisma/schema.prisma) and is bundled inline by esbuild.
 * - Native query-engine .node binaries use loader:{'.node':'copy'} so esbuild
 *   copies them into dist-electron/ and emits require('<filename>').
 * - The generated index.js resolves engines and schema via __dirname, so we
 *   also copy schema.prisma into dist-electron/ after bundling.
 * - electron-builder's asarUnpack ensures .node files land in app.asar.unpacked
 *   at the same relative path so require() resolves correctly at runtime.
 */

import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── 1. Run prisma generate so src/generated/prisma is always up-to-date ──
console.log('Running prisma generate...');
const prismaBinName = process.platform === 'win32' ? 'prisma.cmd' : 'prisma';
const localPrismaBin = path.join(__dirname, 'node_modules', '.bin', prismaBinName);
const resolvedPrismaBin = fs.existsSync(localPrismaBin) ? localPrismaBin : prismaBinName;
execFileSync(resolvedPrismaBin, ['generate', '--schema=prisma/schema.prisma'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
console.log('Prisma generate complete.');

// ── 2. Bundle main and preload with esbuild ───────────────────────────────
const outdir = path.join(__dirname, 'dist-electron');

const sharedOptions = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  sourcemap: true,
  // Keep native/Electron modules external – they are provided by the runtime.
  // NOTE: @prisma/client and prisma are NOT listed here; the generated client
  // in src/generated/prisma is bundled inline by esbuild.  Native .node files
  // are handled by the loader entry below so they remain as file references.
  external: [
    'electron',
    'electron-log',
    'electron-log/main',
    'electron-updater',
    'ffmpeg-static',
    'nodejs-whisper',
  ],
  // Treat native addons as file-copy assets.
  // esbuild copies them into outdir and emits: require('./filename.node')
  loader: { '.node': 'copy' },
  outdir,
};

await build({
  ...sharedOptions,
  entryPoints: [path.join(__dirname, 'src/main.ts')],
});

await build({
  ...sharedOptions,
  entryPoints: [path.join(__dirname, 'src/preload.ts')],
});

// ── 3. Copy Prisma schema.prisma into dist-electron ───────────────────────
// The generated index.js resolves schema.prisma via path.join(__dirname, 'schema.prisma').
// After esbuild bundles it inline, __dirname is dist-electron/, so we copy it there.
const generatedSchemaPath = path.join(__dirname, 'src', 'generated', 'prisma', 'schema.prisma');
const outSchemaPath = path.join(outdir, 'schema.prisma');
if (fs.existsSync(generatedSchemaPath)) {
  fs.copyFileSync(generatedSchemaPath, outSchemaPath);
  console.log('Copied schema.prisma to dist-electron/');
} else {
  console.warn('WARNING: src/generated/prisma/schema.prisma not found — run prisma generate first');
}

console.log('Electron main and preload bundled successfully.');
