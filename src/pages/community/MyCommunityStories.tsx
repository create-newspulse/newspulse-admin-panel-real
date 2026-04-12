import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useNotify } from '@/components/ui/toast-bridge';
import StoryDeskSummaryCards, { type StoryDeskSummary } from '@/components/community/StoryDeskSummaryCards';
import StoryDeskTable, { type StoryDeskColumns, type StoryDeskGroup } from '@/components/community/StoryDeskTable';
import StoryDeskTimeline from '@/components/community/StoryDeskTimeline';
import ConfirmModal from '@/components/ui/ConfirmModal';
import type { AdminCommunityStory } from '@/lib/api/communityReporterStories';
import { fetchCommunityStories } from '@/lib/communityReporter/api';
import {
  moveCommunityStoryRecordToDeleted,
  permanentlyDeleteCommunityStoryRecord,
  restoreCommunityStoryRecord,
} from '@/lib/api/communityStoryDeskActions';

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'published';
type PubStatusFilter = 'all' | 'published' | 'not_published';
type ViewMode = 'table' | 'timeline' | 'archive';
type GroupBy = 'none' | 'month' | 'year' | 'reporter' | 'status' | 'category';

type DatePreset = 'today' | 'last7' | 'thisMonth' | 'thisYear' | 'allTime' | 'custom';

const PUBLIC_SITE_ORIGIN = ((import.meta.env as any).VITE_PUBLIC_SITE_ORIGIN || 'https://www.newspulse.co.in').toString().replace(/\/+$/, '');

function safeText(v: any): string {
  const s = String(v ?? '').trim();
  return s ? s : '';
}

function firstNonEmpty(...candidates: any[]): string {
  for (const c of candidates) {
    if (Array.isArray(c)) {
      for (const inner of c) {
        const s2 = String(inner ?? '').trim();
        if (s2) return s2;
      }
      continue;
    }
    const s = String(c ?? '').trim();
    if (s) return s;
  }
  return '';
}

function emailLocalPart(email: any): string {
  const s = String(email ?? '').trim();
  if (!s) return '';
  if (s.includes('@')) return s.split('@')[0].trim();
  return s;
}

function deriveReporterNameFromRaw(raw: any): string {
  const reporterObj = raw?.reporter && typeof raw.reporter === 'object' && !Array.isArray(raw.reporter) ? raw.reporter : null;
  const submittedByObj = raw?.submittedBy && typeof raw.submittedBy === 'object' && !Array.isArray(raw.submittedBy) ? raw.submittedBy : null;
  const userObj = raw?.user && typeof raw.user === 'object' && !Array.isArray(raw.user) ? raw.user : null;
  const authorObj = raw?.author && typeof raw.author === 'object' && !Array.isArray(raw.author) ? raw.author : null;

  const preferred = firstNonEmpty(
    reporterObj?.name,
    raw?.reporterName,
    raw?.submittedByName,
    raw?.authorName,
    submittedByObj?.name,
    submittedByObj?.fullName,
    submittedByObj?.displayName,
    userObj?.name,
    userObj?.fullName,
    userObj?.displayName,
    raw?.userName,
    raw?.name,
    raw?.contactName,
    authorObj?.name,
  );
  const looksLikeId = /^[a-f0-9]{24}$/i.test(preferred) || /^\d{10,}$/.test(preferred);
  if (preferred && !looksLikeId) return preferred;

  const email = firstNonEmpty(
    reporterObj?.email,
    raw?.reporterEmail,
    raw?.contactEmail,
    raw?.email,
    raw?.authorEmail,
    submittedByObj?.email,
    raw?.submittedByEmail,
    userObj?.email,
    authorObj?.email,
  );
  const fromEmail = emailLocalPart(email);
  if (fromEmail) return fromEmail;

  const phone = firstNonEmpty(
    reporterObj?.phone,
    raw?.reporterPhone,
    raw?.contactPhone,
    raw?.phone,
    raw?.whatsapp,
    submittedByObj?.phone,
    userObj?.phone,
    authorObj?.phone,
  );
  if (phone) return phone;

  return '';
}

function deriveReporterEmailFromRaw(raw: any): string {
  const reporterObj = raw?.reporter && typeof raw.reporter === 'object' && !Array.isArray(raw.reporter) ? raw.reporter : null;
  const submittedByObj = raw?.submittedBy && typeof raw.submittedBy === 'object' && !Array.isArray(raw.submittedBy) ? raw.submittedBy : null;
  const userObj = raw?.user && typeof raw.user === 'object' && !Array.isArray(raw.user) ? raw.user : null;
  const authorObj = raw?.author && typeof raw.author === 'object' && !Array.isArray(raw.author) ? raw.author : null;
  return firstNonEmpty(
    reporterObj?.email,
    raw?.reporterEmail,
    raw?.contactEmail,
    raw?.email,
    raw?.authorEmail,
    submittedByObj?.email,
    raw?.submittedByEmail,
    userObj?.email,
    authorObj?.email,
  );
}

function deriveCategoryFromRaw(raw: any): string {
  const metaObj = raw?.meta && typeof raw.meta === 'object' && !Array.isArray(raw.meta) ? raw.meta : null;
  const category = firstNonEmpty(
    // required precedence
    raw?.category,
    raw?.primaryCategory,
    raw?.section,
    raw?.storyType,
    // common alternates
    raw?.topic,
    raw?.categoryName,
    raw?.categorySlug,
    raw?.sectionName,
    metaObj?.category,
    metaObj?.primaryCategory,
    metaObj?.section,
    metaObj?.storyType,
  );
  return category || 'Uncategorized';
}

function normalizeLanguageValue(v: any): string {
  const raw = String(v ?? '').trim();
  if (!raw) return '';

  const lower = raw.toLowerCase();
  // Normalize common language tags/names to a short code.
  if (lower === 'en' || lower.startsWith('en-') || lower === 'english') return 'en';
  if (lower === 'gu' || lower.startsWith('gu-') || lower === 'gujarati') return 'gu';
  if (lower === 'hi' || lower.startsWith('hi-') || lower === 'hindi') return 'hi';

  // If it's already a BCP-47-ish tag, keep the primary subtag.
  if (/^[a-z]{2,3}(-[a-z0-9]{2,8})+$/i.test(raw)) {
    return raw.split('-')[0].toLowerCase();
  }

  // Otherwise keep as-is (table uppercases it).
  return raw;
}

function inferLanguageFromHeadline(headline: any): string {
  const s = String(headline ?? '');
  if (!s) return '';
  // Gujarati block: U+0A80..U+0AFF
  if (/[\u0A80-\u0AFF]/.test(s)) return 'gu';
  // Devanagari: U+0900..U+097F
  if (/[\u0900-\u097F]/.test(s)) return 'hi';
  return '';
}

function deriveLanguageFromRaw(raw: any): string {
  // Prefer explicit language code fields when present; some backends set `language` to a default.
  const metaObj = raw?.meta && typeof raw.meta === 'object' && !Array.isArray(raw.meta) ? raw.meta : null;
  const candidate = firstNonEmpty(
    raw?.lang,
    raw?.languageCode,
    raw?.language,
    raw?.locale,
    raw?.contentLanguage,
    raw?.languageTag,
    raw?.storyLanguage,
    metaObj?.lang,
    metaObj?.languageCode,
    metaObj?.language,
    metaObj?.locale,
  );

  const normalized = normalizeLanguageValue(candidate);
  const inferred = inferLanguageFromHeadline(raw?.headline ?? raw?.title);
  // If backend says EN but headline script strongly suggests Gujarati/Hindi, trust the script.
  if ((normalized === '' || normalized === 'en') && inferred) return inferred;
  return normalized;
}

function parseDateInput(value: string): Date | null {
  const s = String(value || '').trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function monthKey(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

function monthLabel(d: Date): string {
  return d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
}

function toMs(value?: string): number {
  const s = String(value || '').trim();
  if (!s) return 0;
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? t : 0;
}

function normalizeReporterName(story: AdminCommunityStory): string {
  const preferred = safeText(story.reporterName);
  const looksLikeId = /^[a-f0-9]{24}$/i.test(preferred) || /^\d{10,}$/i.test(preferred);
  if (preferred && !looksLikeId) return preferred;

  const email = safeText(story.reporterEmail);
  if (email.includes('@')) {
    const left = email.split('@')[0].trim();
    if (left) return left;
  }
  const phone = safeText(story.reporterPhone);
  if (phone) return phone;
  return '';
}

const MyCommunityStoriesPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const notify = (useNotify?.() as unknown) as { ok: (msg: string, sub?: string) => void; error: (msg: string) => void; info?: (msg: string, sub?: string) => void } | undefined;

  const [stories, setStories] = useState<AdminCommunityStory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<AdminCommunityStory | null>(null);
  const [permanentDeleteTyped, setPermanentDeleteTyped] = useState('');
  const [permanentDeleteBusy, setPermanentDeleteBusy] = useState(false);

  const role = String(user?.role || '').toLowerCase();
  const isFounderOrAdmin = role === 'founder' || role === 'admin';

  function isDeletedLikeStatus(story: AdminCommunityStory): boolean {
    const explicit = (story as any)?.isDeleted;
    if (typeof explicit === 'boolean') return explicit;

    const st = String((story as any)._statusNorm ?? (story as any).status ?? '').toLowerCase();
    return (
      st.includes('withdrawn') ||
      st.includes('rejected') ||
      st.includes('deleted') ||
      st.includes('removed') ||
      st.includes('trash') ||
      st.includes('archived')
    );
  }

  function canSoftDeleteRecord(story: AdminCommunityStory): boolean {
    const v = (story as any)?.canSoftDelete;
    if (typeof v === 'boolean') return v;
    return isFounderOrAdmin && !isDeletedLikeStatus(story);
  }

  function canRestoreRecord(story: AdminCommunityStory): boolean {
    const v = (story as any)?.canRestore;
    if (typeof v === 'boolean') return v;
    return isFounderOrAdmin && isDeletedLikeStatus(story);
  }

  function canPermanentDeleteRecord(story: AdminCommunityStory): boolean {
    const v = (story as any)?.canPermanentDelete;
    if (typeof v === 'boolean') return v;
    return isFounderOrAdmin && isDeletedLikeStatus(story);
  }

  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [publicationStatusFilter, setPublicationStatusFilter] = useState<PubStatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [reporterFilter, setReporterFilter] = useState('');
  const [languageFilter, setLanguageFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [districtFilter, setDistrictFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');

  const [datePreset, setDatePreset] = useState<DatePreset>('allTime');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const [columns, setColumns] = useState<StoryDeskColumns>({
    district: false,
    state: false,
    views: false,
    reporterEmail: false,
    sourceId: false,
  });

  async function loadStories() {
    setIsLoading(true);
    setError(null);
    try {
      // Preserve the old working data source for this route:
      // GET /community/my-stories (server decides which reporter based on session).
      const serverStatus = statusFilter !== 'all'
        ? statusFilter
        : viewMode === 'archive'
          ? 'rejected'
          : undefined;
      const fetched = await fetchCommunityStories({
        status: serverStatus,
        search: searchQuery || undefined,
      });

      const mapped: AdminCommunityStory[] = (Array.isArray(fetched) ? fetched : []).map((s: any) => ({
        id: String(s.id ?? s._id ?? ''),
        headline: String(s.headline ?? s.title ?? ''),
        summary: s.summary ?? null,
        language: deriveLanguageFromRaw(s),
        category: deriveCategoryFromRaw(s),
        city: s.city ?? s.location?.city ?? '',
        district: s.district ?? s.location?.district ?? '',
        state: s.state ?? s.location?.state ?? '',
        country: s.country ?? s.location?.country ?? '',
        reporterName: deriveReporterNameFromRaw(s),
        reporterEmail: deriveReporterEmailFromRaw(s),
        reporterPhone: firstNonEmpty(s?.reporter?.phone, s.reporterPhone, s.contactPhone, s.phone, s.whatsapp),
        reporterKey: s.reporterKey ?? s.userId ?? '',
        sourceId: s.sourceId ?? s.refId ?? s.referenceId ?? '',
        linkedArticleId: s.linkedArticleId ?? s.articleId ?? '',
        linkedArticleSlug: s.linkedArticleSlug ?? s.slug ?? s.articleSlug ?? '',
        linkedArticleStatus: s.linkedArticleStatus ?? s.articleStatus ?? '',
        published: Boolean(s.published ?? s.isPublished),
        publishedAt: s.publishedAt ?? s.liveAt ?? '',
        views: typeof s.views === 'number' ? s.views : typeof s.viewCount === 'number' ? s.viewCount : undefined,
        status: String(s.status ?? 'submitted'),
        ...(typeof s.isDeleted === 'boolean' ? { isDeleted: s.isDeleted } : null),
        ...(typeof s.canSoftDelete === 'boolean' ? { canSoftDelete: s.canSoftDelete } : null),
        ...(typeof s.canRestore === 'boolean' ? { canRestore: s.canRestore } : null),
        ...(typeof s.canPermanentDelete === 'boolean' ? { canPermanentDelete: s.canPermanentDelete } : null),
        createdAt: String(s.createdAt ?? new Date().toISOString()),
        updatedAt: s.updatedAt ? String(s.updatedAt) : undefined,
      }));

      setStories(mapped);
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

  // Apply date presets → update custom date range inputs.
  useEffect(() => {
    const now = new Date();

    if (datePreset === 'allTime') {
      setDateFrom('');
      setDateTo('');
      return;
    }

    if (datePreset === 'custom') return;

    let from: Date;
    let to: Date;

    if (datePreset === 'today') {
      from = startOfDay(now);
      to = endOfDay(now);
    } else if (datePreset === 'last7') {
      const past = new Date(now);
      past.setDate(past.getDate() - 6);
      from = startOfDay(past);
      to = endOfDay(now);
    } else if (datePreset === 'thisMonth') {
      from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      to = endOfDay(now);
    } else {
      // thisYear
      from = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      to = endOfDay(now);
    }

    const iso = (d: Date) => d.toISOString().slice(0, 10);
    setDateFrom(iso(from));
    setDateTo(iso(to));
  }, [datePreset]);

  const enrichedStories = useMemo(() => {
    return (stories || []).map((s) => {
      const reporterName = normalizeReporterName(s);
      const createdAtMs = toMs(s.createdAt);
      const updatedAtMs = toMs(s.updatedAt) || createdAtMs;
      const normalizedStatus = safeText(s.status).toLowerCase();
      const published = Boolean(s.published || normalizedStatus === 'published' || safeText(s.linkedArticleStatus).toLowerCase() === 'published');
      return {
        ...s,
        reporterName: s.reporterName || reporterName,
        published,
        _createdAtMs: createdAtMs,
        _updatedAtMs: updatedAtMs,
        _statusNorm: normalizedStatus,
      } as any;
    });
  }, [stories]);

  const uniqueFilters = useMemo(() => {
    const reporters = new Set<string>();
    const languages = new Set<string>();
    const categories = new Set<string>();
    const cities = new Set<string>();
    const districts = new Set<string>();
    const states = new Set<string>();

    for (const s of enrichedStories as any[]) {
      const r = safeText(s.reporterName) || safeText(s.reporterEmail);
      if (r) reporters.add(r);
      const lang = safeText(s.language);
      if (lang) languages.add(lang.toUpperCase());
      const cat = safeText(s.category);
      if (cat) categories.add(cat);
      const city = safeText(s.city);
      if (city) cities.add(city);
      const d = safeText(s.district);
      if (d) districts.add(d);
      const st = safeText(s.state);
      if (st) states.add(st);
    }

    const sort = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });
    return {
      reporters: Array.from(reporters).sort(sort),
      languages: Array.from(languages).sort(sort),
      categories: Array.from(categories).sort(sort),
      cities: Array.from(cities).sort(sort),
      districts: Array.from(districts).sort(sort),
      states: Array.from(states).sort(sort),
    };
  }, [enrichedStories]);

  const filteredNoDate = useMemo(() => {
    const q = safeText(searchQuery).toLowerCase();
    const reporterQ = safeText(reporterFilter).toLowerCase();

    return (enrichedStories as any[]).filter((s) => {
      // Archive mode: focus on rejected/withdrawn/removed (but keep filters flexible)
      if (viewMode === 'archive') {
        const st = String(s._statusNorm || '').toLowerCase();
        const inArchive = st.includes('rejected') || st.includes('withdrawn') || st.includes('removed') || st.includes('deleted') || st.includes('archived');
        if (!inArchive) return false;
      }

      if (q) {
        const hay = [s.headline, s.reporterName, s.reporterEmail, s.category, s.city, s.district, s.state, s.sourceId]
          .map((x) => safeText(x).toLowerCase())
          .join(' | ');
        if (!hay.includes(q)) return false;
      }

      if (reporterQ) {
        const r = (safeText(s.reporterName) || safeText(s.reporterEmail)).toLowerCase();
        if (!r.includes(reporterQ)) return false;
      }

      if (statusFilter !== 'all') {
        const st = String(s._statusNorm || '').toLowerCase();
        if (statusFilter === 'published') {
          if (!s.published) return false;
        } else {
          if (!st.includes(statusFilter)) return false;
        }
      }

      if (publicationStatusFilter !== 'all') {
        if (publicationStatusFilter === 'published' && !s.published) return false;
        if (publicationStatusFilter === 'not_published' && s.published) return false;
      }

      if (languageFilter !== 'all') {
        if (safeText(s.language).toUpperCase() !== String(languageFilter).toUpperCase()) return false;
      }

      if (categoryFilter !== 'all') {
        if (safeText(s.category).toLowerCase() !== String(categoryFilter).toLowerCase()) return false;
      }

      if (cityFilter !== 'all') {
        if (safeText(s.city).toLowerCase() !== String(cityFilter).toLowerCase()) return false;
      }
      if (districtFilter !== 'all') {
        if (safeText(s.district).toLowerCase() !== String(districtFilter).toLowerCase()) return false;
      }
      if (stateFilter !== 'all') {
        if (safeText(s.state).toLowerCase() !== String(stateFilter).toLowerCase()) return false;
      }

      return true;
    });
  }, [enrichedStories, searchQuery, reporterFilter, statusFilter, publicationStatusFilter, languageFilter, categoryFilter, cityFilter, districtFilter, stateFilter, viewMode]);

  const filteredStories = useMemo(() => {
    const from = parseDateInput(dateFrom);
    const to = parseDateInput(dateTo);
    const fromMs = from ? startOfDay(from).getTime() : null;
    const toMsVal = to ? endOfDay(to).getTime() : null;

    const out = filteredNoDate.filter((s: any) => {
      if (fromMs == null && toMsVal == null) return true;
      const t = Number(s._createdAtMs || 0);
      if (!t) return false;
      if (fromMs != null && t < fromMs) return false;
      if (toMsVal != null && t > toMsVal) return false;
      return true;
    });

    // Default desk sort: newest first.
    out.sort((a: any, b: any) => Number(b._createdAtMs || 0) - Number(a._createdAtMs || 0));
    return out as AdminCommunityStory[];
  }, [filteredNoDate, dateFrom, dateTo]);

  const groups: StoryDeskGroup[] = useMemo(() => {
    const items = filteredStories as any[];
    if (groupBy === 'none') {
      return [{ key: 'all', label: 'All stories', items: filteredStories }];
    }

    const map = new Map<string, { label: string; items: AdminCommunityStory[] }>();
    const ensure = (key: string, label: string) => {
      if (!map.has(key)) map.set(key, { label, items: [] });
      return map.get(key)!;
    };

    for (const s of items) {
      const created = new Date((s as any).createdAt);
      const createdOk = !Number.isNaN(created.getTime());

      if (groupBy === 'month') {
        const d = createdOk ? created : new Date(0);
        const k = monthKey(d);
        ensure(k, createdOk ? monthLabel(d) : 'Unknown month').items.push(s);
      } else if (groupBy === 'year') {
        const y = createdOk ? String(created.getFullYear()) : 'Unknown year';
        ensure(y, y).items.push(s);
      } else if (groupBy === 'reporter') {
        const r = normalizeReporterName(s) || safeText((s as any).reporterEmail) || 'Unknown reporter';
        ensure(r.toLowerCase(), r).items.push(s);
      } else if (groupBy === 'status') {
        const st = safeText((s as any).status) || 'Unknown status';
        ensure(st.toLowerCase(), st).items.push(s);
      } else {
        const cat = safeText((s as any).category) || 'Uncategorized';
        ensure(cat.toLowerCase(), cat).items.push(s);
      }
    }

    const out: StoryDeskGroup[] = Array.from(map.entries()).map(([key, v]) => ({ key, label: v.label, items: v.items }));
    // Stable ordering: month/year newest first; others alpha.
    if (groupBy === 'month' || groupBy === 'year') {
      out.sort((a, b) => b.key.localeCompare(a.key));
    } else {
      out.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
    }
    // Ensure group items are newest first.
    out.forEach((g) => g.items.sort((a: any, b: any) => Number((b as any)._createdAtMs || 0) - Number((a as any)._createdAtMs || 0)));
    return out;
  }, [filteredStories, groupBy]);

  const summary: StoryDeskSummary = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime();

    let approved = 0;
    let pending = 0;
    let rejected = 0;
    let withdrawn = 0;
    let published = 0;
    let thisMonth = 0;
    let lastMs = 0;

    for (const s of filteredNoDate as any[]) {
      const st = String(s._statusNorm || '').toLowerCase();
      if (st.includes('approved')) approved += 1;
      else if (st.includes('rejected')) rejected += 1;
      else if (st.includes('withdrawn')) withdrawn += 1;
      else if (st.includes('pending') || st.includes('submitted') || st.includes('under_review') || st.includes('review')) pending += 1;
      // published computed separately
      if (s.published) published += 1;

      const t = Number(s._createdAtMs || 0);
      if (t && t >= monthStart) thisMonth += 1;
      if (t && t > lastMs) lastMs = t;
    }

    const lastSubmissionLabel = lastMs ? new Date(lastMs).toLocaleString() : '—';

    // Total stories card reflects date range (what you’re looking at)
    const total = filteredStories.length;
    const approvedInRange = filteredStories.filter((s: any) => String((s as any)._statusNorm || '').includes('approved')).length;
    const pendingInRange = filteredStories.filter((s: any) => {
      const st = String((s as any)._statusNorm || '').toLowerCase();
      return st.includes('pending') || st.includes('submitted') || st.includes('under_review') || st.includes('review');
    }).length;
    const rejectedInRange = filteredStories.filter((s: any) => String((s as any)._statusNorm || '').includes('rejected')).length;
    const withdrawnInRange = filteredStories.filter((s: any) => String((s as any)._statusNorm || '').includes('withdrawn')).length;
    const publishedInRange = filteredStories.filter((s: any) => Boolean((s as any).published)).length;

    return {
      total,
      approved: approvedInRange,
      pending: pendingInRange,
      rejected: rejectedInRange,
      withdrawn: withdrawnInRange,
      published: publishedInRange,
      thisMonth,
      lastSubmissionLabel,
    };
  }, [filteredNoDate, filteredStories]);

  return (
    <div className="px-6 py-4 max-w-[1400px] mx-auto space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Community Story Desk</h1>
          <p className="mt-1 text-sm text-slate-600">Founder/Admin oversight for reporter-owned Community Reporter submissions, status history, and follow-up actions.</p>
          <p className="mt-1 text-xs text-slate-500">
            Live site content (publish/unpublish/archive/delete) is managed in{' '}
            <a href="/admin/manage-news" className="underline hover:text-slate-700">Manage News Articles</a>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadStories()}
            className="text-sm px-3 py-2 rounded-md border border-slate-300 bg-white hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
      </div>

      <StoryDeskSummaryCards summary={summary} />

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-slate-200 overflow-hidden">
            {([
              { key: 'table', label: 'Table' },
              { key: 'timeline', label: 'Timeline' },
              { key: 'archive', label: 'Deleted' },
            ] as Array<{ key: ViewMode; label: string }>).map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setViewMode(m.key)}
                className={`px-3 py-1.5 text-sm ${viewMode === m.key ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <label className="text-xs text-slate-600">Group</label>
            <select
              className="text-sm border rounded-md px-2 py-1.5 bg-white"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupBy)}
            >
              <option value="none">None</option>
              <option value="month">By Month</option>
              <option value="year">By Year</option>
              <option value="reporter">By Reporter</option>
              <option value="status">By Status</option>
              <option value="category">By Category</option>
            </select>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600">Date</span>
              <div className="flex flex-wrap items-center gap-1">
                {(
                  [
                    { key: 'today', label: 'Today' },
                    { key: 'last7', label: '7D' },
                    { key: 'thisMonth', label: 'This Month' },
                    { key: 'thisYear', label: 'This Year' },
                    { key: 'allTime', label: 'All Time' },
                    { key: 'custom', label: 'Custom Range' },
                  ] as Array<{ key: DatePreset; label: string }>
                ).map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setDatePreset(p.key)}
                    className={`px-2.5 py-1.5 rounded-md border text-xs ${datePreset === p.key ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {datePreset === 'custom' ? (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-600">From</label>
              <input
                type="date"
                className="text-sm border rounded-md px-2 py-1.5"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-600">To</label>
              <input
                type="date"
                className="text-sm border rounded-md px-2 py-1.5"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="space-y-1">
            <div className="text-xs text-slate-600">Search</div>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Title, reporter, location, source id…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <div className="text-xs text-slate-600">Reporter</div>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              list="np_reporters"
              placeholder="Name or email…"
              value={reporterFilter}
              onChange={(e) => setReporterFilter(e.target.value)}
            />
            <datalist id="np_reporters">
              {uniqueFilters.reporters.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-slate-600">Status</div>
            <select className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Deleted</option>
              <option value="published">Published</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
          <div className="space-y-1">
            <div className="text-xs text-slate-600">Publication status</div>
            <select className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm bg-white" value={publicationStatusFilter} onChange={(e) => setPublicationStatusFilter(e.target.value as PubStatusFilter)}>
              <option value="all">All</option>
              <option value="published">Published</option>
              <option value="not_published">Not published</option>
            </select>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-slate-600">Language</div>
            <select className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm bg-white" value={languageFilter} onChange={(e) => setLanguageFilter(e.target.value)}>
              <option value="all">All</option>
              {uniqueFilters.languages.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-slate-600">Category</div>
            <select className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm bg-white" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="all">All</option>
              {uniqueFilters.categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-slate-600">City</div>
            <select className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm bg-white" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
              <option value="all">All</option>
              {uniqueFilters.cities.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-slate-600">District</div>
            <select className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm bg-white" value={districtFilter} onChange={(e) => setDistrictFilter(e.target.value)}>
              <option value="all">All</option>
              {uniqueFilters.districts.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-slate-600">State</div>
            <select className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm bg-white" value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
              <option value="all">All</option>
              {uniqueFilters.states.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="col-span-2 md:col-span-2 xl:col-span-2 space-y-1">
            <div className="text-xs text-slate-600">Optional columns</div>
            <div className="flex flex-wrap gap-3 text-xs text-slate-700">
              {(
                [
                  { k: 'district', label: 'District' },
                  { k: 'state', label: 'State' },
                  { k: 'views', label: 'Views' },
                  { k: 'reporterEmail', label: 'Reporter Email' },
                  { k: 'sourceId', label: 'Source ID' },
                ] as Array<{ k: keyof StoryDeskColumns; label: string }>
              ).map((c) => (
                <label key={c.k} className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!columns[c.k]}
                    onChange={(e) => setColumns((prev) => ({ ...prev, [c.k]: e.target.checked }))}
                  />
                  {c.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500">
          <div>
            Loaded: {stories.length} · Matching (no date): {filteredNoDate.length} · In range: {filteredStories.length}
          </div>
          {!isFounderOrAdmin ? (
            <div className="text-amber-700">Some actions require Founder/Admin.</div>
          ) : null}
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-600">Loading community stories…</div>
      ) : error ? (
        <div className="rounded-xl border border-red-300 bg-red-50 p-8 text-sm text-red-700">{error}</div>
      ) : (
        <>
          {viewMode === 'table' || viewMode === 'archive' ? (
            <StoryDeskTable
              groups={groups}
              columns={columns}
              canMutate={isFounderOrAdmin}
              canHardDelete={isFounderOrAdmin}
              onAction={async (a) => {
                const story = a.story;
                if (a.type === 'view') {
                  navigate(`/admin/community-reporter/${encodeURIComponent(story.id)}?from=my-stories`);
                  return;
                }
                if (a.type === 'edit') {
                  const url = `/admin/community-reporter/${encodeURIComponent(story.id)}?from=my-stories`;
                  window.open(url, '_blank', 'noopener,noreferrer');
                  return;
                }
                if (a.type === 'openPublic') {
                  const slug = safeText(story.linkedArticleSlug);
                  if (!slug) return;
                  const url = `${PUBLIC_SITE_ORIGIN}/story/${encodeURIComponent(slug)}`;
                  window.open(url, '_blank', 'noopener,noreferrer');
                  return;
                }
                if (a.type === 'openAdminArticle') {
                  const id = safeText(story.linkedArticleId);
                  if (!id) return;
                  const url = `/admin/articles/${encodeURIComponent(id)}/edit`;
                  window.open(url, '_blank', 'noopener,noreferrer');
                  return;
                }

                if (!isFounderOrAdmin) {
                  notify?.error?.('Founder/Admin required for this action');
                  return;
                }

                if (a.type === 'moveToDeleted') {
                  if (!canSoftDeleteRecord(story)) {
                    notify?.error?.('Cannot move this community record to Deleted');
                    return;
                  }
                  try {
                    await moveCommunityStoryRecordToDeleted(story.id);
                    notify?.ok?.('Community record moved to Deleted', 'Linked live site visibility is not changed');
                    await loadStories();
                  } catch (e: any) {
                    notify?.error?.(e?.message || 'Failed to move community record to Deleted');
                  }
                  return;
                }

                if (a.type === 'restore') {
                  if (!canRestoreRecord(story)) {
                    notify?.error?.('Cannot restore this community record');
                    return;
                  }
                  try {
                    await restoreCommunityStoryRecord(story.id);
                    notify?.ok?.('Community record restored', 'Linked live site visibility is not changed');
                    await loadStories();
                  } catch (e: any) {
                    notify?.error?.(e?.message || 'Restore not supported for this community record');
                  }
                  return;
                }

                if (a.type === 'deletePermanently') {
                  if (!canPermanentDeleteRecord(story)) {
                    notify?.error?.('Move the community record to Deleted before permanent delete');
                    return;
                  }
                  setPermanentDeleteTyped('');
                  setPermanentDeleteTarget(story);
                  return;
                }
              }}
            />
          ) : (
            <StoryDeskTimeline
              groups={groups}
              onView={(s) => navigate(`/admin/community-reporter/${encodeURIComponent(s.id)}?from=my-stories`)}
            />
          )}
        </>
      )}

      <ConfirmModal
        open={!!permanentDeleteTarget}
        title="Delete community record permanently?"
        confirmLabel="Delete Permanently"
        confirmVariant="danger"
        confirmDisabled={
          permanentDeleteBusy ||
          !permanentDeleteTarget ||
          String(permanentDeleteTyped || '').trim().toUpperCase() !== 'DELETE'
        }
        confirmBusyLabel={permanentDeleteBusy ? 'Deleting…' : undefined}
        onCancel={() => {
          if (permanentDeleteBusy) return;
          setPermanentDeleteTarget(null);
          setPermanentDeleteTyped('');
        }}
        onConfirm={async () => {
          if (!permanentDeleteTarget || permanentDeleteBusy) return;

          if (!isFounderOrAdmin) {
            notify?.error?.('Founder/Admin required for this action');
            return;
          }

          const canPermanentDelete = canPermanentDeleteRecord(permanentDeleteTarget);
          if (!canPermanentDelete) {
            notify?.error?.('Move the community record to Deleted before permanent delete');
            return;
          }

          if (String(permanentDeleteTyped || '').trim().toUpperCase() !== 'DELETE') return;

          setPermanentDeleteBusy(true);
          try {
            await permanentlyDeleteCommunityStoryRecord(permanentDeleteTarget.id);
            notify?.ok?.('Community record deleted permanently', 'Linked live site content is not deleted/unpublished');
            setPermanentDeleteTarget(null);
            setPermanentDeleteTyped('');
            await loadStories();
          } catch (e: any) {
            notify?.error?.(e?.message || 'Failed to delete permanently');
          } finally {
            setPermanentDeleteBusy(false);
          }
        }}
      >
        <div className="space-y-3">
          <div className="text-sm text-slate-700">This will permanently remove the community story record from Community Story Desk and cannot be undone.</div>
          <div className="text-xs text-slate-600">
            This does <span className="font-semibold">not</span> delete or unpublish any linked live site article. To remove live site content, use{' '}
            <a href="/admin/manage-news" className="underline hover:text-slate-700">Manage News Articles</a>.
          </div>
          <div className="space-y-1">
            <div className="text-xs text-slate-600">Type <span className="font-semibold">DELETE</span> to confirm</div>
            <input
              value={permanentDeleteTyped}
              onChange={(e) => setPermanentDeleteTyped(e.target.value)}
              placeholder="DELETE"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="characters"
              spellCheck={false}
              disabled={permanentDeleteBusy}
            />
          </div>
        </div>
      </ConfirmModal>
    </div>
  );
};

export default MyCommunityStoriesPage;


// Removed unused RowActions legacy block

