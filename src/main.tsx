import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
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

// 🎯 Grouped providers
const Providers: React.FC<React.PropsWithChildren> = ({ children }) => (
  <React.StrictMode>
    <BrowserRouter>
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
    </BrowserRouter>
  </React.StrictMode>
);

// 🚀 Mount App
const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("❌ Root element #root not found in index.html");
createRoot(rootEl).render(
  <Providers>
    <App />
  </Providers>
);
