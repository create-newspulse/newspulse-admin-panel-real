// vite.config.ts
import { defineConfig, loadEnv, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const r = (p: string): string => fileURLToPath(new URL(p, import.meta.url));
const stripSlash = (u?: string) => (u ? u.replace(/\/+$/, '') : u);

// https://vitejs.dev/config/
export default defineConfig(({ mode }): UserConfig => {
  const env = loadEnv(mode, process.cwd(), '');
  const API_HTTP = stripSlash(env.VITE_API_URL) || 'http://localhost:5000';
  const API_WS   = stripSlash(env.VITE_API_WS)  || API_HTTP; // default WS -> same host

  return {
    plugins: [react()],
    envPrefix: 'VITE_',

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
      host: true,
      port: 5173,
      open: true,
      strictPort: true,
      cors: true,
      // Proxy all API + sockets to backend in dev
      proxy: {
        '/api': {
          target: API_HTTP,
          changeOrigin: true,
          secure: false,
          // keep path as-is (no rewrite) so /api/* hits backend /api/*
        },
        '/socket.io': {
          target: API_WS,
          ws: true,
          changeOrigin: true,
          secure: false,
        },
      },
      watch: {
        ignored: [
          '**/admin-backend/backend/data/**',
          '**/backend/data/**',
          '**/admin-backend/backend/data/*.json',
          '**/admin-backend/backend/data/*',
        ],
      },
      // Uncomment if the red error overlay bothers you during dev:
      // hmr: { overlay: false },
      headers: {
        // Helpful for cookies/session during local testing
        'Access-Control-Allow-Credentials': 'true',
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
      chunkSizeWarningLimit: 1500, // quiets the big-chunk warning
      // If you want tighter chunking later, uncomment and tune:
      // rollupOptions: {
      //   output: {
      //     manualChunks: {
      //       react: ['react', 'react-dom'],
      //       socketio: ['socket.io-client'],
      //       html2canvas: ['html2canvas'],
      //     },
      //   },
      // },
    },

    preview: {
      port: 4173,
      open: true,
    },

    // Speed up dev for common deps (optional)
    optimizeDeps: {
      include: ['react', 'react-dom', 'socket.io-client'],
    },
  };
});
