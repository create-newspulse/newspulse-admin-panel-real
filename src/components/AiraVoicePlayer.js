import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { API_BASE_PATH } from '@lib/api';
const fmtTime = (ts) => new Date(ts).toLocaleString();
const speakWithBrowser = async (text, lang) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        alert('SpeechSynthesis not supported.');
        return;
    }
    const utter = new SpeechSynthesisUtterance(text);
    // Best-effort voice selection
    utter.lang = /guj|Gujarati/i.test(lang) ? 'gu-IN' : /hi|Hindi/i.test(lang) ? 'hi-IN' : 'en-US';
    utter.rate = 1.0;
    utter.pitch = 1.0;
    speechSynthesis.cancel();
    speechSynthesis.speak(utter);
};
const AiraVoicePlayer = () => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [genLoading, setGenLoading] = useState(false);
    const [lang, setLang] = useState('Gujarati');
    const [focus, setFocus] = useState('');
    const [deletingId, setDeletingId] = useState(null);
    const load = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_PATH}/aira/bulletins`, { credentials: 'include' });
            const json = await res.json();
            if (json?.ok && Array.isArray(json.items))
                setItems(json.items);
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => { load(); }, []);
    const generate = async () => {
        setGenLoading(true);
        try {
            const r = await fetch(`${API_BASE_PATH}/aira/generate`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ lang, durationSec: 45, focus }),
            });
            const j = await r.json();
            if (!r.ok)
                throw new Error(j?.detail || 'Failed to generate');
            await load();
        }
        catch (e) {
            alert(e?.message || String(e));
        }
        finally {
            setGenLoading(false);
        }
    };
    const remove = async (id) => {
        if (!id)
            return;
        const ok = window.confirm('Delete this bulletin? This action cannot be undone.');
        if (!ok)
            return;
        setDeletingId(id);
        try {
            const r = await fetch(`${API_BASE_PATH}/aira/bulletins/${encodeURIComponent(id)}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            const j = await r.json().catch(() => ({}));
            if (!r.ok || !j?.ok)
                throw new Error(j?.detail || 'Delete failed');
            setItems(prev => prev.filter(x => x.id !== id));
        }
        catch (e) {
            alert(e?.message || String(e));
        }
        finally {
            setDeletingId(null);
        }
    };
    return (_jsxs("div", { className: "rounded-xl border dark:border-slate-700 p-4 bg-white dark:bg-slate-900", children: [_jsx("h3", { className: "text-xl font-bold mb-3", children: "AIRA Voice Bulletins" }), _jsxs("div", { className: "flex flex-wrap gap-2 items-center mb-3", children: [_jsxs("select", { className: "border dark:border-slate-700 rounded-lg p-2 dark:bg-slate-800", value: lang, onChange: (e) => setLang(e.target.value), children: [_jsx("option", { value: "Gujarati", children: "Gujarati" }), _jsx("option", { value: "Hindi", children: "Hindi" }), _jsx("option", { value: "English", children: "English" })] }), _jsx("input", { className: "border dark:border-slate-700 rounded-lg p-2 dark:bg-slate-800 flex-1 min-w-[220px]", placeholder: "Focus (optional) e.g., Youth Pulse", value: focus, onChange: (e) => setFocus(e.target.value) }), _jsx("button", { disabled: genLoading, onClick: generate, className: "px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50", children: genLoading ? 'Generating…' : 'Generate Now' })] }), loading ? _jsx("div", { children: "Loading\u2026" }) : (items.length === 0 ? _jsx("div", { children: "No bulletins yet." }) : (_jsx("div", { className: "space-y-3", children: items.map(it => (_jsxs("div", { className: "border dark:border-slate-700 rounded-lg p-3", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [_jsx("div", { className: "font-semibold", children: it.title }), _jsxs("div", { className: "text-xs opacity-70", children: [fmtTime(it.ts), " \u00B7 ", it.lang] })] }), _jsxs("div", { className: "mt-2 flex items-center gap-2", children: [it.audioUrl ? (_jsx("audio", { controls: true, src: it.audioUrl, className: "w-full" })) : (_jsx("button", { className: "px-2 py-1 bg-slate-800 text-white rounded hover:bg-slate-700", onClick: () => speakWithBrowser(it.script, it.lang), children: "Play (browser TTS)" })), _jsx("button", { disabled: deletingId === it.id, className: "px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50", onClick: () => remove(it.id), children: deletingId === it.id ? 'Deleting…' : 'Delete' }), _jsxs("details", { className: "ml-auto", children: [_jsx("summary", { className: "cursor-pointer text-sm", children: "Show script" }), _jsx("pre", { className: "mt-2 whitespace-pre-wrap text-sm bg-slate-50 dark:bg-slate-800 p-2 rounded border dark:border-slate-700 max-h-48 overflow-auto", children: it.script })] })] })] }, it.id))) })))] }));
};
export default AiraVoicePlayer;
