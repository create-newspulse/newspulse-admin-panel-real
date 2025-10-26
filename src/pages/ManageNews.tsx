import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@lib/api';
import toast from 'react-hot-toast';

type Article = {
  _id: string;
  title: string;
  language?: string;
  status?: string;
  workflow?: {
    stage?: string;
    checklist?: Record<string, boolean>;
  };
};

export default function ManageNews() {
  const navigate = useNavigate();

  // Voice state (preserve existing TTS helpers)
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [voiceGender, setVoiceGender] = useState<'female' | 'male'>('female');
  const [speed, setSpeed] = useState<'normal' | 'slow' | 'fast'>('normal');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchArticles = async () => {
    setLoading(true);
    try {
      const res = await api.get('/news/all');
      const data = res.data || res;
      const items: Article[] = (data.articles || data.items || []).map((a: any) => ({
        _id: a._id || a.id,
        title: a.title,
        language: a.language,
        status: a.status,
        workflow: a.workflow || {},
      }));
      setArticles(items);
      setError('');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to load articles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArticles();
  }, []);

  // TTS helpers (unchanged)
  const playVoice = (text: string, id: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-IN';
    utterance.rate = speed === 'fast' ? 1.5 : speed === 'slow' ? 0.75 : 1;
    utterance.voice =
      speechSynthesis.getVoices().find((v) =>
        voiceGender === 'male' ? v.name.toLowerCase().includes('male') : v.name.toLowerCase().includes('female')
      ) || null;
    utterance.onend = () => setPlayingId(null);
    setPlayingId(id);
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  };

  const stopVoice = () => {
    speechSynthesis.cancel();
    setPlayingId(null);
  };

  const handleCheckbox = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const playSelected = () => {
    const texts = articles.filter((a) => selectedIds.includes(a._id)).map((a) => a.title).join('. ');
    if (texts) playVoice(texts, 'batch');
  };

  // Workflow quick actions
  const doTransition = async (id: string, action: 'toReview' | 'toLegal' | 'approve' | 'publish') => {
    try {
      const res = await api.post(`/news/${id}/transition`, { action });
      if (res.data?.success) {
        toast.success(`${action} done`);
        // Optimistically refresh this article's status
        await fetchArticles();
      } else {
        toast.error('Action failed');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Request failed');
    }
  };

  const can = (a: Article) => {
    const stage = (a.workflow?.stage || '').toLowerCase();
    return {
      toReview: !stage || stage === 'draft',
      toLegal: stage === 'copy-edit' || stage === 'review',
      approve: stage === 'legal' || stage === 'eic-review',
      publish: stage === 'approved' || stage === 'scheduled',
    };
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">📁 Manage News Articles</h1>
        <div className="flex gap-2">
          <button onClick={fetchArticles} className="px-3 py-1 rounded bg-slate-800 text-white">🔄 Refresh</button>
          <button onClick={() => navigate('/add')} className="px-3 py-1 rounded bg-green-700 text-white">➕ Add</button>
        </div>
      </div>

      {loading && <p>Loading…</p>}
      {error && <p className="text-red-600">{error}</p>}

      {!loading && !error && articles.length === 0 && (
        <p className="text-slate-600">No articles found.</p>
      )}

      {articles.map((article) => {
        const c = can(article);
        const stage = article.workflow?.stage || 'draft';
        return (
          <div key={article._id} className="bg-white rounded shadow p-4 mb-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(article._id)}
                  onChange={() => handleCheckbox(article._id)}
                />
                <p className="font-semibold text-lg">{article.title}</p>
              </div>
              <div className="flex gap-2 text-xs">
                <span className="px-2 py-1 rounded bg-blue-100 text-blue-800">Status: {article.status || 'draft'}</span>
                <span className="px-2 py-1 rounded bg-purple-100 text-purple-800">Stage: {stage}</span>
                {article.language && (
                  <span className="px-2 py-1 rounded bg-slate-100 text-slate-800">Lang: {article.language}</span>
                )}
              </div>
            </div>

            <div className="flex gap-2 flex-wrap mt-2">
              <button onClick={() => navigate(`/edit/${article._id}`)} className="bg-green-600 text-white px-3 py-1 rounded">✏️ Edit</button>
              <button className="bg-red-600 text-white px-3 py-1 rounded">🗑 Delete</button>

              {/* Voice controls */}
              <button onClick={() => playVoice(article.title, article._id)} className="bg-purple-600 text-white px-3 py-1 rounded">
                🔊 {playingId === article._id ? 'Playing...' : 'Test Voice'}
              </button>
              <button onClick={() => playVoice(article.title, article._id)} className="bg-gray-700 text-white px-3 py-1 rounded">🔁 Replay</button>
              <button onClick={stopVoice} className="bg-black text-white px-3 py-1 rounded">⏹ Stop</button>
              <button onClick={() => setVoiceGender(voiceGender === 'female' ? 'male' : 'female')} className="bg-blue-500 text-white px-3 py-1 rounded">
                🎙 Switch to {voiceGender === 'female' ? 'Male' : 'Female'}
              </button>
              <select value={speed} onChange={(e) => setSpeed(e.target.value as 'normal' | 'fast' | 'slow')} className="border px-2 py-1 rounded text-sm">
                <option value="normal">🌐 Normal</option>
                <option value="slow">🐢 Slow</option>
                <option value="fast">⚡ Fast</option>
              </select>

              {/* Workflow quick actions */}
              <div className="ml-auto flex gap-2 flex-wrap">
                <button onClick={() => doTransition(article._id, 'toReview')} disabled={!c.toReview} className={`px-3 py-1 rounded text-white ${!c.toReview ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'}`}>📤 To Review</button>
                <button onClick={() => doTransition(article._id, 'toLegal')} disabled={!c.toLegal} className={`px-3 py-1 rounded text-white ${!c.toLegal ? 'bg-gray-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-500'}`}>⚖️ To Legal</button>
                <button onClick={() => doTransition(article._id, 'approve')} disabled={!c.approve} className={`px-3 py-1 rounded text-white ${!c.approve ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500'}`}>✅ Approve</button>
                <button onClick={() => doTransition(article._id, 'publish')} disabled={!c.publish} className={`px-3 py-1 rounded text-white ${!c.publish ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-500'}`}>🚀 Publish</button>
              </div>
            </div>
          </div>
        );
      })}

      {selectedIds.length > 0 && (
        <div className="mt-6 p-4 bg-slate-100 rounded shadow border">
          <h3 className="font-semibold mb-2">🎧 Playlist Actions</h3>
          <div className="flex gap-3 flex-wrap">
            <button onClick={playSelected} className="bg-purple-700 text-white px-4 py-1 rounded">▶️ Play All ({selectedIds.length})</button>
            <button onClick={() => setSelectedIds([])} className="bg-red-500 text-white px-4 py-1 rounded">❌ Clear Playlist</button>
          </div>
        </div>
      )}
    </div>
  );
}
