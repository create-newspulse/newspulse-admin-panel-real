import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import axios from 'axios';
const TodayInHistoryBlock = () => {
    const [entries, setEntries] = useState([]);
    useEffect(() => {
        axios.get(`${import.meta.env.VITE_API_URL}/today-history`)
            .then(res => {
            if (res.data.success)
                setEntries(res.data.data);
        })
            .catch(err => console.error('Γ¥î Failed to load history:', err));
    }, []);
    if (!entries.length)
        return null;
    return (_jsxs("div", { className: "bg-blue-100 dark:bg-blue-900 text-black dark:text-white p-4 rounded-xl shadow mb-6", children: [_jsx("h3", { className: "font-bold text-lg mb-2", children: "\uD83D\uDCDC Today in History" }), _jsx("ul", { className: "list-disc pl-5 space-y-1", children: entries.map((item, idx) => (_jsxs("li", { children: [_jsxs("span", { className: "font-semibold", children: [item.year, ":"] }), " ", item.event] }, idx))) })] }));
};
export default TodayInHistoryBlock;
