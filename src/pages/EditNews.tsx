import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '../components/Editor';

interface NewsForm {
  title: string;
  content: string;
  category: string;
  language: string;
  summary?: string;
}

const CATEGORY_OPTIONS = [
  'Breaking News', 'Regional', 'Politics', 'National', 'International',
  'Business', 'Tech', 'Lifestyle', 'Glamorous', 'Sports',
  'Viral Videos', 'Web Stories', 'Editorial', 'Login'
];

const LANGUAGE_OPTIONS = ['English', 'Hindi', 'Gujarati'];

export default function EditNews() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState<NewsForm>({
    title: '',
    content: '',
    category: '',
    language: '',
    summary: ''
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/news/${id}`);
        const data = await res.json();
        if (data.success && data.data) {
          setForm({
            title: data.data.title,
            content: data.data.content,
            category: data.data.category,
            language: data.data.language,
            summary: data.data.summary || ''
          });
        } else {
          setError('⚠️ News not found');
        }
      } catch (err) {
        console.error(err);
        setError('❌ Failed to load news');
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, [id]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.title || !form.content || !form.category || !form.language) {
      alert('⚠️ All fields are required');
      return;
    }

    try {
      const res = await fetch(`http://localhost:5000/api/edit-news/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const result = await res.json();

      if (result.success) {
        alert('✅ News updated');
        navigate('/manage');
      } else {
        alert('❌ Update failed');
      }
    } catch (err) {
      console.error(err);
      alert('❌ Server error');
    }
  };

  const handleAISummary = async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/ai/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: form.content }),
      });
      const data = await response.json();
      if (data.summary) {
        setForm({ ...form, summary: data.summary });
        alert('🧠 Summary updated!');
      }
    } catch (err) {
      alert('❌ AI summarizer failed');
      console.error(err);
    }
  };

  if (loading) return <p className="p-4">Loading news...</p>;
  if (error) return <p className="p-4 text-red-500">{error}</p>;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">✏️ Edit News</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          name="title"
          value={form.title}
          onChange={handleChange}
          placeholder="📰 News Title"
          required
          className="w-full border px-4 py-2 rounded"
        />

        <select
          name="category"
          value={form.category}
          onChange={handleChange}
          required
          className="w-full border px-4 py-2 rounded"
        >
          <option value="">Select Category</option>
          {CATEGORY_OPTIONS.map((cat, index) => (
            <option key={index} value={cat}>{cat}</option>
          ))}
        </select>

        <select
          name="language"
          value={form.language}
          onChange={handleChange}
          required
          className="w-full border px-4 py-2 rounded"
        >
          <option value="">Select Language</option>
          {LANGUAGE_OPTIONS.map((lang, index) => (
            <option key={index} value={lang}>{lang}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={handleAISummary}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-500"
        >
          🧠 Auto-Summarize
        </button>

        <textarea
          className="w-full border px-4 py-2 rounded"
          placeholder="📝 Summary will appear here..."
          rows={3}
          name="summary"
          value={form.summary || ''}
          onChange={handleChange}
        />

        <Editor
          content={form.content}
          onChange={(value) => setForm({ ...form, content: value })}
        />

        <div className="text-right">
          <button
            type="submit"
            className="bg-green-700 text-white px-6 py-2 rounded hover:bg-green-600"
          >
            💾 Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}
