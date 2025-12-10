import { useNavigate } from 'react-router-dom';
import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Copy as CopyIcon } from 'lucide-react';
import { useNotify } from '@/components/ui/toast-bridge';
import ReporterProfileDrawer from '@/components/community/ReporterProfileDrawer.tsx';
import type { ReporterContact } from '@/lib/api/reporterDirectory.ts';
import { adminApi, resolveAdminPath } from '@/lib/adminApi';
import { useAuth } from '@/context/AuthContext.tsx';
import { updateReporterStatus } from '@/lib/api/communityAdmin.ts';

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
  const navigate = useNavigate();
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
  const [page] = useState(1);
  const notify = (useNotify?.() as unknown) as { ok: (msg: string, sub?: string) => void; error: (msg: string) => void } | undefined;
  const [sortBy, setSortBy] = useState<undefined | 'name' | 'stories' | 'lastStory' | 'activity'>(undefined);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Query backend for reporter contacts (paginated, large page to reduce client fetches)
  const [refreshTick, setRefreshTick] = useState(0);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['reporter-contacts', {
      country: countryVal, state: stateVal, city: cityVal, district: districtFilter,
      area: areaTypeFilter, beat: beatFilter, type: typeFilter, verification: verificationFilter,
      status: statusFilter, activity: activityFilter, hasNotes: hasNotesOnly, searchQuery, refreshTick
    }],
    queryFn: async () => {
      const res = await adminApi.get(resolveAdminPath('/admin/community/reporter-contacts'), {
        params: { page: 1, limit: 200 },
      });
      return res.data;
    },
  });
  const reporters: ReporterContact[] = (data?.items as ReporterContact[]) ?? (data?.rows as ReporterContact[]) ?? [];
  const items = reporters;
  const total = typeof data?.total === 'number' ? data.total : reporters.length;
  const unauthorized = (error as any)?.isUnauthorized === true || (error as any)?.status === 401;

  // Fetch via admin reporters API whenever filters/search change
  // Note: depends on filter states declared below; place after declarations to avoid TS block-scope issues
  // The actual effect is defined later after filter state hooks.


  // Derive unique sets from current dataset
  // Unique value derivation (case-sensitive as stored)
  const uniqueCountries = useMemo(() => ['All countries', ...Array.from(new Set(items.map(i => norm(i.country, 'country')).filter(Boolean))).sort()], [items]);
  const uniqueStates = useMemo(() => {
    const base = countryVal && countryVal !== 'All countries'
      ? items.filter(i => norm(i.country, 'country').toLowerCase() === countryVal.toLowerCase())
      : items;
    return ['All states', ...Array.from(new Set(base.map(i => norm(i.state, 'state')).filter(Boolean))).sort()];
  }, [items, countryVal]);
  const filteredCities = useMemo(() => {
    const base = items.filter(i => {
      const ctry = norm(i.country, 'country').toLowerCase();
      const st = norm(i.state, 'state').toLowerCase();
      if (countryVal && countryVal !== 'All countries' && ctry !== countryVal.toLowerCase()) return false;
      if (stateVal && stateVal !== 'All states' && st !== stateVal.toLowerCase()) return false;
      return true;
    });
    return ['All cities', ...Array.from(new Set(base.map(i => norm(i.city, 'city')).filter(Boolean))).sort()];
  }, [items, countryVal, stateVal]);

  // Districts based on selected country/state
  const filteredDistricts = useMemo(() => {
    const base = items.filter(i => {
      const ctry = norm(i.country, 'country').toLowerCase();
      const st = norm(i.state, 'state').toLowerCase();
      if (countryVal && countryVal !== 'All countries' && ctry !== countryVal.toLowerCase()) return false;
      if (stateVal && stateVal !== 'All states' && st !== stateVal.toLowerCase()) return false;
      return true;
    });
    const set = new Set<string>();
    base.forEach(i => { const d = String((i as any).district || '').trim(); if (d) set.add(d); });
    return ['All districts', ...Array.from(set).sort()];
  }, [items, countryVal, stateVal]);

  // Removed auto-default country selection to avoid unintended filtering

  // Client-side filtered reporters
  const [activityFilter, setActivityFilter] = useState<'all' | 'active' | 'inactive' | 'new' | 'on_leave' | 'blacklisted'>('all');
  const [verificationFilter, setVerificationFilter] = useState<'All'|'Verified'|'Pending'|'Limited'|'Revoked'|'Unverified'|'Community Default'>('All');

  // Load preferences on mount (browser-only)
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data && typeof data === 'object') {
        if (typeof data.searchQuery === 'string') setSearchQuery(data.searchQuery);
        if (typeof data.countryVal === 'string' || data.countryVal === undefined) setCountryVal(data.countryVal);
        if (typeof data.stateVal === 'string' || data.stateVal === undefined) setStateVal(data.stateVal);
        if (typeof data.cityVal === 'string' || data.cityVal === undefined) setCityVal(data.cityVal);
        if (typeof data.districtFilter === 'string') setDistrictFilter(data.districtFilter);
        if (typeof data.areaTypeFilter === 'string') setAreaTypeFilter(data.areaTypeFilter);
        if (typeof data.beatFilter === 'string') setBeatFilter(data.beatFilter);
        if (typeof data.hasNotesOnly === 'boolean') setHasNotesOnly(data.hasNotesOnly);
        if (typeof data.activityFilter === 'string') setActivityFilter(data.activityFilter);
        if (typeof data.sortBy === 'string' || data.sortBy === undefined) setSortBy(data.sortBy);
        if (data.sortDirection === 'asc' || data.sortDirection === 'desc') setSortDirection(data.sortDirection);
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
    country: (countryVal ? String(countryVal).toLowerCase() : 'all'),
    state: (stateVal ? String(stateVal).toLowerCase() : 'all'),
    district: (districtFilter ? String(districtFilter).toLowerCase() : 'all'),
    city: (cityVal ? String(cityVal).toLowerCase() : 'all'),
    area: (areaTypeFilter ? String(areaTypeFilter).toLowerCase() : 'all'),
    beat: (beatFilter ? String(beatFilter).toLowerCase() : 'all beats'),
    type: typeFilter ?? 'all',
    verification: (String(verificationFilter || 'all')).toLowerCase(),
    status: statusFilter ?? 'all',
    activity: activityFilter ?? 'all activity',
    hasNotes: !!hasNotesOnly,
  };

  const filteredReporters = useMemo(() => reporters.filter((r) => reporterMatchesFilters(r, filters, searchQuery)), [reporters, filters, searchQuery]);

  // Debug logs for investigation (will be trimmed later)
  useEffect(() => {
    // Raw vs filtered list visibility
    console.log('[ReporterDirectory] raw reporters', reporters);
    console.log('[ReporterDirectory] filters', {
      countryVal, stateVal, cityVal, districtFilter, areaTypeFilter, beatFilter,
      typeFilter, verificationFilter, statusFilter, activityFilter, hasNotesOnly,
    }, 'search', (searchQuery ?? '').toString());
    console.log('[ReporterDirectory] filtered reporters', filteredReporters);
  }, [reporters, filteredReporters, countryVal, stateVal, cityVal, districtFilter, areaTypeFilter, beatFilter, typeFilter, verificationFilter, statusFilter, activityFilter, hasNotesOnly, searchQuery]);

  const sortedReporters = useMemo(() => {
    const arr = [...filteredReporters];
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
  }, [filteredReporters, sortBy, sortDirection]);

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
    const rows = filteredReporters.map(r => {
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  return (
    <div className="px-6 py-4 max-w-7xl mx-auto w-full">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Reporter Contact Directory</h1>
        <p className="text-sm text-slate-600">Secure list of reporter contact & location for follow-up. Founder/Admin only.</p>
      </header>

      {unauthorized && (
        <div className="mt-4 p-3 rounded-md border bg-amber-50 text-amber-800">
          You don't have permission to view the Reporter Contact Directory or your session is missing. Please login with an account that has access, or contact an admin.
        </div>
      )}

      {/* Mobile location toggle (only if states available) */}
      {hasStates && (
        <div className="mt-4 md:hidden">
          <button
            type="button"
            onClick={() => setShowLocationNav(v => !v)}
            className="text-sm px-3 py-2 rounded-md border bg-white shadow-sm hover:bg-slate-50"
          >{showLocationNav ? 'Hide location navigator' : 'Browse by location'}</button>
          {showLocationNav && (
            <div className="mt-3 border rounded-md overflow-hidden">
              <LocationNavigator
                stateGroups={stateGroups}
                cityGroups={cityGroups}
                activeState={stateVal}
                activeCity={cityVal}
                onSelectState={(s) => { setStateVal(s); setCityVal(undefined); }}
                onSelectCity={(c) => setCityVal(c)}
              />
            </div>
          )}
        </div>
      )}

      <div className="mt-6 md:mt-8 flex flex-col md:flex-row gap-8">
        {/* Desktop Sidebar (only if states available) */}
        {hasStates && (
          <aside className="hidden md:block w-72 shrink-0">
            <div className="border rounded-lg p-4 bg-white shadow-sm">
              <h2 className="text-sm font-semibold mb-3">Browse by location</h2>
              <LocationNavigator
                stateGroups={stateGroups}
                cityGroups={cityGroups}
                activeState={stateVal}
                activeCity={cityVal}
                onSelectState={(s) => { setStateVal(s); setCityVal(undefined); }}
                onSelectCity={(c) => setCityVal(c)}
              />
            </div>
          </aside>
        )}

        <div className="flex-1 space-y-6">
        {/* Filters Bar */}
        <div className="flex flex-wrap items-center gap-3">
        <select value={countryVal ?? ''} onChange={(e) => { setCountryVal(e.target.value || undefined); setStateVal(undefined); setCityVal(undefined); }} className="px-3 py-2 border rounded-md text-sm">
          {uniqueCountries.map(c => <option key={c ?? 'All countries'} value={c === 'All countries' ? '' : (c ?? '')}>{c}</option>)}
        </select>
        <select value={stateVal ?? ''} onChange={(e) => { setStateVal(e.target.value || undefined); setCityVal(undefined); setDistrictFilter('all'); }} className="px-3 py-2 border rounded-md text-sm">
          {uniqueStates.map(s => <option key={s ?? 'All states'} value={s === 'All states' ? '' : (s ?? '')}>{s}</option>)}
        </select>
        {/* District */}
        <select value={districtFilter} onChange={(e) => setDistrictFilter((e.target.value || 'all') as 'all' | string)} className="px-3 py-2 border rounded-md text-sm">
          {filteredDistricts.map(d => <option key={d ?? 'All districts'} value={d === 'All districts' ? 'all' : (d ?? '')}>{d}</option>)}
        </select>
        <select value={cityVal ?? ''} onChange={(e) => setCityVal(e.target.value || undefined)} className="px-3 py-2 border rounded-md text-sm">
          {filteredCities.map(c => <option key={c ?? 'All cities'} value={c === 'All cities' ? '' : (c ?? '')}>{c}</option>)}
        </select>
        {/* Area type */}
        <select value={areaTypeFilter} onChange={(e) => setAreaTypeFilter((e.target.value || 'all') as any)} className="px-3 py-2 border rounded-md text-sm">
          <option value="all">All areas</option>
          <option value="metro">Metro city</option>
          <option value="corporation">Municipal corporation</option>
          <option value="district_hq">District HQ</option>
          <option value="taluka">Taluka / block</option>
          <option value="village">Village / rural</option>
        </select>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search name, email, or phone…"
          className="w-full sm:w-64 px-3 py-2 border rounded-md text-sm"
        />
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
            setSortBy(undefined);
            setSortDirection('desc');
            if (typeof window !== 'undefined') {
              try { window.localStorage.removeItem(STORAGE_KEY); } catch {}
            }
          }}
          className="text-xs px-3 py-2 border rounded-md hover:bg-slate-50"
        >Clear filters</button>
          <label className="inline-flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={hasNotesOnly} onChange={(e) => setHasNotesOnly(e.target.checked)} />
            Has notes
          </label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600">Beat:</span>
            <select value={beatFilter} onChange={(e)=> setBeatFilter((e.target.value || 'all') as 'all' | string)} className="text-xs px-2 py-2 border rounded-md">
              {['all','Politics','Crime','Youth','Education','Business','Sports','Civic issues'].map(opt => (
                <option key={opt} value={opt}>{opt === 'all' ? 'All beats' : opt}</option>
              ))}
            </select>
            <span className="text-xs text-slate-600">Type:</span>
            <select value={typeFilter} onChange={(e)=> setTypeFilter(e.target.value as 'all'|'community'|'journalist')} className="text-xs px-2 py-2 border rounded-md">
              <option value="all">All</option>
              <option value="community">Community</option>
              <option value="journalist">Journalist</option>
            </select>
            <span className="text-xs text-slate-600">Verification:</span>
            <select value={verificationFilter} onChange={(e)=> setVerificationFilter(e.target.value as any)} className="text-xs px-2 py-2 border rounded-md">
              {['All','Verified','Pending','Limited','Revoked','Unverified','Community Default'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            <span className="text-xs text-slate-600">Status:</span>
            <select value={statusFilter} onChange={(e)=> setStatusFilter(e.target.value as 'all'|'active'|'blocked'|'archived')} className="text-xs px-2 py-2 border rounded-md">
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="blocked">Blocked</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <select
            value={activityFilter}
            onChange={(e) => setActivityFilter((e.target.value || 'all') as any)}
            className="text-xs px-2 py-2 border rounded-md"
            title="Filter by activity"
          >
            {[
              { label: 'All activity', value: 'all' },
              { label: 'Active', value: 'active' },
              { label: 'Inactive', value: 'inactive' },
              { label: 'New', value: 'new' },
              { label: 'On leave', value: 'on_leave' },
              { label: 'Blacklisted', value: 'blacklisted' },
            ].map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {/* Use filtered list for shown count to match table */}
          <span className="text-xs text-slate-500">{filteredReporters.length} / {reporters.length} shown</span>
          {(() => {
            const totalReporters = filteredReporters.length;
            const completeProfiles = filteredReporters.filter(r => r.phone && (r.city || r.state || r.country)).length;
            const missingPhone = filteredReporters.filter(r => !r.phone).length;
            const missingLocation = filteredReporters.filter(r => !r.city && !r.state && !r.country).length;
            return (
              <span className="text-xs text-slate-500 inline-flex items-center gap-2">
                {totalReporters > 0 && (
                  <>
                    <span>{completeProfiles} complete</span>
                    <span>· {missingLocation} missing location</span>
                    <span>· {missingPhone} missing phone</span>
                  </>
                )}
              </span>
            );
          })()}
          <button
            type="button"
            onClick={handleExportCsv}
            className="ml-auto text-xs px-3 py-2 border rounded-md hover:bg-slate-50"
          >Export CSV</button>
          <span className="ml-2 text-xs text-slate-600">{selectedIds.size} selected</span>
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
            className="text-xs px-3 py-2 border rounded-md hover:bg-slate-50 disabled:opacity-50"
          >Copy selected emails</button>
      </div>

      {/* Table with data */}
        <DirectoryTable
          isLoading={isLoading}
          isError={isError}
          error={error as any}
          items={sortedReporters}
          selectedIds={selectedIds}
          notify={notify}
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
          onSelect={(r) => { setSelectedReporter(r); setIsProfileOpen(true); }}
        />

        </div>{/* end main content */}
      </div>

      <ReporterProfileDrawer
        open={isProfileOpen}
        reporter={selectedReporter}
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
          {cityGroups.length === 0 && <p className="text-xs text-slate-500">No cities found.</p>}
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

function DirectoryTable({ isLoading, isError, error, items, selectedIds, onToggleSelect, onToggleSelectAll, onSelect, onRequestRefresh, notify }: { isLoading: boolean; isError: boolean; error: any; items: ReporterContact[]; selectedIds: Set<string>; onToggleSelect: (id: string) => void; onToggleSelectAll: () => void; onSelect: (r: ReporterContact) => void; onRequestRefresh: () => void; notify?: { ok: (msg: string, sub?: string) => void; error: (msg: string) => void } }) {
  const navigate = useNavigate();
  const { isFounder } = useAuth();
  // For sort indicator, we pull from parent via URL? Simpler: local props not available.
  // We'll read from window state via a tiny hook? Instead, render indicators via a simple context closure.
  // To keep it straightforward, we add minimal inline indicators by querying current sort from the DOM-less vars through closures.

  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Phone</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">City</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">State</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Country</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Stories</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: 8 }).map((__, j) => (
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

  if (isError && (error as any)?.isUnauthorized) {
    return (
      <div className="rounded-xl border border-red-300 bg-red-50 p-6 space-y-3">
        <h2 className="text-lg font-semibold text-red-700">Admin session expired</h2>
        <p className="text-sm text-red-700">For security, reporter contact details are only visible to Founder/Admin.</p>
        <p className="text-sm text-red-700">Please log in again, then reopen this page.</p>
        <button
          onClick={() => navigate('/admin/login')}
          className="inline-flex items-center px-4 py-2 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 shadow focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
        >
          Go to Admin Login
        </button>
      </div>
    );
  }

  if (isError) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">Failed to load reporter contacts.</div>;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
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
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Type</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Verification</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Status / Strikes</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-600" title={!isFounder ? 'Contact details may be masked for non-Founder' : undefined}>Phone</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">City</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">District</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">State</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Country</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">
                <button type="button" className="inline-flex items-center gap-1 hover:underline" onClick={() => (window as any).__rc_handleSortChange?.('stories') || undefined}>
                  Stories <SortIndicator column="stories" />
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Approved</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Pending</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">
              <button type="button" className="inline-flex items-center gap-1 hover:underline" onClick={() => (window as any).__rc_handleSortChange?.('activity') || undefined}>
                Activity <SortIndicator column="activity" />
              </button>
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">
              <button type="button" className="inline-flex items-center gap-1 hover:underline" onClick={() => (window as any).__rc_handleSortChange?.('lastStory') || undefined}>
                Last Story <SortIndicator column="lastStory" />
              </button>
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {items.length === 0 ? (
            <tr>
              <td colSpan={15} className="px-4 py-8 text-center text-sm text-slate-600">No reporters match your filters yet.</td>
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
                  {(() => {
                    const beats = ((rc as any).beatsProfessional || (rc as any).beats || []) as string[];
                    if (Array.isArray(beats) && beats.length > 0) {
                      return <div className="mt-1 text-[11px] text-slate-600">Beats: {beats.join(', ')}</div>;
                    }
                    return null;
                  })()}
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${rc.reporterType==='journalist' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-purple-100 text-purple-700 border-purple-200'}`}>
                    {rc.reporterType==='journalist' ? 'Journalist' : 'Community Reporter'}
                  </span>
                  {rc.organisationName && (
                    <span className="ml-2 text-xs text-slate-600">{rc.organisationName}{rc.beatsProfessional && rc.beatsProfessional.length>0 ? ` · ${rc.beatsProfessional.join(', ')}` : ''}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${rc.verificationLevel==='verified' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : rc.verificationLevel==='pending' ? 'bg-amber-100 text-amber-800 border-amber-200' : rc.verificationLevel==='limited' ? 'bg-amber-100 text-amber-800 border-amber-200' : rc.verificationLevel==='revoked' ? 'bg-slate-100 text-slate-700 border-slate-200' : rc.verificationLevel==='community_default' ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                    {rc.verificationLevel==='verified' ? 'Verified' : rc.verificationLevel==='pending' ? 'Pending' : rc.verificationLevel==='limited' ? 'Limited' : rc.verificationLevel==='revoked' ? 'Revoked' : rc.verificationLevel==='community_default' ? 'Community Default' : 'Unverified'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  {(() => {
                    const s = rc.status || 'active';
                    const map: Record<string, string> = {
                      active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
                      watchlist: 'bg-amber-100 text-amber-800 border-amber-200',
                      suspended: 'bg-yellow-100 text-yellow-800 border-yellow-200',
                      banned: 'bg-red-100 text-red-700 border-red-200',
                    };
                    const label: Record<string, string> = { active: 'Active', watchlist: 'Watchlist', suspended: 'Suspended', banned: 'Banned' };
                    const activity = String(((rc as any).activity || '')).toLowerCase();
                    const activityMap: Record<string, string> = {
                      active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
                      new: 'bg-blue-100 text-blue-700 border-blue-200',
                      on_leave: 'bg-amber-100 text-amber-800 border-amber-200',
                      inactive: 'bg-slate-100 text-slate-700 border-slate-200',
                      blacklisted: 'bg-red-100 text-red-700 border-red-200',
                    };
                    const activityLabel: Record<string, string> = { active: 'Active', new: 'New', on_leave: 'On leave', inactive: 'Inactive', blacklisted: 'Blacklisted' };
                    return (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${map[s]}`}>{label[s]}</span>
                        {activity && activity !== s && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${activityMap[activity]}`}>{activityLabel[activity] || activity}</span>
                        )}
                        {isFounder && (
                          <select
                            className="ml-2 text-xs px-2 py-1 border rounded-md bg-white"
                            value={s}
                            onClick={(e) => e.stopPropagation()}
                            onChange={async (e) => {
                              e.stopPropagation();
                              const next = e.target.value as 'active'|'watchlist'|'suspended'|'banned';
                              const id = (rc as any)._id || rc.id || rc.reporterKey || rc.email || '';
                              try {
                                await updateReporterStatus(String(id), { status: next });
                                notify?.ok?.('Status updated', `Set to ${next}`);
                                onRequestRefresh();
                              } catch (err:any) {
                                notify?.error?.('Failed to update status');
                              }
                            }}
                            title="Founder-only: change reporter status"
                          >
                            {['active','watchlist','suspended','banned'].map(v => <option key={v} value={v}>{label[v]}</option>)}
                          </select>
                        )}
                        <span className="ml-2 text-[11px] text-slate-600">Strikes: {typeof rc.ethicsStrikes === 'number' ? rc.ethicsStrikes : 0}</span>
                      </div>
                    );
                  })()}
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
                  ) : '—'}
                  {Array.isArray(rc.languages) && rc.languages.length > 0 && (
                    <div className="mt-1 text-[10px] text-slate-600">{rc.languages.map(l => (l || '').toUpperCase()).join(' · ')}</div>
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
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-xs">No phone yet</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">{norm(rc.city, 'city') || (!rc.city && !rc.state && !rc.country ? <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-xs">Location not set</span> : '—')}</td>
                <td className="px-4 py-3 text-sm">{String(((rc as any).district || '')).trim() || '—'}</td>
                <td className="px-4 py-3 text-sm">{norm(rc.state, 'state') || '—'}</td>
                <td className="px-4 py-3 text-sm">{norm(rc.country, 'country') || '—'}</td>
                <td className="px-4 py-3 text-sm">{rc.totalStories}</td>
                <td className="px-4 py-3 text-sm">{typeof rc.approvedStories === 'number' ? rc.approvedStories : 0}</td>
                <td className="px-4 py-3 text-sm">{typeof rc.pendingStories === 'number' ? rc.pendingStories : 0}</td>
                <td className="px-4 py-3 text-sm">
                  {(() => {
                    const activity = String(((rc as any).activity || '')).toLowerCase();
                    const label: Record<string, string> = { active: 'Active', new: 'New', on_leave: 'On leave', inactive: 'Inactive', blacklisted: 'Blacklisted' };
                    const styles: Record<string, string> = {
                      active: 'bg-emerald-100 text-emerald-700',
                      new: 'bg-blue-100 text-blue-700',
                      on_leave: 'bg-amber-100 text-amber-700',
                      inactive: 'bg-slate-100 text-slate-600',
                      blacklisted: 'bg-red-100 text-red-700',
                    };
                    return activity ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${styles[activity]}`}>{label[activity] || activity}</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-600">—</span>
                    );
                  })()}
                </td>
                <td className="px-4 py-3 text-sm">{rc.lastStoryAt ? new Date(rc.lastStoryAt).toLocaleString() : '—'}</td>
                <td className="px-4 py-3 text-right">
                  {(() => {
                    function normalizePhone(phone?: string, country?: string): string {
                      const raw = String(phone || '').replace(/[^0-9+]/g, '');
                      if (!raw) return '';
                      if (raw.startsWith('+')) return raw;
                      const c = String(country || '').toLowerCase();
                      const defaultCode = c === 'india' || c === 'in' ? '+91' : '+91';
                      return `${defaultCode}${raw}`;
                    }
                    const normalizedPhone = normalizePhone(rc.phone || undefined, (norm(rc.country, 'country') || undefined) as string | undefined);
                    const id = (rc as any)._id || rc.id || rc.reporterKey || rc.email || '';
                    return (
                      <span className="inline-flex items-center gap-2">
                        {rc.phone && (
                          <a href={`tel:${rc.phone}`} onClick={(e) => e.stopPropagation()} className="text-xs px-2 py-1 rounded-md border hover:bg-slate-50">Call</a>
                        )}
                        {normalizedPhone && (
                          <a href={`https://wa.me/${normalizedPhone.replace('+','')}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-xs px-2 py-1 rounded-md border hover:bg-slate-50">WhatsApp</a>
                        )}
                        {rc.email && (
                          <a href={`mailto:${rc.email}`} onClick={(e) => e.stopPropagation()} className="text-xs px-2 py-1 rounded-md border hover:bg-slate-50">Email</a>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const qs = new URLSearchParams();
                            if (id) qs.set('reporterId', String(id));
                            navigate(`/community/reporter-queue?${qs.toString()}`);
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
                      </span>
                    );
                  })()}
                </td>
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
 
