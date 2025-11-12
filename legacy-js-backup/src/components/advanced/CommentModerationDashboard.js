import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// ≡ƒÆ¼ Comment Moderation Dashboard with Shadow-ban & Auto-mod
import { useEffect, useState } from 'react';
import axios from 'axios';
import { MessageSquare, CheckCircle, XCircle, Flag, Ban, TrendingDown, TrendingUp } from 'lucide-react';
const API_BASE = import.meta.env.VITE_API_URL || '/admin-api';
export default function CommentModerationDashboard() {
    const [comments, setComments] = useState([]);
    const [stats, setStats] = useState(null);
    const [filter, setFilter] = useState('pending');
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        loadData();
    }, [filter]);
    const loadData = async () => {
        setLoading(true);
        try {
            const [commentsRes, statsRes] = await Promise.all([
                axios.get(`${API_BASE}/moderation/comments${filter !== 'all' ? `?status=${filter}` : ''}`),
                axios.get(`${API_BASE}/moderation/comments/stats`)
            ]);
            setComments(commentsRes.data.comments || []);
            setStats(statsRes.data.stats || null);
        }
        catch (error) {
            console.error('Failed to load comments:', error);
        }
        finally {
            setLoading(false);
        }
    };
    const moderateComment = async (id, action) => {
        try {
            await axios.post(`${API_BASE}/moderation/comments/${id}/moderate`, { action, moderator: 'admin' });
            loadData();
        }
        catch (error) {
            console.error('Failed to moderate comment:', error);
        }
    };
    const shadowBanUser = async (author) => {
        if (!confirm(`Shadow-ban user: ${author}?`))
            return;
        try {
            await axios.post(`${API_BASE}/moderation/comments/shadow-ban`, { author, reason: 'Manual shadow-ban from dashboard' });
            alert(`User ${author} shadow-banned. Their future comments will be hidden from other users.`);
        }
        catch (error) {
            console.error('Failed to shadow-ban user:', error);
        }
    };
    const getSentimentColor = (sentiment) => {
        return sentiment === 'positive' ? 'text-green-400' : sentiment === 'negative' ? 'text-red-400' : 'text-slate-400';
    };
    const getToxicityColor = (toxicity) => {
        if (toxicity > 0.7)
            return 'text-red-400';
        if (toxicity > 0.4)
            return 'text-yellow-400';
        return 'text-green-400';
    };
    return (_jsx("div", { className: "min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-8", children: _jsxs("div", { className: "max-w-7xl mx-auto", children: [_jsxs("h1", { className: "text-4xl font-bold text-white flex items-center gap-3 mb-2", children: [_jsx(MessageSquare, { className: "w-10 h-10 text-blue-400" }), "Comment Moderation"] }), _jsx("p", { className: "text-slate-300 mb-8", children: "AI-powered moderation with shadow-ban capability" }), stats && (_jsxs("div", { className: "grid grid-cols-2 md:grid-cols-5 gap-4 mb-6", children: [_jsxs("div", { className: "bg-slate-800/50 rounded-xl p-4 border border-slate-700", children: [_jsx("p", { className: "text-slate-400 text-sm mb-1", children: "Total" }), _jsx("p", { className: "text-2xl font-bold text-white", children: stats.total })] }), _jsxs("div", { className: "bg-green-500/10 rounded-xl p-4 border border-green-500/30", children: [_jsx("p", { className: "text-green-400 text-sm mb-1", children: "Approved" }), _jsx("p", { className: "text-2xl font-bold text-white", children: stats.approved })] }), _jsxs("div", { className: "bg-yellow-500/10 rounded-xl p-4 border border-yellow-500/30", children: [_jsx("p", { className: "text-yellow-400 text-sm mb-1", children: "Pending" }), _jsx("p", { className: "text-2xl font-bold text-white", children: stats.pending })] }), _jsxs("div", { className: "bg-red-500/10 rounded-xl p-4 border border-red-500/30", children: [_jsx("p", { className: "text-red-400 text-sm mb-1", children: "Rejected" }), _jsx("p", { className: "text-2xl font-bold text-white", children: stats.rejected })] }), _jsxs("div", { className: "bg-purple-500/10 rounded-xl p-4 border border-purple-500/30", children: [_jsx("p", { className: "text-purple-400 text-sm mb-1", children: "Shadow-banned" }), _jsx("p", { className: "text-2xl font-bold text-white", children: stats.shadowBanned })] })] })), _jsx("div", { className: "flex gap-2 mb-6", children: ['all', 'pending', 'approved', 'rejected'].map(f => (_jsx("button", { onClick: () => setFilter(f), className: `px-4 py-2 rounded-lg font-medium transition capitalize ${filter === f
                            ? 'bg-blue-500 text-white'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`, children: f }, f))) }), loading ? (_jsxs("div", { className: "bg-slate-800/50 rounded-xl p-12 text-center", children: [_jsx("div", { className: "animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4" }), _jsx("p", { className: "text-slate-400", children: "Loading comments..." })] })) : (_jsx("div", { className: "space-y-4", children: comments.map(comment => (_jsxs("div", { className: "bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700", children: [_jsx("div", { className: "flex items-start justify-between mb-4", children: _jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: "flex items-center gap-3 mb-2", children: [_jsx("p", { className: "text-white font-medium", children: comment.author }), _jsx("span", { className: `text-xs px-2 py-1 rounded ${comment.status === 'approved' ? 'bg-green-500/20 text-green-300' :
                                                        comment.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300' :
                                                            'bg-red-500/20 text-red-300'}`, children: comment.status }), comment.spam && _jsx("span", { className: "text-xs px-2 py-1 bg-red-500/20 text-red-300 rounded", children: "SPAM" })] }), _jsx("p", { className: "text-slate-300 mb-3", children: comment.content }), _jsxs("div", { className: "flex items-center gap-4 text-sm", children: [_jsxs("div", { className: "flex items-center gap-1", children: [comment.sentiment === 'positive' ? _jsx(TrendingUp, { className: "w-4 h-4" }) : _jsx(TrendingDown, { className: "w-4 h-4" }), _jsx("span", { className: `${getSentimentColor(comment.sentiment)} capitalize`, children: comment.sentiment })] }), _jsx("div", { children: _jsxs("span", { className: getToxicityColor(comment.toxicity), children: ["Toxicity: ", (comment.toxicity * 100).toFixed(0), "%"] }) }), _jsx("span", { className: "text-slate-500", children: new Date(comment.createdAt).toLocaleString() })] })] }) }), _jsxs("div", { className: "flex gap-2", children: [comment.status === 'pending' && (_jsxs(_Fragment, { children: [_jsxs("button", { onClick: () => moderateComment(comment.id, 'approve'), className: "px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition flex items-center gap-2", children: [_jsx(CheckCircle, { className: "w-4 h-4" }), "Approve"] }), _jsxs("button", { onClick: () => moderateComment(comment.id, 'reject'), className: "px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition flex items-center gap-2", children: [_jsx(XCircle, { className: "w-4 h-4" }), "Reject"] })] })), _jsxs("button", { onClick: () => moderateComment(comment.id, 'flag'), className: "px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm font-medium transition flex items-center gap-2", children: [_jsx(Flag, { className: "w-4 h-4" }), "Flag"] }), _jsxs("button", { onClick: () => shadowBanUser(comment.author), className: "px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition flex items-center gap-2", children: [_jsx(Ban, { className: "w-4 h-4" }), "Shadow-ban User"] })] })] }, comment.id))) }))] }) }));
}
