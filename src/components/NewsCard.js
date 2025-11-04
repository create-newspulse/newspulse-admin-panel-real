import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
export default function NewsCard({ article }) {
    const { user } = useAuth();
    const handleSave = async () => {
        try {
            const res = await api.post(`/news/save-news/${article._id}`, {
                userId: user?._id,
            });
            if (res.data.success) {
                alert('✅ News saved!');
                // Optionally use a toast instead of alert for better UX
                // toast.success('News saved successfully!');
            }
        }
        catch (err) {
            console.error('❌ Save failed:', err);
            alert('❌ Could not save news.');
        }
    };
    return (_jsxs("div", { className: "bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm p-5 transition hover:shadow-md", children: [_jsx("h2", { className: "text-lg font-semibold text-gray-800 dark:text-white mb-2", children: article.title }), _jsx("p", { className: "text-sm text-gray-600 dark:text-gray-300", children: article.summary }), _jsx("div", { className: "mt-4 flex justify-end", children: _jsx("button", { onClick: handleSave, className: "px-4 py-1.5 text-sm rounded bg-blue-600 hover:bg-blue-500 text-white transition", children: "\uD83D\uDD16 Save" }) })] }));
}
