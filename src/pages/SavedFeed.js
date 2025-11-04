import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import apiClient from '@lib/api';
import { topicLabelMap } from '../lib/topicLabelMap';
const SavedFeed = () => {
    const [savedNews, setSavedNews] = useState([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const userId = localStorage.getItem('userId');
        if (!userId)
            return;
        apiClient
            .get(`/saved-news`, { params: { userId } })
            .then((res) => {
            const data = res?.data ?? res;
            setSavedNews(data.saved || []);
        })
            .catch((err) => console.error('❌ Failed to fetch saved news:', err))
            .finally(() => setLoading(false));
    }, []);
    return (_jsxs("div", { className: "px-4 py-6 sm:px-8", children: [_jsx("h1", { className: "text-3xl font-bold text-slate-800 dark:text-white mb-6", children: "\uD83D\uDD16 Saved News" }), loading ? (_jsx("p", { className: "text-gray-500 dark:text-gray-300", children: "Loading..." })) : savedNews.length === 0 ? (_jsx("p", { className: "text-gray-500 dark:text-gray-300", children: "No saved articles yet." })) : (_jsx("div", { className: "grid gap-6 sm:grid-cols-2 lg:grid-cols-3", children: savedNews.map((item) => (_jsxs("div", { className: "bg-white dark:bg-slate-800 rounded-lg shadow hover:shadow-xl transition p-4", children: [item.image && (_jsx("img", { src: item.image, alt: item.title, className: "w-full h-48 object-cover rounded-md mb-3" })), _jsx("h2", { className: "text-lg font-semibold text-slate-800 dark:text-white mb-1", children: item.title }), _jsx("p", { className: "text-sm text-gray-500 dark:text-gray-400", children: topicLabelMap[item.category] || item.category }), _jsx("p", { className: "text-xs text-gray-400 mt-1", children: new Date(item.publishedAt).toLocaleString() })] }, item._id))) }))] }));
};
export default SavedFeed;
