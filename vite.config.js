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
    const DEFAULT_REAL_BACKEND = stripSlash(process.env.NP_REAL_BACKEND
        || env.NP_REAL_BACKEND
        || 'https://newspulse-backend-real.onrender.com');
    // IMPORTANT:
    // `VITE_BACKEND_ORIGIN` is the ONLY source of truth for the dev proxy backend origin.
    // - Example (local):   VITE_BACKEND_ORIGIN=http://localhost:5000
    // - Example (remote):  VITE_BACKEND_ORIGIN=https://newspulse-backend-real.onrender.com
    // No trailing '/api'.
    const rawOrigin = stripSlash(env.VITE_BACKEND_ORIGIN || '');
    const devDefaultOrigin = 'http://localhost:5000';
    let originSource = 'VITE_BACKEND_ORIGIN';
    let ORIGIN = rawOrigin;
    if (!ORIGIN || hasPlaceholders(ORIGIN) || !isValidAbsoluteUrl(ORIGIN)) {
        ORIGIN = mode === 'development' ? devDefaultOrigin : DEFAULT_REAL_BACKEND;
        originSource = mode === 'development' ? `default:${devDefaultOrigin}` : `default:${DEFAULT_REAL_BACKEND}`;
    }
    // Proxy targets must be backend ORIGIN (no /api suffix), otherwise we can create /api/api/*
    const BACKEND_ORIGIN = /\/api$/i.test(ORIGIN) ? ORIGIN.replace(/\/api$/i, '') : ORIGIN;
    const API_WS = stripSlash(env.VITE_API_WS) || BACKEND_ORIGIN;

    if (mode === 'development') {
        // eslint-disable-next-line no-console
        console.log('[vite] Resolved backend origin:', BACKEND_ORIGIN, `(source: ${originSource})`);
    }

    const attachProxy404Logger = (proxy, kind) => {
        let last = 0;
        proxy.on('proxyRes', (proxyRes, req) => {
            try {
                if (proxyRes?.statusCode !== 404) return;
                const now = Date.now();
                // throttle a bit to avoid noisy logs when the UI retries
                if (now - last < 1000) return;
                last = now;
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
                console.warn(`[vite-proxy-404] ${req?.method || 'GET'} ${inUrl} -> ${BACKEND_ORIGIN}${mapped}`);
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
            open: true,
            // Prefer 5173, but don't crash if it's already used.
            strictPort: false,
            cors: true,
            // Proxy all API + sockets to backend in dev
            proxy: {
                // DEV contract: frontend calls go through '/admin-api/*'.
                '/admin-api': {
                    target: BACKEND_ORIGIN,
                    changeOrigin: true,
                    secure: false,
                    configure: (proxy) => attachProxy404Logger(proxy, 'admin-api'),
                    // Map '/admin-api/*' -> backend '/api/*'
                    // Example: /admin-api/admin/ad-settings -> /api/admin/ad-settings
                    rewrite: (p) => {
                        // Keep parity with the Vercel proxy which tolerates callers that already include '/api'.
                        // Examples:
                        // - /admin-api/articles        -> /api/articles
                        // - /admin-api/api/articles    -> /api/articles
                        const out = p.replace(/^\/admin-api/, '/api');
                        const final = out.replace(/^\/api\/api\//, '/api/');
                        if (mode === 'development') {
                            console.log(`[vite-proxy] ${p} -> ${BACKEND_ORIGIN}${final}`);
                        }
                        return final;
                    },
                },
                '/api': {
                    target: BACKEND_ORIGIN,
                    changeOrigin: true,
                    secure: false,
                    configure: (proxy) => attachProxy404Logger(proxy, 'api'),
                    // keep path mostly as-is so /api/* hits backend /api/*
                    // but collapse accidental double-prefixes: /api/api/* -> /api/*
                    rewrite: (p) => p.replace(/^\/api\/api\//, '/api/'),
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
