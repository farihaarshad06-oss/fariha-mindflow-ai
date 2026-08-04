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
      // Hard limit: CI will fail if the initial (non-lazy) bundle exceeds 400 KB.
      // Lazy-loaded route chunks may each be up to 600 KB.
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          // Route-level code splitting: each page becomes its own async chunk so
          // the initial load only pulls in the shell + router.
          manualChunks(id) {
            // Vendor chunk — large third-party libraries that rarely change
            if (id.includes('node_modules')) {
              if (id.includes('react-dom') || id.includes('react-router')) {
                return 'vendor-react';
              }
              if (id.includes('@radix-ui') || id.includes('lucide-react') || id.includes('class-variance-authority')) {
                return 'vendor-ui';
              }
              if (id.includes('zod') || id.includes('date-fns')) {
                return 'vendor-utils';
              }
              return 'vendor';
            }
            // Heavy pages get their own chunk so they are not in the initial bundle
            const heavyPages = [
              'RecorderPage',
              'ModelManagerPage',
              'ChatPage',
              'StudyPlanPage',
              'SettingsPage',
              'LectureDetailPage',
              'CourseDetailPage',
            ];
            for (const page of heavyPages) {
              if (id.includes(`pages/${page}`)) return `page-${page.toLowerCase()}`;
            }
          },
        },
      },
    },
  };
});
