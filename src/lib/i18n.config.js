// 📁 src/lib/i18n.config.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
// 🔤 Translation files
import en from '../locales/en.json';
import gu from '../locales/gu.json';
import hi from '../locales/hi.json';
// 🚀 i18n Initialization
i18n
    .use(LanguageDetector) // 🌍 Detect from browser/localStorage
    .use(initReactI18next) // 🔌 Connect with React
    .init({
    resources: {
        en: { translation: en },
        gu: { translation: gu },
        hi: { translation: hi },
    },
    fallbackLng: 'en', // Default fallback language
    detection: {
        order: ['localStorage', 'navigator'],
        caches: ['localStorage'],
    },
    interpolation: {
        escapeValue: false, // React already protects from XSS
    },
});
export default i18n;
