import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { supportedLanguages } from "../lib/languageConfig";
export default function LanguageDropdown() {
    const [selectedLangCode, setSelectedLangCode] = useState("en");
    useEffect(() => {
        const savedCode = localStorage.getItem("preferredLanguage") || "en";
        setSelectedLangCode(savedCode);
        document.documentElement.lang = savedCode;
    }, []);
    const handleChange = (e) => {
        const langCode = e.target.value;
        setSelectedLangCode(langCode);
        localStorage.setItem("preferredLanguage", langCode);
        document.documentElement.lang = langCode;
        window.location.reload(); // Optional: useful if using i18n
    };
    return (_jsxs("div", { className: "relative z-50 flex items-center gap-2", children: [_jsx("label", { htmlFor: "lang-select", className: "text-sm font-semibold text-white dark:text-slate-50", children: "\uD83C\uDF10 Language:" }), _jsx("select", { id: "lang-select", value: selectedLangCode, onChange: handleChange, className: "p-2 rounded-md border bg-white dark:bg-slate-800 text-black dark:text-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400", children: supportedLanguages.map((lang) => (_jsx("option", { value: lang.code, children: lang.label }, lang.code))) })] }));
}
