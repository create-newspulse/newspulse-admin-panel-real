import React, { Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

// Explicit extension to force TS source (App.tsx) on CI and avoid stale App.js
import App from "./App.tsx";
import ErrorBoundary from './components/common/ErrorBoundary';
import { ErrorBoundary as SystemErrorBoundary } from './components/system/ErrorBoundary';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster, toast } from 'react-hot-toast';
import "./index.css";
import { runNavAudit } from '@/dev/navAudit';

// 🧠 Global Providers
// Use path aliases consistently to avoid duplicate module instances in dev (prevents double Contexts)
import { AuthProvider } from "@context/AuthContext";
import { DarkModeProvider } from "@context/DarkModeContext";
import { ThemeProvider } from "@context/ThemeContext";
import { SidebarProvider } from "@context/SidebarContext";
import { NotificationProvider } from "@context/NotificationContext";
import { LanguageProvider } from "@context/LanguageContext";
import { bootstrapAuth } from "./lib/auth";
bootstrapAuth();
// Initialize DOMPurify in the browser to make window.DOMPurify available
import initDomPurify from './lib/initDomPurify';
initDomPurify();
// Install guard to surface HTML-as-JS parse failures clearly
import { installHtmlImportGuard } from './lib/guardHtmlImport';
installHtmlImportGuard();

// Surface API base misconfiguration as a visible toast in production.
if (import.meta.env.PROD) {
  try {
    if (typeof window !== 'undefined') {
      window.addEventListener('np:api-config-error', (ev: any) => {
        const msg = ev?.detail?.message || 'Backend is not configured. Please set VITE_API_URL.';
        toast.error(msg);
      });
    }
  } catch {
    // ignore
  }
}

// Debug env detection for API base on boot (useful on Vercel)
console.log(
  '[adminBoot][env]',
  'VITE_ADMIN_API_URL =', import.meta.env.VITE_ADMIN_API_URL,
  'VITE_ADMIN_API_BASE_URL =', import.meta.env.VITE_ADMIN_API_BASE_URL
);

// Dev-only console error throttling to stop runaway repeated identical logs
if (import.meta.env.DEV) {
  try {
    const origErr = console.error;
    interface Meta { count: number; first: number }
    const registry = new Map<string, Meta>();
    const MAX_INITIAL = 5; // always show first 5 identical errors
    const WINDOW_MS = 60_000; // reset after a minute
    console.error = (...args: any[]) => {
      const key = String(args[0]);
      const meta = registry.get(key) || { count: 0, first: Date.now() };
      meta.count += 1;
      const now = Date.now();
      if (meta.count <= MAX_INITIAL) {
        origErr(...args);
      } else if (meta.count === MAX_INITIAL + 1) {
        origErr('[console-error-throttle] suppressing further repeats for 60s:', key);
      } else if (now - meta.first > WINDOW_MS) {
        meta.count = 1; meta.first = now; origErr(...args);
      }
      registry.set(key, meta);
    };
  } catch {}
}

// 🎯 Grouped providers
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: false, // disable automatic retries to prevent exponential error cascades
    },
  },
});

const Providers: React.FC<React.PropsWithChildren> = ({ children }) => (
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <NotificationProvider>
          <AuthProvider>
            <LanguageProvider>
              <DarkModeProvider>
                <ThemeProvider>
                  <SidebarProvider>{children}</SidebarProvider>
                </ThemeProvider>
              </DarkModeProvider>
            </LanguageProvider>
          </AuthProvider>
        </NotificationProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
);

// 🚀 Mount App
const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("❌ Root element #root not found in index.html");
createRoot(rootEl).render(
  <Providers>
    <SystemErrorBoundary>
      <Suspense fallback={<div style={{ padding:16 }}>Loading…</div>}>
        <ErrorBoundary title="Application error">
          <Toaster position="top-right" richColors />
          <App />
        </ErrorBoundary>
      </Suspense>
    </SystemErrorBoundary>
  </Providers>
);

if (import.meta.env.DEV) {
  try { runNavAudit(); } catch {}
}
