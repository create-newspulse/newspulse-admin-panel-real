import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getArticle } from '@/lib/api/articles';
import { ArticleForm } from '@/components/news/ArticleForm';

export default function ArticleEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [dirty, setDirty] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ['articles','one', id],
    queryFn: () => id ? getArticle(id) : Promise.resolve(null),
    enabled: !!id,
  });

  if (!id) return <div className="p-6 text-red-600">Invalid article id.</div>;
  if (isLoading) return <div className="p-6">Loading article…</div>;
  if (error) return <div className="p-6 text-red-600">Failed to load article.</div>;
  if (!data) return <div className="p-6 text-red-600">Article not found.</div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">✏️ Edit Article</h1>
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
        mode="edit"
        id={id}
        initialValues={data}
        userRole="admin"
        onDirtyChange={setDirty}
      />
    </div>
  );
}
