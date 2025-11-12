import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE_PATH } from '../lib/api';
// Simple Web Speech API wrapper with queue-safety
function useSpeech() {
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    const [speaking, setSpeaking] = useState(false);
    const [paused, setPaused] = useState(false);
    const [voices, setVoices] = useState([]);
    const utterRef = useRef(null);
    useEffect(() => {
        if (!synth)
            return;
        const load = () => setVoices(synth.getVoices());
        load();
        synth.addEventListener('voiceschanged', load);
        return () => synth.removeEventListener('voiceschanged', load);
    }, [synth]);
    const speak = useCallback((text, voice, rate = 1.0) => {
        if (!synth)
            return;
        // Stop any current speech
        synth.cancel();
        const u = new SpeechSynthesisUtterance(text);
        if (voice)
            u.voice = voice;
        u.rate = rate;
        u.onstart = () => { setSpeaking(true); setPaused(false); };
        u.onend = () => { setSpeaking(false); setPaused(false); utterRef.current = null; };
        u.onerror = () => { setSpeaking(false); setPaused(false); utterRef.current = null; };
        utterRef.current = u;
        synth.speak(u);
    }, [synth]);
    const pause = useCallback(() => { if (synth && synth.speaking && !synth.paused) {
        synth.pause();
        setPaused(true);
    } }, [synth]);
    const resume = useCallback(() => { if (synth && synth.paused) {
        synth.resume();
        setPaused(false);
    } }, [synth]);
    const stop = useCallback(() => { if (synth) {
        synth.cancel();
        setSpeaking(false);
        setPaused(false);
    } }, [synth]);
    return { voices, speaking, paused, speak, pause, resume, stop };
}
export const AiAnchorPlayer = ({ open, onClose, source }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [script, setScript] = useState('');
    const [selectedVoice, setSelectedVoice] = useState('');
    const [rate, setRate] = useState(1.0);
    const { voices, speaking, paused, speak, pause, resume, stop } = useSpeech();
    const voiceObj = useMemo(() => voices.find(v => v.name === selectedVoice), [voices, selectedVoice]);
    useEffect(() => {
        if (!open) {
            stop();
            return;
        }
        setError(null);
        if (!source)
            return;
        // Auto-fetch a voice script when opened
        const run = async () => {
            try {
                setLoading(true);
                const payload = {
                    title: source.title,
                    content: source.content || '',
                    category: source.category || '',
                    language: source.language || 'en',
                };
                const r = await fetch(`${API_BASE_PATH}/ai/tools/voice-script`, {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                        'Authorization': `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('token') : ''}`,
                    },
                    credentials: 'include',
                    body: JSON.stringify(payload),
                });
                if (!r.ok)
                    throw new Error(`HTTP ${r.status}`);
                const data = await r.json();
                const s = (data && (data.script || data.content || data.result)) || '';
                setScript(s || `Here is a brief update on: ${source.title}.`);
            }
            catch (e) {
                setError(e?.message || 'Failed to generate voice script');
            }
            finally {
                setLoading(false);
            }
        };
        run();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, source?.title]);
    const onPlay = () => { if (script)
        speak(script, voiceObj ?? undefined, rate); };
    if (!open)
        return null;
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/50", children: _jsxs("div", { className: "bg-white dark:bg-gray-900 w-full max-w-xl p-4 rounded shadow", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("h3", { className: "text-lg font-semibold", children: "AI Anchor \u2014 Voice Reader" }), _jsx("button", { className: "px-3 py-1 bg-gray-600 text-white rounded", onClick: () => { stop(); onClose(); }, children: "Close" })] }), _jsxs("div", { className: "space-y-3", children: [_jsxs("label", { className: "block", children: [_jsx("span", { className: "text-sm text-gray-600", children: "Voice" }), _jsxs("select", { className: "mt-1 w-full border rounded px-2 py-1", value: selectedVoice, onChange: e => setSelectedVoice(e.target.value), children: [_jsx("option", { value: "", children: "System default" }), voices.map(v => (_jsxs("option", { value: v.name, children: [v.name, " ", v.lang ? `(${v.lang})` : ''] }, v.name)))] })] }), _jsxs("label", { className: "block", children: [_jsxs("span", { className: "text-sm text-gray-600", children: ["Speed: ", rate.toFixed(1), "x"] }), _jsx("input", { type: "range", min: 0.6, max: 1.4, step: 0.1, value: rate, onChange: e => setRate(parseFloat(e.target.value)), className: "w-full" })] }), _jsxs("label", { className: "block", children: [_jsx("span", { className: "text-sm text-gray-600", children: "Script" }), _jsx("textarea", { className: "mt-1 w-full border rounded px-2 py-1 min-h-[120px]", value: script, onChange: e => setScript(e.target.value) })] }), error && _jsx("p", { className: "text-sm text-red-600", children: error }), loading && _jsx("p", { className: "text-sm text-gray-500", children: "Generating script\u2026" }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { className: "bg-blue-600 text-white px-3 py-1 rounded", onClick: onPlay, disabled: !script, children: "Play" }), !paused && speaking && (_jsx("button", { className: "bg-yellow-600 text-white px-3 py-1 rounded", onClick: pause, children: "Pause" })), paused && (_jsx("button", { className: "bg-green-600 text-white px-3 py-1 rounded", onClick: resume, children: "Resume" })), _jsx("button", { className: "bg-gray-700 text-white px-3 py-1 rounded", onClick: stop, children: "Stop" })] })] })] }) }));
};
export default AiAnchorPlayer;
