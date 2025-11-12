import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import axios from 'axios';
// Always use environment for API base!
const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, '') ||
    (typeof window !== 'undefined' && window.location.origin + '/api') ||
    '/api';
const DailyWonderAdmin = () => {
    const [quote, setQuote] = useState('');
    const [videoEmbedUrl, setVideoEmbedUrl] = useState('');
    const [source, setSource] = useState('');
    const [creator, setCreator] = useState('');
    const [message, setMessage] = useState('');
    const handleSubmit = async () => {
        try {
            await axios.post(`${API_BASE}/daily-wonder`, {
                quote,
                videoEmbedUrl,
                source,
                creator,
            });
            setMessage('Γ£à Daily Wonder saved!');
        }
        catch (err) {
            setMessage('Γ¥î Failed to save' + (err?.response?.data?.message ? ': ' + err.response.data.message : ''));
        }
    };
    return (_jsxs("div", { className: "max-w-xl mx-auto p-6 bg-white rounded shadow", children: [_jsx("h2", { className: "text-2xl font-bold mb-4", children: "\uD83D\uDCE4 Upload Daily Wonder" }), _jsx("input", { placeholder: "Enter wonder quote", className: "w-full mb-3 p-2 border rounded", value: quote, onChange: (e) => setQuote(e.target.value) }), _jsx("input", { placeholder: "Embed video URL (YouTube)", className: "w-full mb-3 p-2 border rounded", value: videoEmbedUrl, onChange: (e) => setVideoEmbedUrl(e.target.value) }), _jsx("input", { placeholder: "Source link (AirVuz, YouTube etc.)", className: "w-full mb-3 p-2 border rounded", value: source, onChange: (e) => setSource(e.target.value) }), _jsx("input", { placeholder: "Creator name", className: "w-full mb-4 p-2 border rounded", value: creator, onChange: (e) => setCreator(e.target.value) }), _jsx("button", { onClick: handleSubmit, className: "bg-blue-600 text-white px-4 py-2 rounded", children: "Save Wonder" }), message && _jsx("p", { className: "mt-4 text-sm", children: message })] }));
};
export default DailyWonderAdmin;
