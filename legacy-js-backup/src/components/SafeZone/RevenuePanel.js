import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { api } from '@lib/api';
const RevenuePanel = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        api.revenue()
            .then((resData) => {
            // Defensive: Check for required fields, not error object
            if (typeof resData.adsense === "number" &&
                typeof resData.affiliates === "number" &&
                typeof resData.sponsors === "number" &&
                typeof resData.total === "number") {
                setData(resData);
            }
            else if (resData.error) {
                setError(resData.error);
            }
            else {
                setError("Invalid revenue data format.");
            }
            setLoading(false);
        })
            .catch((err) => {
            setError("Failed to load revenue data: " + err.message);
            setLoading(false);
        });
    }, []);
    const isEmpty = data?.adsense === 0 && data?.affiliates === 0 && data?.sponsors === 0;
    return (_jsxs("section", { className: "p-5 md:p-6 bg-lime-50 dark:bg-lime-900/10 border border-lime-300 dark:border-lime-700 rounded-2xl shadow-inner max-h-[90vh] overflow-y-auto", children: [_jsxs("div", { className: "flex justify-between items-center mb-3", children: [_jsx("p", { className: "text-green-600 dark:text-green-400 font-mono text-sm", children: "\u2705 RevenuePanel Loaded" }), _jsx("a", { href: api.revenueExportPdfPath(), className: "text-sm text-blue-600 dark:text-blue-400 hover:underline", children: "\uD83D\uDCC4 Export PDF" })] }), _jsx("h2", { className: "text-xl font-bold text-lime-700 dark:text-lime-300 mb-2", children: "\uD83D\uDCB0 Revenue Panel" }), loading ? (_jsx("p", { className: "text-sm text-slate-500 dark:text-slate-400", children: "\u23F3 Loading revenue data..." })) : error ? (_jsx("p", { className: "text-sm text-red-600 dark:text-red-400", children: error })) : isEmpty ? (_jsx("p", { className: "text-sm text-yellow-600 dark:text-yellow-300", children: "\u26A0\uFE0F Revenue data will appear after the site goes live." })) : (_jsxs("ul", { className: "text-sm text-slate-700 dark:text-slate-200 space-y-1", children: [_jsxs("li", { children: ["\u2022 Google AdSense: \u20B9", data?.adsense?.toLocaleString?.() ?? 0, " (This Month)"] }), _jsxs("li", { children: ["\u2022 Affiliates: \u20B9", data?.affiliates?.toLocaleString?.() ?? 0] }), _jsxs("li", { children: ["\u2022 Sponsors: \u20B9", data?.sponsors?.toLocaleString?.() ?? 0] }), _jsxs("li", { className: "font-semibold mt-2", children: ["\u2022 Total Revenue: \u20B9", data?.total?.toLocaleString?.() ?? 0] })] })), data?.lastUpdated && (_jsxs("p", { className: "text-xs text-slate-500 dark:text-slate-400 mt-3", children: ["Last updated ", data.lastUpdated] }))] }));
};
export default RevenuePanel;
