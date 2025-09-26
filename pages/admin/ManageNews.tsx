// ✅ Updated: admin-backend/pages/admin/ManageNews.tsx with Filters, Preview, Pagination, Inline Editing
import React, { useEffect, useState } from 'react';

interface NewsItem {
  _id: string;
  title: string;
  category: string;
  language?: string;
  content?: string;
  createdAt: string;
}

const ITEMS_PER_PAGE = 5;

const ManageNews: React.FC = () => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [languageFilter, setLanguageFilter] = useState('All');
  const [previewItem, setPreviewItem] = useState<NewsItem | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedTitle, setEditedTitle] = useState('');
  const [userRole] = useState('founder'); // optionally replace with real auth check

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/all-news');
        const data = await res.json();
        if (data.success && Array.isArray(data.news)) {
          setNews(data.news);
        } else {
          setError('⚠️ No news data found');
        }
      } catch (err) {
        console.error('❌ Fetch error:', err);
        setError('❌ Failed to load news');
      } finally {
        setLoading(false);
      }
    };
    fetchNews();
  }, []);

  const filteredNews = news.filter(item =>
    (categoryFilter === 'All' || item.category === categoryFilter) &&
    (languageFilter === 'All' || item.language === languageFilter)
  );

  const totalPages = Math.ceil(filteredNews.length / ITEMS_PER_PAGE);
  const currentNews = filteredNews.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const uniqueCategories = Array.from(new Set(news.map(n => n.category)));
  const uniqueLanguages = Array.from(new Set(news.map(n => n.language)));

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this news item?')) return;
    try {
      const res = await fetch(`http://localhost:5000/api/delete-news/${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        setNews(news.filter(n => n._id !== id));
      } else {
        alert('❌ Delete failed');
      }
    } catch (err) {
      alert('❌ Server error');
    }
  };

  const startEditing = (id: string, title: string) => {
    setEditingId(id);
    setEditedTitle(title);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditedTitle('');
  };

  const saveEdit = (id: string) => {
    setNews(news.map(item => item._id === id ? { ...item, title: editedTitle } : item));
    cancelEditing();
  };

  if (loading) return <p className="p-6 text-gray-500">Loading...</p>;
  if (error) return <p className="p-6 text-red-500">{error}</p>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">📁 Manage News</h1>

      <div className="flex gap-4 mb-4">
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="border px-3 py-2 rounded">
          <option value="All">All Categories</option>
          {uniqueCategories.map((cat, idx) => <option key={idx} value={cat}>{cat}</option>)}
        </select>

        <select value={languageFilter} onChange={e => setLanguageFilter(e.target.value)} className="border px-3 py-2 rounded">
          <option value="All">All Languages</option>
          {uniqueLanguages.map((lang, idx) => <option key={idx} value={lang || 'N/A'}>{lang || 'N/A'}</option>)}
        </select>
      </div>

      {filteredNews.length === 0 ? (
        <p className="text-gray-500">No news found.</p>
      ) : (
        <>
          <table className="table-auto w-full border mt-4">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 border">Title</th>
                <th className="p-2 border">Category</th>
                <th className="p-2 border">Language</th>
                <th className="p-2 border">Date</th>
                <th className="p-2 border">Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentNews.map((item) => (
                <tr key={item._id} className="border-t">
                  <td className="p-2 border">
                    {editingId === item._id ? (
                      <input value={editedTitle} onChange={e => setEditedTitle(e.target.value)} className="w-full border px-2 py-1 rounded" />
                    ) : (
                      item.title
                    )}
                  </td>
                  <td className="p-2 border">{item.category}</td>
                  <td className="p-2 border">{item.language || 'N/A'}</td>
                  <td className="p-2 border">{new Date(item.createdAt).toLocaleString()}</td>
                  <td className="p-2 border flex gap-2">
                    {editingId === item._id ? (
                      <>
                        <button onClick={() => saveEdit(item._id)} className="bg-green-600 text-white px-3 py-1 rounded">Save</button>
                        <button onClick={cancelEditing} className="bg-gray-600 text-white px-3 py-1 rounded">Cancel</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => setPreviewItem(item)} className="bg-blue-600 text-white px-3 py-1 rounded">Preview</button>
                        <button onClick={() => startEditing(item._id, item.title)} className="bg-yellow-500 text-white px-3 py-1 rounded">Edit</button>
                        {userRole === 'founder' && (
                          <button onClick={() => handleDelete(item._id)} className="bg-red-600 text-white px-3 py-1 rounded">Delete</button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-between items-center mt-4">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="bg-gray-300 px-4 py-2 rounded disabled:opacity-50">⬅️ Prev</button>
            <span>Page {currentPage} of {totalPages}</span>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="bg-gray-300 px-4 py-2 rounded disabled:opacity-50">Next ➡️</button>
          </div>
        </>
      )}

      {/* Preview Modal */}
      {previewItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 p-6 rounded shadow-lg max-w-xl w-full">
            <h2 className="text-xl font-bold mb-2">{previewItem.title}</h2>
            <p className="text-sm text-gray-500">{previewItem.category} • {previewItem.language}</p>
            <p className="mt-4 text-sm text-gray-700 dark:text-gray-300">{previewItem.content || 'No content available.'}</p>
            <div className="mt-6 text-right">
              <button onClick={() => setPreviewItem(null)} className="bg-gray-500 text-white px-4 py-2 rounded">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageNews;
