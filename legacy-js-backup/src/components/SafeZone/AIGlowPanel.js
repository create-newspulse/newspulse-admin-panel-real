import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { API_BASE_PATH } from '@lib/api';
import { FaHeartbeat, FaRobot, FaBolt, FaBrain } from "react-icons/fa";
const AIGlowPanel = () => {
    const [aiSystems, setAISystems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        let isMounted = true;
        const fetchStatus = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(`${API_BASE_PATH}/ai-glow-status`, { credentials: 'include' });
                const ct = res.headers.get('content-type') || '';
                if (!res.ok) {
                    const txt = await res.text().catch(() => '');
                    throw new Error(`HTTP ${res.status}. Body: ${txt.slice(0, 160)}`);
                }
                if (!/application\/json/i.test(ct)) {
                    const txt = await res.text().catch(() => '');
                    throw new Error(`Expected JSON, got ${ct}. Body: ${txt.slice(0, 160)}`);
                }
                const json = await res.json();
                if (isMounted && json.systems && Array.isArray(json.systems)) {
                    setAISystems(json.systems);
                }
                else {
                    throw new Error('Invalid API data format');
                }
            }
            catch (err) {
                if (isMounted) {
                    setAISystems([]);
                    setError("ΓÜá∩╕Å Failed to load AI system status.");
                }
            }
            finally {
                if (isMounted)
                    setLoading(false);
            }
        };
        fetchStatus();
        return () => {
            isMounted = false;
        };
    }, []);
    const statusColor = {
        active: "text-green-400",
        idle: "text-yellow-300",
        error: "text-red-400",
    };
    return (_jsxs("section", { className: "relative p-6 bg-gradient-to-br from-purple-700/40 to-indigo-800/40 border border-purple-500/30 rounded-2xl shadow-xl transition hover:shadow-2xl hover:scale-[1.01] duration-300 text-white backdrop-blur-lg overflow-hidden", children: [_jsx("div", { className: "absolute -top-4 -left-4 w-32 h-32 bg-purple-500 blur-2xl opacity-20 animate-ping rounded-full pointer-events-none" }), _jsxs("h2", { className: "text-2xl font-bold mb-3 flex items-center gap-2 text-purple-100 drop-shadow", children: [_jsx(FaRobot, { className: "text-purple-300 animate-pulse" }), " KiranOS AI Panel"] }), _jsxs("p", { className: "text-sm md:text-base text-purple-200 mb-4 flex items-center gap-2", children: [_jsx(FaBolt, { className: "text-yellow-300 animate-bounce" }), "Real-time snapshot of AI engines working inside News Pulse."] }), loading ? (_jsxs("p", { className: "text-xs text-purple-300 animate-pulse flex items-center gap-2", children: [_jsx(FaHeartbeat, { className: "animate-spin text-pink-400" }), "Loading AI systems..."] })) : error ? (_jsx("p", { className: "text-xs text-red-400 flex items-center gap-2", children: error })) : aiSystems.length === 0 ? (_jsx("p", { className: "text-xs text-purple-300", children: "No AI systems found." })) : (_jsx("ul", { className: "space-y-3 text-sm", children: aiSystems.map((ai, idx) => (_jsxs("li", { className: "flex items-center justify-between text-purple-100 bg-white/5 px-3 py-2 rounded-lg shadow-inner border border-purple-500/10 hover:bg-purple-500/10 transition", children: [_jsxs("span", { className: "flex items-center gap-2", children: [_jsx(FaBrain, { className: "text-indigo-300" }), ai.system] }), _jsxs("span", { className: `font-mono ${statusColor[ai.status]} animate-pulse`, children: ["\u25CF ", ai.status.toUpperCase()] })] }, idx))) }))] }));
};
export default AIGlowPanel;
