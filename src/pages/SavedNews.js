import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
export default function SavedNews() {
    const { user } = useAuth();
    const [saved, setSaved] = useState([]); // ✅ Typed array
    useEffect(() => {
        if (!user?._id)
            return;
        api
            .get(`/news/saved-news?userId=${user._id}`)
            .then((res) => {
            if (res.data.success) {
                setSaved(res.data.saved);
            }
        })
            .catch((err) => console.error('❌ Load failed:', err));
    }, [user]);
    return (_jsxs("main", { className: "p-6", children: [_jsx("h1", { className: "text-2xl font-bold mb-4", children: "\uD83D\uDD16 Saved News" }), _jsx("ul", { className: "space-y-4", children: saved.map((item) => (_jsxs("li", { className: "bg-gray-100 dark:bg-gray-800 p-4 rounded shadow", children: [_jsx("h3", { className: "text-lg font-semibold", children: item.title }), _jsx("p", { className: "text-sm text-gray-500", children: new Date(item.createdAt).toLocaleString() })] }, item._id))) })] }));
}
