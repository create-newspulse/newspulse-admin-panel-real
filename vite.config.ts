// vite.config.ts
import { createLogger, defineConfig, loadEnv, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';

const stripSlash = (u?: string): string => String(u ?? '').replace(/\/+$/, '');
const hasPlaceholders = (s?: string) => /[<>]/.test(String(s || ''));
const isValidAbsoluteUrl = (u?: string) => {
  const s = String(u || '').trim();
  if (!/^https?:\/\//i.test(s)) return false;
  try { new URL(s); return true; } catch { return false; }
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }): UserConfig => {
  const env = loadEnv(mode, process.cwd(), '');
  const baseLogger = createLogger();
  const DEFAULT_LOCAL_BACKEND = 'http://localhost:5000';
  const DEV_SERVER_PORT = 5173;
  const useProxy = String(env.VITE_USE_PROXY || '').toLowerCase() === 'true';
  const proxyDebug = String(env.VITE_PROXY_DEBUG || '').toLowerCase() === 'true';
  // Per project convention, allow a non-VITE env var for proxy targeting.
  // This is used only by Vite dev server (never shipped to the browser).
  const BACKEND_URL_ENV = stripSlash(env.BACKEND_URL || process.env.BACKEND_URL || '');
  const adminApiOrigin = stripSlash(env.VITE_ADMIN_API_ORIGIN || ''); // no /api suffix per spec
  const adminApiUrl = stripSlash(env.VITE_ADMIN_API_URL || '');
  const rawDevProxyEnv = stripSlash(env.VITE_ADMIN_API_TARGET || env.VITE_DEV_PROXY_TARGET || '');
  const normalizedDevProxyEnv = /\/api$/i.test(rawDevProxyEnv)
    ? rawDevProxyEnv.replace(/\/api$/i, '')
    : rawDevProxyEnv;
  const DEV_PROXY_TARGET = (!normalizedDevProxyEnv || hasPlaceholders(normalizedDevProxyEnv) || !isValidAbsoluteUrl(normalizedDevProxyEnv))
    ? DEFAULT_LOCAL_BACKEND
    : normalizedDevProxyEnv;
  const ignoredDevProxyVars = [
    BACKEND_URL_ENV ? 'BACKEND_URL' : '',
    stripSlash(env.VITE_BACKEND_ORIGIN || '') ? 'VITE_BACKEND_ORIGIN' : '',
    stripSlash(env.VITE_PROXY_TARGET || '') ? 'VITE_PROXY_TARGET' : '',
  ].filter(Boolean);
  // IMPORTANT:
  // - `VITE_API_URL` is for DIRECT mode (frontend talks straight to backend).
  // - Dev proxy targets should NOT depend on it, otherwise a stale VITE_API_URL
  //   can silently redirect Vite's `/api/*` proxy and cause ECONNREFUSED.
  // Use a dedicated variable for proxy targeting.
  const rawCandidate = stripSlash(
    mode === 'development'
      ? DEV_PROXY_TARGET
      : (
        BACKEND_URL_ENV
        || env.VITE_BACKEND_ORIGIN
        || env.VITE_ADMIN_API_TARGET
        || env.VITE_DEV_PROXY_TARGET
        || env.VITE_BACKEND_URL
        || env.VITE_ADMIN_API_ORIGIN
        || env.VITE_API_BASE_URL
        || ''
      )
  );
  const DEFAULT_REAL_BACKEND = '';
  const looksLocalhost = (() => {
    const s = String(rawCandidate || '').toLowerCase();
    return s.includes('localhost:') || s.includes('127.0.0.1:') || s.includes('0.0.0.0:');
  })();
  const API_TARGET = mode === 'development'
    ? DEV_PROXY_TARGET
    : ((!hasPlaceholders(rawCandidate)
      && isValidAbsoluteUrl(rawCandidate)
      && !looksLocalhost)
      ? rawCandidate
      : DEFAULT_REAL_BACKEND);
  // IMPORTANT: Vite proxy `target` must be the backend ORIGIN (no /api suffix).
  // Otherwise, forwarding a path that already starts with `/api/...` becomes `/api/api/...`.
  const BACKEND_ORIGIN = /\/api$/i.test(API_TARGET) ? API_TARGET.replace(/\/api$/i, '') : API_TARGET;
  const BACKEND_URL = BACKEND_ORIGIN;
  const API_WS = stripSlash(env.VITE_API_WS) || BACKEND_ORIGIN; // default WS -> same host if available

  // Keep /admin-api proxy target consistent with the primary backend origin.
  // (Historically some setups used VITE_BACKEND_URL; keep it as a fallback only.)
  const ADMIN_API_PROXY_TARGET = stripSlash(
    mode === 'development'
      ? DEV_PROXY_TARGET
      : (
        (adminApiUrl && isValidAbsoluteUrl(adminApiUrl) ? adminApiUrl : '')
        || BACKEND_ORIGIN
        || env.VITE_BACKEND_URL
        || process.env.VITE_BACKEND_URL
        || ''
      )
  ) || '';

  // If the dev proxy target is the Vercel admin host, DO NOT rewrite '/admin-api/*' to '/api/*'.
  // Production relies on Vercel rewrites for '/admin-api/*' -> serverless proxy.
  // NOTE: in local dev we hard-pin the target to localhost, so this must be false.
  const ADMIN_PROXY_IS_VERCEL = (() => {
    if (!ADMIN_API_PROXY_TARGET) return false;
    try {
      const host = new URL(ADMIN_API_PROXY_TARGET).hostname.toLowerCase();
      return host === 'admin.newspulse.co.in' || host.endsWith('.vercel.app');
    } catch {
      return false;
    }
  })();

  const proxy: any = {};
  // DEV: proxy common API prefixes to the backend.
  // Default dev proxy to the local backend so localhost never drifts to another port.

  const attachProxyErrorLogger = (proxyServer: any, kind: 'admin-api' | 'api' | 'settings', targetOrigin: string) => {
    let last = 0;
    const mapPath = (inUrl: string) => {
      let mapped = inUrl;
      if (kind === 'admin-api') {
        if (/^\/admin-api\/api\//.test(mapped)) return mapped.replace(/^\/admin-api/, '').replace(/^\/api\/api\//, '/api/');
        return mapped.replace(/^\/admin-api/, '/api').replace(/^\/api\/api\//, '/api/');
      }
      if (kind === 'settings') {
        return mapped.replace(/^\/settings/, '/api/settings');
      }
      return mapped.replace(/^\/api\/api\//, '/api/');
    };
    proxyServer.on('proxyRes', (proxyRes: any, req: any) => {
      try {
        const status = Number(proxyRes?.statusCode || 0);
        const inUrl = String(req?.url || '');
        if (proxyDebug && kind === 'admin-api' && /^\/admin-api\/ads\/inquiries(\/|\?|$)/.test(inUrl)) {
          const mapped = mapPath(inUrl);
          // eslint-disable-next-line no-console
          console.log(`[vite-proxy] ${kind} ${req?.method || 'GET'} ${inUrl} -> ${stripSlash(targetOrigin)}${mapped} (${status || 'unknown'})`);
        }
        if (!status || status < 400) return;
        const now = Date.now();
        // throttle a bit to avoid noisy logs when the UI retries
        if (now - last < 500) return;
        last = now;
        const mapped = mapPath(inUrl);
        // eslint-disable-next-line no-console
        console.warn(`[vite-proxy] ${kind} ${req?.method || 'GET'} ${inUrl} -> ${stripSlash(targetOrigin)}${mapped} (${status})`);
      } catch {
        // ignore
      }
    });
    proxyServer.on('error', (err: any, req: any) => {
      try {
        const inUrl = String(req?.url || '');
        const mapped = mapPath(inUrl);
        // eslint-disable-next-line no-console
        console.warn(`[vite-proxy] ${kind} ${req?.method || 'GET'} ${inUrl} -> ${stripSlash(targetOrigin)}${mapped} (error: ${err?.code || err?.message || 'unknown'})`);
      } catch {
        // ignore
      }
    });
  };
  if (DEV_PROXY_TARGET) {
    proxy['/api'] = {
      target: `${DEV_PROXY_TARGET}`,
      changeOrigin: true,
      secure: false,
      timeout: 120000,
      proxyTimeout: 120000,
      configure: (p: any) => attachProxyErrorLogger(p, 'api', DEV_PROXY_TARGET),
    };
    // Support public settings in local dev (maps /settings/* -> /api/settings/*)
    proxy['/settings'] = {
      target: `${DEV_PROXY_TARGET}`,
      changeOrigin: true,
      secure: false,
      timeout: 120000,
      proxyTimeout: 120000,
      configure: (p: any) => attachProxyErrorLogger(p, 'settings', DEV_PROXY_TARGET),
      rewrite: (path: string) => path.replace(/^\/settings/, '/api/settings'),
    };
    proxy['/socket.io'] = {
      target: mode === 'development' ? DEV_PROXY_TARGET : API_WS,
      ws: true,
      changeOrigin: true,
      secure: false,
    };
  }
  // /admin-api proxy
  // - Dev: default to real backend, unless explicitly pointed to localhost.
  // - Prod: Vercel handles /admin-api via serverless rewrites.
  const ADMIN_PROXY_TARGET = mode === 'development'
    ? DEV_PROXY_TARGET
    : ADMIN_API_PROXY_TARGET;
  if (ADMIN_PROXY_TARGET) {
    proxy['/admin-api'] = {
      target: ADMIN_PROXY_TARGET,
      changeOrigin: true,
      secure: false,
      timeout: 120000,
      proxyTimeout: 120000,
      configure: (p: any) => attachProxyErrorLogger(p, 'admin-api', ADMIN_PROXY_TARGET),
      rewrite: (path: string) => {
        // DEV: match Vercel behavior so calls like '/admin-api/system/health' hit backend '/api/system/health'.
        if (mode === 'development') {
          if (/^\/admin-api\/api\//.test(path)) return path.replace(/^\/admin-api/, '').replace(/^\/api\/api\//, '/api/');
          return path.replace(/^\/admin-api/, '/api').replace(/^\/api\/api\//, '/api/');
        }
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
        port: DEV_SERVER_PORT,
        open: true,
        // Use the fixed local admin port requested by the repo/user.
        strictPort: true,
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
      ...baseLogger,
      info(msg) {
        baseLogger.info(msg);
        if (mode === 'development' && msg.includes('ready in')) {
          baseLogger.info(`[vite] Admin dev proxy: /admin-api/* -> ${DEV_PROXY_TARGET}/api/*`);
          if (ignoredDevProxyVars.length > 0) {
            baseLogger.warn(`[vite] Ignoring ${ignoredDevProxyVars.join(', ')} in development; use VITE_ADMIN_API_TARGET or VITE_DEV_PROXY_TARGET to override ${DEFAULT_LOCAL_BACKEND}.`);
          }
        }
      },
      clearScreen(_type) {
        // no-op
      },
    },

    // Speed up dev for common deps (optional)
    optimizeDeps: {
      include: ['react', 'react-dom', 'socket.io-client'],
    },
  };
});
