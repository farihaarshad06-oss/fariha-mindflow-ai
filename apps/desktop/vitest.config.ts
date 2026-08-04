import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.{ts,js}'],
    // Each test must complete within 30 s; hooks (beforeAll/afterAll) get 120 s
    // to account for `npx prisma db push` in beforeAll.
    testTimeout: 30_000,
    hookTimeout: 120_000,
    // Run each test file in its own process so module-level singletons
    // (e.g. WhisperWorker state, Prisma _prisma) never bleed across files.
    pool: 'forks',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
      include: ['src/services/**', 'src/ipc/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
