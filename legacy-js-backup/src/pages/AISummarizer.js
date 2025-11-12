import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useState } from 'react';
import { useTranslate } from '../hooks/useTranslate';
import apiClient from '@lib/api';
const AISummarizer = () => {
    const t = useTranslate();
    const [input, setInput] = useState('');
    const [summary, setSummary] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const handleSummarize = async () => {
        if (!input.trim())
            return;
        setLoading(true);
        setError('');
        setSummary('');
        try {
            const res = await apiClient.post('/ai/summarize', { content: input });
            const data = res?.data ?? res;
            if (data.success && data.summary) {
                setSummary(data.summary);
            }
            else {
                setError(t('aiSummaryFailed'));
            }
        }
        catch (err) {
            setError(t('serverError'));
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsxs("div", { className: "p-6 max-w-3xl mx-auto text-gray-800 dark:text-white", children: [_jsxs("h1", { className: "text-2xl font-bold mb-4", children: ["\uD83E\uDDE0 ", t('aiSummarize')] }), _jsx("textarea", { value: input, onChange: (e) => setInput(e.target.value), rows: 6, placeholder: t('newsContent'), className: "w-full p-3 border border-gray-300 dark:border-gray-700 rounded dark:bg-gray-800 mb-4" }), _jsx("button", { onClick: handleSummarize, disabled: loading, className: "bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50", children: loading ? t('loading') : t('aiSummarize') }), summary && (_jsxs("div", { className: "mt-6 p-4 bg-green-100 dark:bg-green-900 text-sm rounded", children: [_jsxs("strong", { children: [t('aiSummary'), ":"] }), _jsx("p", { className: "mt-2 whitespace-pre-wrap", children: summary })] })), error && _jsx("p", { className: "mt-4 text-red-500", children: error })] }));
};
export default AISummarizer;
