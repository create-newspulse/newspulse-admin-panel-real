"use client";

import { useEffect, useState } from "react";
import api from "../../lib/api";

// ✅ Define the expected structure of a news item
type NewsItem = {
  id: string;
  title: string;
  content: string;
  // Optionally extend with: imageUrl, date, author, etc.
};

export default function ManageNews() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<NewsItem[]>("/news")
      .then((res) => {
        setNews(res.data);
        setLoading(false);
      })
      .catch(() => {
        setError("❌ Failed to fetch news articles.");
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen p-6 bg-gray-100">
      <h1 className="text-3xl font-bold mb-6 text-blue-700 text-center">
        🗂️ Manage News Articles
      </h1>

      {loading && <p className="text-gray-600 text-center">Loading news...</p>}
      {error && <p className="text-red-500 text-center">{error}</p>}

      <div className="grid gap-4">
        {news.map((item) => (
          <div key={item.id} className="bg-white p-4 rounded shadow-md">
            <h2 className="text-xl font-semibold text-gray-800">{item.title}</h2>
            <p className="text-gray-600 mt-2">{item.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
