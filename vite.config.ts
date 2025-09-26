// vite.config.ts
import { defineConfig, loadEnv, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// ESM-safe resolver with types
const r = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig(({ mode }): UserConfig => {
  // load all envs; only VITE_* are exposed to client
  const env = loadEnv(mode, process.cwd(), '');

  const API_HTTP = env.VITE_API_URL || 'http://localhost:5000';
  const API_WS   = env.VITE_API_WS  || API_HTTP; // default WS to same host

  return {
    plugins: [react()],

    resolve: {
      alias: {
        '@': r('./src'),
        '@components': r('./src/components'),
        '@pages': r('./src/pages'),
        '@lib': r('./src/lib'),
        '@context': r('./src/context'),
        '@hooks': r('./src/hooks'),
        '@assets': r('./src/assets'),
        '@styles': r('./src/styles'),
        '@utils': r('./src/utils'),
        '@config': r('./src/config'),
        '@types': r('./src/types'),
      },
    },

    server: {
      port: 5173,
      open: true,
      strictPort: true,
      proxy: {
        // HTTP API -> backend
        '/api': {
          target: API_HTTP,
          changeOrigin: true,
          secure: false, // dev only
          ws: false,
        },
        // 🔌 Socket.IO WS -> backend
        '/socket.io': {
          target: API_WS,
          changeOrigin: true,
          ws: true,
          secure: false, // dev only
        },
      },
      // hmr: { overlay: false }, // uncomment if overlay is too noisy
      watch: {
        ignored: [
          '**/admin-backend/backend/data/**',
          '**/backend/data/**',
          '**/admin-backend/backend/data/*.json',
          '**/admin-backend/backend/data/*',
        ],
      },
    },

    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(API_HTTP),
      'import.meta.env.VITE_API_WS': JSON.stringify(API_WS),
      'import.meta.env.VITE_SITE_NAME': JSON.stringify(env.VITE_SITE_NAME ?? ''),
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
  };
});
