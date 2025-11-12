import { jsx as _jsx } from "react/jsx-runtime";
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
// ≡ƒºá Global Providers
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
// ≡ƒÄ» Grouped providers
const Providers = ({ children }) => (_jsx(React.StrictMode, { children: _jsx(BrowserRouter, { children: _jsx(NotificationProvider, { children: _jsx(AuthProvider, { children: _jsx(LanguageProvider, { children: _jsx(DarkModeProvider, { children: _jsx(ThemeProvider, { children: _jsx(SidebarProvider, { children: children }) }) }) }) }) }) }) }));
// ≡ƒÜÇ Mount App
const rootEl = document.getElementById("root");
if (!rootEl)
    throw new Error("Γ¥î Root element #root not found in index.html");
createRoot(rootEl).render(_jsx(Providers, { children: _jsx(App, {}) }));
