import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArticleForm } from '@/components/news/ArticleForm';

// Direct Add Article page using the advanced ArticleForm (replaces old redirect shim)
const AddNews: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [dirty, setDirty] = useState(false);
  const resumeId = searchParams.get('id');
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">📝 Add Article</h1>
        <button
          type="button"
          onClick={() => {
            if (dirty) {
              const ok = window.confirm('You have unsaved changes. Leave this page?');
              if (!ok) return;
            }
            navigate('/admin/news');
          }}
          className="text-sm px-3 py-2 rounded border bg-white hover:bg-slate-50"
        >Back to News</button>
      </div>
      <ArticleForm
        mode="create"
        id={resumeId}
        userRole="admin"
        onDirtyChange={setDirty}
      />
    </div>
  );
};

export default AddNews;