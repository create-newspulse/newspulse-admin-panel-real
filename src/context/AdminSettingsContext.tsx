import { createContext, useContext, useState, ReactNode } from 'react';

type AdminSettingsContextType = {
  panelGuideVisible: boolean;
  showLoginRecords: boolean;
  showBackupPanel: boolean;
  enableAITrainer: boolean;
  restrictToFounder: boolean;
  showSystemHealth: boolean;
  showTrafficAnalytics: boolean;
  showAIActivityLog: boolean;
  showRevenuePanel: boolean;
  enableExportPDF: boolean;
  allowEditorMode: boolean;
  themeColor: string;
  setThemeColor: (color: string) => void;
  toggleSetting: (key: keyof Omit<AdminSettingsContextType, 'toggleSetting' | 'themeColor' | 'setThemeColor'>) => void;
};

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

const AdminSettingsContext = createContext<AdminSettingsContextType | undefined>(undefined);

export const AdminSettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<Omit<AdminSettingsContextType, 'toggleSetting' | 'themeColor' | 'setThemeColor'>>(
    defaultSettings
  );
  const [themeColor, setThemeColor] = useState<string>(
    localStorage.getItem('themeColor') || '#2563eb'
  );

  const toggleSetting = (
    key: keyof Omit<AdminSettingsContextType, 'toggleSetting' | 'themeColor' | 'setThemeColor'>
  ) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <AdminSettingsContext.Provider
      value={{ ...settings, themeColor, setThemeColor, toggleSetting }}
    >
      {children}
    </AdminSettingsContext.Provider>
  );
};

export const useAdminSettings = () => {
  const context = useContext(AdminSettingsContext);
  if (!context) throw new Error('useAdminSettings must be used within AdminSettingsProvider');
  return context;
};
