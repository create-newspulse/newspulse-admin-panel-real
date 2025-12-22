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
    const rawCandidate = stripSlash(env.VITE_ADMIN_API_TARGET || env.VITE_BACKEND_URL || env.VITE_ADMIN_API_ORIGIN || '');
    const API_TARGET = (!hasPlaceholders(rawCandidate) && isValidAbsoluteUrl(rawCandidate))
        ? rawCandidate
        : 'http://localhost:5000';
    // IMPORTANT: proxy targets must be backend ORIGIN (no /api suffix), otherwise we can create /api/api/*
    const BACKEND_ORIGIN = /\/api$/i.test(API_TARGET) ? API_TARGET.replace(/\/api$/i, '') : API_TARGET;
    const API_WS = stripSlash(env.VITE_API_WS) || BACKEND_ORIGIN;
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
            port: 5173,
            open: true,
            // Enforce fixed port for CORS allowlist compatibility
            strictPort: true,
            cors: true,
            // Proxy all API + sockets to backend in dev
            proxy: {
                // DEV contract: frontend calls go through '/admin-api/*'.
                '/admin-api': {
                    target: BACKEND_ORIGIN,
                    changeOrigin: true,
                    secure: false,
                    // Strip only the '/admin-api' prefix; callers include '/api' themselves via apiBase.
                    rewrite: (p) => p.replace(/^\/admin-api/, ''),
                },
                '/api': {
                    target: BACKEND_ORIGIN,
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
