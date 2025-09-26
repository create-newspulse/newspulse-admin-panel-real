import React, { createContext, useContext, useEffect, useState } from 'react';
import i18n from '../lib/i18n.config';

// 🔠 Define the shape of the context
type LanguageContextType = {
  selectedLanguage: string;
  setLanguage: (lang: string) => void;
};

// 🌍 Create context with a default fallback
const LanguageContext = createContext<LanguageContextType>({
  selectedLanguage: 'en',
  setLanguage: () => {},
});

// ✅ Provider component
export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [selectedLanguage, setSelectedLanguage] = useState('en');

  // Load saved language preference on first render
  useEffect(() => {
    const saved = localStorage.getItem('preferredLanguage') || getCookie('preferredLanguage');
    if (saved) {
      setSelectedLanguage(saved);
      i18n.changeLanguage(saved); // Sync i18next language
    }
  }, []);

  // Change language + save preference
  const setLanguage = (lang: string) => {
    setSelectedLanguage(lang);
    i18n.changeLanguage(lang);
    localStorage.setItem('preferredLanguage', lang);
    document.cookie = `preferredLanguage=${encodeURIComponent(lang)}; path=/; max-age=31536000`;
  };

  return (
    <LanguageContext.Provider value={{ selectedLanguage, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

// 🔁 Hook to use language context
export const useLanguage = (): LanguageContextType => {
  return useContext(LanguageContext);
};

// 🍪 Utility: Get cookie by name
function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}
