// vite.config.ts
import { defineConfig, loadEnv, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const r = (p: string): string => fileURLToPath(new URL(p, import.meta.url));
const stripSlash = (u?: string) => (u ? u.replace(/\/+$/, '') : u);
const hasPlaceholders = (s?: string) => /[<>]/.test(String(s || ''));
const isValidAbsoluteUrl = (u?: string) => {
  const s = String(u || '').trim();
  if (!/^https?:\/\//i.test(s)) return false;
  try { new URL(s); return true; } catch { return false; }
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }): UserConfig => {
  const env = loadEnv(mode, process.cwd(), '');
  const useProxy = String(env.VITE_USE_PROXY || '').toLowerCase() === 'true';
  const adminApiOrigin = stripSlash(env.VITE_ADMIN_API_ORIGIN || ''); // no /api suffix per spec
  // IMPORTANT:
  // - `VITE_API_URL` is for DIRECT mode (frontend talks straight to backend).
  // - Dev proxy targets should NOT depend on it, otherwise a stale VITE_API_URL
  //   can silently redirect Vite's `/api/*` proxy and cause ECONNREFUSED.
  // Use a dedicated variable for proxy targeting.
  // Prefer dedicated proxy target; fall back to VITE_API_BASE_URL (used by the simple axios client).
  const rawCandidate = stripSlash(
    env.VITE_ADMIN_API_TARGET
    || env.VITE_BACKEND_URL
    || env.VITE_ADMIN_API_ORIGIN
    || env.VITE_API_BASE_URL
    || ''
  );
  const useLocalDemo = String(env.VITE_USE_LOCAL_DEMO_BACKEND || '').toLowerCase() === 'true';
  const looksLocalhost = (() => {
    const s = String(rawCandidate || '').toLowerCase();
    return s.includes('localhost:') || s.includes('127.0.0.1:') || s.includes('0.0.0.0:');
  })();
  const API_TARGET = (!hasPlaceholders(rawCandidate)
    && isValidAbsoluteUrl(rawCandidate)
    && (!looksLocalhost || useLocalDemo))
    ? rawCandidate
    // Safe dev default: local demo backend origin.
    : 'http://localhost:5000';
  // IMPORTANT: Vite proxy `target` must be the backend ORIGIN (no /api suffix).
  // Otherwise, forwarding a path that already starts with `/api/...` becomes `/api/api/...`.
  const BACKEND_ORIGIN = /\/api$/i.test(API_TARGET) ? API_TARGET.replace(/\/api$/i, '') : API_TARGET;
  const BACKEND_URL = BACKEND_ORIGIN;
  const API_WS = stripSlash(env.VITE_API_WS) || BACKEND_ORIGIN; // default WS -> same host if available

  // Keep /admin-api proxy target consistent with the primary backend origin.
  // (Historically some setups used VITE_BACKEND_URL; keep it as a fallback only.)
  const ADMIN_API_PROXY_TARGET = stripSlash(
    BACKEND_ORIGIN
    || env.VITE_BACKEND_URL
    || process.env.VITE_BACKEND_URL
    || ''
  ) || '';

  // If the dev proxy target is the Vercel admin host, DO NOT rewrite '/admin-api/*' to '/api/*'.
  // Production relies on Vercel rewrites for '/admin-api/*' -> serverless proxy.
  const ADMIN_PROXY_IS_VERCEL = (() => {
    if (!ADMIN_API_PROXY_TARGET) return false;
    try {
      const host = new URL(ADMIN_API_PROXY_TARGET).hostname.toLowerCase();
      return host === 'admin.newspulse.co.in' || host.endsWith('.vercel.app');
    } catch {
      return false;
    }
  })();

  // Dev diagnostic: show current admin API proxy target
  if (mode === 'development') {
    // eslint-disable-next-line no-console
    console.log('[vite] Admin API target:', API_TARGET || '(undefined)');
    if (BACKEND_URL) {
      console.log('[vite] Dev proxy BACKEND_URL:', BACKEND_URL);
    }
    console.log('[vite] Dev proxy /admin-api target:', ADMIN_API_PROXY_TARGET);
    if (API_TARGET && /\/api\/?$/.test(API_TARGET)) {
      console.warn('[vite] Note: Target ends with /api; using origin for proxy:', BACKEND_ORIGIN);
    }
  }
  const proxy: any = {};
  if (BACKEND_ORIGIN) {
    proxy['/api'] = {
      target: `${BACKEND_ORIGIN}`,
      changeOrigin: true,
      secure: false,
    };
    // Support public settings in local dev (maps /settings/* -> /api/settings/*)
    proxy['/settings'] = {
      target: `${BACKEND_ORIGIN}`,
      changeOrigin: true,
      secure: false,
      rewrite: (path: string) => path.replace(/^\/settings/, '/api/settings'),
    };
    proxy['/socket.io'] = {
      target: API_WS,
      ws: true,
      changeOrigin: true,
      secure: false,
    };
  }
  if (ADMIN_API_PROXY_TARGET) {
    proxy['/admin-api'] = {
      target: ADMIN_API_PROXY_TARGET,
      changeOrigin: true,
      secure: false,
      rewrite: (path: string) => {
        if (ADMIN_PROXY_IS_VERCEL) return path;
        if (/^\/admin-api\/api\//.test(path)) return path.replace(/^\/admin-api/, '');
        return path.replace(/^\/admin-api/, '/api');
      },
    };
  }

  return {
    envPrefix: 'VITE_',
    base: '/',

    resolve: {
      alias: {
        // IMPORTANT (Windows + Vite dev): use root-relative aliases to prevent
        // duplicate module instances (e.g. /@fs/... vs /src/...) which can break React Context.
        '@': '/src',
        '@components': '/src/components',
        '@pages': '/src/pages',
        '@lib': '/src/lib',
        '@context': '/src/context',
        '@hooks': '/src/hooks',
        '@assets': '/src/assets',
        '@styles': '/src/styles',
        '@utils': '/src/utils',
        '@config': '/src/config',
        '@types': '/src/types',
        '@features': '/src/features',
      },
    },

      server: {
        host: true,
        open: true,
        // Prefer the standard Vite port, but don't crash if it's already used.
        strictPort: false,
      cors: true,
      // Proxy all API + sockets to backend in dev
      proxy: {
        ...proxy,
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
      // Do NOT override VITE_API_URL here; it must come from real env vars.
      // We only define non-sensitive derived values.
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
