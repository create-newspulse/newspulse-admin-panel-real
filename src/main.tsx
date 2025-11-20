import React, { Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

// Explicit extension to force TS source (App.tsx) on CI and avoid stale App.js
import App from "./App.tsx";
import ErrorBoundary from './components/common/ErrorBoundary';
import { ErrorBoundary as SystemErrorBoundary } from './components/system/ErrorBoundary';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import "./index.css";

// 🧠 Global Providers
import { AuthProvider } from "./context/AuthContext";
import { DarkModeProvider } from "./context/DarkModeContext";
import { ThemeProvider } from "./context/ThemeContext";
import { SidebarProvider } from "./context/SidebarContext";
import { NotificationProvider } from "./context/NotificationContext";
import { LanguageProvider } from "./context/LanguageContext";
import { bootstrapAuth } from "./lib/auth";
bootstrapAuth();
// Initialize DOMPurify in the browser to make window.DOMPurify available
import initDomPurify from './lib/initDomPurify';
initDomPurify();
// Install guard to surface HTML-as-JS parse failures clearly
import { installHtmlImportGuard } from './lib/guardHtmlImport';
installHtmlImportGuard();

// 🎯 Grouped providers
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
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
          <App />
        </ErrorBoundary>
      </Suspense>
    </SystemErrorBoundary>
  </Providers>
);
