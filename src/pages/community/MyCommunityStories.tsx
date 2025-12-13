import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { listAdminCommunityStories, type AdminCommunityStory } from '@/lib/api/communityReporterStories';

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'withdrawn';

function formatDate(value?: string) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString();
}

const MyCommunityStoriesPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isReady, restoreSession } = useAuth();
  const inferredEmail = new URLSearchParams(location.search).get('email') || '';
  const [activeEmail] = useState<string>(inferredEmail);
  const [stories, setStories] = useState<AdminCommunityStory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  async function loadStories() {
    setIsLoading(true);
    setError(null);
    try {
      const fetched = await listAdminCommunityStories({
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: searchQuery || undefined,
        // email is optional; founder scope handled server-side
        email: undefined,
      });
      setStories(Array.isArray(fetched) ? fetched : []);
    } catch (err: any) {
      console.error('Failed to load community stories', err);
      setError('Failed to load community stories.');
      setStories([]);
    } finally {
      setIsLoading(false);
    }
  }

  // Initial load and when filters change (Apply/Refresh triggers explicitly too)
  useEffect(() => {
    // First load with status='all' and empty search
    void loadStories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      {/* Page header (keep your existing styles if you have components for this) */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          My Community Stories
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          View and manage stories you&apos;ve submitted to News Pulse.
        </p>
      </div>

      {/* Actions + Filters row */}
      <div className="flex flex-wrap items-center gap-4 justify-between">
        {/* Right-side actions */}
        <div className="ml-auto flex items-center gap-3">
          <button
            className="text-sm px-3 py-1.5 rounded-md border border-gray-300 bg-white hover:bg-gray-50"
            onClick={() => navigate('/community/submit')}
          >
            + New Story
          </button>
          <button
            className="text-sm px-3 py-1.5 rounded-md border border-gray-300 bg-white hover:bg-gray-50"
            onClick={() => loadStories()}
          >
            Refresh
          </button>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">
            Status
          </label>
          <select
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="withdrawn">Withdrawn</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">
            Search
          </label>
          <input
            className="w-64 rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Title contains..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            onClick={() => loadStories()}
          >Apply</button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Title
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Summary
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Language
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Category
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                City
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Created
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Last updated
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200">
            {isLoading && (
              <tr>
                <td
                  colSpan={9}
                  className="text-center py-8 text-slate-500"
                >
                  Loading community stories…
                </td>
              </tr>
            )}

            {!isLoading && error && (
              <tr>
                <td
                  colSpan={9}
                  className="text-center py-8 text-red-600"
                >
                  {error}
                </td>
              </tr>
            )}

            {!isLoading && !error && stories.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="text-center py-8 text-slate-500"
                >
                  No community stories found. Use the Reporter Portal or Submit Story page to send your first report.
                </td>
              </tr>
            )}

            {!isLoading && !error && stories.map((story) => (
                <tr key={story.id}>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {story.headline || (story as any).title || '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {story.summary || (story as any).aiSummary || '—'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {story.status}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {story.language || (story as any).lang || '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {story.category || (story as any).categorySlug || '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {story.city || (story as any).location?.city || '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatDate((story as any).createdAt || (story as any).created_at || (story as any).created)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatDate((story as any).updatedAt || (story as any).updated_at || (story as any).updated)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    <button
                      type="button"
                      className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                      onClick={() => navigate(`/admin/community-reporter/${encodeURIComponent(story.id)}`)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MyCommunityStoriesPage;


// Removed unused RowActions legacy block

