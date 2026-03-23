import React, { useEffect, useRef, useState } from 'react';
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
  | 'moveToDeleted'
  | 'restore'
  | 'deletePermanently';

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

function getDeletionCapabilities(
  story: AdminCommunityStory,
  baseCanMutate: boolean,
  baseCanHardDelete: boolean,
): {
  isDeleted: boolean;
  canSoftDelete: boolean;
  canRestore: boolean;
  canPermanentDelete: boolean;
} {
  const s: any = story as any;

  // Drive visibility from backend capability fields when present.
  // If the backend doesn't send these (older environments), fall back to conservative defaults.
  const isDeleted = typeof s.isDeleted === 'boolean' ? s.isDeleted : false;
  const canSoftDelete = typeof s.canSoftDelete === 'boolean' ? s.canSoftDelete : baseCanMutate && !isDeleted;
  const canRestore = typeof s.canRestore === 'boolean' ? s.canRestore : baseCanMutate && isDeleted;
  const canPermanentDelete = typeof s.canPermanentDelete === 'boolean' ? s.canPermanentDelete : baseCanHardDelete && isDeleted;

  return { isDeleted, canSoftDelete, canRestore, canPermanentDelete };
}

export default function StoryDeskTable({
  groups,
  columns,
  canMutate,
  canHardDelete,
  onAction,
}: {
  groups: StoryDeskGroup[];
  columns: StoryDeskColumns;
  canMutate: boolean;
  canHardDelete?: boolean;
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

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const openMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const openMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!openMenuId) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenuId(null);
    };

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;

      const btn = openMenuButtonRef.current;
      const menu = openMenuRef.current;
      if (btn && btn.contains(target)) return;
      if (menu && menu.contains(target)) return;
      setOpenMenuId(null);
    };

    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown, true);
    document.addEventListener('touchstart', onPointerDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown, true);
      document.removeEventListener('touchstart', onPointerDown, true);
    };
  }, [openMenuId]);

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
                  const storyId = String((story as any).id || '');
                  const isMenuOpen = !!openMenuId && openMenuId === storyId;
                  const allowHardDelete = typeof canHardDelete === 'boolean' ? canHardDelete : canMutate;
                  const deletion = getDeletionCapabilities(story, canMutate, allowHardDelete);

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
                        <div className="relative">
                          <button
                            type="button"
                            ref={(el) => {
                              if (isMenuOpen) openMenuButtonRef.current = el;
                            }}
                            className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 inline-flex items-center"
                            aria-haspopup="menu"
                            aria-expanded={isMenuOpen}
                            onClick={() => {
                              if (!storyId) return;
                              setOpenMenuId((prev) => (prev === storyId ? null : storyId));
                            }}
                          >
                            Actions
                          </button>

                          {isMenuOpen ? (
                            <div
                              ref={(el) => {
                                openMenuRef.current = el;
                              }}
                              role="menu"
                              className="absolute right-0 z-10 mt-2 w-52 rounded-md border border-slate-200 bg-white shadow-sm p-1 text-xs"
                            >
                              <button
                                type="button"
                                role="menuitem"
                                className="w-full text-left px-2 py-2 rounded hover:bg-slate-50"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  void onAction({ type: 'view', story });
                                }}
                              >
                                View
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                className="w-full text-left px-2 py-2 rounded hover:bg-slate-50"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  void onAction({ type: 'edit', story });
                                }}
                              >
                                Edit (new tab)
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                className={`w-full text-left px-2 py-2 rounded ${hasPublic ? 'hover:bg-slate-50' : 'text-slate-400 cursor-not-allowed'}`}
                                disabled={!hasPublic}
                                onClick={() => {
                                  setOpenMenuId(null);
                                  void onAction({ type: 'openPublic', story });
                                }}
                              >
                                Open public story
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                className={`w-full text-left px-2 py-2 rounded ${hasAdminArticle ? 'hover:bg-slate-50' : 'text-slate-400 cursor-not-allowed'}`}
                                disabled={!hasAdminArticle}
                                onClick={() => {
                                  setOpenMenuId(null);
                                  void onAction({ type: 'openAdminArticle', story });
                                }}
                              >
                                Open admin article
                              </button>

                              <div className="my-1 border-t border-slate-200" />

                              {!deletion.isDeleted ? (
                                <button
                                  type="button"
                                  role="menuitem"
                                  className={`w-full text-left px-2 py-2 rounded ${deletion.canSoftDelete ? 'hover:bg-slate-50' : 'text-slate-400 cursor-not-allowed'}`}
                                  disabled={!deletion.canSoftDelete}
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    void onAction({ type: 'moveToDeleted', story });
                                  }}
                                >
                                  Move to Deleted
                                </button>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    role="menuitem"
                                    className={`w-full text-left px-2 py-2 rounded ${deletion.canRestore ? 'hover:bg-slate-50' : 'text-slate-400 cursor-not-allowed'}`}
                                    disabled={!deletion.canRestore}
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      void onAction({ type: 'restore', story });
                                    }}
                                  >
                                    Restore
                                  </button>
                                  <button
                                    type="button"
                                    role="menuitem"
                                    className={`w-full text-left px-2 py-2 rounded ${deletion.canPermanentDelete ? 'text-red-700 hover:bg-red-50' : 'text-slate-400 cursor-not-allowed'}`}
                                    disabled={!deletion.canPermanentDelete}
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      void onAction({ type: 'deletePermanently', story });
                                    }}
                                  >
                                    Delete Permanently
                                  </button>
                                </>
                              )}
                            </div>
                          ) : null}
                        </div>
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
