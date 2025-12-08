import { useNavigate } from 'react-router-dom';
import { useMemo, useState, useEffect } from 'react';
import { Copy as CopyIcon } from 'lucide-react';
import { useNotify } from '@/components/ui/toast-bridge';
import ReporterProfileDrawer from '@/components/community/ReporterProfileDrawer.tsx';
import { useReporterContactsQuery } from '@/features/community/api/reporterDirectory.ts';
import type { ReporterContact } from '@/lib/api/reporterDirectory.ts';

// Compute reporter activity status based on last story date
function getActivityStatus(lastStoryAt?: string | null): 'Very active' | 'Active' | 'Dormant' | 'Inactive' {
  if (!lastStoryAt) return 'Inactive';
  const last = new Date(lastStoryAt).getTime();
  if (Number.isNaN(last)) return 'Inactive';
  const days = Math.floor((Date.now() - last) / (1000 * 60 * 60 * 24));
  if (days <= 7) return 'Very active';
  if (days <= 30) return 'Active';
  if (days <= 90) return 'Dormant';
  return 'Inactive';
}

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
  const [searchQuery, setSearchQuery] = useState('');
  const [stateVal, setStateVal] = useState<string | undefined>(undefined);
  const [cityVal, setCityVal] = useState<string | undefined>(undefined);
  const [countryVal, setCountryVal] = useState<string | undefined>(undefined);
  const [page] = useState(1);
  const notify = (useNotify?.() as unknown) as { ok: (msg: string, sub?: string) => void; error: (msg: string) => void } | undefined;
  const [sortBy, setSortBy] = useState<undefined | 'name' | 'stories' | 'lastStory' | 'activity'>(undefined);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Fetch base reporter list (broad; we will filter client-side)
  const { data, isLoading, isError, error } = useReporterContactsQuery({ page, limit: 200 });
  const unauthorized = (error as any)?.isUnauthorized === true || (error as any)?.status === 401;
  const items = (data?.rows ?? []) as ReporterContact[];
  // Optional debug: confirm payload shape from backend mapping
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug('[ReporterContactDirectory] contacts payload', { total: data?.total, count: items.length });
  }


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

  // Default country to India if present and not yet chosen
  useEffect(() => {
    if (!countryVal) {
      const hasIndia = items.some(i => norm(i.country, 'country').toLowerCase() === 'india');
      if (hasIndia) setCountryVal('India');
    }
  }, [items, countryVal]);

  // Client-side filtered reporters
  const [hasNotesOnly, setHasNotesOnly] = useState(false);
  const [activityFilter, setActivityFilter] = useState<'All activity' | 'Very active' | 'Active' | 'Dormant' | 'Inactive'>('All activity');
  const [typeFilter, setTypeFilter] = useState<'All'|'Community'|'Journalist'>('All');
  const [verificationFilter, setVerificationFilter] = useState<'All'|'Verified'|'Pending'|'Limited'|'Revoked'|'Unverified'|'Community Default'>('All');
  const [statusFilter, setStatusFilter] = useState<'All'|'Active'|'Watchlist'|'Suspended'|'Banned'>('All');

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
      hasNotesOnly,
      activityFilter,
      sortBy,
      sortDirection,
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {}
  }, [searchQuery, countryVal, stateVal, cityVal, hasNotesOnly, activityFilter, sortBy, sortDirection]);

  // moved to module scope

  const filteredReporters = useMemo(() => {
    let list = items;
    if (countryVal && countryVal !== 'All countries') {
      list = list.filter(r => norm(r.country, 'country').toLowerCase() === countryVal.toLowerCase());
    }
    if (stateVal && stateVal !== 'All states') {
      list = list.filter(r => norm(r.state, 'state').toLowerCase() === stateVal.toLowerCase());
    }
    if (cityVal && cityVal !== 'All cities') {
      list = list.filter(r => norm(r.city, 'city').toLowerCase() === cityVal.toLowerCase());
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(r => [r.name, r.email, r.phone].some(f => norm(f).toLowerCase().includes(q)));
    }
    if (hasNotesOnly) {
      list = list.filter(r => !!(r.notes && String(r.notes).trim().length > 0));
    }
    if (activityFilter !== 'All activity') {
      list = list.filter(r => getActivityStatus(r.lastStoryAt) === activityFilter);
    }
    if (typeFilter !== 'All') {
      list = list.filter(r => (r.reporterType || 'community') === (typeFilter === 'Journalist' ? 'journalist' : 'community'));
    }
    if (verificationFilter !== 'All') {
      list = list.filter(r => {
        const v = (r.verificationLevel || 'community_default');
        if (verificationFilter === 'Verified') return v === 'verified';
        if (verificationFilter === 'Pending') return v === 'pending';
        if (verificationFilter === 'Limited') return v === 'limited';
        if (verificationFilter === 'Revoked') return v === 'revoked';
        if (verificationFilter === 'Community Default') return v === 'community_default';
        return v === 'unverified';
      });
    }
    if (statusFilter !== 'All') {
      list = list.filter(r => {
        const s = (r.status || 'active');
        if (statusFilter === 'Active') return s === 'active';
        if (statusFilter === 'Watchlist') return s === 'watchlist';
        if (statusFilter === 'Suspended') return s === 'suspended';
        return s === 'banned';
      });
    }
    // Optional default sort: newest last story first, empties at bottom
    return list;
  }, [items, countryVal, stateVal, cityVal, searchQuery, hasNotesOnly, activityFilter, typeFilter, verificationFilter, statusFilter]);

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
      const rank = { 'Very active': 3, 'Active': 2, 'Dormant': 1, 'Inactive': 0 } as const;
      arr.sort((a, b) => {
        const ra = rank[getActivityStatus(a.lastStoryAt)];
        const rb = rank[getActivityStatus(b.lastStoryAt)];
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
        <select value={stateVal ?? ''} onChange={(e) => { setStateVal(e.target.value || undefined); setCityVal(undefined); }} className="px-3 py-2 border rounded-md text-sm">
          {uniqueStates.map(s => <option key={s ?? 'All states'} value={s === 'All states' ? '' : (s ?? '')}>{s}</option>)}
        </select>
        <select value={cityVal ?? ''} onChange={(e) => setCityVal(e.target.value || undefined)} className="px-3 py-2 border rounded-md text-sm">
          {filteredCities.map(c => <option key={c ?? 'All cities'} value={c === 'All cities' ? '' : (c ?? '')}>{c}</option>)}
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
            setSearchQuery('');
            setHasNotesOnly(false);
            setActivityFilter('All activity');
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
            <span className="text-xs text-slate-600">Type:</span>
            <select value={typeFilter} onChange={(e)=> setTypeFilter(e.target.value as any)} className="text-xs px-2 py-2 border rounded-md">
              {['All','Community','Journalist'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            <span className="text-xs text-slate-600">Verification:</span>
            <select value={verificationFilter} onChange={(e)=> setVerificationFilter(e.target.value as any)} className="text-xs px-2 py-2 border rounded-md">
              {['All','Verified','Pending','Limited','Revoked','Unverified','Community Default'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            <span className="text-xs text-slate-600">Status:</span>
            <select value={statusFilter} onChange={(e)=> setStatusFilter(e.target.value as any)} className="text-xs px-2 py-2 border rounded-md">
              {['All','Active','Watchlist','Suspended','Banned'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
          <select
            value={activityFilter}
            onChange={(e) => setActivityFilter(e.target.value as any)}
            className="text-xs px-2 py-2 border rounded-md"
            title="Filter by activity"
          >
            {['All activity','Very active','Active','Dormant','Inactive'].map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          <span className="text-xs text-slate-500">{filteredReporters.length} / {items.length} shown</span>
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
                // clear selection for visible ones only
                allVisibleIds.forEach(id => next.delete(id));
              } else {
                allVisibleIds.forEach(id => next.add(id));
              }
              return next;
            });
          }}
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

function DirectoryTable({ isLoading, isError, error, items, selectedIds, onToggleSelect, onToggleSelectAll, onSelect, notify }: { isLoading: boolean; isError: boolean; error: any; items: ReporterContact[]; selectedIds: Set<string>; onToggleSelect: (id: string) => void; onToggleSelectAll: () => void; onSelect: (r: ReporterContact) => void; notify?: { ok: (msg: string, sub?: string) => void; error: (msg: string) => void } }) {
  const navigate = useNavigate();
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
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Email</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Type</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Verification</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Status</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Phone</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">City</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">State</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Country</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">
              <button type="button" className="inline-flex items-center gap-1 hover:underline" onClick={() => (window as any).__rc_handleSortChange?.('stories') || undefined}>
                Stories <SortIndicator column="stories" />
              </button>
            </th>
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
          {(!items || items.length === 0) ? (
            <tr>
              <td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-600">No reporters match your filters yet.</td>
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
                    return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${map[s]}`}>{label[s]}</span>;
                  })()}
                  {typeof rc.ethicsStrikes === 'number' && rc.ethicsStrikes > 0 && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-800 border border-amber-200" title={`Ethics strikes: ${rc.ethicsStrikes}`}>⚠ {rc.ethicsStrikes}</span>
                  )}
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
                <td className="px-4 py-3 text-sm">{norm(rc.state, 'state') || '—'}</td>
                <td className="px-4 py-3 text-sm">{norm(rc.country, 'country') || '—'}</td>
                <td className="px-4 py-3 text-sm">{rc.totalStories}</td>
                <td className="px-4 py-3 text-sm">
                  {(() => {
                    const status = getActivityStatus(rc.lastStoryAt);
                    const styles: Record<string, string> = {
                      'Very active': 'bg-green-100 text-green-700',
                      'Active': 'bg-emerald-100 text-emerald-700',
                      'Dormant': 'bg-amber-100 text-amber-700',
                      'Inactive': 'bg-slate-100 text-slate-600',
                    };
                    return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${styles[status]}`}>{status}</span>;
                  })()}
                </td>
                <td className="px-4 py-3 text-sm">{rc.lastStoryAt ? new Date(rc.lastStoryAt).toLocaleString() : '—'}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const key = rc.reporterKey || rc.id || rc.email || '';
                      const name = rc.name || rc.email || 'Unknown reporter';
                      const qs = new URLSearchParams();
                      if (key) qs.set('reporterKey', key);
                      if (name) qs.set('name', name);
                      navigate(`/community/reporter-stories?${qs.toString()}`, { state: { reporterKey: key, reporterName: name } });
                    }}
                    className="text-xs px-3 py-1 rounded-md border hover:bg-slate-50"
                  >
                    View Stories
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onSelect(rc); }}
                    className="ml-2 text-xs px-3 py-1 rounded-md border hover:bg-slate-50"
                  >
                    View Profile
                  </button>
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
 
