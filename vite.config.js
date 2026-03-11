import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
const r = (p) => fileURLToPath(new URL(p, import.meta.url));
const stripSlash = (u) => (u ? u.replace(/\/+$/, '') : u);
const hasPlaceholders = (s) => /[<>]/.test(String(s || ''));
const isValidAbsoluteUrl = (u) => {
    const s = String(u || '').trim();
    if (!/^https?:\/\//i.test(s))
        return false;
    try {
        // eslint-disable-next-line no-new
        new URL(s);
        return true;
    }
    catch {
        return false;
    }
};
// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const DEFAULT_LOCAL_BACKEND = 'http://localhost:5000';
    const DEV_SERVER_PORT = 5173;
    const proxyDebug = String(env.VITE_PROXY_DEBUG || '').toLowerCase() === 'true';
    const rawDevProxyEnv = stripSlash(env.VITE_ADMIN_API_TARGET || env.VITE_DEV_PROXY_TARGET || '');
    const normalizedDevProxyEnv = /\/api$/i.test(rawDevProxyEnv)
        ? rawDevProxyEnv.replace(/\/api$/i, '')
        : rawDevProxyEnv;
    const DEV_PROXY_TARGET = (!normalizedDevProxyEnv || hasPlaceholders(normalizedDevProxyEnv) || !isValidAbsoluteUrl(normalizedDevProxyEnv))
        ? DEFAULT_LOCAL_BACKEND
        : normalizedDevProxyEnv;
    // Never hardcode a production backend here.
    // If you need a remote backend for `vite preview`, set ADMIN_BACKEND_URL explicitly.
    const DEFAULT_REAL_BACKEND = stripSlash(process.env.ADMIN_BACKEND_URL
        || process.env.NP_REAL_BACKEND
        || env.NP_REAL_BACKEND
        || '');
    const rawOrigin = stripSlash(mode === 'development' ? DEV_PROXY_TARGET : (env.VITE_BACKEND_ORIGIN || ''));
    const devDefaultOrigin = DEFAULT_LOCAL_BACKEND;
    let originSource = 'VITE_BACKEND_ORIGIN';
    let ORIGIN = rawOrigin;
    if (!ORIGIN || hasPlaceholders(ORIGIN) || !isValidAbsoluteUrl(ORIGIN)) {
        ORIGIN = mode === 'development' ? devDefaultOrigin : DEFAULT_REAL_BACKEND;
        originSource = mode === 'development' ? `default:${devDefaultOrigin}` : (DEFAULT_REAL_BACKEND ? `default:${DEFAULT_REAL_BACKEND}` : 'default');
    }
    // Proxy targets must be backend ORIGIN (no /api suffix), otherwise we can create /api/api/*
    const RESOLVED_BACKEND_ORIGIN = /\/api$/i.test(ORIGIN) ? ORIGIN.replace(/\/api$/i, '') : ORIGIN;
    const DEV_BACKEND_ORIGIN = mode === 'development' ? DEV_PROXY_TARGET : RESOLVED_BACKEND_ORIGIN;
    const API_WS = stripSlash(env.VITE_API_WS) || RESOLVED_BACKEND_ORIGIN;

    if (mode === 'development') {
        console.log(`[vite] Admin dev proxy: /admin-api/* -> ${DEV_BACKEND_ORIGIN}/api/*`);
    }

    const attachProxyErrorLogger = (proxy, kind) => {
        let last = 0;
        proxy.on('proxyRes', (proxyRes, req) => {
            try {
                const status = Number(proxyRes?.statusCode || 0);
                const inUrl = String(req?.url || '');
                if (proxyDebug && kind === 'admin-api' && /^\/admin-api\/ads\/inquiries(\/|\?|$)/.test(inUrl)) {
                    let mapped = inUrl;
                    mapped = mapped.replace(/^\/admin-api/, '/api');
                    mapped = mapped.replace(/^\/api\/api\//, '/api/');
                    // eslint-disable-next-line no-console
                    console.log(`[vite-proxy] ${kind} ${req?.method || 'GET'} ${inUrl} -> ${DEV_BACKEND_ORIGIN}${mapped} (${status || 'unknown'})`);
                }
                if (!status || status < 400) return;
                const now = Date.now();
                // throttle a bit to avoid noisy logs when the UI retries
                if (now - last < 500) return;
                last = now;
                let mapped = inUrl;
                if (kind === 'admin-api') {
                    mapped = mapped.replace(/^\/admin-api/, '/api');
                    mapped = mapped.replace(/^\/api\/api\//, '/api/');
                }
                if (kind === 'api') {
                    mapped = mapped.replace(/^\/api\/api\//, '/api/');
                }
                // eslint-disable-next-line no-console
                console.warn(`[vite-proxy] ${kind} ${req?.method || 'GET'} ${inUrl} -> ${DEV_BACKEND_ORIGIN}${mapped} (${status})`);
            } catch {
                // ignore
            }
        });
        proxy.on('error', (err, req) => {
            try {
                const inUrl = String(req?.url || '');
                let mapped = inUrl;
                if (kind === 'admin-api') {
                    mapped = mapped.replace(/^\/admin-api/, '/api');
                    mapped = mapped.replace(/^\/api\/api\//, '/api/');
                }
                if (kind === 'api') {
                    mapped = mapped.replace(/^\/api\/api\//, '/api/');
                }
                // eslint-disable-next-line no-console
                console.warn(`[vite-proxy] ${kind} ${req?.method || 'GET'} ${inUrl} -> ${DEV_BACKEND_ORIGIN}${mapped} (error: ${err?.code || err?.message || 'unknown'})`);
            } catch {
                // ignore
            }
        });
    };
    return {
        plugins: [react()],
        envPrefix: 'VITE_',
        resolve: {
            alias: {
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
                // DEV contract: frontend calls go through '/admin-api/*'.
                '/admin-api': {
                    target: DEV_BACKEND_ORIGIN,
                    changeOrigin: true,
                    secure: false,
                    timeout: 120000,
                    proxyTimeout: 120000,
                    configure: (proxy) => attachProxyErrorLogger(proxy, 'admin-api'),
                    // DEV: match Vercel behavior: /admin-api/* -> /api/*
                    // Also tolerate accidental double-prefixes.
                    rewrite: (p) => {
                        if (/^\/admin-api\/api\//.test(p))
                            return p.replace(/^\/admin-api/, '').replace(/^\/api\/api\//, '/api/');
                        return p.replace(/^\/admin-api/, '/api').replace(/^\/api\/api\//, '/api/');
                    },
                },
                '/api': {
                    target: DEV_BACKEND_ORIGIN,
                    changeOrigin: true,
                    secure: false,
                    timeout: 120000,
                    proxyTimeout: 120000,
                    configure: (proxy) => attachProxyErrorLogger(proxy, 'api'),
                    // keep path mostly as-is so /api/* hits backend /api/*
                    // but collapse accidental double-prefixes: /api/api/* -> /api/*
                    rewrite: (p) => p.replace(/^\/api\/api\//, '/api/'),
                },
                '/socket.io': {
                    target: mode === 'development' ? DEV_PROXY_TARGET : API_WS,
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
                        jspdf: ['jspdf', 'html2pdf.js'],
                        tiptap: [
                            '@tiptap/react',
                            '@tiptap/starter-kit',
                            '@tiptap/extension-image',
                            '@tiptap/extension-link',
                            // removed placeholder extension (not installed)
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
        // Speed up dev for common deps (optional)
        optimizeDeps: {
            include: ['react', 'react-dom', 'socket.io-client'],
        },
    };
});
