import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
// 📁 src/pages/NewsDetail.tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { trackAnalytics } from '../lib/trackAnalytics';
export default function NewsDetail() {
    const { id } = useParams();
    const [article, setArticle] = useState(null);
    // ✅ Fetch article from API
    useEffect(() => {
        const fetchArticle = async () => {
            try {
                const res = await fetch(`${import.meta.env.VITE_API_URL}/news/${id}`);
                const data = await res.json();
                if (data.success && data.data) {
                    setArticle(data.data);
                }
            }
            catch (error) {
                console.error('❌ Failed to fetch article:', error);
            }
        };
        if (id)
            fetchArticle();
    }, [id]);
    // ✅ Track Analytics after article is loaded
    useEffect(() => {
        if (article?._id) {
            trackAnalytics(`/news/${article._id}`, article._id);
        }
    }, [article]);
    return (_jsx("div", { className: "p-6", children: article ? (_jsxs(_Fragment, { children: [_jsx("h1", { className: "text-2xl font-bold", children: article.title }), _jsx("p", { className: "mt-4 text-gray-700", children: article.content })] })) : (_jsx("p", { children: "Loading article..." })) }));
}
