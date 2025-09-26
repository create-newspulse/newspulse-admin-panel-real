import { useLanguage } from '../context/LanguageContext';
import { translations } from '../lib/translations';

// Type-safe key mapping
type LanguageKey = keyof typeof translations['English'];

// Supported languages
const allowedLanguages = ['English', 'Hindi', 'Gujarati'] as const;
type AllowedLanguage = (typeof allowedLanguages)[number];

export function useTranslate() {
  const { selectedLanguage } = useLanguage();

  const lang: AllowedLanguage = allowedLanguages.includes(selectedLanguage as AllowedLanguage)
    ? (selectedLanguage as AllowedLanguage)
    : 'English';

  return (key: LanguageKey): string => {
    const result = translations[lang]?.[key] || translations['English'][key];
    return result ?? key.charAt(0).toUpperCase() + key.slice(1);
  };
}
