import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@lib/api';
import toast from 'react-hot-toast';
export default function ManageNews() {
    const navigate = useNavigate();
    // Voice state (preserve existing TTS helpers)
    const [playingId, setPlayingId] = useState(null);
    const [voiceGender, setVoiceGender] = useState('female');
    const [speed, setSpeed] = useState('normal');
    const [selectedIds, setSelectedIds] = useState([]);
    const [articles, setArticles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const fetchArticles = async () => {
        setLoading(true);
        try {
            const res = await api.get('/news/all');
            const data = res.data || res;
            const items = (data.articles || data.items || []).map((a) => ({
                _id: a._id || a.id,
                title: a.title,
                language: a.language,
                status: a.status,
                workflow: a.workflow || {},
            }));
            setArticles(items);
            setError('');
        }
        catch (err) {
            console.error(err);
            setError(err?.message || 'Failed to load articles');
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        fetchArticles();
    }, []);
    // TTS helpers (unchanged)
    const playVoice = (text, id) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-IN';
        utterance.rate = speed === 'fast' ? 1.5 : speed === 'slow' ? 0.75 : 1;
        utterance.voice =
            speechSynthesis.getVoices().find((v) => voiceGender === 'male' ? v.name.toLowerCase().includes('male') : v.name.toLowerCase().includes('female')) || null;
        utterance.onend = () => setPlayingId(null);
        setPlayingId(id);
        speechSynthesis.cancel();
        speechSynthesis.speak(utterance);
    };
    const stopVoice = () => {
        speechSynthesis.cancel();
        setPlayingId(null);
    };
    const handleCheckbox = (id) => {
        setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    };
    const playSelected = () => {
        const texts = articles.filter((a) => selectedIds.includes(a._id)).map((a) => a.title).join('. ');
        if (texts)
            playVoice(texts, 'batch');
    };
    // Workflow quick actions
    const doTransition = async (id, action) => {
        try {
            const res = await api.post(`/news/${id}/transition`, { action });
            if (res.data?.success) {
                toast.success(`${action} done`);
                // Optimistically refresh this article's status
                await fetchArticles();
            }
            else {
                toast.error('Action failed');
            }
        }
        catch (err) {
            toast.error(err?.response?.data?.message || err?.message || 'Request failed');
        }
    };
    const can = (a) => {
        const stage = (a.workflow?.stage || '').toLowerCase();
        return {
            toReview: !stage || stage === 'draft',
            toLegal: stage === 'copy-edit' || stage === 'review',
            approve: stage === 'legal' || stage === 'eic-review',
            publish: stage === 'approved' || stage === 'scheduled',
        };
    };
    return (_jsxs("div", { className: "p-6", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("h1", { className: "text-2xl font-bold", children: "\uD83D\uDCC1 Manage News Articles" }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: fetchArticles, className: "px-3 py-1 rounded bg-slate-800 text-white", children: "\uD83D\uDD04 Refresh" }), _jsx("button", { onClick: () => navigate('/add'), className: "px-3 py-1 rounded bg-green-700 text-white", children: "\u2795 Add" })] })] }), loading && _jsx("p", { children: "Loading\u2026" }), error && _jsx("p", { className: "text-red-600", children: error }), !loading && !error && articles.length === 0 && (_jsx("p", { className: "text-slate-600", children: "No articles found." })), articles.map((article) => {
                const c = can(article);
                const stage = article.workflow?.stage || 'draft';
                return (_jsxs("div", { className: "bg-white rounded shadow p-4 mb-4", children: [_jsxs("div", { className: "flex items-center justify-between gap-2 mb-2", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("input", { type: "checkbox", checked: selectedIds.includes(article._id), onChange: () => handleCheckbox(article._id) }), _jsx("p", { className: "font-semibold text-lg", children: article.title })] }), _jsxs("div", { className: "flex gap-2 text-xs", children: [_jsxs("span", { className: "px-2 py-1 rounded bg-blue-100 text-blue-800", children: ["Status: ", article.status || 'draft'] }), _jsxs("span", { className: "px-2 py-1 rounded bg-purple-100 text-purple-800", children: ["Stage: ", stage] }), article.language && (_jsxs("span", { className: "px-2 py-1 rounded bg-slate-100 text-slate-800", children: ["Lang: ", article.language] }))] })] }), _jsxs("div", { className: "flex gap-2 flex-wrap mt-2", children: [_jsx("button", { onClick: () => navigate(`/edit/${article._id}`), className: "bg-green-600 text-white px-3 py-1 rounded", children: "\u270F\uFE0F Edit" }), _jsx("button", { className: "bg-red-600 text-white px-3 py-1 rounded", children: "\uD83D\uDDD1 Delete" }), _jsxs("button", { onClick: () => playVoice(article.title, article._id), className: "bg-purple-600 text-white px-3 py-1 rounded", children: ["\uD83D\uDD0A ", playingId === article._id ? 'Playing...' : 'Test Voice'] }), _jsx("button", { onClick: () => playVoice(article.title, article._id), className: "bg-gray-700 text-white px-3 py-1 rounded", children: "\uD83D\uDD01 Replay" }), _jsx("button", { onClick: stopVoice, className: "bg-black text-white px-3 py-1 rounded", children: "\u23F9 Stop" }), _jsxs("button", { onClick: () => setVoiceGender(voiceGender === 'female' ? 'male' : 'female'), className: "bg-blue-500 text-white px-3 py-1 rounded", children: ["\uD83C\uDF99 Switch to ", voiceGender === 'female' ? 'Male' : 'Female'] }), _jsxs("select", { value: speed, onChange: (e) => setSpeed(e.target.value), className: "border px-2 py-1 rounded text-sm", children: [_jsx("option", { value: "normal", children: "\uD83C\uDF10 Normal" }), _jsx("option", { value: "slow", children: "\uD83D\uDC22 Slow" }), _jsx("option", { value: "fast", children: "\u26A1 Fast" })] }), _jsxs("div", { className: "ml-auto flex gap-2 flex-wrap", children: [_jsx("button", { onClick: () => doTransition(article._id, 'toReview'), disabled: !c.toReview, className: `px-3 py-1 rounded text-white ${!c.toReview ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'}`, children: "\uD83D\uDCE4 To Review" }), _jsx("button", { onClick: () => doTransition(article._id, 'toLegal'), disabled: !c.toLegal, className: `px-3 py-1 rounded text-white ${!c.toLegal ? 'bg-gray-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-500'}`, children: "\u2696\uFE0F To Legal" }), _jsx("button", { onClick: () => doTransition(article._id, 'approve'), disabled: !c.approve, className: `px-3 py-1 rounded text-white ${!c.approve ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500'}`, children: "\u2705 Approve" }), _jsx("button", { onClick: () => doTransition(article._id, 'publish'), disabled: !c.publish, className: `px-3 py-1 rounded text-white ${!c.publish ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-500'}`, children: "\uD83D\uDE80 Publish" })] })] })] }, article._id));
            }), selectedIds.length > 0 && (_jsxs("div", { className: "mt-6 p-4 bg-slate-100 rounded shadow border", children: [_jsx("h3", { className: "font-semibold mb-2", children: "\uD83C\uDFA7 Playlist Actions" }), _jsxs("div", { className: "flex gap-3 flex-wrap", children: [_jsxs("button", { onClick: playSelected, className: "bg-purple-700 text-white px-4 py-1 rounded", children: ["\u25B6\uFE0F Play All (", selectedIds.length, ")"] }), _jsx("button", { onClick: () => setSelectedIds([]), className: "bg-red-500 text-white px-4 py-1 rounded", children: "\u274C Clear Playlist" })] })] }))] }));
}
