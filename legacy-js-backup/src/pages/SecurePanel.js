import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// src/pages/SecurePanel.tsx
import { useEffect, useState } from 'react';
import { apiFetch } from '@utils/apiFetch';
import ErrorDisplay from '@components/ErrorDisplay';
export default function SecurePanel() {
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await apiFetch('/api/system/secure-data');
            setData(res.data);
        }
        catch (err) {
            setError(err.message);
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => { fetchData(); }, []);
    return (_jsxs("div", { className: "max-w-lg mx-auto p-6", children: [_jsx("h2", { className: "font-bold text-2xl mb-4", children: "\uD83D\uDD12 Secure Data Panel" }), _jsx("button", { onClick: fetchData, disabled: loading, className: "mb-3 px-4 py-2 bg-blue-600 text-white rounded", children: "Refresh" }), _jsx(ErrorDisplay, { error: error }), _jsx("div", { className: "mt-4 bg-slate-100 rounded p-3", children: loading ? "Loading..." : data ? (_jsx("pre", { children: JSON.stringify(data, null, 2) })) : "No data." })] }));
}
