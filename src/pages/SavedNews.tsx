import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

// 🔹 Define Article interface
interface Article {
  _id: string;
  title: string;
  createdAt: string;
  summary?: string; // Optional if not used here
}

export default function SavedNews() {
  const { user } = useAuth();
  const [saved, setSaved] = useState<Article[]>([]); // ✅ Typed array

  useEffect(() => {
    if (!user?._id) return;

    api
      .get(`/news/saved-news?userId=${user._id}`)
      .then((res) => {
        if (res.data.success) {
          setSaved(res.data.saved as Article[]);
        }
      })
      .catch((err) => console.error('❌ Load failed:', err));
  }, [user]);

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">🔖 Saved News</h1>
      <ul className="space-y-4">
        {saved.map((item) => (
          <li key={item._id} className="bg-gray-100 dark:bg-gray-800 p-4 rounded shadow">
            <h3 className="text-lg font-semibold">{item.title}</h3>
            <p className="text-sm text-gray-500">{new Date(item.createdAt).toLocaleString()}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
