import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { api as apiLib, API_BASE_PATH } from '../../lib/api';
// Simple options
const LANGUAGES = ['English', 'Hindi', 'Gujarati'];
const TASKS = ['Summarize', 'Rewrite', 'Creative Narrative', '5W1H Story', 'SEO Article'];
export default function AIEngine() {
    const [provider, setProvider] = useState('openai');
    const [model, setModel] = useState('');
    const [serverModel, setServerModel] = useState('');
    const [language, setLanguage] = useState('English');
    const [task, setTask] = useState('Summarize');
    const [founderCommand, setFounderCommand] = useState('');
    const [sourceText, setSourceText] = useState('');
    const [sourceUrl, setSourceUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState(null);
    const run = async () => {
        setError('');
        setResult(null);
        if (!sourceText.trim() && !sourceUrl.trim()) {
            setError('Please paste content or provide a source URL.');
            return;
        }
        setLoading(true);
        try {
            const resp = await apiLib.aiEngineRun({ provider, model, language, taskType: task, founderCommand, sourceText, url: sourceUrl });
            setResult(resp.result);
        }
        catch (e) {
            setError(e?.response?.data?.error || 'Failed to run AI Engine');
        }
        finally {
            setLoading(false);
        }
    };
    const prettyModel = (m) => {
        const v = (m || '').toLowerCase();
        if (v === 'gpt-5' || v === 'gpt5')
            return 'GPT‑5 Plus';
        if (v === 'gpt-5-auto')
            return 'GPT‑5 Auto';
        if (!v)
            return 'GPT‑5 Plus';
        return (m || 'gpt-5')
            .replace(/^gpt-/, 'GPT-')
            .replace(/-/g, ' ')
            .replace(/G P T/, 'GPT');
    };
    const ProviderButton = ({ label, keyName, hintModel }) => (_jsx("button", { onClick: () => { setProvider(keyName); setModel(hintModel || ''); }, className: `px-3 py-2 rounded border ${provider === keyName ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200'} hover:border-blue-400`, children: label }));
    // Fetch current backend OpenAI model for display/hint
    useEffect(() => {
        fetch(`${API_BASE_PATH}/system/ai-health`, { credentials: 'include' })
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
            .then((data) => {
            const m = (data && (data.model || data.selectedModel)) || '';
            if (typeof m === 'string' && m)
                setServerModel(m);
        })
            .catch(() => { });
    }, []);
    return (_jsxs("div", { className: "max-w-5xl mx-auto p-4", children: [_jsx("h1", { className: "text-3xl font-bold mb-2", children: "\uD83E\uDDE0 News Pulse AI Engine" }), _jsx("p", { className: "text-slate-600 dark:text-slate-300 mb-6", children: "Paste any news content or URL and generate a fresh, publication-ready article. Original narrative with 5W1H framing and SEO extras." }), _jsxs("div", { className: "mb-4", children: [_jsx("div", { className: "font-semibold mb-2", children: "AI Engine:" }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx(ProviderButton, { label: `OpenAI (${prettyModel(serverModel)})`, keyName: "openai", hintModel: serverModel || 'gpt-5' }), _jsx(ProviderButton, { label: "Gemini 1.5 Pro", keyName: "gemini", hintModel: "gemini-1.5-pro" })] })] }), _jsxs("div", { className: "grid md:grid-cols-2 gap-4 mb-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Language" }), _jsx("select", { value: language, onChange: (e) => setLanguage(e.target.value), className: "w-full border rounded px-3 py-2", children: LANGUAGES.map((l) => _jsx("option", { value: l, children: l }, l)) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Task Type" }), _jsx("select", { value: task, onChange: (e) => setTask(e.target.value), className: "w-full border rounded px-3 py-2", children: TASKS.map((t) => _jsx("option", { value: t, children: t }, t)) })] })] }), _jsxs("div", { className: "grid md:grid-cols-2 gap-4 mb-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Founder Command (override)" }), _jsx("input", { value: founderCommand, onChange: (e) => setFounderCommand(e.target.value), className: "w-full border rounded px-3 py-2", placeholder: "e.g., Emphasize accountability and add strong headline variants" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Source URL (optional)" }), _jsx("input", { value: sourceUrl, onChange: (e) => setSourceUrl(e.target.value), className: "w-full border rounded px-3 py-2", placeholder: "https://example.com/article" })] })] }), _jsxs("div", { className: "mb-4", children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Paste or type source content" }), _jsx("textarea", { value: sourceText, onChange: (e) => setSourceText(e.target.value), rows: 8, className: "w-full border rounded px-3 py-2", placeholder: "Paste the news text or facts here..." })] }), error && _jsxs("div", { className: "text-red-600 mb-3", children: ["\u274C ", error] }), _jsx("button", { disabled: loading, onClick: run, className: "bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded disabled:opacity-60", children: loading ? 'Running…' : 'Run AI Task' }), result && (_jsxs("div", { className: "mt-6 space-y-4", children: [_jsxs("div", { className: "bg-white dark:bg-slate-800 p-4 rounded shadow", children: [_jsx("div", { className: "text-sm text-slate-500 mb-1", children: "Title" }), _jsx("div", { className: "text-xl font-bold", children: result.title })] }), _jsxs("div", { className: "bg-white dark:bg-slate-800 p-4 rounded shadow", children: [_jsx("div", { className: "text-sm text-slate-500 mb-1", children: "Summary" }), _jsx("p", { children: result.summary })] }), result.fiveWh && (_jsxs("div", { className: "bg-white dark:bg-slate-800 p-4 rounded shadow grid md:grid-cols-3 gap-3", children: [_jsxs("div", { children: [_jsx("div", { className: "text-xs text-slate-500", children: "Who" }), _jsx("div", { className: "font-medium", children: result.fiveWh.who })] }), _jsxs("div", { children: [_jsx("div", { className: "text-xs text-slate-500", children: "What" }), _jsx("div", { className: "font-medium", children: result.fiveWh.what })] }), _jsxs("div", { children: [_jsx("div", { className: "text-xs text-slate-500", children: "Where" }), _jsx("div", { className: "font-medium", children: result.fiveWh.where })] }), _jsxs("div", { children: [_jsx("div", { className: "text-xs text-slate-500", children: "When" }), _jsx("div", { className: "font-medium", children: result.fiveWh.when })] }), _jsxs("div", { children: [_jsx("div", { className: "text-xs text-slate-500", children: "Why" }), _jsx("div", { className: "font-medium", children: result.fiveWh.why })] }), _jsxs("div", { children: [_jsx("div", { className: "text-xs text-slate-500", children: "How" }), _jsx("div", { className: "font-medium", children: result.fiveWh.how })] })] })), Array.isArray(result.outline) && result.outline.length > 0 && (_jsxs("div", { className: "bg-white dark:bg-slate-800 p-4 rounded shadow", children: [_jsx("div", { className: "text-sm text-slate-500 mb-1", children: "Outline" }), _jsx("ul", { className: "list-disc ml-6 space-y-1", children: result.outline.map((o, i) => _jsx("li", { children: o }, i)) })] })), result.article && (_jsxs("div", { className: "bg-white dark:bg-slate-800 p-4 rounded shadow", children: [_jsx("div", { className: "text-sm text-slate-500 mb-1", children: "Article" }), _jsx("div", { className: "prose dark:prose-invert max-w-none whitespace-pre-wrap", children: result.article })] })), result.seo && (_jsxs("div", { className: "bg-white dark:bg-slate-800 p-4 rounded shadow", children: [_jsx("div", { className: "text-sm text-slate-500 mb-1", children: "SEO" }), _jsx("div", { className: "font-medium", children: result.seo.title }), _jsx("div", { className: "text-sm text-slate-600", children: result.seo.description }), _jsxs("div", { className: "mt-1 text-xs", children: ["Tags: ", (result.seo.tags || []).join(', ')] })] })), result.disclaimer && (_jsx("div", { className: "text-xs text-slate-500", children: result.disclaimer }))] }))] }));
}
