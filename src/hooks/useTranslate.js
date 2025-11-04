import { useLanguage } from '../context/LanguageContext';
import { translations } from '../lib/translations';
// Supported languages
const allowedLanguages = ['English', 'Hindi', 'Gujarati'];
export function useTranslate() {
    const { selectedLanguage } = useLanguage();
    const lang = allowedLanguages.includes(selectedLanguage)
        ? selectedLanguage
        : 'English';
    return (key) => {
        const result = translations[lang]?.[key] || translations['English'][key];
        return result ?? key.charAt(0).toUpperCase() + key.slice(1);
    };
}
