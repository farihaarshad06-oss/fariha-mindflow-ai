import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      port: Number(env.WEB_PORT ?? 5173),
      host: true,
    },
    resolve: {
      alias: {
        '@mindflow/ui/styles.css': resolve(__dirname, '../../packages/ui/src/styles.css'),
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
  };
});
