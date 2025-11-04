import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { toast } from 'react-hot-toast';
const VoiceAndExplainer = ({ text }) => {
    const [loading, setLoading] = useState(false);
    const [summary, setSummary] = useState(null);
    const playVoice = () => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-IN';
        speechSynthesis.speak(utterance);
    };
    const fetchSummary = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/ai/explain`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: text }),
            });
            const data = await res.json();
            setSummary(data.summary || 'No summary returned.');
        }
        catch (err) {
            toast.error('Failed to fetch explanation');
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsxs("div", { className: "flex flex-col gap-2 mt-4", children: [_jsx("button", { onClick: playVoice, className: "px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-500 transition", children: "\uD83C\uDFA7 Play Voice" }), _jsx("button", { onClick: fetchSummary, className: "px-4 py-2 bg-green-600 text-white rounded hover:bg-green-500 transition", children: "\uD83E\uDDE0 Explain This" }), loading && _jsx("p", { className: "text-sm text-gray-400", children: "Generating explanation..." }), summary && _jsx("p", { className: "text-sm mt-2 bg-gray-100 dark:bg-gray-800 p-2 rounded", children: summary })] }));
};
export default VoiceAndExplainer;
