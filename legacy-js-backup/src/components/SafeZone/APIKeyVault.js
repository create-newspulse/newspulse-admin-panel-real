import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { API_BASE_PATH } from '@lib/api';
import { fetchJson } from '@lib/fetchJson';
import { useEffect, useState } from "react";
import { FaKey, FaLock, FaCheckCircle, FaExclamationTriangle, } from "react-icons/fa";
const APIKeyVault = () => {
    const [keys, setKeys] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        let isMounted = true;
        const fetchKeys = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await fetchJson(`${API_BASE_PATH}/system/api-keys`, { timeoutMs: 15000 });
                // Accepts both { keys: [...] } or { data: { keys: [...] } }
                const keysArr = Array.isArray(data.keys)
                    ? data.keys
                    : data.data && Array.isArray(data.data.keys)
                        ? data.data.keys
                        : null;
                if (Array.isArray(keysArr)) {
                    if (isMounted)
                        setKeys(keysArr);
                }
                else {
                    if (isMounted)
                        setError(data.message || "Failed to fetch keys");
                }
            }
            catch (err) {
                if (isMounted)
                    setError("Server error while fetching API keys");
            }
            finally {
                if (isMounted)
                    setLoading(false);
            }
        };
        fetchKeys();
        return () => {
            isMounted = false;
        };
    }, []);
    const statusColor = {
        valid: "text-green-500",
        missing: "text-red-500",
        expired: "text-yellow-400",
    };
    return (_jsxs("section", { className: "p-5 md:p-6 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-400/30 rounded-2xl shadow-inner max-h-[90vh] overflow-y-auto", children: [_jsxs("div", { className: "mb-3 flex items-center gap-2 text-green-600 dark:text-green-400 font-mono text-sm", children: [_jsx(FaLock, {}), "\u2705 APIKeyVault Loaded"] }), _jsxs("h2", { className: "text-xl font-bold text-yellow-700 dark:text-yellow-300 mb-3 flex items-center gap-2", children: [_jsx(FaKey, { className: "text-yellow-500" }), "API Key Vault"] }), loading ? (_jsx("p", { className: "text-xs text-yellow-600 dark:text-yellow-300 animate-pulse", children: "\uD83D\uDD04 Loading API keys..." })) : error ? (_jsx("p", { className: "text-xs text-red-500", children: error })) : keys.length === 0 ? (_jsx("p", { className: "text-sm text-slate-500", children: "No API keys found." })) : (_jsx("ul", { className: "space-y-3 text-sm md:text-base text-gray-800 dark:text-gray-200", children: keys.map((key, idx) => (_jsxs("li", { className: "flex justify-between items-center bg-white/5 dark:bg-yellow-800/10 px-3 py-2 rounded-lg border border-yellow-300/20", children: [_jsxs("div", { className: "flex flex-col", children: [_jsx("span", { className: "font-semibold", children: key.service }), _jsxs("span", { className: "text-xs text-slate-500", children: ["Last checked: ", key.lastChecked] })] }), _jsxs("span", { className: `font-mono ${statusColor[key.status]} flex items-center`, children: [key.status === "valid" && (_jsx(FaCheckCircle, { className: "inline mr-1" })), (key.status === "expired" || key.status === "missing") && (_jsx(FaExclamationTriangle, { className: "inline mr-1" })), key.status.toUpperCase()] })] }, idx))) })), _jsx("div", { className: "mt-6 text-xs text-yellow-700 dark:text-yellow-300 font-mono", children: "\uD83D\uDD12 Security Tip: Never expose API keys in frontend code. All access should be handled securely via server-side." })] }));
};
export default APIKeyVault;
