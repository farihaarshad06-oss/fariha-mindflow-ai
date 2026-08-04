/**
 * Bundles the Electron main and preload entry points with esbuild.
 *
 * Strategy: CommonJS output so Node.js can resolve all modules without
 * extensionless-import issues.  All internal service files are inlined into
 * two bundles (main.js and preload.js).  Only `electron` (and other native
 * modules) are kept external so they are still loaded by Electron at runtime.
 */

import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const sharedOptions = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  sourcemap: true,
  // Keep native/Electron modules external – they are provided by the runtime
  external: [
    'electron',
    '@prisma/client',
    'prisma',
    'electron-log',
    'electron-log/main',
    'electron-updater',
    'ffmpeg-static',
    'nodejs-whisper',
  ],
  outdir: path.join(__dirname, 'dist-electron'),
};

await build({
  ...sharedOptions,
  entryPoints: [path.join(__dirname, 'src/main.ts')],
});

await build({
  ...sharedOptions,
  entryPoints: [path.join(__dirname, 'src/preload.ts')],
});

console.log('Electron main and preload bundled successfully.');
