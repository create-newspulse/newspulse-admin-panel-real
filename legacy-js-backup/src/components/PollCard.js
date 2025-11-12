import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
const PollCard = () => {
    const [poll, setPoll] = useState(null);
    const [selected, setSelected] = useState(null);
    const [voted, setVoted] = useState(false);
    const [lang, setLang] = useState('en');
    useEffect(() => {
        const stored = localStorage.getItem('preferredLang');
        const detected = navigator.language.startsWith('hi')
            ? 'hi'
            : navigator.language.startsWith('gu')
                ? 'gu'
                : 'en';
        setLang(stored || detected);
    }, []);
    useEffect(() => {
        fetch(`${import.meta.env.VITE_API_URL}/polls/latest`)
            .then((res) => res.json())
            .then((data) => {
            if (data.success)
                setPoll(data.poll);
        });
    }, []);
    const getQuestion = () => {
        if (!poll)
            return '';
        return lang === 'hi'
            ? poll.question_hi
            : lang === 'gu'
                ? poll.question_gu
                : poll.question_en;
    };
    const getOptions = () => {
        if (!poll)
            return [];
        return lang === 'hi'
            ? poll.options_hi
            : lang === 'gu'
                ? poll.options_gu
                : poll.options_en;
    };
    const handleVote = async () => {
        if (!poll || selected === null)
            return;
        const res = await fetch(`${import.meta.env.VITE_API_URL}/polls/vote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pollId: poll._id, optionIndex: selected }),
        });
        const data = await res.json();
        if (data.success) {
            setPoll(data.poll); // returns updated votes
            setVoted(true);
        }
    };
    if (!poll)
        return null;
    return (_jsxs("div", { className: "bg-white shadow p-4 rounded-lg", children: [_jsx("h3", { className: "font-semibold text-lg mb-2", children: "\uD83D\uDCCA Poll of the Day" }), _jsx("p", { className: "mb-3 text-sm", children: getQuestion() }), getOptions().map((opt, idx) => (_jsxs("button", { onClick: () => setSelected(idx), className: `block w-full text-left px-3 py-2 mb-1 border rounded ${selected === idx ? 'border-blue-600 bg-blue-50' : 'border-gray-300'}`, children: [opt, voted && poll.options && (_jsxs("span", { className: "ml-2 text-sm text-gray-500", children: ["(", poll.options[idx]?.votes ?? 0, ")"] }))] }, idx))), !voted ? (_jsx("button", { className: "mt-3 w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700", onClick: handleVote, disabled: selected === null, children: "Vote" })) : (_jsx("p", { className: "text-green-600 mt-2", children: "\u2705 Voted!" }))] }));
};
export default PollCard;
