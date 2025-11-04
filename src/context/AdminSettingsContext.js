import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useState } from 'react';
const defaultSettings = {
    panelGuideVisible: true,
    showLoginRecords: true,
    showBackupPanel: true,
    enableAITrainer: false,
    restrictToFounder: true,
    showSystemHealth: true,
    showTrafficAnalytics: true,
    showAIActivityLog: false,
    showRevenuePanel: false,
    enableExportPDF: true,
    allowEditorMode: false,
};
const AdminSettingsContext = createContext(undefined);
export const AdminSettingsProvider = ({ children }) => {
    const [settings, setSettings] = useState(defaultSettings);
    const [themeColor, setThemeColor] = useState(localStorage.getItem('themeColor') || '#2563eb');
    const toggleSetting = (key) => {
        setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
    };
    return (_jsx(AdminSettingsContext.Provider, { value: { ...settings, themeColor, setThemeColor, toggleSetting }, children: children }));
};
export const useAdminSettings = () => {
    const context = useContext(AdminSettingsContext);
    if (!context)
        throw new Error('useAdminSettings must be used within AdminSettingsProvider');
    return context;
};
