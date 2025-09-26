// ✅ Step 1: Create LanguageManager.tsx inside /src/pages/SafeOwner
import { useEffect, useState } from 'react';
const indianLanguages = [
  { name: 'Gujarati', label: '🇮🇳 ગુજરાતી (Gujarati)' },
  { name: 'Hindi', label: '🇮🇳 हिन्दी (Hindi)' },
  { name: 'English', label: '🇮🇳 English (English)' },
  { name: 'Bengali', label: '🇮🇳 বাংলা (Bengali)' },
  { name: 'Marathi', label: '🇮🇳 मराठी (Marathi)' },
  { name: 'Tamil', label: '🇮🇳 தமிழ் (Tamil)' },
  { name: 'Telugu', label: '🇮🇳 తెలుగు (Telugu)' },
  { name: 'Kannada', label: '🇮🇳 ಕನ್ನಡ (Kannada)' },
];

const globalLanguages = [
  { name: 'Spanish', label: '🇪🇸 Español (Spanish)' },
  { name: 'French', label: '🇫🇷 Français (French)' },
  { name: 'German', label: '🇩🇪 Deutsch (German)' },
  { name: 'Chinese', label: '🇨🇳 中文 (Chinese)' },
  { name: 'Arabic', label: '🇸🇦 العربية (Arabic)' },
  { name: 'Portuguese', label: '🇵🇹 Português (Portuguese)' },
  { name: 'Russian', label: '🇷🇺 Русский (Russian)' },
  { name: 'Japanese', label: '🇯🇵 日本語 (Japanese)' },
];

const LanguageManager = () => {
  const [enabledLanguages, setEnabledLanguages] = useState<string[]>([]);
  const [defaultLanguage, setDefaultLanguage] = useState('English');

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('languageSettings') || '{}');
    setEnabledLanguages(saved.enabled || ['English', 'Hindi', 'Gujarati']);
    setDefaultLanguage(saved.default || 'English');
  }, []);

  const toggleLanguage = (lang: string) => {
    setEnabledLanguages((prev) =>
      prev.includes(lang)
        ? prev.filter((l) => l !== lang)
        : [...prev, lang]
    );
  };

  const handleSave = () => {
    const config = {
      default: defaultLanguage,
      enabled: enabledLanguages,
    };
    localStorage.setItem('languageSettings', JSON.stringify(config));
    alert('✅ Language settings saved!');
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">🌐 Language Manager</h1>

      <div className="mb-6">
        <label className="block font-semibold mb-2">Set Default Language</label>
        <select
          value={defaultLanguage}
          onChange={(e) => setDefaultLanguage(e.target.value)}
          className="border rounded px-3 py-2"
        >
          {[...indianLanguages, ...globalLanguages].map((lang) => (
            <option key={lang.name} value={lang.name}>{lang.label}</option>
          ))}
        </select>
      </div>

      <div className="mb-6">
        <label className="block font-semibold mb-2">🟢 Indian Languages</label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {indianLanguages.map((lang) => (
            <button
              key={lang.name}
              onClick={() => toggleLanguage(lang.name)}
              className={`px-4 py-2 rounded shadow text-center ${
                enabledLanguages.includes(lang.name)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-black'
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <label className="block font-semibold mb-2">🌍 Global Languages</label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {globalLanguages.map((lang) => (
            <button
              key={lang.name}
              onClick={() => toggleLanguage(lang.name)}
              className={`px-4 py-2 rounded shadow text-center ${
                enabledLanguages.includes(lang.name)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-black'
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleSave}
        className="mt-6 bg-blue-600 text-white px-6 py-2 rounded shadow hover:bg-blue-500"
      >
        Save Preferences
      </button>
    </div>
  );
};

export default LanguageManager;
