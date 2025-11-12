import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArticleForm } from '@/components/news/ArticleForm';

// Direct Add Article page using the advanced ArticleForm (replaces old redirect shim)
const AddNews: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">📝 Add Article</h1>
        <button
          type="button"
          onClick={() => navigate('/admin/news')}
          className="text-sm px-3 py-2 rounded border bg-white hover:bg-slate-50"
        >Back to News</button>
      </div>
      <ArticleForm
        mode="create"
        userRole="admin"
        onDone={() => navigate('/admin/news')}
      />
    </div>
  );
};

export default AddNews;