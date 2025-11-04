import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 📁 components/PushPreviewBox.tsx
import { useEffect, useState } from 'react';
import { getPushPreview } from '../utils/pushPreview';
export default function PushPreviewBox({ headline, category }) {
    const [preview, setPreview] = useState('');
    const [error, setError] = useState(false);
    useEffect(() => {
        if (!headline || !category) {
            setPreview('');
            return;
        }
        setError(false); // Reset error state
        getPushPreview(headline, category)
            .then((data) => {
            setPreview(data);
        })
            .catch(() => {
            setError(true);
            setPreview('⚠️ Failed to fetch preview.');
        });
    }, [headline, category]);
    return (_jsxs("div", { className: "mt-3 bg-blue-50 dark:bg-gray-800 border border-blue-200 dark:border-gray-600 rounded p-4", children: [_jsx("p", { className: "text-sm font-medium text-gray-700 dark:text-gray-300", children: "\uD83D\uDD14 Push Notification Preview:" }), _jsx("p", { className: "text-lg font-bold text-gray-900 dark:text-white", children: preview || '🔍 Waiting for headline...' }), error && (_jsx("p", { className: "text-red-500 text-xs mt-2", children: "Backend not responding or invalid preview." }))] }));
}
