import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useLockdownCheck } from '@hooks/useLockdownCheck';
import apiClient from '@lib/api';
const PollOfTheDay = () => {
    const [poll, setPoll] = useState(null);
    const [selected, setSelected] = useState(null);
    const [voted, setVoted] = useState(false);
    const [loading, setLoading] = useState(true);
    const [lang, setLang] = useState('en');
    const [settings, setSettings] = useState({ lockdown: false });
    // ≡ƒöÆ Load lockdown settings
    useEffect(() => {
        apiClient
            .get('/settings/load')
            .then((res) => setSettings((res?.data ?? res) || { lockdown: false }))
            .catch(() => setSettings({ lockdown: false }));
    }, []);
    useLockdownCheck(settings);
    // ≡ƒîÉ Detect browser language
    useEffect(() => {
        const browserLang = navigator.language;
        if (browserLang.startsWith('hi'))
            setLang('hi');
        else if (browserLang.startsWith('gu'))
            setLang('gu');
    }, []);
    // ≡ƒôÑ Load latest poll
    useEffect(() => {
        fetch(`${import.meta.env.VITE_API_URL}/polls/latest`)
            .then((res) => res.json())
            .then((data) => {
            if (data.success)
                setPoll(data.poll);
            setLoading(false);
        })
            .catch((err) => {
            console.error('Failed to load poll', err);
            setLoading(false);
        });
    }, []);
    const getQuestion = () => {
        if (!poll)
            return '';
        if (lang === 'hi')
            return poll.question_hi;
        if (lang === 'gu')
            return poll.question_gu;
        return poll.question_en;
    };
    const getOptions = () => {
        if (!poll)
            return [];
        if (lang === 'hi')
            return poll.options_hi;
        if (lang === 'gu')
            return poll.options_gu;
        return poll.options_en;
    };
    const handleVote = async () => {
        if (poll && selected !== null) {
            try {
                const res = await fetch(`${import.meta.env.VITE_API_URL}/polls/vote`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pollId: poll._id, optionIndex: selected }),
                });
                const data = await res.json();
                if (data.success) {
                    setPoll(data.poll);
                    setVoted(true);
                }
            }
            catch (err) {
                console.error('Vote failed', err);
            }
        }
    };
    // ≡ƒöÆ Lockdown message
    if (settings.lockdown) {
        return (_jsx("div", { className: "p-6 text-center text-red-600 dark:text-red-400", children: "\uD83D\uDD12 Voting is temporarily disabled during lockdown mode." }));
    }
    return (_jsxs("div", { className: "p-6 max-w-2xl mx-auto bg-white shadow rounded-xl", children: [_jsx("h1", { className: "text-2xl font-bold mb-4", children: "\uD83D\uDCCA Poll of the Day" }), _jsxs("div", { className: "mb-4", children: [_jsx("label", { htmlFor: "lang", className: "mr-2 font-semibold", children: "Language:" }), _jsxs("select", { id: "lang", value: lang, onChange: (e) => setLang(e.target.value), className: "border px-2 py-1 rounded", children: [_jsx("option", { value: "en", children: "\uD83C\uDDEC\uD83C\uDDE7 English" }), _jsx("option", { value: "hi", children: "\uD83C\uDDEE\uD83C\uDDF3 \u0939\u093F\u0902\u0926\u0940" }), _jsx("option", { value: "gu", children: "\uD83C\uDDEE\uD83C\uDDF3 \u0A97\u0AC1\u0A9C\u0AB0\u0ABE\u0AA4\u0AC0" })] })] }), loading ? (_jsx("p", { children: "Loading..." })) : poll ? (_jsxs(_Fragment, { children: [_jsx("h2", { className: "text-lg font-semibold mb-3", children: getQuestion() }), _jsx("ul", { className: "space-y-2", children: getOptions().map((opt, idx) => (_jsxs("li", { onClick: () => setSelected(idx), className: `cursor-pointer px-4 py-2 rounded-md border ${selected === idx ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`, children: [opt, voted && poll.options && poll.options[idx] && (_jsxs("span", { className: "ml-2 text-sm text-gray-600", children: ["\u2013 ", poll.options[idx].votes, " vote", poll.options[idx].votes !== 1 ? 's' : ''] }))] }, idx))) }), !voted && (_jsx("button", { onClick: handleVote, className: "mt-4 px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700", disabled: selected === null, children: "Vote" })), voted && (_jsx("p", { className: "mt-4 text-green-600", children: "\u2705 Thank you for voting!" }))] })) : (_jsx("p", { children: "No active poll available." }))] }));
};
export default PollOfTheDay;
