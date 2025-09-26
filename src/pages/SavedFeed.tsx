import { useEffect, useState } from 'react';
import axios from 'axios';
import { topicLabelMap } from '../lib/topicLabelMap';

interface NewsItem {
  _id: string;
  title: string;
  category: string;
  publishedAt: string;
  source?: string;
  image?: string;
}

const SavedFeed = () => {
  const [savedNews, setSavedNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = localStorage.getItem('userId');

    if (!userId) return;

    axios
      .get(`/api/saved-news?userId=${userId}`)
      .then((res) => setSavedNews(res.data.saved || []))
      .catch((err) => console.error('❌ Failed to fetch saved news:', err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="px-4 py-6 sm:px-8">
      <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-6">🔖 Saved News</h1>

      {loading ? (
        <p className="text-gray-500 dark:text-gray-300">Loading...</p>
      ) : savedNews.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-300">No saved articles yet.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {savedNews.map((item) => (
            <div
              key={item._id}
              className="bg-white dark:bg-slate-800 rounded-lg shadow hover:shadow-xl transition p-4"
            >
              {item.image && (
                <img
                  src={item.image}
                  alt={item.title}
                  className="w-full h-48 object-cover rounded-md mb-3"
                />
              )}
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-1">
                {item.title}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {topicLabelMap[item.category] || item.category}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {new Date(item.publishedAt).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SavedFeed;
