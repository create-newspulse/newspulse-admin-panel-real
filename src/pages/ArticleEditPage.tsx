import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getArticle } from '@/lib/api/articles';
import { ArticleForm } from '@/components/news/ArticleForm';
import { ArticleAnalyticsPanel } from '@/components/analytics/ArticleAnalyticsPanel';
import { normalizeArticleError } from '@/lib/articleLifecycle';

export default function ArticleEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [dirty, setDirty] = useState(false);
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['articles','one', id],
    queryFn: () => id ? getArticle(id) : Promise.resolve(null),
    enabled: !!id,
    retry: false,
  });

  if (!id) return <div className="p-6 text-red-600">Invalid article id.</div>;
  if (isLoading) return <div className="p-6">Loading article…</div>;
  const loadError = error ? (
    <div role="alert" className="mb-4 rounded border border-red-200 p-4 text-red-700">
      <div>{normalizeArticleError(error, 'Failed to load article').message}</div>
      {data && <div className="mt-1 text-sm">The last loaded article and your unsaved edits are still available.</div>}
      <button type="button" className="mt-2 underline" disabled={isFetching} onClick={() => void refetch()}>
        Retry loading article
      </button>
    </div>
  ) : null;
  if (error && !data) return loadError;
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
            navigate('/admin/articles');
          }}
          className="text-sm px-3 py-2 rounded border bg-white hover:bg-slate-50"
        >Back to News</button>
      </div>

        <div className="mb-6">
          <ArticleAnalyticsPanel articleId={id} />
        </div>

      {loadError}
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
