import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { API_BASE_PATH } from '../../lib/api';
const AiToolsPanel = () => {
    const [text, setText] = useState('');
    const [lang, setLang] = useState('Gujarati');
    const [loading, setLoading] = useState(null);
    const [result, setResult] = useState('');
    async function callTool(path, body) {
        setLoading(path);
        setResult('');
        try {
            const res = await fetch(`${API_BASE_PATH}/ai/tools/${path}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(body),
            });
            const ct = res.headers.get('content-type') || '';
            if (!res.ok || !/application\/json/i.test(ct)) {
                const txt = await res.text().catch(() => '');
                throw new Error(`HTTP ${res.status}. Body: ${txt.slice(0, 200)}`);
            }
            const json = await res.json();
            if (json?.ok && (json.result || json.raw)) {
                setResult(typeof json.result === 'string' ? json.result : JSON.stringify(json.result, null, 2));
            }
            else if (json?.content) {
                setResult(json.content);
            }
            else {
                setResult(JSON.stringify(json, null, 2));
            }
        }
        catch (e) {
            setResult(`Error: ${e?.message || String(e)}`);
        }
        finally {
            setLoading(null);
        }
    }
    return (_jsxs("div", { className: "rounded-xl border dark:border-slate-700 p-4 bg-white dark:bg-slate-900", children: [_jsx("h3", { className: "text-xl font-bold mb-3", children: "AI Tools" }), _jsx("textarea", { className: "w-full border dark:border-slate-700 rounded-lg p-3 mb-3 dark:bg-slate-800", rows: 6, placeholder: "Paste article text or headline here...", value: text, onChange: (e) => setText(e.target.value) }), _jsxs("div", { className: "flex flex-wrap gap-2 items-center mb-3", children: [_jsxs("select", { className: "border dark:border-slate-700 rounded-lg p-2 dark:bg-slate-800", value: lang, onChange: (e) => setLang(e.target.value), children: [_jsx("option", { value: "Gujarati", children: "Gujarati" }), _jsx("option", { value: "Hindi", children: "Hindi" }), _jsx("option", { value: "English", children: "English" })] }), _jsx("button", { disabled: !!loading, onClick: () => callTool('summarize', { text, bullets: 2 }), className: "px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50", children: loading === 'summarize' ? 'Summarizing…' : 'Summarize' }), _jsx("button", { disabled: !!loading, onClick: () => callTool('translate', { text, targetLang: lang }), className: "px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50", children: loading === 'translate' ? 'Translating…' : `Translate → ${lang}` }), _jsx("button", { disabled: !!loading, onClick: () => callTool('fact-check', { text }), className: "px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50", children: loading === 'fact-check' ? 'Checking…' : 'Fact Check' }), _jsx("button", { disabled: !!loading, onClick: () => callTool('headline', { title: text }), className: "px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50", children: loading === 'headline' ? 'Ranking…' : 'Rank Headline' }), _jsx("button", { disabled: !!loading, onClick: () => callTool('seo-meta', { text }), className: "px-3 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50", children: loading === 'seo-meta' ? 'Optimizing…' : 'SEO Meta' }), _jsx("button", { disabled: !!loading, onClick: () => callTool('voice-script', { text, durationSec: 25 }), className: "px-3 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50", children: loading === 'voice-script' ? 'Writing…' : 'Voice Script' }), _jsx("button", { disabled: !!loading, onClick: () => callTool('inverted-pyramid', { text, targetLang: lang }), className: "px-3 py-2 bg-amber-700 text-white rounded-lg hover:bg-amber-800 disabled:opacity-50", children: loading === 'inverted-pyramid' ? 'Structuring…' : 'Inverted Pyramid' }), _jsx("button", { disabled: !!loading, onClick: () => callTool('5w1h', { text, targetLang: lang }), className: "px-3 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50", children: loading === '5w1h' ? 'Extracting…' : '5W1H' }), _jsx("button", { disabled: !!loading, onClick: () => callTool('topband', { text, targetLang: lang }), className: "px-3 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 disabled:opacity-50", children: loading === 'topband' ? 'Generating…' : 'Topband One‑Liners' })] }), _jsx("pre", { className: "whitespace-pre-wrap text-sm bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border dark:border-slate-700 overflow-auto max-h-72", children: result })] }));
};
export default AiToolsPanel;
