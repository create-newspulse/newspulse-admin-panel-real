import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArticleForm } from '@/components/news/ArticleForm';

// Direct Add Article page using the advanced ArticleForm (replaces old redirect shim)
const AddNews: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [dirty, setDirty] = useState(false);
  const resumeId = searchParams.get('id');
  const sponsoredMode = searchParams.get('sponsored') === '1';
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
      {sponsoredMode ? (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <div className="font-semibold">Sponsored Article</div>
          <div className="mt-1">Use the Sponsored Article section in Publishing Settings to add sponsor details without affecting the normal editorial workflow.</div>
        </div>
      ) : null}
      <ArticleForm
        mode="create"
        id={resumeId}
        userRole="admin"
        onDirtyChange={setDirty}
        defaultSponsored={sponsoredMode}
      />
    </div>
  );
};

export default AddNews;