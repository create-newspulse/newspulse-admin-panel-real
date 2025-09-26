// 📁 src/pages/NewsDetail.tsx

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { trackAnalytics } from '../lib/trackAnalytics';

interface Article {
  _id: string;
  title: string;
  content: string;
  // Add more fields as needed
}

export default function NewsDetail() {
  const { id } = useParams<{ id: string }>();
  const [article, setArticle] = useState<Article | null>(null);

  // ✅ Fetch article from API
  useEffect(() => {
    const fetchArticle = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/news/${id}`);
        const data = await res.json();
        if (data.success && data.data) {
          setArticle(data.data);
        }
      } catch (error) {
        console.error('❌ Failed to fetch article:', error);
      }
    };

    if (id) fetchArticle();
  }, [id]);

  // ✅ Track Analytics after article is loaded
  useEffect(() => {
    if (article?._id) {
      trackAnalytics(`/news/${article._id}`, article._id);
    }
  }, [article]);

  return (
    <div className="p-6">
      {article ? (
        <>
          <h1 className="text-2xl font-bold">{article.title}</h1>
          <p className="mt-4 text-gray-700">{article.content}</p>
        </>
      ) : (
        <p>Loading article...</p>
      )}
    </div>
  );
}
