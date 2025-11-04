import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
const fallbackEngines = ["gpt", "gemini"];
const AiEngineToggle = ({ engine, setEngine }) => {
    const { t } = useTranslation();
    const [availableEngines, setAvailableEngines] = useState([]);
    const [loading, setLoading] = useState(true);
    const [openaiModel, setOpenaiModel] = useState('gpt-5');
    const [error, setError] = useState(null);
    useEffect(() => {
        setLoading(true);
        setError(null);
        fetch('/api/ai/engines', { credentials: 'include' })
            .then(async (res) => {
            if (!res.ok)
                throw new Error('API error: ' + res.status);
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
                const validEngines = list.filter((key) => fallbackEngines.includes(key));
                if (validEngines.length > 0) {
                    setAvailableEngines(validEngines);
                    setError(null);
                }
                else {
                    setAvailableEngines(fallbackEngines);
                    setError(null);
                }
            }
            else {
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
        // Also fetch current OpenAI model for display if available
        fetch('/api/system/ai-health', { credentials: 'include' })
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
            const m = d && (d.model || d.selectedModel);
            if (typeof m === 'string' && m)
                setOpenaiModel(m);
        })
            .catch(() => { });
    }, []);
    const pretty = (m) => {
        const v = (m || 'gpt-5').trim().toLowerCase();
        if (v === 'gpt-5' || v === 'gpt5')
            return 'GPT‑5 Plus';
        if (v === 'gpt-5-auto')
            return 'GPT‑5 Auto';
        return (m || 'gpt-5')
            .replace(/^gpt-/, 'GPT-')
            .replace(/-/g, ' ')
            .replace(/G P T/, 'GPT');
    };
    const options = availableEngines.map((key) => ({
        key,
        label: key === "gpt" ? `OpenAI (${pretty(openaiModel)})` : "Gemini 1.5 Pro",
    }));
    return (_jsxs("div", { className: "flex flex-col sm:flex-row items-start sm:items-center gap-2", children: [_jsxs("label", { className: "text-sm font-semibold text-gray-700 dark:text-gray-200", children: ["\uD83E\uDD16 ", t("aiEngineLabel") || "AI Engine", ":"] }), loading ? (_jsxs("div", { className: "text-sm text-slate-500 dark:text-slate-300 ml-2", children: ["\u23F3 ", t("loading") || "Loading..."] })) : options.length > 0 ? (_jsx("div", { className: "flex flex-wrap gap-2", children: options.map(({ key, label }) => (_jsx("button", { onClick: () => setEngine(key), className: `px-4 py-1.5 text-sm font-medium rounded-md border transition-all duration-200
                ${engine === key
                        ? "bg-blue-600 text-white border-blue-700 shadow-md"
                        : "bg-white text-gray-800 border-gray-300 hover:bg-gray-100 dark:bg-gray-800 dark:text-white dark:border-gray-600"}`, children: label }, key))) })) : (
            // Only shows if all fetch/parse attempts failed and nothing to show
            _jsxs("div", { className: "text-sm text-red-500 ml-2", children: ["\u26A0\uFE0F ", error || t("errorLoading") || "Failed to load engines"] }))] }));
};
export default AiEngineToggle;
