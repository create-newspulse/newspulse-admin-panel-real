import React, { useEffect, useState } from 'react';

type NewsType = {
  _id: string;
  title: string;
  content: string;
  category: string;
  language: string;
};

const AllNews = () => {
  const [newsList, setNewsList] = useState<NewsType[]>([]);

  useEffect(() => {
    fetch('http://localhost:5000/api/all-news')
      .then(res => res.json())
      .then(data => setNewsList(data))
      .catch(err => console.error("Error loading news:", err));
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">📰 All Submitted News</h2>
      {newsList.map(news => (
        <div key={news._id} className="border p-4 my-2 bg-white shadow rounded">
          <h3 className="text-xl font-semibold">{news.title}</h3>
          <p>{news.content}</p>
          <div className="text-sm text-gray-600">
            {news.category} | {news.language}
          </div>
        </div>
      ))}
    </div>
  );
};

export default AllNews;
