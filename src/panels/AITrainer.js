import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { FaSyncAlt, FaBrain, FaClock, FaChartBar, FaRocket, FaShieldAlt, FaCogs, FaMicroscope, FaBolt } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import { useAITrainingInfo } from '@context/AITrainingInfoContext';
import { apiFetch } from '@utils/apiFetch'; // <-- USE THIS
export default function AITrainer() {
    const { info: trainerInfo, loading, error } = useAITrainingInfo();
    const [feedback, setFeedback] = useState('');
    const [loadingAction, setLoadingAction] = useState(false);
    const [activating, setActivating] = useState(false);
    // --- Use apiFetch for backend actions ---
    const retrainNow = async () => {
        setLoadingAction(true);
        try {
            const res = await apiFetch('/api/system/ai-train', { method: 'POST' });
            alert(`✅ ${res.message || 'Retraining triggered.'}`);
            // Optionally trigger context refresh (e.g., refetch training info)
        }
        catch (err) {
            console.error('❌ Retrain failed:', err);
            alert('❌ Training failed: ' + (err.message || 'Unknown error'));
        }
        finally {
            setLoadingAction(false);
        }
    };
    const activateFullTrainer = async () => {
        setActivating(true);
        try {
            const res = await apiFetch('/api/system/ai-trainer/activate', { method: 'POST' });
            alert(`🧬 ${res.message || 'Full AI Trainer activated.'}`);
            // Optionally trigger context refresh
        }
        catch (err) {
            console.error('❌ Activation error:', err);
            alert('❌ Activation failed: ' + (err.message || 'Unknown error'));
        }
        finally {
            setActivating(false);
        }
    };
    const submitFeedback = async () => {
        if (!feedback.trim())
            return;
        try {
            await apiFetch('/api/system/ai-feedback', {
                method: 'POST',
                body: JSON.stringify({ feedback }),
            });
            alert('📩 Feedback submitted to AI trainer.');
            setFeedback('');
        }
        catch (err) {
            console.error('❌ Feedback error:', err);
            alert('❌ Failed to send feedback: ' + (err.message || 'Unknown error'));
        }
    };
    return (_jsxs("div", { className: "ai-card glow-panel futuristic-glow border border-indigo-600 dark:border-indigo-400 p-6 rounded-xl text-white bg-gradient-to-br from-black via-gray-900 to-gray-800", children: [_jsxs("h2", { className: "text-xl font-bold flex items-center gap-2 text-blue-400 mb-2 animate-pulse", children: [_jsx(FaBolt, { className: "text-yellow-400" }), "AI Trainer Control Panel"] }), _jsx("p", { className: "text-sm text-gray-300 mb-4", children: "Tune your AI engine for smarter behavior, better decisions, and intelligent automation." }), error ? (_jsx("div", { className: "text-red-400", children: "\u274C Failed to load AI training info." })) : loading ? (_jsx("div", { className: "text-gray-400", children: "\u23F3 Loading trainer info..." })) : trainerInfo ? (_jsxs("div", { className: "space-y-2 text-sm text-gray-200", children: [_jsxs("p", { children: [_jsx(FaBrain, { className: "inline mr-1 text-green-400" }), _jsx("strong", { children: "Last Trained:" }), ' ', trainerInfo.lastTraining ? new Date(trainerInfo.lastTraining).toLocaleString() : '—'] }), _jsxs("p", { children: [_jsx(FaClock, { className: "inline mr-1 text-yellow-300" }), _jsx("strong", { children: "Next Training:" }), ' ', trainerInfo.nextTraining ? new Date(trainerInfo.nextTraining).toLocaleString() : '—'] }), _jsxs("p", { children: [_jsx(FaChartBar, { className: "inline mr-1 text-blue-300" }), _jsx("strong", { children: "Data Used:" }), " ", trainerInfo.articlesAnalyzed, " articles, ", trainerInfo.keywords, " keywords"] }), _jsxs("p", { children: [_jsx(FaRocket, { className: "inline mr-1 text-purple-300" }), _jsx("strong", { children: "Focus:" }), " ", trainerInfo.patternFocus || 'Engagement Intelligence'] }), _jsxs("p", { children: [_jsx(FaShieldAlt, { className: "inline mr-1 text-red-400" }), _jsx("strong", { children: "Founder Lock:" }), ' ', trainerInfo.lockedByFounder ? '🛡️ Only you can retrain' : '❌ Not active'] }), _jsxs("p", { children: [_jsx(FaMicroscope, { className: "inline mr-1 text-green-300" }), _jsx("strong", { children: _jsx(Link, { to: "/admin/diagnostics", className: "text-green-400 hover:underline", children: "View AI Diagnostics" }) })] })] })) : (_jsx("div", { className: "text-gray-400", children: "\u23F3 Loading trainer info..." })), _jsxs("div", { className: "flex gap-3 mt-6", children: [_jsxs("button", { onClick: retrainNow, disabled: loadingAction, className: `px-4 py-2 rounded-full flex items-center gap-2 text-white font-semibold shadow ${loadingAction ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-700 hover:bg-blue-800'}`, children: [_jsx(FaSyncAlt, { className: loadingAction ? 'animate-spin-slow' : '' }), " Retrain Now"] }), _jsxs("button", { onClick: activateFullTrainer, disabled: activating, className: `px-4 py-2 rounded-full flex items-center gap-2 text-white font-semibold shadow ${activating ? 'bg-purple-400 cursor-not-allowed' : 'bg-purple-700 hover:bg-purple-800'}`, children: [_jsx(FaCogs, { className: activating ? 'animate-spin-slow' : '' }), " Activate Full AI Trainer"] })] }), _jsxs("div", { className: "mt-6", children: [_jsx("textarea", { rows: 3, className: "w-full p-3 border rounded-md bg-white dark:bg-slate-800 text-black dark:text-white text-sm", placeholder: "\uD83D\uDCAC Suggest improvement or tell what AI should focus on...", value: feedback, onChange: (e) => setFeedback(e.target.value) }), _jsx("button", { onClick: submitFeedback, className: "mt-2 px-4 py-2 bg-green-600 text-white rounded-full hover:bg-green-700 font-medium shadow", children: "\uD83D\uDCE4 Submit Feedback" })] })] }));
}
