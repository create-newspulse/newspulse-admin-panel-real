// vite.config.js
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());

  return {
    plugins: [react()],
    server: {
      port: 5173,
      open: true,
      strictPort: true,
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false, // Only for local dev!
          ws: false,
        },
      },
      // ⛔️ THIS FIX IGNORES ALL FILES INSIDE THESE FOLDERS!
      watch: {
        ignored: [
          '**/admin-backend/backend/data/**',
          '**/backend/data/**',
          '**/admin-backend/backend/data/*.json',
          '**/admin-backend/backend/data/*',
        ],
      },
    },
    resolve: {
      alias: {
        '@components': path.resolve(__dirname, 'src/components'),
        '@pages': path.resolve(__dirname, 'src/pages'),
        '@lib': path.resolve(__dirname, 'src/lib'),
        '@context': path.resolve(__dirname, 'src/context'),
        '@hooks': path.resolve(__dirname, 'src/hooks'),
        '@assets': path.resolve(__dirname, 'src/assets'),
        '@styles': path.resolve(__dirname, 'src/styles'),
        '@utils': path.resolve(__dirname, 'src/utils'),
        '@config': path.resolve(__dirname, 'src/config'),
        '@types': path.resolve(__dirname, 'src/types'),
        '@': path.resolve(__dirname, 'src'),
      },
    },
    build: {
      target: 'esnext',
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
      cssCodeSplit: true,
    },
    preview: {
      port: 4173,
      open: true,
    },
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL ?? ''),
      'import.meta.env.VITE_SITE_NAME': JSON.stringify(env.VITE_SITE_NAME ?? ''),
    },
  };
});
