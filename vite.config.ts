// vite.config.ts
import { defineConfig, loadEnv, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const r = (p: string): string => fileURLToPath(new URL(p, import.meta.url));
const stripSlash = (u?: string) => (u ? u.replace(/\/+$/, '') : u);

// https://vitejs.dev/config/
export default defineConfig(({ mode }): UserConfig => {
  const env = loadEnv(mode, process.cwd(), '');
  const useProxy = String(env.VITE_USE_PROXY || '').toLowerCase() === 'true';
  const adminApiOrigin = stripSlash(env.VITE_ADMIN_API_ORIGIN || ''); // no /api suffix per spec
  const rawAdminBase = stripSlash(env.VITE_ADMIN_API_BASE_URL || env.VITE_API_ROOT || env.VITE_API_URL);
  // Prefer explicit dev proxy target, then new base, then existing fallbacks
  const API_TARGET =
    stripSlash(env.VITE_ADMIN_API_TARGET) ||
    stripSlash(env.VITE_API_BASE_URL) ||
    stripSlash(env.VITE_BACKEND_URL) ||
    rawAdminBase ||
    'http://localhost:5000';
  // Explicit backend URL for dev proxy of /admin-api/* → backend
  const BACKEND_URL = stripSlash(env.VITE_BACKEND_URL || env.VITE_API_BASE_URL || '');
  const API_WS   = stripSlash(env.VITE_API_WS)  || API_TARGET; // default WS -> same host if available

  const DEV_PORT = 5173;
  // Dev diagnostic: show current admin API proxy target
  if (mode === 'development') {
    // eslint-disable-next-line no-console
    console.log('[vite] Admin API target:', API_TARGET || '(undefined)');
    if (BACKEND_URL) {
      console.log('[vite] Dev proxy BACKEND_URL:', BACKEND_URL);
    }
    if (API_TARGET && /\/api\/?$/.test(API_TARGET)) {
      console.warn('[vite] Note: Target ends with /api; proxy will strip /admin-api/api to avoid double prefix.');
    }
  }
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
        port: DEV_PORT,
        open: true,
        // Keep the standard Vite port
        strictPort: true,
      cors: true,
      // Proxy all API + sockets to backend in dev
      proxy: {
        '/api': {
          target: `${API_TARGET || 'http://localhost:5000'}`,
          changeOrigin: true,
          secure: false,
        },
        // Support public settings in local dev (maps /settings/* -> /api/settings/*)
        '/settings': {
          target: `${API_TARGET}`,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/settings/, '/api/settings'),
        },
        // Proxy /admin-api/* -> backend. Rewrite strategy:
        // - If backend routes are under '/admin/*', remove '/admin-api'
        // - If backend routes are under '/api/admin/*', keep frontend path and add '/api' via Vercel or backend config.
        // For local dev we strip '/admin-api' to hit '/admin/*' directly.
        '/admin-api': {
          target: BACKEND_URL || env.VITE_ADMIN_API_TARGET || API_TARGET || 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
          // Rewrite '/admin-api/*' -> '/api/*' for compatibility during transition.
          rewrite: (path) => path.replace(/^\/admin-api/, '/api'),
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
      'import.meta.env.VITE_ADMIN_API_BASE_URL': JSON.stringify(API_TARGET),
      'import.meta.env.VITE_API_URL': JSON.stringify(API_TARGET),
      'import.meta.env.VITE_API_WS': JSON.stringify(API_WS),
      'import.meta.env.VITE_SITE_NAME': JSON.stringify(env.VITE_SITE_NAME ?? ''),
      'import.meta.env.VITE_USE_PROXY': JSON.stringify(useProxy),
      'import.meta.env.VITE_ADMIN_API_ORIGIN': JSON.stringify(adminApiOrigin),
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

    // Startup banner reminding restart when env/proxy changes
    customLogger: {
      info(msg) {
        // eslint-disable-next-line no-console
        console.info(msg);
        // eslint-disable-next-line no-console
        if (msg.includes('ready in')) {
          console.warn('[vite] If you change VITE_ADMIN_API_TARGET or proxy, restart `npm run dev`.');
          console.warn('[vite] Admin API dev proxy →', env.VITE_ADMIN_API_TARGET || API_TARGET || '(unset)');
        }
      },
      warn(msg) { console.warn(msg); },
      error(msg) { console.error(msg); },
      clearScreen: undefined,
    },

    // Speed up dev for common deps (optional)
    optimizeDeps: {
      include: ['react', 'react-dom', 'socket.io-client'],
    },
  };
});
