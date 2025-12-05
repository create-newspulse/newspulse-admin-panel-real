// vite.config.ts
import { defineConfig, loadEnv, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const r = (p: string): string => fileURLToPath(new URL(p, import.meta.url));
const stripSlash = (u?: string) => (u ? u.replace(/\/+$/, '') : u);

// https://vitejs.dev/config/
export default defineConfig(({ mode }): UserConfig => {
  const env = loadEnv(mode, process.cwd(), '');
  const rawAdminBase = stripSlash(env.VITE_ADMIN_API_BASE_URL || env.VITE_API_ROOT || env.VITE_API_URL);
  // In dev, default to local backend if not specified; keep production untouched
  const API_HTTP = rawAdminBase || (mode === 'development' ? 'http://localhost:5000' : '');
  const API_WS   = stripSlash(env.VITE_API_WS)  || API_HTTP; // default WS -> same host if available

  return {
    envPrefix: 'VITE_',
    base: '/',

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
        '@features': r('./src/features'),
      },
    },

      server: {
        host: true,
        port: 5173,
        open: true,
        // Force chosen port; prevents silent fallback and gives explicit error if busy
        strictPort: true,
      cors: true,
      // Proxy all API + sockets to backend in dev
      proxy: {
        '/api': {
          target: `${API_HTTP}`,
          changeOrigin: true,
          secure: false,
          // keep path as-is (no rewrite) so /api/* hits backend /api/*
        },
        // Proxy /admin-api/* to local backend without rewriting path
        // Backend mounts admin endpoints under '/admin-api', so keep the prefix intact.
        '/admin-api': {
          // Local backend dev server for admin API
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
          // No rewrite: preserve '/admin-api' so routes like '/admin-api/articles/:id' resolve
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
      'import.meta.env.VITE_ADMIN_API_BASE_URL': JSON.stringify(API_HTTP),
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
      // Raise the warning threshold and split some heavy libs into separate chunks
      chunkSizeWarningLimit: 3000,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom'],
            socketio: ['socket.io-client'],
            html2canvas: ['html2canvas'],
            jspdf: ['jspdf', 'html2pdf.js'],
            tiptap: [
              '@tiptap/react',
              '@tiptap/starter-kit',
              '@tiptap/extension-image',
              '@tiptap/extension-link',
              // placeholder extension removed from manualChunks list (not installed)
              '@tiptap/extension-underline',
            ],
            i18n: ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
            chart: ['chart.js', 'react-chartjs-2'],
            purify: ['dompurify'],
          },
        },
      },
    },

    preview: {
      port: 4173,
      open: true,
    },
    plugins: [react(), {
      name: 'diagnostic-html-guard',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url && /\.[tj]sx?$/.test(req.url)) {
            // noop: kept for potential future logging
          }
          next();
        });
      }
    }],

    // Speed up dev for common deps (optional)
    optimizeDeps: {
      include: ['react', 'react-dom', 'socket.io-client'],
    },
  };
});
