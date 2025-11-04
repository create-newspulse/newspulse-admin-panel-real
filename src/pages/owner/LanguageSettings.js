import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
export default function LanguageSettings() {
    const { t, i18n } = useTranslation();
    const [lang, setLang] = useState(i18n.language || 'en');
    const changeLanguage = (lng) => {
        i18n.changeLanguage(lng);
        setLang(lng);
    };
    return (_jsxs("div", { className: "max-w-xl mx-auto bg-white dark:bg-slate-800 p-6 rounded-lg shadow border border-slate-200 dark:border-slate-700", children: [_jsx("h1", { className: "text-2xl font-bold mb-4 text-slate-900 dark:text-white", children: t('languageSettings') || 'Language Settings' }), _jsx("label", { className: "block text-sm text-slate-600 dark:text-slate-300 mb-2", children: t('chooseLanguage') || 'Choose language' }), _jsxs("select", { value: lang, onChange: (e) => changeLanguage(e.target.value), className: "w-full p-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white", children: [_jsx("option", { value: "en", children: "English" }), _jsx("option", { value: "hi", children: "\u0939\u093F\u0902\u0926\u0940" }), _jsx("option", { value: "gu", children: "\u0A97\u0AC1\u0A9C\u0AB0\u0ABE\u0AA4\u0AC0" })] }), _jsx("p", { className: "text-xs text-slate-500 dark:text-slate-400 mt-4", children: t('languageSettingsNote') || 'This setting affects UI labels and messages.' })] }));
}
