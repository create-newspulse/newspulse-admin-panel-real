import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export type AiEngine = "gpt" | "gemini";

type AiEngineToggleProps = {
  engine: AiEngine;
  setEngine: (engine: AiEngine) => void;
};

const fallbackEngines: AiEngine[] = ["gpt", "gemini"];

const AiEngineToggle: React.FC<AiEngineToggleProps> = ({ engine, setEngine }) => {
  const { t } = useTranslation();
  const [availableEngines, setAvailableEngines] = useState<AiEngine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    fetch('/api/ai/engines', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error('API error: ' + res.status);
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('application/json')) {
          const text = await res.text();
          throw new Error('Not valid JSON: ' + text.slice(0, 160));
        }
        return res.json();
      })
      .then((data) => {
        // Accept either an array, or an object with { engines: [...] }
        const list = Array.isArray(data) ? data : Array.isArray(data?.engines) ? data.engines : null;
        if (Array.isArray(list)) {
          const validEngines = list.filter((key: any): key is AiEngine => fallbackEngines.includes(key));
          if (validEngines.length > 0) {
            setAvailableEngines(validEngines);
            setError(null);
          } else {
            setAvailableEngines(fallbackEngines);
            setError(null);
          }
        } else {
          setAvailableEngines(fallbackEngines);
          setError(null);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load AI engines:", err);
        setAvailableEngines(fallbackEngines); // Fallback
        setError(null); // Don't show error UI for fallback
        setLoading(false);
      });
  }, []);

  const options: { key: AiEngine; label: string }[] = availableEngines.map((key) => ({
    key,
    label: key === "gpt" ? "GPT‑5 Auto" : "Gemini 2.5 Pro",
  }));

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
      <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">
        🤖 {t("aiEngineLabel") || "AI Engine"}:
      </label>
      {loading ? (
        <div className="text-sm text-slate-500 dark:text-slate-300 ml-2">
          ⏳ {t("loading") || "Loading..."}
        </div>
      ) : options.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {options.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setEngine(key)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md border transition-all duration-200
                ${
                  engine === key
                    ? "bg-blue-600 text-white border-blue-700 shadow-md"
                    : "bg-white text-gray-800 border-gray-300 hover:bg-gray-100 dark:bg-gray-800 dark:text-white dark:border-gray-600"
                }`}
            >
              {label}
            </button>
          ))}
        </div>
      ) : (
        // Only shows if all fetch/parse attempts failed and nothing to show
        <div className="text-sm text-red-500 ml-2">
          ⚠️ {error || t("errorLoading") || "Failed to load engines"}
        </div>
      )}
    </div>
  );
};

export default AiEngineToggle;
