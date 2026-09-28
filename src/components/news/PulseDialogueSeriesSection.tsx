import { useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Settings, X } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  createPulseDialogueSeries,
  getPulseDialogueContributor,
  getPulseDialogueSeries,
  listPulseDialogueContributors,
  listPulseDialogueSeries,
  updatePulseDialogueSeries,
} from '@/lib/api/pulseDialogue';
import { getContributorId, type PulseDialogueFormValue, type PulseDialogueSeries } from '@/lib/pulseDialogue';

type Props = {
  value: PulseDialogueFormValue;
  onChange: (value: PulseDialogueFormValue) => void;
  canManage: boolean;
};

export default function PulseDialogueSeriesSection({ value, onChange, canManage }: Props) {
  const queryClient = useQueryClient();
  const [managing, setManaging] = useState(false);
  const [form, setForm] = useState<PulseDialogueSeries | null>(null);
  const [ownerSearch, setOwnerSearch] = useState('');
  const [error, setError] = useState('');
  const [loadingSeries, setLoadingSeries] = useState(false);
  const seriesQuery = useInfiniteQuery({
    queryKey: ['pulse-dialogue', 'series'],
    queryFn: ({ pageParam }) => listPulseDialogueSeries({ page: pageParam, limit: 20 }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => pages.reduce((count, page) => count + page.items.length, 0) < lastPage.total && lastPage.items.length > 0 ? lastPage.page + 1 : undefined,
    enabled: Boolean(value.contributorId || managing),
    staleTime: 60 * 1000,
  });
  const series = Array.from(new Map((seriesQuery.data?.pages.flatMap((page) => page.items) || []).map((item) => [item.id, item])).values());
  const selected = series.find((item) => item.slug === value.seriesSlug && item.title === value.series);
  const hasAssignment = Boolean(value.series || value.seriesSlug);
  const ownersQuery = useQuery({
    queryKey: ['pulse-dialogue', 'contributors', ownerSearch.trim()],
    queryFn: () => listPulseDialogueContributors({ q: ownerSearch.trim(), limit: 20 }),
    enabled: Boolean(managing && form && ownerSearch.trim()),
    staleTime: 60 * 1000,
  });
  const ownerQuery = useQuery({
    queryKey: ['pulse-dialogue', 'contributors', form?.ownerContributorId || ''],
    queryFn: () => getPulseDialogueContributor(form!.ownerContributorId!),
    enabled: Boolean(managing && form?.ownerContributorId),
    staleTime: 60 * 1000,
  });
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form || !canManage || !form.title.trim()) throw new Error('Title is required');
      const payload = {
        title: form.title.trim(),
        description: form.description?.trim() || null,
        ownerContributorId: form.ownerContributorId || null,
        profileVisible: form.profileVisible ?? true,
      };
      return form.id
        ? updatePulseDialogueSeries(form.id, payload)
        : createPulseDialogueSeries({ ...payload, ...(form.slug.trim() ? { slug: form.slug.trim() } : {}) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pulse-dialogue', 'series'] });
      setForm(null);
      setError('');
      toast.success('Series saved');
    },
    onError: () => setError('Series could not be saved. Check the fields and try again.'),
  });

  async function editSeries(id: string) {
    setLoadingSeries(true);
    setError('');
    try {
      setForm(await getPulseDialogueSeries(id));
      setOwnerSearch('');
    } catch {
      setError('Series could not be loaded. Please try again.');
    } finally {
      setLoadingSeries(false);
    }
  }

  const listStatus = <>
    {seriesQuery.isLoading ? <p className="text-xs text-slate-500">Loading Series...</p> : null}
    {seriesQuery.isError ? <div role="alert" className="text-xs text-red-700">Series could not be loaded. <button type="button" className="underline" onClick={() => void seriesQuery.refetch()}>Retry Series</button></div> : null}
    {seriesQuery.hasNextPage ? <button type="button" className="btn-secondary px-2 py-1 text-xs" disabled={seriesQuery.isFetchingNextPage} onClick={() => void seriesQuery.fetchNextPage()}>{seriesQuery.isFetchingNextPage ? 'Loading...' : 'Load more Series'}</button> : null}
  </>;

  return <div className="space-y-2">
    {value.contributorId ? <>
      <label className="block text-xs font-medium" htmlFor="pulse-series">Series / Column - optional</label>
      <select id="pulse-series" value={selected?.id || (hasAssignment ? '__current' : '')} className="w-full border px-2 py-2 rounded bg-white" onChange={(event) => {
        const next = series.find((item) => item.id === event.target.value);
        if (next) onChange({ ...value, series: next.title, seriesSlug: next.slug });
        else if (!event.target.value) onChange({ ...value, series: null, seriesSlug: null });
      }}>
        <option value="">No Series</option>
        {hasAssignment && !selected ? <option value="__current">{value.series || value.seriesSlug} (current)</option> : null}
        {series.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
      </select>
      {listStatus}
    </> : null}
    {canManage ? <button type="button" className="btn-secondary inline-flex items-center gap-1 px-2 py-1 text-xs" onClick={() => { setManaging(true); setForm(null); setError(''); }}><Settings size={14} />Manage Series / Columns</button> : null}

    {managing && canManage ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Series / Column Management">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold">Series / Column Management</h2>
          <button type="button" aria-label="Close Series management" title="Close Series management" className="btn-secondary p-1" disabled={saveMutation.isPending || loadingSeries} onClick={() => setManaging(false)}><X size={18} /></button>
        </div>
        {error ? <p role="alert" className="mb-3 text-sm text-red-700">{error}</p> : null}
        {form ? <div className="space-y-3">
          <label className="block text-xs font-medium">Title *<input aria-label="Series Title" required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="w-full border px-2 py-2 rounded" /></label>
          <label className="block text-xs font-medium">Slug<input aria-label="Series Slug" readOnly={Boolean(form.id)} value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} className="w-full border px-2 py-2 rounded read-only:bg-slate-100" /></label>
          <label className="block text-xs font-medium">Description - optional<textarea aria-label="Series Description" value={form.description || ''} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} className="w-full border px-2 py-2 rounded" /></label>
          <div className="space-y-2">
            <label className="block text-xs font-medium">Owner Contributor - optional<input type="search" aria-label="Search owner contributors" value={ownerSearch} onChange={(event) => setOwnerSearch(event.target.value)} className="w-full border px-2 py-2 rounded" /></label>
            {form.ownerContributorId ? <div className="flex flex-wrap items-center gap-2 text-sm"><span>Owner: {ownerQuery.data?.canonicalName || form.ownerContributorId}</span><button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => setForm({ ...form, ownerContributorId: null })}>Clear Owner</button></div> : <p className="text-xs text-slate-500">No owner</p>}
            {ownerQuery.isError ? <p role="alert" className="text-xs text-red-700">Owner could not be loaded.</p> : null}
            {ownerSearch.trim() ? <div className="max-h-40 overflow-auto border border-slate-200">
              {ownersQuery.isLoading ? <p className="p-2 text-xs">Loading contributors...</p> : ownersQuery.isError ? <p role="alert" className="p-2 text-xs text-red-700">Contributor search failed.</p> : !ownersQuery.data?.items.length ? <p className="p-2 text-xs">No contributors found.</p> : ownersQuery.data.items.map((owner) => <button key={getContributorId(owner)} type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => { setForm({ ...form, ownerContributorId: getContributorId(owner) }); setOwnerSearch(''); }}>{owner.canonicalName}</button>)}
            </div> : null}
          </div>
          <label className="flex items-center gap-2 text-xs font-medium"><input type="checkbox" checked={form.profileVisible ?? true} onChange={(event) => setForm({ ...form, profileVisible: event.target.checked })} />Public Visibility</label>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary px-3 py-1 text-sm" disabled={saveMutation.isPending} onClick={() => { setForm(null); setError(''); }}>Cancel Series Edit</button>
            <button type="button" className="btn-primary px-3 py-1 text-sm" disabled={saveMutation.isPending || !form.title.trim()} onClick={() => saveMutation.mutate()}>{saveMutation.isPending ? 'Saving...' : 'Save Series'}</button>
          </div>
        </div> : <div className="space-y-3">
          <button type="button" className="btn-secondary inline-flex items-center gap-1 px-2 py-1 text-xs" disabled={loadingSeries} onClick={() => { setForm({ id: '', title: '', slug: '', description: '', ownerContributorId: null, profileVisible: true }); setOwnerSearch(''); setError(''); }}><Plus size={14} />New Series</button>
          {listStatus}
          {seriesQuery.isSuccess && !series.length ? <p className="text-sm text-slate-500">No Series found.</p> : null}
          <ul className="divide-y divide-slate-200">
            {series.map((item) => <li key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div className="min-w-0 break-words"><div className="font-medium">{item.title}</div><div className="break-all text-xs text-slate-500">{item.slug} | {item.profileVisible === false ? 'Not public' : 'Public'}</div></div>
              <button type="button" aria-label={`Edit Series ${item.title}`} title={`Edit Series ${item.title}`} className="btn-secondary shrink-0 p-2" disabled={loadingSeries} onClick={() => void editSeries(item.id)}><Pencil size={16} /></button>
            </li>)}
          </ul>
          {loadingSeries ? <p className="text-xs">Loading Series details...</p> : null}
        </div>}
      </div>
    </div> : null}
  </div>;
}