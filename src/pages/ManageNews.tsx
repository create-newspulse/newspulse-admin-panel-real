// newspulse-admin-panel-real-main/src/pages/ManageNews.tsx

import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArticleFilters } from '@/components/news/ArticleFilters';
import { FiltersDrawer } from '@/components/news/FiltersDrawer';
import { NewsTable } from '@/components/news/NewsTable';
import { QuickViewsBar, type QuickViewCounts, type QuickViewKey } from '@/components/news/QuickViewsBar';
import { UploadCsvDialog } from '@/components/news/UploadCsvDialog';
import apiClient from '@/lib/api';
import { debug } from '@/lib/debug';
import { guardAction, type ArticleWorkflowAction } from '@/lib/articleWorkflowGuard';
import toast from 'react-hot-toast';
import type { ArticleStatus } from '@/types/articles';
import type { ManageNewsParams } from '@/types/api';
import { usePublishFlag } from '@/context/PublishFlagContext';
import { useAuth } from '@/context/AuthContext';
import { useDebounce } from '@/hooks/useDebounce';
import { ARTICLE_CATEGORY_LABELS, isAllowedArticleCategoryKey } from '@/lib/articleCategories';

// Status tabs metadata
const STATUS_TABS: { value: 'all' | ArticleStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
  { value: 'deleted', label: 'Deleted' },
];

export default function ManageNews() {
  const navigate = useNavigate();
  const location = useLocation();

  const quickViewsStickyRef = React.useRef<HTMLDivElement | null>(null);
  const [tableHeaderTop, setTableHeaderTop] = React.useState(0);

  React.useLayoutEffect(() => {
    const el = quickViewsStickyRef.current;
    if (!el) return;

    const update = () => {
      const h = el.getBoundingClientRect().height;
      setTableHeaderTop((prev) => (Math.abs(prev - h) < 0.5 ? prev : h));
    };

    update();
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      ro.disconnect();
    };
  }, []);

  // status param uses explicit 'all' | ArticleStatus for UI sync
  const [params, setParams] = React.useState<ManageNewsParams>({
    page: 1,
    limit: 20,
    // Backend may or may not honor this; table also enforces client-side sorting.
    sort: '-updatedAt',
    status: 'all',
  });

  const [showCsv, setShowCsv] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [searchInput, setSearchInput] = React.useState('');
  const debouncedSearch = useDebounce(searchInput, 300);

  const parseQuickViewFromSearch = React.useCallback((search: string): QuickViewKey | null => {
    try {
      const sp = new URLSearchParams(search);
      const raw = (sp.get('qv') || '').trim().toLowerCase();
      if (!raw) return null;
      const allowed: QuickViewKey[] = [
        'all',
        'published',
        'draft',
        'scheduled',
        'breaking',
        'gujarat-breaking',
        'regional',
        'pti',
        'flagged',
      ];
      return allowed.includes(raw as QuickViewKey) ? (raw as QuickViewKey) : null;
    } catch {
      return null;
    }
  }, []);

  const [quickView, setQuickView] = React.useState<QuickViewKey>(() => {
    const fromUrl = parseQuickViewFromSearch(location.search);
    if (fromUrl) return fromUrl;
    try {
      if (typeof window === 'undefined') return 'all';
      const raw = localStorage.getItem('np_admin_articles_quick_view');
      if (!raw) return 'all';
      const allowed: QuickViewKey[] = [
        'all',
        'published',
        'draft',
        'scheduled',
        'breaking',
        'gujarat-breaking',
        'regional',
        'pti',
        'flagged',
      ];
      return allowed.includes(raw as QuickViewKey) ? (raw as QuickViewKey) : 'all';
    } catch {
      return 'all';
    }
  });

  const [quickCounts, setQuickCounts] = React.useState<QuickViewCounts>({
    all: 0,
    published: 0,
    draft: 0,
    scheduled: 0,
    breaking: 0,
    'gujarat-breaking': 0,
    regional: 0,
    pti: 0,
    flagged: 0,
  });
  const { publishEnabled, override, setOverride, envDefault } = usePublishFlag();
  const { isFounder } = useAuth();

  const clearAll = React.useCallback(() => {
    setQuickView('all');
    setSearchInput('');
    setParams({ page: 1, limit: 20, sort: '-updatedAt', status: 'all' });
  }, []);

  const handleQuickViewChange = React.useCallback((v: QuickViewKey) => {
    setQuickView(v);
    setParams((p) => ({ ...p, page: 1 }));
  }, []);

  React.useEffect(() => {
    try {
      localStorage.setItem('np_admin_articles_quick_view', quickView);
    } catch {}
  }, [quickView]);

  React.useEffect(() => {
    // Keep quick view synced to URL (?qv=breaking etc) so refresh keeps the view.
    // Preserve other query params (e.g. highlight, status).
    try {
      const sp = new URLSearchParams(location.search);
      if (quickView === 'all') sp.delete('qv');
      else sp.set('qv', quickView);

      const next = sp.toString();
      const nextSearch = next ? `?${next}` : '';
      if (nextSearch === location.search) return;
      navigate({ pathname: location.pathname, search: nextSearch }, { replace: true });
    } catch {}
  }, [quickView, location.pathname, location.search, navigate]);

  React.useEffect(() => {
    // Support back/forward navigation updating selected quick view.
    const fromUrl = parseQuickViewFromSearch(location.search);
    if (!fromUrl) return;
    setQuickView((cur) => (cur === fromUrl ? cur : fromUrl));
  }, [location.search, parseQuickViewFromSearch]);

  const highlightId = React.useMemo(() => {
    try {
      const sp = new URLSearchParams(location.search);
      return sp.get('highlight');
    } catch {
      return null;
    }
  }, [location.search]);

  const didInitFromUrl = React.useRef(false);
  React.useEffect(() => {
    // Initialize from URL once; don't keep overwriting local changes when other
    // query params (like qv) update.
    if (didInitFromUrl.current) return;
    didInitFromUrl.current = true;
    try {
      const sp = new URLSearchParams(location.search);
      const statusFromUrl = sp.get('status');
      if (statusFromUrl && STATUS_TABS.some(t => t.value === statusFromUrl)) {
        setParams(p => ({
          ...p,
          status: statusFromUrl as any,
          page: 1,
        }));
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Workflow transition (mirrors legacy doTransition)
  const doTransition = async (id: string, action: ArticleWorkflowAction) => {
    try {
      const g = guardAction(action, publishEnabled, { isFounder });
      if (!g.allowed) {
        debug('[ManageNews] blocked transition', { id, action, publishEnabled });
        toast.error(g.reason || 'Action blocked');
        return;
      }

      await apiClient.post(`/news/${id}/transition`, { action });
      toast.success(`${action} done`);

      // Trigger a soft refresh by nudging params (keeps pagination)
      setParams(p => ({ ...p }));
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || err?.message || 'Transition failed',
      );
    }
  };

  return (
    <div className="space-y-4">
      <div className="max-w-6xl mx-auto px-4 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Manage News Articles</h1>
          <div className="flex flex-wrap gap-2 items-center">
            <button
              onClick={() => setShowCsv(true)}
              className="px-3 py-1 bg-indigo-600 text-white rounded"
            >
              CSV Upload
            </button>
            <button
              onClick={() => navigate('/add')}
              className="px-3 py-1 bg-green-600 text-white rounded"
            >
              Add New
            </button>
            <button
              onClick={() => setParams(p => ({ ...p }))}
              className="px-3 py-1 bg-slate-700 text-white rounded"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4">
        <div className="overflow-x-auto">
          <div className="inline-flex items-center gap-2">
            {STATUS_TABS.map((t) => {
              const active = (params.status ?? 'all') === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setParams((p) => ({ ...p, status: t.value as any, page: 1 }))}
                  className={
                    'px-4 py-2 rounded-md border text-sm whitespace-nowrap '
                    + (active
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50')
                  }
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div ref={quickViewsStickyRef}>
        <QuickViewsBar
          value={quickView}
          counts={quickCounts}
          onChange={handleQuickViewChange}
          onOpenFilters={() => setFiltersOpen(true)}
        />
      </div>

      <div className="max-w-6xl mx-auto px-4">
        <div className="rounded border bg-white p-3">
          <label className="text-xs font-semibold">Search</label>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search title, summary, content, tags…"
            className="mt-1 w-full border rounded px-3 py-2"
          />
          <div className="mt-1 text-[11px] text-slate-500">Search applies instantly (client-side).</div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4">
        {(() => {
          const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];

          const QUICK_VIEW_LABELS: Record<QuickViewKey, string> = {
            all: 'All',
            published: 'Published',
            draft: 'Draft',
            scheduled: 'Scheduled',
            breaking: 'Breaking',
            'gujarat-breaking': 'Gujarat Breaking',
            regional: 'Regional (Gujarat)',
            pti: 'PTI Needs Review',
            flagged: 'Flagged',
          };

          if (quickView !== 'all') {
            chips.push({
              key: `qv:${quickView}`,
              label: `Quick View: ${QUICK_VIEW_LABELS[quickView]}`,
              onRemove: () => setQuickView('all'),
            });
          }

          if (searchInput.trim()) {
            chips.push({ key: 'search', label: `Search: ${searchInput.trim()}`, onRemove: () => setSearchInput('') });
          }

          if ((params.status ?? 'all') !== 'all') {
            chips.push({
              key: `status:${params.status}`,
              label: `Status: ${params.status}`,
              onRemove: () => setParams((p) => ({ ...p, status: 'all', page: 1 })),
            });
          }

          if (params.language) {
            chips.push({
              key: `lang:${params.language}`,
              label: `Language: ${String(params.language).toUpperCase()}`,
              onRemove: () => setParams((p) => ({ ...p, language: undefined, page: 1 })),
            });
          }

          const cats = String(params.category || '').split(',').map((c) => c.trim()).filter(Boolean);
          cats.forEach((c) => {
            const label = isAllowedArticleCategoryKey(c) ? ARTICLE_CATEGORY_LABELS[c] : c;
            chips.push({
              key: `cat:${c}`,
              label: `Category: ${label}`,
              onRemove: () => {
                setParams((p) => {
                  const selected = String(p.category || '').split(',').map((x) => x.trim()).filter(Boolean);
                  const next = selected.filter((x) => x !== c);
                  return { ...p, category: next.length ? next.join(',') : undefined, page: 1 };
                });
              },
            });
          });

          if (params.from || params.to) {
            const label = `Date: ${(params.from || '…')} → ${(params.to || '…')}`;
            chips.push({
              key: 'date',
              label,
              onRemove: () => setParams((p) => ({ ...p, from: undefined, to: undefined, page: 1 })),
            });
          }

          return (
            <div className="rounded border bg-white px-3 py-2 flex flex-wrap items-center gap-2">
              <div className="text-xs font-semibold text-slate-700">Active Filters</div>
              <div className="flex-1 flex flex-wrap gap-2">
                {chips.length === 0 ? (
                  <div className="text-xs text-slate-500">None</div>
                ) : (
                  chips.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={c.onRemove}
                      className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border bg-slate-50 text-xs text-slate-700 hover:bg-slate-100"
                      title="Remove filter"
                    >
                      <span className="truncate max-w-[240px]">{c.label}</span>
                      <span className="text-slate-500">×</span>
                    </button>
                  ))
                )}
              </div>

              <button
                type="button"
                onClick={clearAll}
                className="px-3 py-1.5 rounded border text-xs bg-white hover:bg-slate-50"
              >
                Clear all
              </button>
            </div>
          );
        })()}
      </div>

      <div className="max-w-6xl mx-auto px-4">
        <NewsTable
          params={params}
          search={debouncedSearch}
          quickView={quickView}
          onCounts={setQuickCounts}
          onSelectIds={setSelectedIds}
          onPageChange={(p) => setParams(prev => ({ ...prev, page: Math.max(1, p) }))}
          highlightId={highlightId || undefined}
          stickyTopOffsetPx={tableHeaderTop}
        />
      </div>

      <FiltersDrawer open={filtersOpen} onClose={() => setFiltersOpen(false)}>
        <div className="space-y-3">
          <div className="text-xs text-slate-600">Categories and language apply instantly. Date range applies only when you click “Apply date range”. Status uses the tabs above.</div>
          <ArticleFilters
            params={params}
            onChange={(p) => {
              setParams(p);
            }}
            hideSearch
            hideStatus
          />
        </div>
      </FiltersDrawer>

      {/* Bulk actions */}
      {selectedIds.length > 0 && (
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-wrap items-center gap-3 bg-slate-50 dark:bg-slate-800 p-3 rounded border text-xs">
            <span className="font-medium">Selected: {selectedIds.length}</span>
            <span className="mx-2 text-slate-400">|</span>

          <button
            onClick={() => {
              if (
                confirm(`Send ${selectedIds.length} article(s) to Review?`)
              ) {
                selectedIds.forEach(id => void doTransition(id, 'toReview'));
              }
            }}
            className="px-2 py-1 rounded border"
          >
            To Review
          </button>

          <button
            onClick={() => {
              if (confirm(`Send ${selectedIds.length} article(s) to Legal?`)) {
                selectedIds.forEach(id => void doTransition(id, 'toLegal'));
              }
            }}
            className="px-2 py-1 rounded border"
          >
            To Legal
          </button>

          <button
            onClick={() => {
              if (confirm(`Approve ${selectedIds.length} article(s)?`)) {
                selectedIds.forEach(id => void doTransition(id, 'approve'));
              }
            }}
            className="px-2 py-1 rounded border"
          >
            Approve
          </button>

          {publishEnabled ? (
            <button
              onClick={() => {
                if (confirm(`Publish ${selectedIds.length} article(s)?`)) {
                  selectedIds.forEach(id => void doTransition(id, 'publish'));
                }
              }}
              className="px-2 py-1 rounded border text-white bg-red-600"
            >
              Publish
            </button>
          ) : (
            <span
              className="px-2 py-1 rounded border bg-slate-200 text-slate-500"
              title="Publishing temporarily disabled"
            >
              Publish (disabled)
            </span>
          )}
          </div>
        </div>
      )}

      {/* Founder-only publish toggle */}
      {isFounder && (
        <div className="max-w-6xl mx-auto px-4">
          <div className="mt-4 p-3 rounded border bg-slate-50 text-xs flex flex-wrap items-center gap-3">
            <span className="font-medium">Publish Runtime Toggle</span>
            <span>Env Default: {envDefault ? 'ON' : 'OFF'}</span>
            <span>
              Override:{' '}
              {override === null ? '—' : override ? 'ON' : 'OFF'}
            </span>
            <span>Effective: {publishEnabled ? 'ON' : 'OFF'}</span>

          <button
            type="button"
            onClick={() =>
              setOverride(override === null ? !envDefault : !override)
            }
            className="px-2 py-1 rounded border bg-white hover:bg-slate-100"
          >
            Toggle
          </button>

          {override !== null && (
            <button
              type="button"
              onClick={() => setOverride(null)}
              className="px-2 py-1 rounded border bg-white hover:bg-slate-100"
            >
              Clear Override
            </button>
          )}
          </div>
        </div>
      )}

      {/* CSV upload modal */}
      {showCsv && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <UploadCsvDialog onDone={() => setShowCsv(false)} />
        </div>
      )}
    </div>
  );
}
