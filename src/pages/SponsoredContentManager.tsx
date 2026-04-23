import React from 'react';
import toast from 'react-hot-toast';

import { api } from '@/lib/api';
import type { SponsoredFeatureInventoryRecord } from '@/lib/sponsoredContentInventory';
import {
  deleteSponsoredFeature,
  listSponsoredArticleInventory,
  listSponsoredFeatures,
  saveSponsoredFeature,
  setSponsoredArticleVisibility,
  setSponsoredFeatureActive,
  setSponsoredFeatureComboActive,
  type SponsoredArticleOption,
} from '@/lib/sponsoredFeaturesApi';

type SponsoredFeatureFormState = {
  sponsorName: string;
  campaignLabel: string;
  headline: string;
  shortSummary: string;
  ctaText: string;
  coverImage: string;
  destinationUrl: string;
  linkedSponsoredArticleId: string;
  linkedSponsoredArticleTitle: string;
  linkedSponsoredArticleUrl: string;
  isActive: boolean;
  comboCampaignIsActive: boolean;
  startAt: string;
  endAt: string;
};

function emptyForm(): SponsoredFeatureFormState {
  return {
    sponsorName: '',
    campaignLabel: '',
    headline: '',
    shortSummary: '',
    ctaText: '',
    coverImage: '',
    destinationUrl: '',
    linkedSponsoredArticleId: '',
    linkedSponsoredArticleTitle: '',
    linkedSponsoredArticleUrl: '',
    isActive: false,
    comboCampaignIsActive: true,
    startAt: '',
    endAt: '',
  };
}

function toDatetimeLocalValue(input?: string | null) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  const normalized = new Date(date.getTime() - offset * 60_000);
  return normalized.toISOString().slice(0, 16);
}

function fromDatetimeLocalValue(input: string) {
  const raw = String(input || '').trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function formatDateLabel(input?: string | null) {
  const raw = String(input || '').trim();
  if (!raw) return 'Not scheduled';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return 'Not scheduled';
  return date.toLocaleString();
}

function formatSchedule(startAt?: string | null, endAt?: string | null) {
  const start = formatDateLabel(startAt);
  const end = formatDateLabel(endAt);
  if (start === 'Not scheduled' && end === 'Not scheduled') return 'Always available';
  return `${start} to ${end}`;
}

function getVisibility(record: SponsoredFeatureInventoryRecord) {
  const now = Date.now();
  const start = record.startAt ? new Date(record.startAt).getTime() : null;
  const end = record.endAt ? new Date(record.endAt).getTime() : null;

  if (!record.isActive) {
    return { label: 'Inactive', className: 'border-slate-200 bg-slate-50 text-slate-700' };
  }
  if (start && start > now) {
    return { label: 'Scheduled', className: 'border-blue-200 bg-blue-50 text-blue-800' };
  }
  if (end && end < now) {
    return { label: 'Expired', className: 'border-amber-200 bg-amber-50 text-amber-900' };
  }
  return { label: 'Live on homepage', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' };
}

function isSponsoredArticleLiveStatus(status?: string | null) {
  const normalized = String(status || '').trim().toLowerCase();
  return normalized === 'published' || normalized === 'live' || normalized === 'public';
}

export default function SponsoredContentManager() {
  const [features, setFeatures] = React.useState<SponsoredFeatureInventoryRecord[]>([]);
  const [articles, setArticles] = React.useState<SponsoredArticleOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [articlesLoading, setArticlesLoading] = React.useState(true);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<SponsoredFeatureFormState>(() => emptyForm());
  const [busyById, setBusyById] = React.useState<Record<string, boolean>>({});
  const [imageFile, setImageFile] = React.useState<File | null>(null);
  const [imageUploading, setImageUploading] = React.useState(false);
  const [imageUploadProgress, setImageUploadProgress] = React.useState<number | null>(null);
  const [imagePreviewBroken, setImagePreviewBroken] = React.useState(false);

  const activeCount = React.useMemo(
    () => features.filter((feature) => feature.isActive).length,
    [features],
  );
  const publishedArticleCount = React.useMemo(
    () => articles.filter((article) => isSponsoredArticleLiveStatus(article.status)).length,
    [articles],
  );
  const featureById = React.useMemo(
    () => new Map(features.map((feature) => [feature.id, feature])),
    [features],
  );

  const liveFeature = React.useMemo(
    () => features.find((feature) => getVisibility(feature).label === 'Live on homepage') || null,
    [features],
  );

  const resolvedFormClickTarget = React.useMemo(() => {
    const linkedId = String(form.linkedSponsoredArticleId || '').trim();
    const linkedUrl = String(form.linkedSponsoredArticleUrl || '').trim();
    const fallbackUrl = String(form.destinationUrl || '').trim();
    return linkedId ? (linkedUrl || fallbackUrl || null) : (fallbackUrl || null);
  }, [form.destinationUrl, form.linkedSponsoredArticleId, form.linkedSponsoredArticleUrl]);

  const loadAll = React.useCallback(async () => {
    setLoading(true);
    try {
      const next = await listSponsoredFeatures();
      setFeatures(next);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load Sponsored Features');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadArticles = React.useCallback(async () => {
    setArticlesLoading(true);
    try {
      const next = await listSponsoredArticleInventory();
      setArticles(next);
    } catch {
      setArticles([]);
    } finally {
      setArticlesLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadAll();
    void loadArticles();
  }, [loadAll, loadArticles]);

  React.useEffect(() => {
    setImagePreviewBroken(false);
  }, [form.coverImage]);

  const uploadCoverImage = React.useCallback(async (file: File) => {
    const payload = new FormData();
    payload.append('file', file);

    const res = await api.post('/ads/upload-image', payload, {
      onUploadProgress: (evt) => {
        const total = typeof evt.total === 'number' ? evt.total : null;
        const loaded = typeof evt.loaded === 'number' ? evt.loaded : null;
        if (!total || !loaded) {
          setImageUploadProgress(null);
          return;
        }
        setImageUploadProgress(Math.max(0, Math.min(100, Math.round((loaded / total) * 100))));
      },
    });

    const data = res?.data;
    const hostedUrl = String(
      data?.hostedUrl
      || data?.hosted_url
      || data?.data?.hostedUrl
      || data?.data?.hosted_url
      || data?.url
      || data?.data?.url
      || ''
    ).trim();

    if (!hostedUrl) throw new Error('Upload succeeded but no hostedUrl was returned');
    if (/^https?:\/\//i.test(hostedUrl)) return hostedUrl;
    if (hostedUrl.startsWith('/') && typeof window !== 'undefined' && window.location?.origin) {
      return `${window.location.origin}${hostedUrl}`;
    }
    return hostedUrl;
  }, []);

  const handleUploadImage = React.useCallback(async () => {
    if (!imageFile) {
      toast.error('Please choose a cover image to upload');
      return;
    }

    setImageUploading(true);
    setImageUploadProgress(null);
    try {
      const url = await uploadCoverImage(imageFile);
      setForm((prev) => ({ ...prev, coverImage: url }));
      toast.success('Cover image uploaded');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Upload failed');
    } finally {
      setImageUploading(false);
      setImageUploadProgress(null);
    }
  }, [imageFile, uploadCoverImage]);

  const openCreate = React.useCallback(() => {
    setEditingId(null);
    setForm(emptyForm());
    setImageFile(null);
    setImageUploading(false);
    setImageUploadProgress(null);
    setModalOpen(true);
  }, []);

  const openEdit = React.useCallback((feature: SponsoredFeatureInventoryRecord) => {
    setEditingId(feature.id);
    setForm({
      sponsorName: String(feature.sponsorName || ''),
      campaignLabel: String(feature.internalCampaignName || ''),
      headline: String(feature.headline || ''),
      shortSummary: String(feature.shortSummary || ''),
      ctaText: String(feature.ctaText || ''),
      coverImage: String(feature.coverImage || ''),
      destinationUrl: String(feature.destinationUrl || ''),
      linkedSponsoredArticleId: String(feature.optionalLinkedSponsoredArticleId || ''),
      linkedSponsoredArticleTitle: String(feature.linkedSponsoredArticleTitle || ''),
      linkedSponsoredArticleUrl: String(feature.linkedSponsoredArticleUrl || ''),
      isActive: Boolean(feature.isActive),
      comboCampaignIsActive: feature.comboCampaignIsActive !== false,
      startAt: toDatetimeLocalValue(feature.startAt),
      endAt: toDatetimeLocalValue(feature.endAt),
    });
    setImageFile(null);
    setImageUploading(false);
    setImageUploadProgress(null);
    setModalOpen(true);
  }, []);

  const closeModal = React.useCallback(() => {
    if (saving || imageUploading) return;
    setModalOpen(false);
    setEditingId(null);
  }, [imageUploading, saving]);

  const submit = React.useCallback(async (event: React.FormEvent) => {
    event.preventDefault();

    const sponsorName = String(form.sponsorName || '').trim();
    const headline = String(form.headline || '').trim();
    const shortSummary = String(form.shortSummary || '').trim();
    const ctaText = String(form.ctaText || '').trim();
    const coverImage = String(form.coverImage || '').trim();
    const destinationUrl = String(form.destinationUrl || '').trim();
    const linkedArticleId = String(form.linkedSponsoredArticleId || '').trim();
    const linkedArticleUrl = String(form.linkedSponsoredArticleUrl || '').trim();
    const startAt = fromDatetimeLocalValue(form.startAt);
    const endAt = fromDatetimeLocalValue(form.endAt);

    if (!sponsorName) return toast.error('Sponsor / Brand Name is required');
    if (!headline) return toast.error('Headline is required');
    if (!shortSummary) return toast.error('Short Summary is required');
    if (!ctaText) return toast.error('CTA Text is required');
    if (!coverImage) return toast.error('Cover Image is required');
    if (!linkedArticleId && !destinationUrl) return toast.error('Destination URL is required when no Sponsored Article is linked');
    if (startAt && endAt && new Date(startAt).getTime() > new Date(endAt).getTime()) {
      return toast.error('Start Date & Time must be before End Date & Time');
    }

    setSaving(true);
    try {
      const next = await saveSponsoredFeature({
        sponsorName,
        headline,
        shortSummary,
        ctaText,
        coverImage,
        destinationUrl: destinationUrl || linkedArticleUrl,
        linkedSponsoredArticleId: linkedArticleId || null,
        linkedSponsoredArticleTitle: String(form.linkedSponsoredArticleTitle || '').trim() || null,
        linkedSponsoredArticleUrl: linkedArticleUrl || null,
        isActive: Boolean(form.isActive),
        comboCampaignIsActive: Boolean(form.comboCampaignIsActive),
        startAt,
        endAt,
        internalCampaignName: String(form.campaignLabel || '').trim() || null,
      }, editingId);
      setFeatures(next);
      setModalOpen(false);
      toast.success(editingId ? 'Sponsored Feature updated' : 'Sponsored Feature created');
    } catch (err: any) {
      toast.error(err?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [editingId, form]);

  const handleDelete = React.useCallback(async (feature: SponsoredFeatureInventoryRecord) => {
    if (!window.confirm(`Delete sponsored feature "${feature.headline || 'Sponsored Feature'}"?`)) return;
    setBusyById((prev) => ({ ...prev, [feature.id]: true }));
    try {
      const next = await deleteSponsoredFeature(feature.id);
      setFeatures(next);
      toast.success('Sponsored Feature deleted');
    } finally {
      setBusyById((prev) => ({ ...prev, [feature.id]: false }));
    }
  }, []);

  const handleToggleActive = React.useCallback(async (feature: SponsoredFeatureInventoryRecord) => {
    setBusyById((prev) => ({ ...prev, [feature.id]: true }));
    try {
      const next = await setSponsoredFeatureActive(feature.id, !feature.isActive);
      setFeatures(next);
      toast.success(!feature.isActive ? 'Sponsored Feature activated' : 'Sponsored Feature deactivated');
    } finally {
      setBusyById((prev) => ({ ...prev, [feature.id]: false }));
    }
  }, []);

  const handleToggleCombo = React.useCallback(async (feature: SponsoredFeatureInventoryRecord) => {
    setBusyById((prev) => ({ ...prev, [feature.id]: true }));
    try {
      const next = await setSponsoredFeatureComboActive(feature.id, feature.comboCampaignIsActive === false);
      setFeatures(next);
      toast.success(feature.comboCampaignIsActive === false ? 'Combo Campaign enabled' : 'Combo Campaign disabled');
    } catch (err: any) {
      toast.error(err?.message || 'Combo toggle failed');
    } finally {
      setBusyById((prev) => ({ ...prev, [feature.id]: false }));
    }
  }, []);

  const handleToggleArticle = React.useCallback(async (article: SponsoredArticleOption) => {
    setBusyById((prev) => ({ ...prev, [article.id]: true }));
    try {
      const nextArticles = await setSponsoredArticleVisibility(article.id, !isSponsoredArticleLiveStatus(article.status));
      setArticles(nextArticles);
      const nextFeatures = await listSponsoredFeatures();
      setFeatures(nextFeatures);
      toast.success(isSponsoredArticleLiveStatus(article.status) ? 'Sponsored Article turned off' : 'Sponsored Article turned on');
    } catch (err: any) {
      toast.error(err?.message || 'Sponsored Article toggle failed');
    } finally {
      setBusyById((prev) => ({ ...prev, [article.id]: false }));
    }
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Sponsored Content</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
            Manage homepage Sponsored Feature campaigns separately from display inventory. Sponsored Articles stay in the article workflow and can be linked here for combo campaigns.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={openCreate}
            className="rounded bg-amber-600 px-4 py-2 text-sm font-medium text-white"
          >
            Create Sponsored Feature
          </button>
          <a
            href="/add?sponsored=1"
            className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
          >
            Add Sponsored Article
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:bg-slate-900">
          <div className="text-sm font-semibold">Sponsored Feature</div>
          <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">Homepage reach product only. Turning it off hides only the homepage sponsored card.</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:bg-slate-900">
          <div className="text-sm font-semibold">Sponsored Article</div>
          <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">Standalone sponsored story product. Its publish state stays independent from the homepage feature.</div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-sm font-semibold text-amber-950">Combo Campaign</div>
          <div className="mt-2 text-sm text-amber-950">Bundle logic only. Turning it off keeps the feature and article records intact but sends homepage clicks to the fallback URL.</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-sm font-semibold text-amber-950">Homepage rule</div>
          <div className="mt-2 text-sm text-amber-950">Only one Sponsored Feature is shown on the homepage at a time.</div>
          <div className="mt-2 text-xs text-amber-900">Turning one campaign on automatically turns the others off.</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:bg-slate-900">
          <div className="text-sm font-semibold">Current active count</div>
          <div className="mt-2 text-3xl font-bold">{activeCount}</div>
          <div className="mt-2 text-xs text-slate-500">Expected value is usually 0 or 1.</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:bg-slate-900">
          <div className="text-sm font-semibold">Sponsored Articles live</div>
          <div className="mt-2 text-3xl font-bold">{publishedArticleCount}</div>
          <div className="mt-2 text-xs text-slate-500">These article ON/OFF controls are separate from homepage feature delivery.</div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Homepage live target</div>
            <div className="mt-1 text-xs text-slate-500">Use this to confirm which active Sponsored Feature the public homepage can actually click through to.</div>
          </div>
          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${liveFeature ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
            {liveFeature ? 'Active record saved' : 'No live record'}
          </span>
        </div>
        {liveFeature ? (
          <div className="mt-3 grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Headline</div>
              <div className="mt-1 text-slate-900 dark:text-slate-100">{liveFeature.headline}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Public click target</div>
              <div className="mt-1 break-all text-slate-900 dark:text-slate-100">{liveFeature.publicClickTarget || '-'}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Combo mode</div>
              <div className="mt-1 text-slate-900 dark:text-slate-100">{liveFeature.comboCampaignIsActive === false ? 'Combo OFF, fallback URL first' : (liveFeature.optionalLinkedSponsoredArticleId ? 'Linked Sponsored Article first' : 'Fallback URL only')}</div>
            </div>
          </div>
        ) : (
          <div className="mt-3 text-sm text-slate-500">Create a Sponsored Feature and mark it active to get a visible homepage record.</div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr),minmax(320px,1fr)]">
        <div className="space-y-4">
          {loading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:bg-slate-900">Loading Sponsored Features…</div>
          ) : features.length > 0 ? (
            features.map((feature) => {
              const busy = Boolean(busyById[feature.id]);
              const visibility = getVisibility(feature);
              const comboIsActive = feature.comboCampaignIsActive !== false;
              return (
                <div key={feature.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:bg-slate-900">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Sponsored Feature</div>
                      <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{feature.headline || 'Untitled Sponsored Feature'}</h2>
                      <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{feature.sponsorName || 'Sponsor name missing'}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${feature.isActive ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
                        {feature.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${visibility.className}`}>
                        {visibility.label}
                      </span>
                    </div>
                  </div>

                  {feature.shortSummary ? (
                    <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-200">{feature.shortSummary}</p>
                  ) : null}

                  <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-slate-600 dark:text-slate-300 md:grid-cols-2">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">CTA</div>
                      <div className="mt-1">{feature.ctaText || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Schedule</div>
                      <div className="mt-1">{formatSchedule(feature.startAt, feature.endAt)}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Combo Link</div>
                      <div className="mt-1">{feature.linkedSponsoredArticleTitle || feature.optionalLinkedSponsoredArticleId || 'No linked Sponsored Article'}</div>
                      <div className="mt-1 text-xs text-slate-500">{comboIsActive ? 'Combo ON: homepage click prefers the linked Sponsored Article when it is public.' : 'Combo OFF: homepage click uses the fallback destination URL.'}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Destination fallback</div>
                      <div className="mt-1 break-all">{feature.destinationUrl || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Public click target</div>
                      <div className="mt-1 break-all">{feature.publicClickTarget || '-'}</div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleToggleActive(feature)}
                      disabled={busy}
                      className={`rounded border px-3 py-1.5 text-xs font-medium ${feature.isActive ? 'border-green-600 bg-green-600 text-white' : 'border-slate-300 bg-slate-100 text-slate-800'}`}
                    >
                      {busy ? 'Saving…' : (feature.isActive ? 'Turn Off' : 'Turn On')}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleToggleCombo(feature)}
                      disabled={busy || !feature.optionalLinkedSponsoredArticleId}
                      className={`rounded border px-3 py-1.5 text-xs font-medium ${comboIsActive ? 'border-amber-500 bg-amber-500 text-white' : 'border-slate-300 bg-slate-100 text-slate-800'} disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      {busy ? 'Saving…' : (comboIsActive ? 'Combo Off' : 'Combo On')}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(feature)}
                      disabled={busy}
                      className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(feature)}
                      disabled={busy}
                      className="rounded border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
              No Sponsored Features yet. Create one here when you need a homepage sponsored campaign.
            </div>
          )}
        </div>

        <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Sponsored Articles</h2>
              <p className="mt-1 text-xs text-slate-500">Standalone article product with its own ON/OFF state. Published articles remain eligible for combo linking.</p>
            </div>
            <a href="/add?sponsored=1" className="text-xs font-medium text-amber-700 hover:text-amber-800">Create</a>
          </div>

          <div className="mt-4 space-y-3">
            {articlesLoading ? (
              <div className="text-sm text-slate-500">Loading Sponsored Articles…</div>
            ) : articles.length > 0 ? (
              articles.slice(0, 8).map((article) => {
                const articleLive = isSponsoredArticleLiveStatus(article.status);
                const busy = Boolean(busyById[article.id]);
                const linkedFeature = article.sponsorFeatureLinkedId ? featureById.get(article.sponsorFeatureLinkedId) || null : null;
                const articleHasOwnCta = Boolean(String(article.sponsorCtaUrl || '').trim());
                const linkedFeatureFallbackAvailable = Boolean(
                  linkedFeature
                  && linkedFeature.comboCampaignIsActive !== false
                  && String(linkedFeature.optionalLinkedSponsoredArticleId || '').trim() === article.id
                  && String(linkedFeature.destinationUrl || '').trim()
                );
                return (
                  <div key={article.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium text-slate-900">{article.title}</div>
                        <div className="mt-1 text-xs text-slate-500">{article.publicUrl || article.id}{article.status ? ` • ${article.status}` : ''}</div>
                        <div className="mt-1 text-[11px] text-slate-500">{articleLive ? 'Article ON: public sponsored story is live.' : 'Article OFF: story stays out of the public sponsored flow.'}</div>
                        <div className="mt-1 text-[11px] text-slate-500">
                          {articleHasOwnCta
                            ? `Article CTA: ${article.sponsorCtaText || 'CTA configured'} -> ${article.sponsorCtaUrl}`
                            : (linkedFeatureFallbackAvailable
                              ? 'Article CTA: no article-level CTA set. Linked feature fallback is available because this article is really linked.'
                              : 'Article CTA: disclosure only unless you add an article-level CTA in the article editor.')}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <button
                          type="button"
                          onClick={() => void handleToggleArticle(article)}
                          disabled={busy}
                          className={`rounded border px-2.5 py-1 text-[11px] font-medium ${articleLive ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white text-slate-700'} disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                          {busy ? 'Saving…' : (articleLive ? 'Article Off' : 'Article On')}
                        </button>
                        <a
                          href={`/admin/articles/${article.id}/edit`}
                          className="text-[11px] font-medium text-amber-700 hover:text-amber-800"
                        >
                          Edit Article CTA
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-sm text-slate-500">No Sponsored Articles found yet.</div>
            )}
          </div>
        </aside>
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-3 py-4" role="dialog" aria-modal="true">
          <div className="flex max-h-[calc(100vh-32px)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border bg-white shadow-lg dark:bg-slate-900">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold">{editingId ? 'Edit Sponsored Feature' : 'Create Sponsored Feature'}</h2>
                <p className="mt-1 text-xs text-slate-500">Homepage shows only one active Sponsored Feature at a time.</p>
              </div>
              <button type="button" onClick={closeModal} disabled={saving || imageUploading} className="rounded border px-3 py-1.5 text-sm">
                Close
              </button>
            </div>

            <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                  <div className="font-semibold">Sponsored Feature</div>
                  <div className="mt-1">This is a premium homepage content unit, not a banner slot or billboard placement.</div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium">Sponsor / Brand Name *</label>
                    <input
                      className="mt-1 w-full rounded border px-3 py-2"
                      value={form.sponsorName}
                      onChange={(e) => setForm((prev) => ({ ...prev, sponsorName: e.target.value }))}
                      placeholder="Enter sponsor or brand name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium">Campaign Label</label>
                    <input
                      className="mt-1 w-full rounded border px-3 py-2"
                      value={form.campaignLabel}
                      onChange={(e) => setForm((prev) => ({ ...prev, campaignLabel: e.target.value }))}
                      placeholder="Optional internal label"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium">Headline *</label>
                    <input
                      className="mt-1 w-full rounded border px-3 py-2"
                      value={form.headline}
                      onChange={(e) => setForm((prev) => ({ ...prev, headline: e.target.value }))}
                      placeholder="Homepage sponsored headline"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium">Short Summary *</label>
                    <textarea
                      className="mt-1 w-full rounded border px-3 py-2"
                      rows={3}
                      value={form.shortSummary}
                      onChange={(e) => setForm((prev) => ({ ...prev, shortSummary: e.target.value }))}
                      placeholder="Premium summary copy for the homepage card"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium">CTA Text *</label>
                    <input
                      className="mt-1 w-full rounded border px-3 py-2"
                      value={form.ctaText}
                      onChange={(e) => setForm((prev) => ({ ...prev, ctaText: e.target.value }))}
                      placeholder="Example: Read the full story"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium">Combo Link: Sponsored Article</label>
                    <select
                      className="mt-1 w-full rounded border px-3 py-2"
                      value={form.linkedSponsoredArticleId}
                      onChange={(e) => {
                        const nextId = e.target.value;
                        const match = articles.find((article) => article.id === nextId);
                        setForm((prev) => ({
                          ...prev,
                          linkedSponsoredArticleId: nextId,
                          linkedSponsoredArticleTitle: match?.title || '',
                          linkedSponsoredArticleUrl: match?.publicUrl || '',
                          destinationUrl: prev.destinationUrl || match?.publicUrl || '',
                        }));
                      }}
                    >
                      <option value="">No linked Sponsored Article</option>
                      {articles.filter((article) => isSponsoredArticleLiveStatus(article.status)).map((article) => (
                        <option key={article.id} value={article.id}>
                          {article.title}{article.status ? ` (${article.status})` : ''}
                        </option>
                      ))}
                    </select>
                    <div className="mt-1 text-[11px] text-slate-500">If linked, the homepage click resolves to the Sponsored Article first. Only published Sponsored Articles are selectable.</div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium">Destination URL {form.linkedSponsoredArticleId ? '(fallback)' : '*'}</label>
                    <input
                      className="mt-1 w-full rounded border px-3 py-2"
                      value={form.destinationUrl}
                      onChange={(e) => setForm((prev) => ({ ...prev, destinationUrl: e.target.value }))}
                      placeholder="https://... or /story/..."
                    />
                    <div className="mt-1 text-[11px] text-slate-500">Used when no Sponsored Article is linked, or as the fallback destination.</div>
                    <div className="mt-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                      <span className="font-semibold">Public click target preview:</span>{' '}
                      <span className="break-all">{resolvedFormClickTarget || 'Add a linked Sponsored Article or a fallback URL'}</span>
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium">Cover Image *</label>
                    <input
                      className="mt-1 w-full rounded border px-3 py-2"
                      value={form.coverImage}
                      onChange={(e) => setForm((prev) => ({ ...prev, coverImage: e.target.value }))}
                      placeholder="https://..."
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        className="text-sm"
                        disabled={imageUploading}
                        onChange={(e) => setImageFile(e.currentTarget.files?.[0] || null)}
                      />
                      <button
                        type="button"
                        onClick={() => void handleUploadImage()}
                        disabled={imageUploading || !imageFile}
                        className="rounded border px-3 py-1.5 text-sm disabled:opacity-60"
                      >
                        {imageUploading
                          ? (typeof imageUploadProgress === 'number' ? `Uploading… ${imageUploadProgress}%` : 'Uploading…')
                          : 'Upload Image'}
                      </button>
                    </div>
                    {form.coverImage ? (
                      <div className="mt-3 flex items-center gap-3">
                        <div className="flex h-[72px] w-[216px] items-center justify-center overflow-hidden rounded border bg-slate-50">
                          {imagePreviewBroken ? (
                            <span className="text-xs text-red-700">Preview failed</span>
                          ) : (
                            <img
                              src={form.coverImage}
                              alt={form.headline || 'Sponsored feature cover'}
                              className="max-h-full max-w-full object-contain"
                              onError={() => setImagePreviewBroken(true)}
                              onLoad={() => setImagePreviewBroken(false)}
                            />
                          )}
                        </div>
                        <span className="text-xs text-slate-500">Cover preview</span>
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <label className="block text-sm font-medium">Start Date & Time</label>
                    <input
                      type="datetime-local"
                      className="mt-1 w-full rounded border px-3 py-2"
                      value={form.startAt}
                      onChange={(e) => setForm((prev) => ({ ...prev, startAt: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium">End Date & Time</label>
                    <input
                      type="datetime-local"
                      className="mt-1 w-full rounded border px-3 py-2"
                      value={form.endAt}
                      onChange={(e) => setForm((prev) => ({ ...prev, endAt: e.target.value }))}
                    />
                  </div>
                  <div className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                    <label className="flex items-start gap-3 text-sm font-medium text-slate-900">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={form.isActive}
                        onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                      />
                      <span>
                        <span className="block">Make this the active homepage Sponsored Feature</span>
                        <span className="mt-1 block text-xs font-normal text-slate-500">If enabled, this campaign becomes the one active Sponsored Feature shown on the homepage.</span>
                      </span>
                    </label>
                  </div>
                  <div className="md:col-span-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                    <label className="flex items-start gap-3 text-sm font-medium text-amber-950">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={form.comboCampaignIsActive}
                        disabled={!form.linkedSponsoredArticleId}
                        onChange={(e) => setForm((prev) => ({ ...prev, comboCampaignIsActive: e.target.checked }))}
                      />
                      <span>
                        <span className="block">Enable Combo Campaign link behavior</span>
                        <span className="mt-1 block text-xs font-normal text-amber-900">When off, the homepage feature can stay on and the Sponsored Article can stay published, but homepage clicks use the fallback destination URL instead of the linked article.</span>
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t px-5 py-4">
                <button type="button" onClick={closeModal} disabled={saving || imageUploading} className="rounded border px-4 py-2 text-sm">
                  Cancel
                </button>
                <button type="submit" disabled={saving || imageUploading} className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
                  {saving ? 'Saving…' : (editingId ? 'Save Sponsored Feature' : 'Create Sponsored Feature')}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}