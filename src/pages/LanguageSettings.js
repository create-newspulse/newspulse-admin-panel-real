import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 📁 src/pages/LanguageSettings.tsx
import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
// ✅ Final Supported Language List (Only 3)
const supportedLanguages = [
    { name: 'Gujarati', label: '🇮🇳 ગુજરાતી (Gujarati)', code: 'gu-IN' },
    { name: 'Hindi', label: '🇮🇳 हिन्दी (Hindi)', code: 'hi-IN' },
    { name: 'English', label: '🇮🇳 English (English)', code: 'en-IN' },
];
export default function LanguageSettings() {
    const { selectedLanguage, setLanguage } = useLanguage();
    const [tempSelected, setTempSelected] = useState(selectedLanguage);
    const handleSave = () => {
        setLanguage(tempSelected);
        alert(`✅ Language set to ${tempSelected}`);
    };
    const handleVoicePreview = async () => {
        const selected = supportedLanguages.find((l) => l.name === tempSelected);
        if (!selected)
            return;
        const response = await fetch('/api/speak', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                text: `Welcome to News Pulse in ${selected.name}`,
                languageCode: selected.code,
            }),
        });
        if (!response.ok) {
            const text = await response.text().catch(() => '');
            alert(`Voice preview failed (${response.status}). ${text.slice(0, 160)}`);
            return;
        }
        const audioBlob = await response.blob();
        const url = URL.createObjectURL(audioBlob);
        new Audio(url).play();
    };
    const renderLanguageButtons = () => (_jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6", children: supportedLanguages.map((lang) => (_jsx("button", { onClick: () => setTempSelected(lang.name), className: `p-4 rounded text-center transition ${tempSelected === lang.name
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-gray-200 dark:bg-gray-700'}`, children: lang.label }, lang.name))) }));
    return (_jsxs("div", { className: "p-6", children: [_jsx("h1", { className: "text-2xl font-bold mb-4", children: "\uD83C\uDF10 Language Settings" }), _jsx("h2", { className: "font-semibold text-lg mb-2 text-green-600", children: "\uD83D\uDFE2 Supported Languages" }), renderLanguageButtons(), _jsxs("div", { className: "flex gap-4 mt-6", children: [_jsx("button", { onClick: handleSave, className: "px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-500", children: "Save Preferences" }), _jsx("button", { onClick: handleVoicePreview, className: "px-5 py-2 bg-green-600 text-white rounded hover:bg-green-500", children: "\uD83D\uDD0A Preview Voice" })] })] }));
}
