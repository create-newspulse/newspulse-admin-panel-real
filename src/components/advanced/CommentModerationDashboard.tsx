// 💬 Comment Moderation Dashboard with Shadow-ban & Auto-mod
import { useEffect, useState } from 'react';
import axios from 'axios';
import { MessageSquare, CheckCircle, XCircle, Flag, Ban, TrendingDown, TrendingUp } from 'lucide-react';

const API_BASE = 'http://localhost:3002/api';

export default function CommentModerationDashboard() {
  const [comments, setComments] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
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
    } catch (error) {
      console.error('Failed to load comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const moderateComment = async (id: string, action: string) => {
    try {
      await axios.post(`${API_BASE}/moderation/comments/${id}/moderate`, { action, moderator: 'admin' });
      loadData();
    } catch (error) {
      console.error('Failed to moderate comment:', error);
    }
  };

  const shadowBanUser = async (author: string) => {
    if (!confirm(`Shadow-ban user: ${author}?`)) return;
    try {
      await axios.post(`${API_BASE}/moderation/comments/shadow-ban`, { author, reason: 'Manual shadow-ban from dashboard' });
      alert(`User ${author} shadow-banned. Their future comments will be hidden from other users.`);
    } catch (error) {
      console.error('Failed to shadow-ban user:', error);
    }
  };

  const getSentimentColor = (sentiment: string) => {
    return sentiment === 'positive' ? 'text-green-400' : sentiment === 'negative' ? 'text-red-400' : 'text-slate-400';
  };

  const getToxicityColor = (toxicity: number) => {
    if (toxicity > 0.7) return 'text-red-400';
    if (toxicity > 0.4) return 'text-yellow-400';
    return 'text-green-400';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-white flex items-center gap-3 mb-2">
          <MessageSquare className="w-10 h-10 text-blue-400" />
          Comment Moderation
        </h1>
        <p className="text-slate-300 mb-8">AI-powered moderation with shadow-ban capability</p>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <p className="text-slate-400 text-sm mb-1">Total</p>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
            </div>
            <div className="bg-green-500/10 rounded-xl p-4 border border-green-500/30">
              <p className="text-green-400 text-sm mb-1">Approved</p>
              <p className="text-2xl font-bold text-white">{stats.approved}</p>
            </div>
            <div className="bg-yellow-500/10 rounded-xl p-4 border border-yellow-500/30">
              <p className="text-yellow-400 text-sm mb-1">Pending</p>
              <p className="text-2xl font-bold text-white">{stats.pending}</p>
            </div>
            <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/30">
              <p className="text-red-400 text-sm mb-1">Rejected</p>
              <p className="text-2xl font-bold text-white">{stats.rejected}</p>
            </div>
            <div className="bg-purple-500/10 rounded-xl p-4 border border-purple-500/30">
              <p className="text-purple-400 text-sm mb-1">Shadow-banned</p>
              <p className="text-2xl font-bold text-white">{stats.shadowBanned}</p>
            </div>
          </div>
        )}

        <div className="flex gap-2 mb-6">
          {['all', 'pending', 'approved', 'rejected'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-4 py-2 rounded-lg font-medium transition capitalize ${
                filter === f
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="bg-slate-800/50 rounded-xl p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
            <p className="text-slate-400">Loading comments...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {comments.map(comment => (
              <div key={comment.id} className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <p className="text-white font-medium">{comment.author}</p>
                      <span className={`text-xs px-2 py-1 rounded ${
                        comment.status === 'approved' ? 'bg-green-500/20 text-green-300' :
                        comment.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300' :
                        'bg-red-500/20 text-red-300'
                      }`}>
                        {comment.status}
                      </span>
                      {comment.spam && <span className="text-xs px-2 py-1 bg-red-500/20 text-red-300 rounded">SPAM</span>}
                    </div>
                    <p className="text-slate-300 mb-3">{comment.content}</p>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        {comment.sentiment === 'positive' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        <span className={`${getSentimentColor(comment.sentiment)} capitalize`}>{comment.sentiment}</span>
                      </div>
                      <div>
                        <span className={getToxicityColor(comment.toxicity)}>Toxicity: {(comment.toxicity * 100).toFixed(0)}%</span>
                      </div>
                      <span className="text-slate-500">{new Date(comment.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  {comment.status === 'pending' && (
                    <>
                      <button
                        onClick={() => moderateComment(comment.id, 'approve')}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition flex items-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Approve
                      </button>
                      <button
                        onClick={() => moderateComment(comment.id, 'reject')}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition flex items-center gap-2"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => moderateComment(comment.id, 'flag')}
                    className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm font-medium transition flex items-center gap-2"
                  >
                    <Flag className="w-4 h-4" />
                    Flag
                  </button>
                  <button
                    onClick={() => shadowBanUser(comment.author)}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition flex items-center gap-2"
                  >
                    <Ban className="w-4 h-4" />
                    Shadow-ban User
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
