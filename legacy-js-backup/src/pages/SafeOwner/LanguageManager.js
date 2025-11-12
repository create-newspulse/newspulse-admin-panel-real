import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Γ£à Step 1: Create LanguageManager.tsx inside /src/pages/SafeOwner
import { useEffect, useState } from 'react';
const indianLanguages = [
    { name: 'Gujarati', label: '≡ƒç«≡ƒç│ α¬ùα½üα¬£α¬░α¬╛α¬ñα½Ç (Gujarati)' },
    { name: 'Hindi', label: '≡ƒç«≡ƒç│ αñ╣αñ┐αñ¿αÑìαñªαÑÇ (Hindi)' },
    { name: 'English', label: '≡ƒç«≡ƒç│ English (English)' },
    { name: 'Bengali', label: '≡ƒç«≡ƒç│ αª¼αª╛αªéαª▓αª╛ (Bengali)' },
    { name: 'Marathi', label: '≡ƒç«≡ƒç│ αñ«αñ░αñ╛αñáαÑÇ (Marathi)' },
    { name: 'Tamil', label: '≡ƒç«≡ƒç│ α«ñα««α«┐α«┤α»ì (Tamil)' },
    { name: 'Telugu', label: '≡ƒç«≡ƒç│ α░ñα▒åα░▓α▒üα░ùα▒ü (Telugu)' },
    { name: 'Kannada', label: '≡ƒç«≡ƒç│ α▓òα▓¿α│ìα▓¿α▓í (Kannada)' },
];
const globalLanguages = [
    { name: 'Spanish', label: '≡ƒç¬≡ƒç╕ Espa├▒ol (Spanish)' },
    { name: 'French', label: '≡ƒç½≡ƒç╖ Fran├ºais (French)' },
    { name: 'German', label: '≡ƒç⌐≡ƒç¬ Deutsch (German)' },
    { name: 'Chinese', label: '≡ƒç¿≡ƒç│ Σ╕¡µûç (Chinese)' },
    { name: 'Arabic', label: '≡ƒç╕≡ƒçª ╪º┘ä╪╣╪▒╪¿┘è╪⌐ (Arabic)' },
    { name: 'Portuguese', label: '≡ƒç╡≡ƒç╣ Portugu├¬s (Portuguese)' },
    { name: 'Russian', label: '≡ƒç╖≡ƒç║ ╨á╤â╤ü╤ü╨║╨╕╨╣ (Russian)' },
    { name: 'Japanese', label: '≡ƒç»≡ƒç╡ µùÑµ£¼Φ¬₧ (Japanese)' },
];
const LanguageManager = () => {
    const [enabledLanguages, setEnabledLanguages] = useState([]);
    const [defaultLanguage, setDefaultLanguage] = useState('English');
    useEffect(() => {
        const saved = JSON.parse(localStorage.getItem('languageSettings') || '{}');
        setEnabledLanguages(saved.enabled || ['English', 'Hindi', 'Gujarati']);
        setDefaultLanguage(saved.default || 'English');
    }, []);
    const toggleLanguage = (lang) => {
        setEnabledLanguages((prev) => prev.includes(lang)
            ? prev.filter((l) => l !== lang)
            : [...prev, lang]);
    };
    const handleSave = () => {
        const config = {
            default: defaultLanguage,
            enabled: enabledLanguages,
        };
        localStorage.setItem('languageSettings', JSON.stringify(config));
        alert('Γ£à Language settings saved!');
    };
    return (_jsxs("div", { className: "p-6", children: [_jsx("h1", { className: "text-2xl font-bold mb-4", children: "\uD83C\uDF10 Language Manager" }), _jsxs("div", { className: "mb-6", children: [_jsx("label", { className: "block font-semibold mb-2", children: "Set Default Language" }), _jsx("select", { value: defaultLanguage, onChange: (e) => setDefaultLanguage(e.target.value), className: "border rounded px-3 py-2", children: [...indianLanguages, ...globalLanguages].map((lang) => (_jsx("option", { value: lang.name, children: lang.label }, lang.name))) })] }), _jsxs("div", { className: "mb-6", children: [_jsx("label", { className: "block font-semibold mb-2", children: "\uD83D\uDFE2 Indian Languages" }), _jsx("div", { className: "grid grid-cols-2 md:grid-cols-3 gap-3", children: indianLanguages.map((lang) => (_jsx("button", { onClick: () => toggleLanguage(lang.name), className: `px-4 py-2 rounded shadow text-center ${enabledLanguages.includes(lang.name)
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-black'}`, children: lang.label }, lang.name))) })] }), _jsxs("div", { className: "mb-6", children: [_jsx("label", { className: "block font-semibold mb-2", children: "\uD83C\uDF0D Global Languages" }), _jsx("div", { className: "grid grid-cols-2 md:grid-cols-3 gap-3", children: globalLanguages.map((lang) => (_jsx("button", { onClick: () => toggleLanguage(lang.name), className: `px-4 py-2 rounded shadow text-center ${enabledLanguages.includes(lang.name)
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-black'}`, children: lang.label }, lang.name))) })] }), _jsx("button", { onClick: handleSave, className: "mt-6 bg-blue-600 text-white px-6 py-2 rounded shadow hover:bg-blue-500", children: "Save Preferences" })] }));
};
export default LanguageManager;
