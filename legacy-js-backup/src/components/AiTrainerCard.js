import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { API_BASE_PATH } from '@lib/api';
export default function AiTrainerCard() {
    const [trainingInfo, setTrainingInfo] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const fetchTrainingInfo = async () => {
            try {
                const res = await fetch(`${API_BASE_PATH}/system/ai-training-info`, { credentials: 'include' });
                const ct = res.headers.get('content-type') || '';
                if (!res.ok || !ct.includes('application/json')) {
                    const txt = await res.text().catch(() => '');
                    throw new Error(`Expected JSON, got "${ct}". Body: ${txt.slice(0, 160)}`);
                }
                const json = await res.json();
                if (res.ok && json.success && json.data) {
                    setTrainingInfo(json.data); // Γ£à Correct assignment
                }
                else {
                    console.error('ΓÜá∩╕Å Training Info API Error:', json);
                    setError(json.message || 'Γ¥î Failed to load training info.');
                }
            }
            catch (err) {
                console.error('Γ¥î AI Training Info Fetch Error:', err);
                setError('Γ¥î Failed to load AI training info.');
            }
            finally {
                setLoading(false);
            }
        };
        fetchTrainingInfo();
    }, []);
    const handleViewDiagnostics = (e) => {
        e.preventDefault();
        if (typeof window !== 'undefined') {
            window.location.href = '/admin/diagnostics';
        }
    };
    const handleActivateTrainer = async () => {
        try {
            const res = await fetch(`${API_BASE_PATH}/system/ai-trainer/activate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trigger: 'manual' }),
                credentials: 'include',
            });
            const data = await res.json();
            if (res.ok) {
                alert('Γ£à Full AI Trainer activated!');
                console.log('≡ƒºá Activation Response:', data);
            }
            else {
                alert('Γ¥î Activation failed: ' + data.message);
            }
        }
        catch (err) {
            alert('Γ¥î Failed to activate trainer. Check backend logs.');
        }
    };
    return (_jsxs("div", { className: "bg-white dark:bg-slate-900 p-6 rounded-xl shadow-xl border border-slate-200", children: [_jsx("h2", { className: "text-xl font-bold text-blue-700 dark:text-blue-300 mb-2", children: "\uD83E\uDDEC AI Trainer" }), _jsx("p", { className: "text-sm text-slate-600 dark:text-slate-400 mb-4", children: "Train your AI engine for smarter automation, engagement optimization, and performance learning." }), error ? (_jsx("p", { className: "text-red-600 text-sm mb-2", children: error })) : loading ? (_jsx("p", { className: "text-sm text-gray-500", children: "Loading training data..." })) : trainingInfo ? (_jsxs("ul", { className: "text-sm text-slate-700 dark:text-slate-300 space-y-1", children: [_jsxs("li", { children: ["\uD83D\uDD53 ", _jsx("strong", { children: "Last Trained:" }), " ", trainingInfo.lastTraining ? new Date(trainingInfo.lastTraining).toLocaleString() : 'N/A'] }), _jsxs("li", { children: ["\u23F3 ", _jsx("strong", { children: "Next Training:" }), " ", trainingInfo.nextTraining ? new Date(trainingInfo.nextTraining).toLocaleString() : 'N/A'] }), _jsxs("li", { children: ["\uD83D\uDCCA ", _jsx("strong", { children: "Data Used:" }), " ", trainingInfo.articlesAnalyzed, " articles, ", trainingInfo.keywords, " keywords"] }), _jsxs("li", { children: ["\uD83C\uDFAF ", _jsx("strong", { children: "Focus:" }), " ", trainingInfo.patternFocus] }), _jsxs("li", { children: ["\uD83D\uDEE1\uFE0F ", _jsx("strong", { children: "Founder Lock:" }), " ", trainingInfo.lockedByFounder ? 'Γ£à Active' : 'Γ¥î Not active'] })] })) : (_jsx("p", { className: "text-sm text-gray-500", children: "No training info available." })), _jsxs("div", { className: "mt-4 flex flex-col gap-2", children: [_jsx("a", { href: "#", onClick: handleViewDiagnostics, className: "text-green-600 underline text-sm hover:text-green-800", children: "\uD83E\uDDE0 View AI Diagnostics" }), _jsx("button", { onClick: handleActivateTrainer, className: "bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded text-sm", children: "\uD83D\uDD27 Activate Full AI Trainer" })] }), _jsx("div", { className: "mt-4", children: _jsx("textarea", { placeholder: "Suggest improvement or tell what AI should focus on...", className: "w-full border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white p-2 rounded mt-2", rows: 3 }) })] }));
}
