import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useEffect, useState } from 'react';
import i18n from '../lib/i18n.config';
// ≡ƒîì Create context with a default fallback
const LanguageContext = createContext({
    selectedLanguage: 'en',
    setLanguage: () => { },
});
// Γ£à Provider component
export const LanguageProvider = ({ children }) => {
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
    const setLanguage = (lang) => {
        setSelectedLanguage(lang);
        i18n.changeLanguage(lang);
        localStorage.setItem('preferredLanguage', lang);
        document.cookie = `preferredLanguage=${encodeURIComponent(lang)}; path=/; max-age=31536000`;
    };
    return (_jsx(LanguageContext.Provider, { value: { selectedLanguage, setLanguage }, children: children }));
};
// ≡ƒöü Hook to use language context
export const useLanguage = () => {
    return useContext(LanguageContext);
};
// ≡ƒì¬ Utility: Get cookie by name
function getCookie(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
}
