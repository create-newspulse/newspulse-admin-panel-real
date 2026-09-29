import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Plus, Save, Trash2, X } from 'lucide-react';
import { listArticles } from '@/lib/api/articles';
import { listPulseDialogueContributors } from '@/lib/api/pulseDialogue';
import {
  CURATION_LIMIT,
  getPulseDialogueCuration,
  saveFeaturedDialogue,
  saveFeaturedVoices,
  type FeaturedDialogue,
  type FeaturedVoice,
  type PulseDialogueCuration,
} from '@/lib/api/pulseDialogueCuration';
import { dialogueFormatLabel, getContributorId, PULSE_DIALOGUE_CATEGORY } from '@/lib/pulseDialogue';
import { normalizeError } from '@/lib/error';
import Denied from '@/pages/Denied';

const buttonClass = 'inline-flex items-center justify-center gap-2 rounded border px-3 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed';
const iconClass = 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded border disabled:opacity-50 disabled:cursor-not-allowed';
type Candidate<T> = { item: T; label: string };
type CandidatePage<T> = { candidates: Candidate<T>[]; pages: number };

async function loadArticles(page: number): Promise<CandidatePage<FeaturedDialogue>> {
  const response = await listArticles({ category: PULSE_DIALOGUE_CATEGORY, status: 'all', page, limit: 20 });
  return {
    pages: response.pages,
    candidates: response.rows.filter((article) => article.category === PULSE_DIALOGUE_CATEGORY && /^[a-f\d]{24}$/i.test(article._id)).map((article) => ({
      item: { id: article._id, title: article.title, slug: article.slug ?? null, status: article.status ?? null, missing: false },
      label: [article.title, article.status || 'Unknown status', article.publishedAt, article.pulseDialogue?.bylineSnapshot?.name, dialogueFormatLabel(article.pulseDialogue?.dialogueFormat), article._id].filter(Boolean).join(' | '),
    })),
  };
}

async function loadVoices(page: number): Promise<CandidatePage<FeaturedVoice>> {
  const response = await listPulseDialogueContributors({ page, limit: 20 });
  return {
    pages: Math.max(1, Math.ceil(response.total / response.limit)),
    candidates: response.items.filter((contributor) => /^[a-f\d]{24}$/i.test(getContributorId(contributor))).map((contributor) => ({
      item: {
        id: getContributorId(contributor),
        name: contributor.canonicalName || contributor.publicContributor?.name || null,
        slug: contributor.slug ?? null,
        publicDesignation: contributor.publicDesignation ?? null,
        status: contributor.status ?? null,
        profileVisible: contributor.profileVisible === true,
        missing: false,
      },
      label: [contributor.canonicalName || contributor.publicContributor?.name || getContributorId(contributor), contributor.publicDesignation, contributor.status, contributor.profileVisible === true ? 'Public profile' : 'Profile not public', getContributorId(contributor)].filter(Boolean).join(' | '),
    })),
  };
}

function OrderedSelection<T extends { id: string }>({
  title, noun, initialItems, loadCandidates, save, describe, denied, onDenied,
}: {
  title: string;
  noun: string;
  initialItems: T[];
  loadCandidates: (page: number) => Promise<CandidatePage<T>>;
  save: (ids: string[]) => Promise<T[]>;
  describe: (item: T) => { name: string; detail?: string | null; unavailable: boolean };
  denied: boolean;
  onDenied: () => void;
}) {
  const [items, setItems] = useState(initialItems);
  const [savedIds, setSavedIds] = useState(initialItems.map((item) => item.id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [candidates, setCandidates] = useState<CandidatePage<T>>({ candidates: [], pages: 1 });
  const [candidateId, setCandidateId] = useState('');
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [candidateError, setCandidateError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const disabled = denied || saving;
  const dirty = JSON.stringify(items.map((item) => item.id)) !== JSON.stringify(savedIds);

  useEffect(() => {
    if (!pickerOpen || denied) return;
    let cancelled = false;
    setLoadingCandidates(true);
    setCandidateError('');
    setCandidateId('');
    loadCandidates(page).then((result) => {
      if (!cancelled) setCandidates(result);
    }).catch((failure) => {
      if (cancelled) return;
      const normalized = normalizeError(failure, 'Candidates could not be loaded.');
      setCandidateError(normalized.message);
      if (normalized.status === 403) onDenied();
    }).finally(() => {
      if (!cancelled) setLoadingCandidates(false);
    });
    return () => { cancelled = true; };
  }, [pickerOpen, page, attempt, denied, loadCandidates, onDenied]);

  function change(next: T[]) {
    if (disabled) return;
    setItems(next);
    setSuccess(false);
    setError('');
  }

  function move(index: number, offset: number) {
    const target = index + offset;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    change(next);
  }

  function add() {
    const candidate = candidates.candidates.find(({ item }) => item.id === candidateId);
    if (!candidate || items.length >= CURATION_LIMIT || items.some((item) => item.id === candidateId)) return;
    change([...items, candidate.item]);
    setCandidateId('');
  }

  async function persist() {
    if (disabled || items.length > CURATION_LIMIT) return;
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      const saved = await save(items.map((item) => item.id));
      setItems(saved);
      setSavedIds(saved.map((item) => item.id));
      setSuccess(true);
    } catch (failure) {
      const normalized = normalizeError(failure, `${title} could not be saved.`);
      setError(normalized.message);
      if (normalized.status === 403) onDenied();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-label={title} className="min-w-0 space-y-3 border-t py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">{title} <span className="text-sm font-normal">({items.length}/{CURATION_LIMIT})</span></h3>
        <button type="button" className={buttonClass} disabled={disabled || items.length >= CURATION_LIMIT} onClick={() => setPickerOpen(true)}><Plus size={16} aria-hidden="true" />Add {noun}</button>
      </div>
      <ol aria-label={`Selected ${title}`} className="space-y-2">
        {items.map((item, index) => {
          const display = describe(item);
          return (
            <li key={item.id} className="flex flex-wrap items-center gap-3 border-b py-3">
              <span className="w-5 shrink-0 text-sm">{index + 1}.</span>
              <div className="min-w-0 flex-1 break-words">
                <div className="font-medium">{display.name}</div>
                {display.detail && <div className="text-sm text-slate-500 dark:text-slate-400">{display.detail}</div>}
                <div className="break-all text-xs text-slate-500 dark:text-slate-400">{item.id}</div>
                {display.unavailable && <div className="text-sm text-slate-500 dark:text-slate-400">Unavailable publicly</div>}
              </div>
              <div className="flex shrink-0 gap-1">
                <button type="button" className={iconClass} title="Move Up" aria-label={`Move Up ${display.name}`} disabled={disabled || index === 0} onClick={() => move(index, -1)}><ArrowUp size={16} aria-hidden="true" /></button>
                <button type="button" className={iconClass} title="Move Down" aria-label={`Move Down ${display.name}`} disabled={disabled || index === items.length - 1} onClick={() => move(index, 1)}><ArrowDown size={16} aria-hidden="true" /></button>
                <button type="button" className={iconClass} title="Remove" aria-label={`Remove ${display.name}`} disabled={disabled} onClick={() => change(items.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={16} aria-hidden="true" /></button>
              </div>
            </li>
          );
        })}
      </ol>
      {items.length === 0 && <p className="text-sm text-slate-500">No selection</p>}
      {pickerOpen && (
        <div className="space-y-3 border-y py-3" aria-label={`${noun} candidates`}>
          <div className="flex items-center justify-between gap-2">
            <label htmlFor={`curation-${noun}`} className="font-medium">Choose {noun}</label>
            <button type="button" className={iconClass} aria-label={`Close ${noun} candidates`} title="Close" onClick={() => setPickerOpen(false)}><X size={16} aria-hidden="true" /></button>
          </div>
          {loadingCandidates && <p role="status">Loading candidates...</p>}
          {candidateError && <div role="alert">{candidateError} <button type="button" className={buttonClass} disabled={disabled} onClick={() => setAttempt((value) => value + 1)}>Retry candidates</button></div>}
          <select id={`curation-${noun}`} className="w-full min-w-0 rounded border bg-white p-2 text-sm text-slate-900" value={candidateId} disabled={disabled || loadingCandidates || !!candidateError || items.length >= CURATION_LIMIT} onChange={(event) => setCandidateId(event.target.value)}>
            <option value="">Select {noun}</option>
            {!loadingCandidates && !candidateError && candidates.candidates.map((candidate) => <option key={candidate.item.id} value={candidate.item.id} disabled={items.some((item) => item.id === candidate.item.id)}>{candidate.label}</option>)}
          </select>
          {!loadingCandidates && !candidateError && candidates.candidates.length === 0 && <p className="text-sm">No candidates on this page.</p>}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={iconClass} title="Previous page" aria-label={`Previous ${noun} page`} disabled={disabled || loadingCandidates || page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={16} aria-hidden="true" /></button>
            <span className="text-sm">Page {page} of {candidates.pages}</span>
            <button type="button" className={iconClass} title="Next page" aria-label={`Next ${noun} page`} disabled={disabled || loadingCandidates || !!candidateError || page >= candidates.pages} onClick={() => setPage((value) => value + 1)}><ChevronRight size={16} aria-hidden="true" /></button>
            <button type="button" className={buttonClass} disabled={disabled || loadingCandidates || !!candidateError || !candidateId || items.length >= CURATION_LIMIT || items.some((item) => item.id === candidateId)} onClick={add}><Plus size={16} aria-hidden="true" />Add selected {noun.toLowerCase()}</button>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={`${buttonClass} bg-indigo-600 text-white`} disabled={disabled || items.length > CURATION_LIMIT || !dirty} onClick={() => void persist()}><Save size={16} aria-hidden="true" />{saving ? `Saving ${title}...` : `Save ${title}`}</button>
        {dirty && !saving && <span className="text-sm">Unsaved changes</span>}
        {success && <span role="status">{title} saved.</span>}
      </div>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

async function persistDialogue(ids: string[]) { return (await saveFeaturedDialogue(ids)).featuredDialogue; }
async function persistVoices(ids: string[]) { return (await saveFeaturedVoices(ids)).featuredVoices; }

export function PulseDialogueCurationEditor() {
  const [configuration, setConfiguration] = useState<PulseDialogueCuration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [denied, setDenied] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [onDenied] = useState(() => () => setDenied(true));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getPulseDialogueCuration().then((result) => {
      if (cancelled) return;
      setConfiguration((current) => current ?? result);
      setDenied(false);
    }).catch((failure) => {
      if (cancelled) return;
      const normalized = normalizeError(failure, 'Curation could not be loaded.');
      setError(normalized.message);
      if (normalized.status === 403) setDenied(true);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [attempt]);

  return (
    <div className="mt-4">
      {loading && <p role="status">Loading curation...</p>}
      {denied && <Denied message="You do not have permission to manage Pulse Dialogue curation." />}
      {error && !denied && <p role="alert">{error}</p>}
      {(error || denied) && <button type="button" className={buttonClass} disabled={loading} onClick={() => setAttempt((value) => value + 1)}>Retry curation access</button>}
      {configuration && <>
        <OrderedSelection title="Featured Dialogue" noun="Article" initialItems={configuration.featuredDialogue} loadCandidates={loadArticles} save={persistDialogue} denied={denied || loading} onDenied={onDenied} describe={(item) => ({ name: item.title || `Article ${item.id}`, detail: item.status, unavailable: item.missing || item.status !== 'published' })} />
        <OrderedSelection title="Featured Voices" noun="Contributor" initialItems={configuration.featuredVoices} loadCandidates={loadVoices} save={persistVoices} denied={denied || loading} onDenied={onDenied} describe={(item) => ({ name: item.name || `Contributor ${item.id}`, detail: item.publicDesignation, unavailable: item.missing || item.status !== 'active' || item.profileVisible !== true })} />
      </>}
    </div>
  );
}

export default function PulseDialogueCurationSection() {
  const [opened, setOpened] = useState(false);
  return (
    <details className="max-w-6xl mx-auto border-y px-4 py-4" onToggle={(event) => { if (event.currentTarget.open) setOpened(true); }}>
      <summary className="cursor-pointer text-lg font-semibold">Pulse Dialogue: Phase 3 Editorial Curation</summary>
      {opened && <PulseDialogueCurationEditor />}
    </details>
  );
}