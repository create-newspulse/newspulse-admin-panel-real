import React from 'react';
import type { AdminCommunityStory } from '@/lib/api/communityReporterStories';
import StoryStatusPill, { mapStoryStatus } from '@/components/community/StoryStatusPill';

export type StoryDeskColumns = {
  district: boolean;
  state: boolean;
  views: boolean;
  reporterEmail: boolean;
  sourceId: boolean;
};

export type StoryDeskGroup = {
  key: string;
  label: string;
  items: AdminCommunityStory[];
};

export type StoryDeskRowActionType =
  | 'view'
  | 'edit'
  | 'openPublic'
  | 'openAdminArticle'
  | 'reporterProfile'
  | 'archive'
  | 'restore';

export type StoryDeskRowAction = {
  type: StoryDeskRowActionType;
  story: AdminCommunityStory;
};

function safeText(v: any): string {
  const s = String(v ?? '').trim();
  return s ? s : '—';
}

function fmtDateShort(value?: string) {
  const s = String(value || '').trim();
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function isArchivedLike(story: AdminCommunityStory): boolean {
  const st = String((story as any).status || '').toLowerCase();
  return (
    st.includes('withdrawn') ||
    st.includes('rejected') ||
    st.includes('removed') ||
    st.includes('archived') ||
    st.includes('deleted')
  );
}

export default function StoryDeskTable({
  groups,
  columns,
  canMutate,
  onAction,
}: {
  groups: StoryDeskGroup[];
  columns: StoryDeskColumns;
  canMutate: boolean;
  onAction: (action: StoryDeskRowAction) => void | Promise<void>;
}) {
  const optionalCount =
    Number(Boolean(columns.district)) +
    Number(Boolean(columns.state)) +
    Number(Boolean(columns.views)) +
    Number(Boolean(columns.reporterEmail)) +
    Number(Boolean(columns.sourceId));

  const colSpan = 10 + optionalCount; // core cols: Title, Reporter, Status, Published, Lang, Category, City, Created, Updated, Actions

  if (!groups || groups.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-600">
        No stories match your filters.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-600 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Title</th>
              <th className="px-4 py-3 text-left font-medium">Reporter Name</th>
              {columns.reporterEmail ? <th className="px-4 py-3 text-left font-medium">Reporter Email</th> : null}
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Published</th>
              <th className="px-4 py-3 text-left font-medium">Language</th>
              <th className="px-4 py-3 text-left font-medium">Category</th>
              <th className="px-4 py-3 text-left font-medium">City</th>
              {columns.district ? <th className="px-4 py-3 text-left font-medium">District</th> : null}
              {columns.state ? <th className="px-4 py-3 text-left font-medium">State</th> : null}
              {columns.views ? <th className="px-4 py-3 text-left font-medium">Views</th> : null}
              {columns.sourceId ? <th className="px-4 py-3 text-left font-medium">Source ID</th> : null}
              <th className="px-4 py-3 text-left font-medium">Created</th>
              <th className="px-4 py-3 text-left font-medium">Last Updated</th>
              <th className="px-4 py-3 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {groups.map((g) => (
              <React.Fragment key={g.key}>
                <tr className="bg-white">
                  <td colSpan={colSpan} className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                    <span className="font-medium text-slate-800">{g.label}</span>
                    <span className="ml-2">· {g.items.length}</span>
                  </td>
                </tr>
                {g.items.map((story) => {
                  const headline = safeText((story as any).headline);
                  const reporterName = safeText((story as any).reporterName);
                  const reporterEmail = safeText((story as any).reporterEmail);
                  const language = safeText((story as any).language).toUpperCase();
                  const category = safeText((story as any).category);
                  const city = safeText((story as any).city);
                  const district = safeText((story as any).district);
                  const state = safeText((story as any).state);
                  const published = Boolean((story as any).published);
                  const views = (story as any).views;
                  const sourceId = safeText((story as any).sourceId);

                  const hasPublic = Boolean(String((story as any).linkedArticleSlug || '').trim());
                  const hasAdminArticle = Boolean(String((story as any).linkedArticleId || '').trim());
                  const showRestore = isArchivedLike(story);

                  return (
                    <tr key={(story as any).id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 max-w-[420px]">
                        <div className="truncate font-medium text-slate-900" title={headline}>
                          {headline}
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-[220px]">
                        <div className="truncate" title={reporterName}>
                          {reporterName}
                        </div>
                      </td>
                      {columns.reporterEmail ? (
                        <td className="px-4 py-3 max-w-[260px]">
                          <div className="truncate" title={reporterEmail}>
                            {reporterEmail}
                          </div>
                        </td>
                      ) : null}
                      <td className="px-4 py-3">
                        <StoryStatusPill status={mapStoryStatus((story as any).status)} />
                      </td>
                      <td className="px-4 py-3">{published ? 'Yes' : 'No'}</td>
                      <td className="px-4 py-3">{language}</td>
                      <td className="px-4 py-3">{category}</td>
                      <td className="px-4 py-3">{city}</td>
                      {columns.district ? <td className="px-4 py-3">{district}</td> : null}
                      {columns.state ? <td className="px-4 py-3">{state}</td> : null}
                      {columns.views ? <td className="px-4 py-3">{typeof views === 'number' ? views : '—'}</td> : null}
                      {columns.sourceId ? <td className="px-4 py-3">{sourceId}</td> : null}
                      <td className="px-4 py-3 whitespace-nowrap">{fmtDateShort((story as any).createdAt)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{fmtDateShort((story as any).updatedAt)}</td>
                      <td className="px-4 py-3">
                        <details className="relative">
                          <summary className="cursor-pointer list-none rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 inline-flex items-center">
                            Actions
                          </summary>
                          <div className="absolute right-0 z-10 mt-2 w-52 rounded-md border border-slate-200 bg-white shadow-sm p-1 text-xs">
                            <button
                              type="button"
                              className="w-full text-left px-2 py-2 rounded hover:bg-slate-50"
                              onClick={() => void onAction({ type: 'view', story })}
                            >
                              View
                            </button>
                            <button
                              type="button"
                              className="w-full text-left px-2 py-2 rounded hover:bg-slate-50"
                              onClick={() => void onAction({ type: 'edit', story })}
                            >
                              Edit (new tab)
                            </button>
                            <button
                              type="button"
                              className={`w-full text-left px-2 py-2 rounded ${hasPublic ? 'hover:bg-slate-50' : 'text-slate-400 cursor-not-allowed'}`}
                              disabled={!hasPublic}
                              onClick={() => void onAction({ type: 'openPublic', story })}
                            >
                              Open public story
                            </button>
                            <button
                              type="button"
                              className={`w-full text-left px-2 py-2 rounded ${hasAdminArticle ? 'hover:bg-slate-50' : 'text-slate-400 cursor-not-allowed'}`}
                              disabled={!hasAdminArticle}
                              onClick={() => void onAction({ type: 'openAdminArticle', story })}
                            >
                              Open admin article
                            </button>
                            <button
                              type="button"
                              className="w-full text-left px-2 py-2 rounded hover:bg-slate-50"
                              onClick={() => void onAction({ type: 'reporterProfile', story })}
                            >
                              Reporter profile
                            </button>
                            <div className="my-1 border-t border-slate-200" />
                            {showRestore ? (
                              <button
                                type="button"
                                className={`w-full text-left px-2 py-2 rounded ${canMutate ? 'hover:bg-slate-50' : 'text-slate-400 cursor-not-allowed'}`}
                                disabled={!canMutate}
                                onClick={() => void onAction({ type: 'restore', story })}
                              >
                                Restore
                              </button>
                            ) : (
                              <button
                                type="button"
                                className={`w-full text-left px-2 py-2 rounded ${canMutate ? 'hover:bg-slate-50' : 'text-slate-400 cursor-not-allowed'}`}
                                disabled={!canMutate}
                                onClick={() => void onAction({ type: 'archive', story })}
                              >
                                Archive
                              </button>
                            )}
                          </div>
                        </details>
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
