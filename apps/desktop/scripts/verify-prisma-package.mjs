#!/usr/bin/env node
/**
 * Pre-package verification script.
 *
 * Fails with exit code 1 if any critical Prisma file is missing from the
 * dist-electron output directory (i.e. what electron-builder will package).
 *
 * Run: node scripts/verify-prisma-package.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const distElectron = path.join(root, 'dist-electron');
const generatedPrisma = path.join(root, 'src', 'generated', 'prisma');

let failed = false;

function check(label, filePath) {
  if (fs.existsSync(filePath)) {
    console.log(`  ✓ ${label}`);
  } else {
    console.error(`  ✗ MISSING: ${label}\n    Expected: ${filePath}`);
    failed = true;
  }
}

console.log('\n── Verifying Prisma build outputs ──\n');

// 1. Generated client JS files (created by prisma generate)
check('@prisma/client default.js (generated)',  path.join(generatedPrisma, 'default.js'));
check('@prisma/client index.js (generated)',     path.join(generatedPrisma, 'index.js'));
check('.prisma/client runtime (generated)',      path.join(generatedPrisma, 'runtime', 'library.js'));
check('prisma schema copy (generated)',          path.join(generatedPrisma, 'schema.prisma'));

// 2. Native query engine binaries in the generated output directory
const generatedFiles = fs.existsSync(generatedPrisma) ? fs.readdirSync(generatedPrisma) : [];
const nativeEngines = generatedFiles.filter(f => f.endsWith('.node'));

if (nativeEngines.length > 0) {
  for (const eng of nativeEngines) {
    console.log(`  ✓ native engine: ${eng}`);
  }
} else {
  console.error('  ✗ MISSING: no native query engine .node files in generated/prisma');
  failed = true;
}

// 3. dist-electron bundle (after build-electron.mjs ran)
if (fs.existsSync(distElectron)) {
  check('dist-electron/main.js',    path.join(distElectron, 'main.js'));
  check('dist-electron/preload.js', path.join(distElectron, 'preload.js'));
  check('dist-electron/schema.prisma', path.join(distElectron, 'schema.prisma'));

  // esbuild copies .node files into dist-electron when loader:{'.node':'copy'} is set
  const distFiles = fs.readdirSync(distElectron);
  const copiedEngines = distFiles.filter(f => f.endsWith('.node'));
  if (copiedEngines.length > 0) {
    for (const eng of copiedEngines) {
      console.log(`  ✓ dist-electron native engine copy: ${eng}`);
    }
  } else {
    console.error('  ✗ MISSING: no .node files copied into dist-electron by esbuild');
    failed = true;
  }
} else {
  console.error('  ✗ MISSING: dist-electron directory (run build:electron first)');
  failed = true;
}

// 4. Prisma schema + migrations for runtime migrations
check('prisma/schema.prisma',       path.join(root, 'prisma', 'schema.prisma'));

const migrationsDir = path.join(root, 'prisma', 'migrations');
if (fs.existsSync(migrationsDir) && fs.readdirSync(migrationsDir).length > 0) {
  console.log('  ✓ prisma/migrations (present)');
} else {
  console.warn('  ⚠ prisma/migrations directory is empty or missing — expected for a fresh schema');
}

console.log('');
if (failed) {
  console.error('Pre-package verification FAILED. Fix the issues above before packaging.\n');
  process.exit(1);
} else {
  console.log('Pre-package verification PASSED.\n');
}
