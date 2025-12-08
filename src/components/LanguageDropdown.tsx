import React, { useEffect, useState } from "react";
import { supportedLanguages } from "../lib/languageConfig";

export interface LanguageOption {
  name: string;
  code: string;
  label: string;
}

export default function LanguageDropdown() {
  const [selectedLangCode, setSelectedLangCode] = useState<string>("en");

  useEffect(() => {
    const savedCode = localStorage.getItem("preferredLanguage") || "en";
    setSelectedLangCode(savedCode);
    document.documentElement.lang = savedCode;
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const langCode = e.target.value;
    setSelectedLangCode(langCode);
    localStorage.setItem("preferredLanguage", langCode);
    document.documentElement.lang = langCode;
    window.location.reload(); // Optional: useful if using i18n
  };

  return (
    <div className="relative z-50 flex items-center gap-2">
      <label htmlFor="lang-select" className="text-sm font-semibold text-white dark:text-slate-50">
        🌐 Language:
      </label>

      <select
        id="lang-select"
        value={selectedLangCode}
        onChange={handleChange}
        className="p-2 rounded-md border bg-white dark:bg-slate-800 text-black dark:text-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        {supportedLanguages.map((lang: LanguageOption) => (
          <option key={lang.code} value={lang.code}>
            {lang.label}
          </option>
        ))}
      </select>
    </div>
  );
}
