import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export type AiEngine = "gpt" | "gemini" | "claude" | "auto";

type AiEngineToggleProps = {
  engine: AiEngine;
  setEngine: (engine: AiEngine) => void;
};

const fallbackEngines: AiEngine[] = ["claude", "gpt", "gemini", "auto"];

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
        if (Array.isArray(data)) {
          const validEngines = data.filter((key): key is AiEngine =>
            fallbackEngines.includes(key)
          );
          // If no valid engines, set fallback and show error
          if (validEngines.length === 0) {
            setAvailableEngines([]);
            setError(t("errorLoading") || "Failed to load engines");
          } else {
            setAvailableEngines(validEngines);
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
    label:
      key === "gpt"
        ? "GPT-4"
        : key === "gemini"
        ? "Gemini 2.5"
        : key === "claude"
        ? "Claude Sonnet 3.7"
        : `${t("autoMode") || "Auto"} ✅`
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
