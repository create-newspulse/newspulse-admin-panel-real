import { useLocation, useNavigate } from 'react-router-dom';
import { useMemo, useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy as CopyIcon, RefreshCw } from 'lucide-react';
import { useNotify } from '@/components/ui/toast-bridge';
import ConfirmModal from '@/components/ui/ConfirmModal';
import ReporterProfileDrawer from '@/components/community/ReporterProfileDrawer.tsx';
import ReporterStoriesDrawer from '@/components/community/ReporterStoriesDrawer.tsx';
import { rebuildReporterDirectory, bulkDeleteReporterContacts, deleteReporterContact, listReporterContactsAll, type ReporterContact } from '@/lib/api/reporterDirectory.ts';
import { useAuth } from '@/context/AuthContext.tsx';

// Deprecated: legacy activity from lastStoryAt removed in favor of backend activity field

// Helper: treat any variant of "All…" as no filter
const isAllFilter = (value?: string | null) => {
  if (!value) return true;
  const v = value.toString().trim().toLowerCase();
  if (v === 'all' || v === 'all activity') return true;
  if (v.startsWith('all ')) return true; // e.g., "all states", "all countries"
  return false;
};

// Normalize any non-string value into a displayable string and extract nested keys if present.
function norm(val: any, prefer?: 'city'|'state'|'country'): string {
  if (val == null) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    const city = (val.city && typeof val.city === 'string') ? val.city : '';
    const state = (val.state && typeof val.state === 'string') ? val.state : '';
    const country = (val.country && typeof val.country === 'string') ? val.country : '';
    if (prefer === 'city') return city;
    if (prefer === 'state') return state;
    if (prefer === 'country') return country;
    const parts = [city, state, country].filter(Boolean);
    return parts.join(', ');
  }
  try { return String(val); } catch { return ''; }
}

export default function ReporterContactDirectory() {
  const STORAGE_KEY = 'reporterDirectoryPreferences';
  const STORAGE_KEY_UI = 'reporterDirectoryUiPreferences';
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  // Primary filter states declared first to avoid block-scope usage errors
  const [typeFilter, setTypeFilter] = useState<'all' | 'community' | 'journalist'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blocked' | 'archived'>('all');
  const [hasNotesOnly, setHasNotesOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [stateVal, setStateVal] = useState<string | undefined>(undefined);
  const [cityVal, setCityVal] = useState<string | undefined>(undefined);
  const [countryVal, setCountryVal] = useState<string | undefined>(undefined);
  const [districtFilter, setDistrictFilter] = useState<'all' | string>('all');
  const [areaTypeFilter, setAreaTypeFilter] = useState<'all' | 'metro' | 'corporation' | 'district_hq' | 'taluka' | 'village' | 'other'>('all');
  const [beatFilter, setBeatFilter] = useState<'all' | string>('all');
  const notify = (useNotify?.() as unknown) as { ok: (msg: string, sub?: string) => void; error: (msg: string) => void } | undefined;
  const [sortBy, setSortBy] = useState<undefined | 'name' | 'stories' | 'lastStory' | 'activity'>(undefined);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const { user } = useAuth();

  type DirectoryTab = 'table' | 'coverage' | 'timeline' | 'archive';
  const [directoryTab, setDirectoryTab] = useState<DirectoryTab>('table');
  const lastNonArchiveStatusRef = useRef<typeof statusFilter>('all');
  const [showFounderColumns, setShowFounderColumns] = useState(false);
  const [profileStartTab, setProfileStartTab] = useState<'overview' | 'contact' | 'coverage' | 'stories' | 'notes' | 'tasks' | 'activity'>('overview');

  const resolvedRole = useMemo(() => {
    const fromUser = String(user?.role || '').trim().toLowerCase();
    if (fromUser) return fromUser;
    try {
      if (typeof window === 'undefined') return '';
      const raw = window.localStorage.getItem('newsPulseAdminAuth');
      if (!raw) return '';
      const parsed = JSON.parse(raw);
      return String(parsed?.role || '').trim().toLowerCase();
    } catch {
      return '';
    }
  }, [user?.role]);

  const canDelete = resolvedRole === 'founder' || resolvedRole === 'admin';

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [backfillOpen, setBackfillOpen] = useState(false);
  const backfillMutation = useMutation({
    mutationFn: rebuildReporterDirectory,
    onSuccess: async (result) => {
      const used = String((result as any)?.endpointUsed || '').trim();
      const upserted = Number((result as any)?.upserted ?? 0) || 0;
      const skippedNoEmail = Number((result as any)?.skippedNoEmail ?? 0) || 0;
      const suffix = used ? ` (via ${used})` : '';
      notify?.ok?.(`Directory rebuild completed${suffix}: ${upserted} updated. Skipped: ${skippedNoEmail}.`);
      setBackfillOpen(false);

      // Clear selection; ids may change after rebuild.
      setSelectedIds(new Set());

      // Refresh the directory list immediately.
      await queryClient.refetchQueries({ queryKey: ['reporter-contacts'], type: 'active' });
      setRefreshTick((t) => t + 1);

      // If backend still returns 0 rows, log cached query data so we can distinguish backend vs UI issues.
      if (import.meta.env.DEV) {
        try {
          const snapshots = queryClient
            .getQueriesData({ queryKey: ['reporter-contacts'] })
            .map(([k, v]) => ({ key: k, total: (v as any)?.total, items: ((v as any)?.items || (v as any)?.rows || [])?.length }));
          // eslint-disable-next-line no-console
          console.log('[ReporterContactDirectory] after backfill refetch', snapshots);
        } catch {
          // ignore
        }
      }
    },
    onError: (err: any) => {
      notify?.error?.(err?.message || 'Backfill failed');
    },
  });

  // Query backend for reporter contacts (paginated, large page to reduce client fetches)
  const [refreshTick, setRefreshTick] = useState(0);

  // Fetch via admin reporters API whenever filters/search change
  // Note: depends on filter states declared below; place after declarations to avoid TS block-scope issues
  // The actual effect is defined later after filter state hooks.


  // Derive unique sets from current dataset (computed after items are defined)

  // Removed auto-default country selection to avoid unintended filtering

  // Client-side filtered reporters
  const [activityFilter, setActivityFilter] = useState<'all' | 'active' | 'inactive' | 'new' | 'on_leave' | 'blacklisted'>('all');
  const [verificationFilter, setVerificationFilter] = useState<'All'|'Verified'|'Pending'|'Limited'|'Revoked'|'Unverified'|'Community Default'>('All');

  const [viewFilter, setViewFilter] = useState<
    | 'all'
    | 'missing_email'
    | 'missing_phone'
    | 'missing_location'
    | 'unresolved_identity'
    | 'no_stories'
    | 'inactive_30'
    | 'inactive_60'
    | 'inactive_90'
  >('all');

  // Fetch data via useQuery after all filter states are declared
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['reporter-contacts', {
      country: countryVal, state: stateVal, city: cityVal, district: districtFilter,
      area: areaTypeFilter, beat: beatFilter, type: typeFilter, verification: verificationFilter,
      status: statusFilter, activity: activityFilter, hasNotes: hasNotesOnly, searchQuery, refreshTick
    }],
    queryFn: async () => {
      const params: Parameters<typeof listReporterContactsAll>[0] = { limit: 500 };

      const q = String(searchQuery || '').trim();
      if (q) params.search = q;

      if (countryVal && !isAllFilter(countryVal)) params.country = String(countryVal);
      if (stateVal && !isAllFilter(stateVal)) params.state = String(stateVal);
      if (cityVal && !isAllFilter(cityVal)) params.city = String(cityVal);

      if (typeFilter !== 'all') params.type = typeFilter;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (hasNotesOnly) params.hasNotes = true;

      if (sortBy === 'lastStory') params.sortBy = 'lastStoryAt';
      if (sortBy === 'stories') params.sortBy = 'totalStories';
      if (sortBy === 'lastStory' || sortBy === 'stories') params.sortDir = sortDirection;

      return await listReporterContactsAll(params);
    },
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
  });
  const reporters: ReporterContact[] = (data?.items as ReporterContact[]) ?? (data?.rows as ReporterContact[]) ?? [];
  const items = reporters;
  const total = typeof data?.total === 'number' ? data.total : reporters.length;
  const unauthorized = (error as any)?.isUnauthorized === true || (error as any)?.status === 401;

  // Stories drawer state
  const [storiesTarget, setStoriesTarget] = useState<ReporterContact | null>(null);

  const bulkDeleteInFlightRef = useRef(false);

  const contactDeleteId = (r: ReporterContact): string => {
    const raw = (r as any)?._id ?? (r as any)?.contactId ?? (r as any)?.contactRecordId ?? (r as any)?.contactRecordID ?? r.contactId ?? '';
    return String(raw || '').trim();
  };

  // IMPORTANT DEBUG: if Delete Contact button is not visible, log once in DEV.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (typeof window === 'undefined') return;
    const w: any = window as any;
    if (w.__npReporterDirectoryDeleteGateLogged) return;
    if (canDelete) return;

    const first = items?.[0] as any;
    const rawId = first ? String(first._id || first.id || '').trim() : '';
    const hasValidId = !!rawId && !rawId.startsWith('tmp_');
    w.__npReporterDirectoryDeleteGateLogged = true;
    // eslint-disable-next-line no-console
    console.log('[ReporterContactDirectory] delete gate', {
      role: resolvedRole,
      canDelete,
      hasValidId,
      sampleId: rawId || null,
    });
  }, [canDelete, resolvedRole, items]);

  // Derive unique sets from current dataset (computed after items are defined)
  const uniqueCountries = useMemo(() => ['All countries', ...Array.from(new Set(items.map(i => norm(i.country, 'country')).filter(Boolean))).sort()], [items]);
  const uniqueStates = useMemo(() => {
    const base = countryVal && countryVal !== 'All countries'
      ? items.filter(i => norm(i.country, 'country').toLowerCase() === (countryVal as string).toLowerCase())
      : items;
    return ['All states', ...Array.from(new Set(base.map(i => norm(i.state, 'state')).filter(Boolean))).sort()];
  }, [items, countryVal]);
  const filteredCities = useMemo(() => {
    const base = items.filter(i => {
      const ctry = norm(i.country, 'country').toLowerCase();
      const st = norm(i.state, 'state').toLowerCase();
      if (countryVal && countryVal !== 'All countries' && ctry !== (countryVal as string).toLowerCase()) return false;
      if (stateVal && stateVal !== 'All states' && st !== (stateVal as string).toLowerCase()) return false;
      return true;
    });
    return ['All cities', ...Array.from(new Set(base.map(i => norm(i.city, 'city')).filter(Boolean))).sort()];
  }, [items, countryVal, stateVal]);
  const filteredDistricts = useMemo(() => {
    const base = items.filter(i => {
      const ctry = norm(i.country, 'country').toLowerCase();
      const st = norm(i.state, 'state').toLowerCase();
      if (countryVal && countryVal !== 'All countries' && ctry !== (countryVal as string).toLowerCase()) return false;
      if (stateVal && stateVal !== 'All states' && st !== (stateVal as string).toLowerCase()) return false;
      return true;
    });
    const set = new Set<string>();
    base.forEach(i => { const d = String((i as any).district || '').trim(); if (d) set.add(d); });
    return ['All districts', ...Array.from(set).sort()];
  }, [items, countryVal, stateVal]);

  // Load preferences on mount (browser-only)
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data && typeof data === 'object') {
        if (typeof data.searchQuery === 'string') setSearchQuery(data.searchQuery);
        // Normalize legacy persisted values like "All countries" -> undefined / 'all'
        if (typeof data.countryVal === 'string' || data.countryVal === undefined) {
          const v = data.countryVal;
          setCountryVal(typeof v === 'string' && isAllFilter(v) ? undefined : v);
        }
        if (typeof data.stateVal === 'string' || data.stateVal === undefined) {
          const v = data.stateVal;
          setStateVal(typeof v === 'string' && isAllFilter(v) ? undefined : v);
        }
        if (typeof data.cityVal === 'string' || data.cityVal === undefined) {
          const v = data.cityVal;
          setCityVal(typeof v === 'string' && isAllFilter(v) ? undefined : v);
        }
        if (typeof data.districtFilter === 'string') {
          const v = String(data.districtFilter);
          setDistrictFilter(isAllFilter(v) ? 'all' : v);
        }
        if (typeof data.areaTypeFilter === 'string') setAreaTypeFilter(data.areaTypeFilter);
        if (typeof data.beatFilter === 'string') {
          const v = String(data.beatFilter);
          setBeatFilter(isAllFilter(v) ? 'all' : v);
        }
        if (typeof data.hasNotesOnly === 'boolean') setHasNotesOnly(data.hasNotesOnly);
        if (typeof data.activityFilter === 'string') setActivityFilter(data.activityFilter);
        if (typeof data.sortBy === 'string' || data.sortBy === undefined) setSortBy(data.sortBy);
        if (data.sortDirection === 'asc' || data.sortDirection === 'desc') setSortDirection(data.sortDirection);
      }
    } catch {}
  }, []);

  // Load UI prefs (e.g., founder-only columns)
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const raw = window.localStorage.getItem(STORAGE_KEY_UI);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data && typeof data === 'object') {
        if (typeof data.showFounderColumns === 'boolean') setShowFounderColumns(data.showFounderColumns);
      }
    } catch {}
  }, []);

  // Persist preferences whenever they change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const prefs = {
      searchQuery,
      countryVal,
      stateVal,
      cityVal,
      districtFilter,
      areaTypeFilter,
      beatFilter,
      hasNotesOnly,
      activityFilter,
      sortBy,
      sortDirection,
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {}
  }, [searchQuery, countryVal, stateVal, cityVal, districtFilter, areaTypeFilter, beatFilter, hasNotesOnly, activityFilter, sortBy, sortDirection]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const prefs = { showFounderColumns };
    try {
      window.localStorage.setItem(STORAGE_KEY_UI, JSON.stringify(prefs));
    } catch {}
  }, [showFounderColumns]);

  // Remove legacy effect-based fetch; useQuery handles loading + error

  // moved to module scope

  // Unified, permissive filter logic per spec
  type Filters = {
    country: string;
    state: string;
    district: string;
    city: string;
    area: string;
    beat: string;
    type: string;
    verification: string;
    status: string;
    activity: string;
    hasNotes: boolean;
  };
  const reporterMatchesFilters = (r: ReporterContact, filters: Filters, search: string): boolean => {
    const normL = (v?: string | null) => (v || '').toLowerCase();

    // country/state/district/city/area
    if (filters.country !== 'all' && normL(r.country) !== normL(filters.country)) return false;
    if (filters.state !== 'all' && normL(r.state) !== normL(filters.state)) return false;
    if (filters.district !== 'all' && normL((r as any).district) !== normL(filters.district)) return false;
    if (filters.city !== 'all' && normL(r.city) !== normL(filters.city)) return false;
    if (filters.area !== 'all' && normL((r as any).areaType) !== normL(filters.area)) return false;

    // beat
    if (filters.beat !== 'all beats' && filters.beat !== 'all') {
      if (normL((r as any).beat) !== normL(filters.beat)) return false;
    }

    // type / verification / status
    if (filters.type !== 'all' && normL((r as any).type || (r as any).reporterType) !== normL(filters.type)) return false;
    if (filters.verification !== 'all' && normL((r as any).verificationStatus || (r as any).verificationLevel) !== normL(filters.verification)) return false;
    if (filters.status !== 'all' && normL((r as any).status) !== normL(filters.status)) return false;

    // activity – only filter when not "all activity"
    if (filters.activity !== 'all activity' && filters.activity !== 'all') {
      const hasAnyStory = (r.totalStories ?? 0) > 0 || !!r.lastStoryAt;
      const isActive = hasAnyStory;
      if (filters.activity === 'active' && !isActive) return false;
      if (filters.activity === 'inactive' && isActive) return false;
    }

    // hasNotes
    if (filters.hasNotes && !(r.notes || (r as any).privateNotes || '').trim()) return false;

    // search
    const q = (search || '').trim().toLowerCase();
    if (q) {
      const haystack = [
        r.name,
        r.email,
        r.phone,
        r.city,
        r.state,
        r.country,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  };

  const filters: Filters = {
    country: (countryVal && !isAllFilter(countryVal) ? String(countryVal).toLowerCase() : 'all'),
    state: (stateVal && !isAllFilter(stateVal) ? String(stateVal).toLowerCase() : 'all'),
    district: (!isAllFilter(districtFilter) && String(districtFilter || '').toLowerCase() !== 'all' ? String(districtFilter).toLowerCase() : 'all'),
    city: (cityVal && !isAllFilter(cityVal) ? String(cityVal).toLowerCase() : 'all'),
    area: (areaTypeFilter ? String(areaTypeFilter).toLowerCase() : 'all'),
    beat: (beatFilter && !isAllFilter(beatFilter) ? String(beatFilter).toLowerCase() : 'all'),
    type: typeFilter ?? 'all',
    verification: (String(verificationFilter || 'all')).toLowerCase(),
    status: statusFilter ?? 'all',
    activity: activityFilter ?? 'all activity',
    hasNotes: !!hasNotesOnly,
  };

  const filteredReporters = useMemo(() => reporters.filter((r) => reporterMatchesFilters(r, filters, searchQuery)), [reporters, filters, searchQuery]);

  const viewFilteredReporters = useMemo(() => {
    const now = Date.now();
    const ageDays = (iso?: string | null) => {
      const s = String(iso || '').trim();
      if (!s) return Infinity;
      const t = new Date(s).getTime();
      if (!Number.isFinite(t) || t <= 0) return Infinity;
      return (now - t) / (1000 * 60 * 60 * 24);
    };

    return filteredReporters.filter((r) => {
      if (viewFilter === 'all') return true;
      if (viewFilter === 'missing_email') return !String(r.email || '').trim();
      if (viewFilter === 'missing_phone') return !String(r.phone || '').trim();
      if (viewFilter === 'missing_location') return !String(r.city || '').trim() && !String(r.state || '').trim() && !String(r.country || '').trim();
      if (viewFilter === 'unresolved_identity') {
        const hasName = !!String(r.name || '').trim();
        const hasAnyContact = !!String(r.email || '').trim() || !!String(r.phone || '').trim();
        return !hasName || !hasAnyContact;
      }
      if (viewFilter === 'no_stories') return Number(r.totalStories || 0) <= 0;
      const last = (r as any).lastSubmissionAt || r.lastStoryAt;
      if (viewFilter === 'inactive_30') return ageDays(last) >= 30;
      if (viewFilter === 'inactive_60') return ageDays(last) >= 60;
      if (viewFilter === 'inactive_90') return ageDays(last) >= 90;
      return true;
    });
  }, [filteredReporters, viewFilter]);

  const contactsById = useMemo(() => {
    return new Map(
      viewFilteredReporters.map((r) => [r.id, { id: r.id, reporterKey: r.reporterKey || null, email: r.email || null }] as const)
    );
  }, [viewFilteredReporters]);

  // Intentionally avoid noisy debug logging here; this page is founder/admin-facing.

  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteBusy, setBulkDeleteBusy] = useState(false);

  const sortedReporters = useMemo(() => {
    const arr = [...viewFilteredReporters];
    if (!sortBy) return arr;
    const dir = sortDirection === 'asc' ? 1 : -1;
    if (sortBy === 'name') {
      arr.sort((a, b) => {
        const an = (a.name || '').toLowerCase();
        const bn = (b.name || '').toLowerCase();
        if (an < bn) return -1 * dir;
        if (an > bn) return 1 * dir;
        return 0;
      });
    } else if (sortBy === 'stories') {
      arr.sort((a, b) => {
        const av = Number(a.totalStories || 0);
        const bv = Number(b.totalStories || 0);
        if (av < bv) return -1 * dir;
        if (av > bv) return 1 * dir;
        return 0;
      });
    } else if (sortBy === 'lastStory') {
      arr.sort((a, b) => {
        const ta = a.lastStoryAt ? new Date(a.lastStoryAt).getTime() : 0;
        const tb = b.lastStoryAt ? new Date(b.lastStoryAt).getTime() : 0;
        if (ta < tb) return -1 * dir;
        if (ta > tb) return 1 * dir;
        return 0;
      });
    } else if (sortBy === 'activity') {
      const rank = { active: 4, new: 3, on_leave: 2, inactive: 1, blacklisted: 0 } as const;
      arr.sort((a, b) => {
        const ra = rank[String((a as any).activity || '').toLowerCase() as keyof typeof rank] ?? -1;
        const rb = rank[String((b as any).activity || '').toLowerCase() as keyof typeof rank] ?? -1;
        if (ra < rb) return -1 * dir;
        if (ra > rb) return 1 * dir;
        return 0;
      });
    }
    return arr;
  }, [viewFilteredReporters, sortBy, sortDirection]);

  function handleSortChange(col: 'name' | 'stories' | 'lastStory' | 'activity') {
    if (sortBy === col) {
      setSortDirection(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      // default to desc where it makes sense
      if (col === 'stories' || col === 'lastStory' || col === 'activity') {
        setSortDirection('desc');
      } else {
        setSortDirection('asc');
      }
    }
  }

  // Expose handler and indicator state to header cells without prop-drilling
  useEffect(() => {
    (window as any).__rc_handleSortChange = (c: 'name' | 'stories' | 'lastStory' | 'activity') => handleSortChange(c);
    (window as any).__rc_sortBy = sortBy;
    (window as any).__rc_sortDir = sortDirection;
  }, [sortBy, sortDirection]);

  // Top reporter highlight removed — no computation needed

  function csvEscape(value: string | number | null | undefined): string {
    const s = value == null ? '' : String(value);
    const needsQuotes = /[",\n]/.test(s);
    const escaped = s.replace(/"/g, '""');
    return needsQuotes ? `"${escaped}"` : escaped;
  }

  function handleExportCsv() {
    const headers = ['Name', 'Email', 'Phone', 'City', 'State', 'Country', 'Stories', 'Last Story'];
    const rows = viewFilteredReporters.map(r => {
      const last = r.lastStoryAt ? new Date(r.lastStoryAt).toLocaleString() : '';
      return [
        r.name || '',
        r.email || '',
        r.phone || '',
        r.city || '',
        r.state || '',
        r.country || '',
        r.totalStories ?? 0,
        last,
      ].map(csvEscape).join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    a.href = url;
    a.download = `reporter-directory-${yyyy}-${mm}-${dd}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Deep-link support: allow story modals/queue to jump into the directory.
  const appliedQueryRef = useRef<{ q?: string; reporterKey?: string } | null>(null);
  useEffect(() => {
    try {
      const sp = new URLSearchParams(location.search || '');
      const q = String(sp.get('q') || '').trim();
      const reporterKey = String(sp.get('reporterKey') || '').trim();
      const open = String(sp.get('open') || '').trim();

      const last = appliedQueryRef.current;
      const changed = (q && q !== last?.q) || (reporterKey && reporterKey !== last?.reporterKey);
      if (!changed) return;

      appliedQueryRef.current = { q: q || last?.q, reporterKey: reporterKey || last?.reporterKey };

      if (q) setSearchQuery(q);

      // If open=1 and we can resolve a reporter from the loaded dataset, open the profile drawer.
      if (open === '1' && reporterKey && reporters.length > 0) {
        const keyLower = reporterKey.toLowerCase();
        const found = reporters.find((r) => {
          const id = String((r as any)._id || r.id || r.reporterKey || '').trim().toLowerCase();
          const email = String(r.email || '').trim().toLowerCase();
          const phone = String(r.phone || '').trim().toLowerCase();
          return id === keyLower || email === keyLower || phone === keyLower;
        });
        if (found) {
          setSelectedReporter(found);
          setIsProfileOpen(true);
        }
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, reporters.length]);

  // Reset city when state changes if city no longer valid
  useEffect(() => {
    if (cityVal && stateVal) {
      const ok = items.some(i => i.state === stateVal && i.city === cityVal);
      if (!ok) setCityVal(undefined);
    }
  }, [stateVal, cityVal, items]);
  const [selectedReporter, setSelectedReporter] = useState<ReporterContact | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [showLocationNav, setShowLocationNav] = useState(false);
  // moved above (used by backfill/bulk actions)

  // Group states with counts (respect country + search so context matches current dataset)
  const stateGroups = useMemo(() => {
    let base = items;
    if (countryVal && countryVal !== 'All countries') {
      base = base.filter(r => (r.country || '').toLowerCase() === countryVal.toLowerCase());
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      base = base.filter(r => [r.name, r.email, r.phone].some(f => (f || '').toLowerCase().includes(q)));
    }
    const map = new Map<string, number>();
    base.forEach(r => {
      const s = (r.state || '').trim();
      if (!s) return;
      map.set(s, (map.get(s) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([state, count]) => ({ state, count }));
  }, [items, countryVal, searchQuery]);

  // Whether we have any states to show (controls sidebar visibility)
  const hasStates = stateGroups.length > 0;

  // Cities for selected state with counts
  const cityGroups = useMemo(() => {
    if (!stateVal || stateVal === 'All states') return [] as { city: string; count: number }[];
    let base = items.filter(r => norm(r.state, 'state').toLowerCase() === stateVal.toLowerCase());
    if (countryVal && countryVal !== 'All countries') {
      base = base.filter(r => norm(r.country, 'country').toLowerCase() === countryVal.toLowerCase());
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      base = base.filter(r => [r.name, r.email, r.phone].some(f => norm(f).toLowerCase().includes(q)));
    }
    const map = new Map<string, number>();
    base.forEach(r => {
      const c = norm(r.city, 'city').trim();
      if (!c) return;
      map.set(c, (map.get(c) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([city, count]) => ({ city, count }));
  }, [items, stateVal, countryVal, searchQuery]);

  const summary = useMemo(() => {
    const base = viewFilteredReporters;
    const totalReporters = base.length;
    const verified = base.filter(r => String(r.verificationLevel || '').toLowerCase() === 'verified').length;
    const missingEmail = base.filter(r => !String(r.email || '').trim()).length;
    const missingPhone = base.filter(r => !String(r.phone || '').trim()).length;
    const missingLocation = base.filter(r => !String(r.city || '').trim() && !String((r as any).district || '').trim() && !String(r.state || '').trim()).length;
    const unresolvedIdentity = base.filter(r => !String(r.name || '').trim() || (!String(r.email || '').trim() && !String(r.phone || '').trim())).length;
    const now = Date.now();
    const daysSince = (iso?: string | null) => {
      const s = String(iso || '').trim();
      if (!s) return Infinity;
      const t = new Date(s).getTime();
      if (!Number.isFinite(t) || t <= 0) return Infinity;
      return (now - t) / (1000 * 60 * 60 * 24);
    };
    const activeThisMonth = base.filter(r => daysSince((r as any).lastSubmissionAt || r.lastStoryAt) <= 31).length;
    const newThisMonth = base.filter(r => String((r as any).activity || '').toLowerCase() === 'new').length;
    const inactive30 = base.filter(r => daysSince((r as any).lastSubmissionAt || r.lastStoryAt) >= 30).length;
    const inactive60 = base.filter(r => daysSince((r as any).lastSubmissionAt || r.lastStoryAt) >= 60).length;
    const inactive90 = base.filter(r => daysSince((r as any).lastSubmissionAt || r.lastStoryAt) >= 90).length;
    const completeProfiles = base.filter(r => String(r.email || '').trim() && String(r.phone || '').trim() && (String(r.city || '').trim() || String((r as any).district || '').trim() || String(r.state || '').trim())).length;
    const lastSubmissionMs = base
      .map(r => new Date(String((r as any).lastSubmissionAt || r.lastStoryAt || '')).getTime())
      .filter(t => Number.isFinite(t) && t > 0)
      .sort((a, b) => b - a)[0];
    const lastSubmissionLabel = lastSubmissionMs ? new Date(lastSubmissionMs).toLocaleString() : '—';
    return {
      totalReporters,
      verified,
      missingEmail,
      missingPhone,
      missingLocation,
      activeThisMonth,
      newThisMonth,
      inactive30,
      inactive60,
      inactive90,
      completeProfiles,
      unresolvedIdentity,
      lastSubmissionLabel,
    };
  }, [viewFilteredReporters]);

  useEffect(() => {
    if (directoryTab !== 'archive') return;
    if (statusFilter !== 'archived') {
      lastNonArchiveStatusRef.current = statusFilter;
      setStatusFilter('archived');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directoryTab]);

  useEffect(() => {
    if (directoryTab === 'archive') return;
    if (statusFilter === 'archived') {
      setStatusFilter(lastNonArchiveStatusRef.current || 'all');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directoryTab]);

  return (
    <div className="px-6 py-4 max-w-7xl mx-auto w-full">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Reporter Contact Directory</h1>
        <p className="text-sm text-slate-600">Founder-grade reporter identity, contact, follow-up, and coverage planning directory.</p>
      </header>

      {unauthorized && (
        <div className="mt-4 p-3 rounded-md border bg-amber-50 text-amber-800">
          You don't have permission to view the Reporter Contact Directory or your session is missing. Please login with an account that has access, or contact an admin.
        </div>
      )}

      {/* Summary */}
      <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <SummaryCard label="Total Reporters" value={summary.totalReporters} />
        <SummaryCard label="Verified" value={summary.verified} />
        <SummaryCard label="Missing Phone" value={summary.missingPhone} />
        <SummaryCard label="Missing Location" value={summary.missingLocation} />
        <SummaryCard label="Active This Month" value={summary.activeThisMonth} />
        <SummaryCard label="New This Month" value={summary.newThisMonth} />
        <SummaryCard label="Last Submission" value={summary.lastSubmissionLabel} isText />
      </div>

      <div className="mt-2 text-xs text-slate-600">
        {summary.completeProfiles} complete · {summary.unresolvedIdentity} unresolved identity · {summary.missingEmail} missing email · {summary.missingPhone} missing phone · {summary.missingLocation} missing location · inactive {summary.inactive30}/{summary.inactive60}/{summary.inactive90} (30/60/90d)
      </div>

      {/* Directory tabs */}
      <div className="mt-6 border-b">
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {([
            { key: 'table', label: 'Table' },
            { key: 'coverage', label: 'Coverage' },
            { key: 'timeline', label: 'Timeline' },
            { key: 'archive', label: 'Archive' },
          ] as const).map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setDirectoryTab(t.key)}
              className={
                'px-3 py-1.5 text-sm rounded-md border whitespace-nowrap ' +
                (directoryTab === t.key ? 'bg-slate-900 text-white border-slate-900' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700')
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 space-y-6">
        {/* Filters */}
        <div className="border rounded-xl bg-white p-4 shadow-sm space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-600 mb-1">Search</label>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, email, phone…"
                className="w-full px-3 py-2 border rounded-md text-sm"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setCountryVal(undefined);
                  setStateVal(undefined);
                  setCityVal(undefined);
                  setDistrictFilter('all');
                  setAreaTypeFilter('all');
                  setBeatFilter('all');
                  setSearchQuery('');
                  setHasNotesOnly(false);
                  setActivityFilter('all');
                  setVerificationFilter('All');
                  setTypeFilter('all');
                  setStatusFilter('all');
                  setViewFilter('all');
                  setSortBy(undefined);
                  setSortDirection('desc');
                  if (typeof window !== 'undefined') {
                    try {
                      window.localStorage.removeItem(STORAGE_KEY);
                    } catch {}
                  }
                }}
                className="text-sm px-3 py-2 border rounded-md hover:bg-slate-50"
              >Clear filters</button>
              <span className="text-sm text-slate-600">{viewFilteredReporters.length} shown · {total} total</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
              <select value={statusFilter} onChange={(e)=> setStatusFilter(e.target.value as any)} className="w-full px-3 py-2 border rounded-md text-sm">
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="blocked">Blocked</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Verification</label>
              <select value={verificationFilter} onChange={(e)=> setVerificationFilter(e.target.value as any)} className="w-full px-3 py-2 border rounded-md text-sm">
                {['All','Verified','Pending','Limited','Revoked','Unverified','Community Default'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
              <select value={typeFilter} onChange={(e)=> setTypeFilter(e.target.value as any)} className="w-full px-3 py-2 border rounded-md text-sm">
                <option value="all">All</option>
                <option value="community">Community Reporter</option>
                <option value="journalist">Journalist</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Activity</label>
              <select value={activityFilter} onChange={(e) => setActivityFilter((e.target.value || 'all') as any)} className="w-full px-3 py-2 border rounded-md text-sm">
                {[{ label: 'All activity', value: 'all' },{ label: 'Active', value: 'active' },{ label: 'Inactive', value: 'inactive' },{ label: 'New', value: 'new' },{ label: 'On leave', value: 'on_leave' },{ label: 'Blacklisted', value: 'blacklisted' }].map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">State</label>
              <select value={stateVal ?? ''} onChange={(e) => { setStateVal(e.target.value || undefined); setCityVal(undefined); setDistrictFilter('all'); }} className="w-full px-3 py-2 border rounded-md text-sm">
                {uniqueStates.map(s => <option key={s ?? 'All states'} value={s === 'All states' ? '' : (s ?? '')}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">District</label>
              <select value={districtFilter} onChange={(e) => setDistrictFilter((e.target.value || 'all') as 'all' | string)} className="w-full px-3 py-2 border rounded-md text-sm">
                {filteredDistricts.map(d => <option key={d ?? 'All districts'} value={d === 'All districts' ? 'all' : (d ?? '')}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">City</label>
              <select value={cityVal ?? ''} onChange={(e) => setCityVal(e.target.value || undefined)} className="w-full px-3 py-2 border rounded-md text-sm">
                {filteredCities.map(c => <option key={c ?? 'All cities'} value={c === 'All cities' ? '' : (c ?? '')}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Beat / Area</label>
              <div className="flex gap-2">
                <select value={beatFilter} onChange={(e)=> setBeatFilter((e.target.value || 'all') as any)} className="w-1/2 px-3 py-2 border rounded-md text-sm">
                  {['all','Politics','Crime','Youth','Education','Business','Sports','Civic issues'].map(opt => (
                    <option key={opt} value={opt}>{opt === 'all' ? 'All beats' : opt}</option>
                  ))}
                </select>
                <select value={areaTypeFilter} onChange={(e) => setAreaTypeFilter((e.target.value || 'all') as any)} className="w-1/2 px-3 py-2 border rounded-md text-sm">
                  <option value="all">All areas</option>
                  <option value="metro">Metro</option>
                  <option value="corporation">Corporation</option>
                  <option value="district_hq">District HQ</option>
                  <option value="taluka">Taluka / block</option>
                  <option value="village">Village / rural</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Missing data</label>
              <select value={viewFilter} onChange={(e) => setViewFilter((e.target.value || 'all') as any)} className="w-full px-3 py-2 border rounded-md text-sm">
                <option value="all">All reporters</option>
                <option value="unresolved_identity">Unresolved identity</option>
                <option value="missing_email">Missing email</option>
                <option value="missing_phone">Missing phone</option>
                <option value="missing_location">Missing location</option>
                <option value="no_stories">No stories yet</option>
                <option value="inactive_30">Inactive 30+ days</option>
                <option value="inactive_60">Inactive 60+ days</option>
                <option value="inactive_90">Inactive 90+ days</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Country</label>
              <select value={countryVal ?? ''} onChange={(e) => { setCountryVal(e.target.value || undefined); setStateVal(undefined); setCityVal(undefined); }} className="w-full px-3 py-2 border rounded-md text-sm">
                {uniqueCountries.map(c => <option key={c ?? 'All countries'} value={c === 'All countries' ? '' : (c ?? '')}>{c}</option>)}
              </select>
            </div>

            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={hasNotesOnly} onChange={(e) => setHasNotesOnly(e.target.checked)} />
                Has notes
              </label>
            </div>
          </div>
        </div>

        {/* Secondary actions */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={handleExportCsv} className="text-sm px-3 py-2 border rounded-md hover:bg-slate-50">Export CSV</button>
            {canDelete && (
              <button
                type="button"
                disabled={backfillMutation.isPending}
                onClick={() => setBackfillOpen(true)}
                className="text-sm px-3 py-2 border rounded-md hover:bg-slate-50 disabled:opacity-50 inline-flex items-center gap-2"
                title="Rebuild reporter directory from backend-normalized contributor data"
              >
                {backfillMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                {backfillMutation.isPending ? 'Rebuilding…' : 'Rebuild directory'}
              </button>
            )}
            <button
              type="button"
              disabled={selectedIds.size === 0}
              onClick={() => {
                const visibleById = new Map(sortedReporters.map(r => [r.id, r] as const));
                const emails = Array.from(selectedIds)
                  .map(id => visibleById.get(id)?.email || '')
                  .filter(e => !!e);
                if (emails.length === 0) {
                  notify?.error?.('No emails found for selection');
                  return;
                }
                const payload = emails.join(', ');
                navigator.clipboard?.writeText(payload);
                notify?.ok?.(`Copied ${emails.length} email(s) to clipboard`);
              }}
              className="text-sm px-3 py-2 border rounded-md hover:bg-slate-50 disabled:opacity-50"
            >Copy selected emails</button>
            {canDelete && (
              <button
                type="button"
                disabled={selectedIds.size === 0 || bulkDeleteBusy}
                onClick={() => setBulkDeleteOpen(true)}
                className="text-sm px-3 py-2 rounded-md border text-red-700 hover:bg-red-50 disabled:opacity-50"
                title={selectedIds.size === 0 ? 'Select one or more contacts to delete' : 'Delete selected contacts'}
              >
                {bulkDeleteBusy ? 'Deleting…' : `Delete selected (${selectedIds.size})`}
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {canDelete && (
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={showFounderColumns} onChange={(e) => setShowFounderColumns(e.target.checked)} />
                Founder columns
              </label>
            )}
            <span className="text-sm text-slate-600">{selectedIds.size} selected</span>
          </div>
        </div>

        {/* Main content */}
        {directoryTab === 'coverage' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="border rounded-xl bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold">Coverage signals</h2>
              <p className="text-xs text-slate-600 mt-1">Quick distribution view for beats and activity.</p>
              <CoverageSummary items={sortedReporters} onOpenProfile={(r) => { setSelectedReporter(r); setProfileStartTab('coverage'); setIsProfileOpen(true); }} />
            </div>
            {hasStates ? (
              <div className="border rounded-xl bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold">Browse by location</h2>
                    <p className="text-xs text-slate-600 mt-1">Use state/city counts to narrow coverage planning.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowLocationNav(v => !v)}
                    className="text-sm px-3 py-2 rounded-md border hover:bg-slate-50 lg:hidden"
                  >{showLocationNav ? 'Hide' : 'Show'}</button>
                </div>
                <div className={showLocationNav ? 'mt-3' : 'mt-3 hidden lg:block'}>
                  <LocationNavigator
                    stateGroups={stateGroups}
                    cityGroups={cityGroups}
                    activeState={stateVal}
                    activeCity={cityVal}
                    onSelectState={(s) => { setStateVal(s); setCityVal(undefined); }}
                    onSelectCity={(c) => setCityVal(c)}
                  />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {directoryTab === 'timeline' ? (
          <div className="border rounded-xl bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold">Timeline</h2>
            <p className="text-xs text-slate-600 mt-1">Recent reporter submissions and activity signals (sorted by latest submission).</p>
            <ReporterTimeline items={sortedReporters} onOpenProfile={(r) => { setSelectedReporter(r); setProfileStartTab('activity'); setIsProfileOpen(true); }} />
          </div>
        ) : null}

        {directoryTab === 'table' || directoryTab === 'archive' ? (
          <DirectoryTable
            isLoading={isLoading}
            isError={isError}
            error={error as any}
            items={sortedReporters}
            selectedIds={selectedIds}
            notify={notify}
            canDelete={canDelete}
            showFounderColumns={showFounderColumns}
            onGoToLogin={() => navigate('/admin/login')}
            onToggleSelect={(id: string) => {
              setSelectedIds(prev => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id); else next.add(id);
                return next;
              });
            }}
            onToggleSelectAll={() => {
              const allVisibleIds = sortedReporters.map(r => r.id);
              const allSelected = allVisibleIds.every(id => selectedIds.has(id)) && allVisibleIds.length > 0;
              setSelectedIds(prev => {
                const next = new Set(prev);
                if (allSelected) {
                  allVisibleIds.forEach(id => next.delete(id));
                } else {
                  allVisibleIds.forEach(id => next.add(id));
                }
                return next;
              });
            }}
            onRequestRefresh={() => setRefreshTick(t => t + 1)}
            onSelect={(r) => { setSelectedReporter(r); setProfileStartTab('overview'); setIsProfileOpen(true); }}
            onAddNote={(r) => { setSelectedReporter(r); setProfileStartTab('notes'); setIsProfileOpen(true); }}
            onAddTask={(r) => { setSelectedReporter(r); setProfileStartTab('tasks'); setIsProfileOpen(true); }}
            onOpenStories={(r) => {
              const contactId = String((r as any)?.contactId || '').trim();
              if (contactId) {
                setStoriesTarget(r);
                return;
              }

              const reporterKey = String(r.reporterKey || r.id || '').trim();
              if (!reporterKey) {
                notify?.error?.('Missing reporter key (cannot load stories)');
                return;
              }

              const name = (r.name || r.email || '').trim();
              const qs = new URLSearchParams();
              qs.set('reporterKey', reporterKey);
              if (name) qs.set('name', name);
              navigate(`/community/reporter-stories?${qs.toString()}`, { state: { reporterKey, reporterName: name } });
            }}
          />
        ) : null}


      <ConfirmModal
        open={bulkDeleteOpen}
        title="Delete selected reporter contacts?"
        description="This will remove the selected reporter contact record(s). This action cannot be undone."
        confirmLabel={`Delete ${selectedIds.size || ''}`.trim()}
        confirmVariant="danger"
        confirmDisabled={bulkDeleteBusy}
        confirmBusyLabel="Deleting…"
        onCancel={() => {
          if (bulkDeleteBusy) return;
          setBulkDeleteOpen(false);
        }}
        onConfirm={async () => {
          // IMPORTANT: only fires from modal confirm click.
          if (bulkDeleteBusy) return;
          if (bulkDeleteInFlightRef.current) return;

          const selectedRows = sortedReporters.filter((r) => selectedIds.has(r.id));
          const ids = selectedRows
            .map((r) => contactDeleteId(r))
            .filter((x) => !!x && !x.startsWith('tmp_'));

          if (ids.length === 0) {
            notify?.error?.('No valid ids found for selection');
            return;
          }

          bulkDeleteInFlightRef.current = true;
          setBulkDeleteBusy(true);
          try {
            const result = await bulkDeleteReporterContacts({ ids, contactsById });
            notify?.ok?.('Deleted reporter contacts', `${result.deleted} deleted`);
            setSelectedIds(new Set());
            setBulkDeleteOpen(false);
            setRefreshTick((t) => t + 1);
          } catch (err: any) {
            notify?.error?.(err?.message || 'Failed to delete selected contacts');
          } finally {
            setBulkDeleteBusy(false);
            bulkDeleteInFlightRef.current = false;
          }
        }}
      />

      <ConfirmModal
        open={backfillOpen}
        title="Rebuild reporter directory?"
        description="This will request the backend to repair/rebuild the contributor directory (including submission-derived reporters). Safe to run multiple times."
        cancelLabel="Cancel"
        confirmLabel="Run Rebuild"
        confirmDisabled={backfillMutation.isPending}
        confirmBusyLabel="Running…"
        onCancel={() => {
          if (backfillMutation.isPending) return;
          setBackfillOpen(false);
        }}
        onConfirm={async () => {
          if (backfillMutation.isPending) return;
          await backfillMutation.mutateAsync();
        }}
      />

      </div>

      <ReporterProfileDrawer
        open={isProfileOpen}
        reporter={selectedReporter}
        initialTab={profileStartTab}
        onClose={() => setIsProfileOpen(false)}
        onOpenStories={(key) => {
          const name = selectedReporter?.name || selectedReporter?.email || '';
          const qs = new URLSearchParams();
          qs.set('reporterKey', key);
          if (name) qs.set('name', name);
          navigate(`/community/reporter-stories?${qs.toString()}`, { state: { reporterKey: key, reporterName: name } });
        }}
        onOpenQueue={(key) => navigate(`/community/reporter?reporterKey=${encodeURIComponent(key)}`)}
      />

      <ReporterStoriesDrawer
        open={!!storiesTarget}
        contactId={String((storiesTarget as any)?.contactId || (storiesTarget as any)?._id || '').trim()}
        contactName={String(storiesTarget?.name || storiesTarget?.email || '').trim()}
        canDelete={canDelete}
        onClose={() => setStoriesTarget(null)}
        onAfterMutation={() => setRefreshTick((t) => t + 1)}
      />
    </div>
  );
}

function SummaryCard({ label, value, isText }: { label: string; value: number | string; isText?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="text-[11px] font-medium text-slate-600">{label}</div>
      <div className={isText ? 'mt-1 text-sm font-semibold text-slate-900' : 'mt-1 text-2xl font-semibold text-slate-900'}>
        {value}
      </div>
    </div>
  );
}

function CoverageSummary({ items, onOpenProfile }: { items: ReporterContact[]; onOpenProfile: (r: ReporterContact) => void }) {
  const beatCounts = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach(r => {
      const beats = ((r as any).beatsProfessional || (r as any).beats || []) as string[];
      if (!Array.isArray(beats) || beats.length === 0) {
        map.set('Unspecified', (map.get('Unspecified') || 0) + 1);
        return;
      }
      beats.forEach(b => {
        const k = String(b || '').trim() || 'Unspecified';
        map.set(k, (map.get(k) || 0) + 1);
      });
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12);
  }, [items]);

  const topActive = useMemo(() => {
    const now = Date.now();
    const daysSince = (iso?: string | null) => {
      const s = String(iso || '').trim();
      if (!s) return Infinity;
      const t = new Date(s).getTime();
      if (!Number.isFinite(t) || t <= 0) return Infinity;
      return (now - t) / (1000 * 60 * 60 * 24);
    };
    return [...items]
      .filter(r => daysSince((r as any).lastSubmissionAt || r.lastStoryAt) <= 31)
      .sort((a, b) => Number(b.totalStories || 0) - Number(a.totalStories || 0))
      .slice(0, 8);
  }, [items]);

  return (
    <div className="mt-4 space-y-4">
      <div>
        <div className="text-xs font-medium text-slate-700">Top beats (current view)</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {beatCounts.length === 0 ? (
            <span className="text-sm text-slate-600">No beat data yet.</span>
          ) : (
            beatCounts.map(([beat, count]) => (
              <span key={beat} className="inline-flex items-center gap-2 px-2 py-1 rounded-md border bg-white text-xs text-slate-700">
                <span>{beat}</span>
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700">{count}</span>
              </span>
            ))
          )}
        </div>
      </div>

      <div>
        <div className="text-xs font-medium text-slate-700">Active this month (quick access)</div>
        <div className="mt-2 divide-y rounded-lg border">
          {topActive.length === 0 ? (
            <div className="p-3 text-sm text-slate-600">No active reporters in the current view this month.</div>
          ) : (
            topActive.map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => onOpenProfile(r)}
                className="w-full text-left p-3 hover:bg-slate-50 flex items-center justify-between"
              >
                <span className="text-sm text-slate-900">{r.name || r.email || 'Unknown'}</span>
                <span className="text-xs text-slate-600">{r.totalStories ?? 0} stories</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ReporterTimeline({ items, onOpenProfile }: { items: ReporterContact[]; onOpenProfile: (r: ReporterContact) => void }) {
  const rows = useMemo(() => {
    const toMs = (iso?: string | null) => {
      const s = String(iso || '').trim();
      if (!s) return 0;
      const t = new Date(s).getTime();
      return Number.isFinite(t) ? t : 0;
    };
    return [...items]
      .map(r => ({ r, t: toMs((r as any).lastSubmissionAt || r.lastStoryAt) }))
      .sort((a, b) => b.t - a.t)
      .slice(0, 50);
  }, [items]);

  return (
    <div className="mt-4 divide-y rounded-lg border bg-white">
      {rows.length === 0 ? (
        <div className="p-4 text-sm text-slate-600">No recent activity for the current view.</div>
      ) : (
        rows.map(({ r, t }) => (
          <button
            key={r.id}
            type="button"
            onClick={() => onOpenProfile(r)}
            className="w-full text-left p-4 hover:bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
          >
            <div>
              <div className="text-sm font-medium text-slate-900">{r.name || r.email || 'Unknown'}</div>
              <div className="text-xs text-slate-600">{r.email || '—'}{r.phone ? ` · ${r.phone}` : ''}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600">{t ? new Date(t).toLocaleString() : '—'}</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs">{r.totalStories ?? 0} stories</span>
            </div>
          </button>
        ))
      )}
    </div>
  );
}

interface LocationNavigatorProps {
  stateGroups: { state: string; count: number }[];
  cityGroups: { city: string; count: number }[];
  activeState?: string | undefined;
  activeCity?: string | undefined;
  onSelectState: (state: string) => void;
  onSelectCity: (city: string) => void;
}

function LocationNavigator({ stateGroups, cityGroups, activeState, activeCity, onSelectState, onSelectCity }: LocationNavigatorProps) {
  return (
    <div className="space-y-4 text-sm">
      <div className="space-y-1">
        {stateGroups.map(sg => (
          <button
            key={sg.state}
            type="button"
            onClick={() => onSelectState(sg.state)}
            className={`w-full text-left px-2 py-1 rounded border transition ${activeState === sg.state ? 'bg-blue-50 border-blue-300' : 'bg-white hover:bg-slate-50 border-slate-200'}`}
          >
            <span className="inline-flex items-center gap-2">
              <span>{sg.state}</span>
              <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-xs text-slate-600">{sg.count}</span>
            </span>
          </button>
        ))}
      </div>
      {activeState && activeState !== 'All states' && (
        <div className="mt-2 pl-2 border-t pt-2">
          <p className="text-xs font-medium text-slate-500 mb-1">Cities in {activeState}</p>
          <div className="space-y-1">
            {cityGroups.map(cg => (
              <button
                key={cg.city}
                type="button"
                onClick={() => onSelectCity(cg.city)}
                className={`w-full text-left px-2 py-1 rounded border transition ${activeCity === cg.city ? 'bg-blue-50 border-blue-300' : 'bg-white hover:bg-slate-50 border-slate-200'}`}
              >
                <span className="inline-flex items-center gap-2">
                  <span>{cg.city}</span>
                  <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-xs text-slate-600">{cg.count}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DirectoryTable({ isLoading, isError, error, items, selectedIds, onToggleSelect, onToggleSelectAll, onSelect, onAddNote, onAddTask, onOpenStories, onRequestRefresh, onGoToLogin, notify, canDelete, showFounderColumns }: { isLoading: boolean; isError: boolean; error: any; items: ReporterContact[]; selectedIds: Set<string>; onToggleSelect: (id: string) => void; onToggleSelectAll: () => void; onSelect: (r: ReporterContact) => void; onAddNote: (r: ReporterContact) => void; onAddTask: (r: ReporterContact) => void; onOpenStories: (r: ReporterContact) => void; onRequestRefresh: () => void; onGoToLogin: () => void; notify?: { ok: (msg: string, sub?: string) => void; error: (msg: string) => void }; canDelete: boolean; showFounderColumns: boolean }) {
  const { isFounder } = useAuth();
  const showDebug = canDelete && showFounderColumns;
  const colCount = showDebug ? 20 : 14;

  const identitySourceLabel = (rc: ReporterContact): string => {
    const raw = String((rc as any).identitySource || '').trim();
    if (raw) return raw;
    const hasContributor = !!String((rc as any).contributorId || '').trim();
    const hasContact = !!String((rc as any).contactId || '').trim();
    if (hasContributor && hasContact) return 'merged';
    if (hasContributor) return 'submission-derived';
    if (hasContact) return 'contact';
    return 'unknown';
  };

  const safe = (v: any) => {
    const s = v == null ? '' : String(v);
    const t = s.trim();
    return t ? t : '—';
  };

  const MissingBadge = ({ label }: { label: string }) => (
    <span className="inline-flex items-center px-2 py-0.5 rounded border bg-amber-50 text-amber-800 border-amber-200 text-xs">{label}</span>
  );

  const [deleteTarget, setDeleteTarget] = useState<ReporterContact | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  // For sort indicator, we pull from parent via URL? Simpler: local props not available.
  // We'll read from window state via a tiny hook? Instead, render indicators via a simple context closure.
  // To keep it straightforward, we add minimal inline indicators by querying current sort from the DOM-less vars through closures.

  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-3" />
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Phone</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">City</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">District</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">State</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Verification</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Stories</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Approved</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Pending</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Last Story</th>
              <th className="px-4 py-3" />
              {showDebug && (
                <>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Activity</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Country</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Identity</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">IDs</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Linked</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: showDebug ? 20 : 14 }).map((__, j) => (
                  <td key={j} className="px-4 py-3">
                    <div className="h-4 w-full max-w-[140px] bg-slate-100 animate-pulse rounded" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (isError && (((error as any)?.isUnauthorized === true) || ((error as any)?.status === 401))) {
    return (
      <div className="rounded-xl border border-red-300 bg-red-50 p-6 space-y-3">
        <h2 className="text-lg font-semibold text-red-700">Admin session expired</h2>
        <div className="text-xs text-red-700">Error 401: {String((error as any)?.message || 'Unauthorized')}</div>
        <p className="text-sm text-red-700">For security, reporter contact details are only visible to Founder/Admin.</p>
        <p className="text-sm text-red-700">Please log in again, then reopen this page.</p>
        <button
          onClick={onGoToLogin}
          className="inline-flex items-center px-4 py-2 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 shadow focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
        >
          Go to Admin Login
        </button>
      </div>
    );
  }

  if (isError) {
    const status = (error as any)?.status ?? (error as any)?.response?.status;
    const msg = String((error as any)?.message || 'Failed to load reporter contacts');
    return (
      <div className="rounded-xl border border-red-300 bg-red-50 p-6 space-y-2">
        <div className="text-sm font-semibold text-red-700">Failed to load reporter contacts</div>
        <div className="text-xs text-red-700">Error {typeof status === 'number' ? status : '—'}: {msg}</div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <ConfirmModal
        open={!!deleteTarget}
        title="Delete reporter contact?"
        description="This will remove the reporter contact record. This action cannot be undone."
        confirmLabel="Delete Contact"
        confirmVariant="danger"
        confirmDisabled={deleteBusy}
        confirmBusyLabel="Deleting…"
        onCancel={() => {
          if (deleteBusy) return;
          setDeleteTarget(null);
        }}
        onConfirm={async () => {
          if (!deleteTarget || deleteBusy) return;
          setDeleteBusy(true);
          try {
            const id = String((deleteTarget as any)._id || (deleteTarget as any)?.contactId || (deleteTarget as any)?.contactRecordId || '').trim();
            if (!id) {
              notify?.error?.('Missing contact record id (cannot delete contact)');
              return;
            }
            await deleteReporterContact({ id, reporterKey: deleteTarget.reporterKey || null, email: deleteTarget.email || null });
            notify?.ok?.('Deleted reporter contact');
            setDeleteTarget(null);
            onRequestRefresh();
          } catch (err: any) {
            notify?.error?.(err?.message || 'Failed to delete reporter contact');
          } finally {
            setDeleteBusy(false);
          }
        }}
      />
      <div className="overflow-x-auto w-full">
      <table className="min-w-[960px] w-full divide-y divide-slate-200 whitespace-nowrap">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-3 py-3 text-left text-xs font-medium text-slate-600">
              <input
                type="checkbox"
                aria-label="Select all"
                checked={items.length > 0 && items.every(r => selectedIds.has(r.id))}
                onChange={onToggleSelectAll}
              />
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">
              <button type="button" className="inline-flex items-center gap-1 hover:underline" onClick={() => (window as any).__rc_handleSortChange?.('name') || undefined}>
                Name <SortIndicator column="name" />
              </button>
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-600" title={!isFounder ? 'Contact details may be masked for non-Founder' : undefined}>Email</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-600" title={!isFounder ? 'Contact details may be masked for non-Founder' : undefined}>Phone</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">City</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">District</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">State</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Type</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Verification</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">
                <button type="button" className="inline-flex items-center gap-1 hover:underline" onClick={() => (window as any).__rc_handleSortChange?.('stories') || undefined}>
                  Stories <SortIndicator column="stories" />
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Approved</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Pending</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">
              <button type="button" className="inline-flex items-center gap-1 hover:underline" onClick={() => (window as any).__rc_handleSortChange?.('lastStory') || undefined}>
                Last Story <SortIndicator column="lastStory" />
              </button>
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Actions</th>
            {showDebug && (
              <>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Activity</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Country</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Identity source</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Linked IDs</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600" title="Backend-provided linked story count (if present)">Linked</th>
              </>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {items.length === 0 ? (
            <tr>
              <td colSpan={colCount} className="px-4 py-10 text-center">
                <div className="text-sm font-medium text-slate-900">No reporters match your filters</div>
                <div className="mt-1 text-sm text-slate-600">Try clearing filters or changing the missing-data view.</div>
              </td>
            </tr>
          ) : (
            items.map((rc) => (
              <tr key={rc.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => onSelect(rc)}>
                  <td className="px-3 py-3 text-sm" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label="Select reporter"
                      checked={selectedIds.has(rc.id)}
                      onChange={() => onToggleSelect(rc.id)}
                    />
                  </td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="text-blue-600 hover:underline"
                      onClick={(e) => { e.stopPropagation(); onSelect(rc); }}
                    >{rc.name || '—'}</button>
                    {!!(rc.notes && String(rc.notes).trim().length > 0) && (
                      <span title="Has founder/admin notes" className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs">Notes</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm">
                  {rc.email ? (
                    <div className="flex items-center gap-1 group">
                      <a className="text-blue-600 hover:underline" href={`mailto:${rc.email}`}>{rc.email}</a>
                      <button
                        type="button"
                        aria-label="Copy email"
                        className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center justify-center h-6 w-6 text-slate-500 hover:text-slate-700 bg-transparent border-0"
                        onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(rc.email || ''); notify?.ok?.('Email copied to clipboard'); }}
                      >
                        <CopyIcon size={14} />
                      </button>
                    </div>
                  ) : (
                    <MissingBadge label="Missing email" />
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  {rc.phone ? (
                    <span className="inline-flex items-center gap-2">
                      <a className="text-blue-600 hover:underline" href={`tel:${rc.phone}`}>{rc.phone}</a>
                      <button
                        type="button"
                        className="text-xs px-2 py-0.5 rounded border hover:bg-slate-50"
                        onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(rc.phone || ''); notify?.ok?.('Phone number copied'); }}
                      >Copy</button>
                    </span>
                  ) : (
                    <MissingBadge label="Missing phone" />
                  )}
                </td>
                <td className="px-4 py-3 text-sm">{norm(rc.city, 'city') || (!rc.city && !(rc as any).district && !rc.state ? <MissingBadge label="Missing location" /> : '—')}</td>
                <td className="px-4 py-3 text-sm">{String(((rc as any).district || '')).trim() || '—'}</td>
                <td className="px-4 py-3 text-sm">{norm(rc.state, 'state') || '—'}</td>
                <td className="px-4 py-3 text-sm">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${rc.reporterType==='journalist' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-purple-100 text-purple-700 border-purple-200'}`}>
                    {rc.reporterType==='journalist' ? 'Journalist' : 'Community'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${rc.verificationLevel==='verified' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : rc.verificationLevel==='pending' ? 'bg-amber-100 text-amber-800 border-amber-200' : rc.verificationLevel==='limited' ? 'bg-amber-100 text-amber-800 border-amber-200' : rc.verificationLevel==='revoked' ? 'bg-slate-100 text-slate-700 border-slate-200' : rc.verificationLevel==='community_default' ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                    {rc.verificationLevel==='verified' ? 'Verified' : rc.verificationLevel==='pending' ? 'Pending' : rc.verificationLevel==='limited' ? 'Limited' : rc.verificationLevel==='revoked' ? 'Revoked' : rc.verificationLevel==='community_default' ? 'Community Default' : 'Unverified'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">{rc.totalStories}</td>
                <td className="px-4 py-3 text-sm">{typeof rc.approvedStories === 'number' ? rc.approvedStories : 0}</td>
                <td className="px-4 py-3 text-sm">{typeof rc.pendingStories === 'number' ? rc.pendingStories : 0}</td>
                <td className="px-4 py-3 text-sm">{rc.lastStoryAt ? new Date(rc.lastStoryAt).toLocaleString() : '—'}</td>
                <td className="px-4 py-3 text-right">
                  {(() => {
                    return (
                      <span className="inline-flex items-center gap-2">
                        {rc.email && (
                          <a href={`mailto:${rc.email}`} onClick={(e) => e.stopPropagation()} className="text-xs px-2 py-1 rounded-md border hover:bg-slate-50">Email</a>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenStories(rc);
                          }}
                          className="text-xs px-2 py-1 rounded-md border hover:bg-slate-50"
                        >
                          View stories
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onSelect(rc); }}
                          className="text-xs px-2 py-1 rounded-md border hover:bg-slate-50"
                        >
                          Profile
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onAddNote(rc); }}
                          className="text-xs px-2 py-1 rounded-md border hover:bg-slate-50"
                        >
                          Add note
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onAddTask(rc); }}
                          className="text-xs px-2 py-1 rounded-md border hover:bg-slate-50"
                        >
                          Add task
                        </button>
                        {(() => {
                          const contactRecordId = String((rc as any)?._id || (rc as any)?.contactId || (rc as any)?.contactRecordId || '').trim();
                          if (!canDelete || !contactRecordId) return null;
                          return (
                          <button
                            type="button"
                            disabled={deleteBusy}
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget(rc); }}
                            className="text-xs px-2 py-1 rounded-md border text-red-700 hover:bg-red-50 disabled:opacity-50"
                          >
                            Delete Contact
                          </button>
                          );
                        })()}
                      </span>
                    );
                  })()}
                </td>
                {showDebug && (
                  <>
                    <td className="px-4 py-3 text-sm">
                      {(() => {
                        const s = rc.status || 'active';
                        const label: Record<string, string> = { active: 'Active', watchlist: 'Watchlist', suspended: 'Suspended', banned: 'Banned' };
                        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs border bg-slate-50 text-slate-700 border-slate-200">{label[s] || s}</span>;
                      })()}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {(() => {
                        const activity = String(((rc as any).activity || '')).toLowerCase();
                        const label: Record<string, string> = { active: 'Active', new: 'New', on_leave: 'On leave', inactive: 'Inactive', blacklisted: 'Blacklisted' };
                        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs border bg-slate-50 text-slate-700 border-slate-200">{label[activity] || activity || '—'}</span>;
                      })()}
                    </td>
                    <td className="px-4 py-3 text-sm">{norm(rc.country, 'country') || '—'}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs border bg-slate-50 text-slate-700 border-slate-200" title={safe((rc as any).identitySource)}>
                        {identitySourceLabel(rc)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="text-[11px] text-slate-700" title={`contributorId=${safe((rc as any).contributorId)}\ncontactId=${safe((rc as any).contactId)}`}>
                        <div>c: {safe((rc as any).contributorId)}</div>
                        <div>k: {safe((rc as any).contactId)}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">{typeof (rc as any).linkedStoryCount === 'number' ? (rc as any).linkedStoryCount : '—'}</td>
                  </>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function SortIndicator({ column }: { column: 'name' | 'stories' | 'lastStory' | 'activity' }) {
  const by = (window as any).__rc_sortBy as undefined | 'name' | 'stories' | 'lastStory' | 'activity';
  const dir = (window as any).__rc_sortDir as 'asc' | 'desc';
  if (by !== column) return null as any;
  return <span className="text-[10px] text-slate-500">{dir === 'asc' ? '▲' : '▼'}</span>;
}
 
