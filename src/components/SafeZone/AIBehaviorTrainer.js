import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { API_BASE_PATH } from '@lib/api';
import { fetchJson } from '@lib/fetchJson';
const AIBehaviorTrainer = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        let isMounted = true;
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const json = await fetchJson(`${API_BASE_PATH}/ai-behavior-log`, { timeoutMs: 15000 });
                // Accepts both { data: {...} } and just {...}
                const info = json.data && typeof json.data === "object" ? json.data : json;
                if (typeof info.autoPublished === "number" &&
                    typeof info.flagged === "number" &&
                    typeof info.suggestedHeadlines === "number" &&
                    typeof info.lastTrustUpdate === "string") {
                    if (isMounted)
                        setData(info);
                }
                else {
                    throw new Error("Invalid data shape");
                }
            }
            catch (err) {
                if (isMounted)
                    setError("AIBehaviorTrainer Failed");
            }
            finally {
                if (isMounted)
                    setLoading(false);
            }
        };
        fetchData();
        return () => {
            isMounted = false;
        };
    }, []);
    const formatDate = (dateStr) => {
        const parsed = Date.parse(dateStr);
        return isNaN(parsed) ? "Not available" : new Date(parsed).toLocaleString();
    };
    return (_jsx("section", { className: "p-5 md:p-6 bg-violet-50 dark:bg-violet-950 border border-violet-400 dark:border-violet-600 rounded-2xl shadow max-h-[90vh] overflow-y-auto", children: loading ? (_jsx("p", { className: "text-sm text-slate-500", children: "\u23F3 Loading AI Behavior Log..." })) : error || !data ? (_jsxs(_Fragment, { children: [_jsx("p", { className: "text-red-500 font-mono text-sm mb-2", children: "\u274C AIBehaviorTrainer Failed" }), _jsx("p", { className: "text-sm text-slate-600 dark:text-slate-300", children: "Please check backend status or retry later." })] })) : (_jsxs(_Fragment, { children: [_jsx("p", { className: "text-green-600 dark:text-green-400 font-mono text-sm mb-2", children: "\u2705 AIBehaviorTrainer Loaded" }), _jsx("h2", { className: "text-xl font-bold text-violet-700 dark:text-violet-300 mb-3", children: "\uD83E\uDD16 AI Behavior Log" }), _jsxs("ul", { className: "text-slate-700 dark:text-slate-200 text-sm space-y-2 list-disc list-inside ml-2", children: [_jsxs("li", { children: [_jsx("strong", { children: "Auto-published:" }), " ", data.autoPublished.toLocaleString(), " stories today"] }), _jsxs("li", { children: [_jsx("strong", { children: "Flagged:" }), " ", data.flagged.toLocaleString(), " articles for review"] }), _jsxs("li", { children: [_jsx("strong", { children: "Suggestions:" }), " ", data.suggestedHeadlines.toLocaleString(), " trending headlines"] }), _jsxs("li", { children: [_jsx("strong", { children: "Last Trust Update:" }), " ", formatDate(data.lastTrustUpdate)] })] })] })) }));
};
export default AIBehaviorTrainer;
