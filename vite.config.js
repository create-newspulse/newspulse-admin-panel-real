// vite.config.ts
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
    // IMPORTANT:
    // - `VITE_API_URL` is for DIRECT mode (frontend talks straight to backend).
    // - Dev proxy targets should NOT depend on it, otherwise a stale VITE_API_URL
    //   can silently redirect Vite's `/api/*` proxy and cause ECONNREFUSED.
    // Prefer dedicated proxy target; fall back to VITE_API_BASE_URL (used by the simple axios client).
    const rawCandidate = stripSlash(env.VITE_ADMIN_API_TARGET
        || env.VITE_BACKEND_URL
        || env.VITE_ADMIN_API_ORIGIN
        || env.VITE_API_BASE_URL
        || '');
    const useLocalDemo = String(env.VITE_USE_LOCAL_DEMO_BACKEND || '').toLowerCase() === 'true';
    const looksLocalhost = (() => {
        const s = String(rawCandidate || '').toLowerCase();
        return s.includes('localhost:') || s.includes('127.0.0.1:') || s.includes('0.0.0.0:');
    })();
    // Never default to placeholder hosts; they cause ENOTFOUND loops in dev.
    // Order:
    // 1) explicit env candidate (valid absolute URL)
    // 2) local demo backend (when opted-in)
    // 3) local demo backend as a safe default (ECONNREFUSED is clearer than ENOTFOUND)
    const API_TARGET = (!hasPlaceholders(rawCandidate)
        && isValidAbsoluteUrl(rawCandidate)
        && (!looksLocalhost || useLocalDemo))
        ? rawCandidate
        : (useLocalDemo ? 'http://localhost:5000' : 'http://localhost:5000');
    // IMPORTANT: proxy targets must be backend ORIGIN (no /api suffix), otherwise we can create /api/api/*
    const BACKEND_ORIGIN = /\/api$/i.test(API_TARGET) ? API_TARGET.replace(/\/api$/i, '') : API_TARGET;
    const API_WS = stripSlash(env.VITE_API_WS) || BACKEND_ORIGIN;

    if (mode === 'development') {
        // eslint-disable-next-line no-console
        console.log('[vite] Dev proxy target:', BACKEND_ORIGIN);
        // eslint-disable-next-line no-console
        console.log('[vite] Using localhost demo backend:', useLocalDemo);
    }
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
                    // Map '/admin-api/*' -> backend '/api/*'
                    // Example: /admin-api/admin/ad-settings -> /api/admin/ad-settings
                    rewrite: (p) => {
                        // Keep parity with the Vercel proxy which tolerates callers that already include '/api'.
                        // Examples:
                        // - /admin-api/articles        -> /api/articles
                        // - /admin-api/api/articles    -> /api/articles
                        const out = p.replace(/^\/admin-api/, '/api');
                        return out.replace(/^\/api\/api\//, '/api/');
                    },
                },
                '/api': {
                    target: BACKEND_ORIGIN,
                    changeOrigin: true,
                    secure: false,
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
