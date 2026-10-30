import React from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ArticleForm } from '@/components/news/ArticleForm';
import { useEditorialAccess } from '@/hooks/useEditorialAccess';
import AdminModuleRoute from '@/components/AdminModuleRoute';
import Denied from '@/pages/Denied';

// Direct Add Article page using the advanced ArticleForm (replaces old redirect shim)
const AddNewsEditor: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const access = useEditorialAccess();
  const resumeId = searchParams.get('id');
  const sponsoredMode = searchParams.get('sponsored') === '1';
  if (access.loading) return <div>Checking article access...</div>;
  if (resumeId && !access.canManageNews) {
    return access.canReadOwnDrafts
      ? <Navigate to={`/draft-desk/${encodeURIComponent(resumeId)}?mode=edit`} replace />
      : <div role="alert">{access.reason}</div>;
  }
  if (!resumeId && !access.canCreateNews) {
    return <Denied message="Create News requires effective Add News, Draft Desk, or Manage News with Edit news permission." />;
  }
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">📝 Add Article</h1>
        <button
          type="button"
          onClick={() => navigate(access.canManageNews ? '/admin/news' : '/draft-desk')}
          className="text-sm px-3 py-2 rounded border bg-white hover:bg-slate-50"
        >Back to News</button>
      </div>
      {sponsoredMode ? (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <div className="font-semibold">Sponsored Article</div>
          <div className="mt-1">Use the Mark as Sponsored Article control in Publishing Settings to add sponsor details without affecting the normal editorial workflow.</div>
        </div>
      ) : null}
      <ArticleForm
        mode="create"
        id={resumeId}
        userRole="admin"
        defaultSponsored={sponsoredMode}
      />
    </div>
  );
};

const AddNews: React.FC = () => (
  <AdminModuleRoute moduleKey={['add_news', 'draft_desk', 'manage_news']}>
    <AddNewsEditor />
  </AdminModuleRoute>
);

export default AddNews;