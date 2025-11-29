import { useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { ReporterContact } from '@/lib/api/reporterDirectory.ts';
import { useReporterContactsQuery } from '@/features/community/api/reporterDirectory.ts';
import ReporterProfileDrawer from '@/components/community/ReporterProfileDrawer.tsx';

export default function ReporterContactDirectory() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [city, setCity] = useState<string | undefined>(undefined);
  const [stateVal, setStateVal] = useState<string | undefined>(undefined);
  const [country, setCountry] = useState<string | undefined>(undefined);
  const [sortBy, setSortBy] = useState<'lastStoryAt' | 'totalStories'>('lastStoryAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page] = useState(1);

  const { data, isLoading, isError, error } = useReporterContactsQuery({ q, city, state: stateVal, country, page, limit: 20, sortBy, sortDir });
  const items = (data?.items ?? []) as ReporterContact[];
  const uniqueCities = useMemo(() => ['All cities', ...Array.from(new Set(items.map(i => i.city).filter(Boolean))).sort()], [items]);
  const uniqueStates = useMemo(() => ['All states', ...Array.from(new Set(items.map(i => i.state).filter(Boolean))).sort()], [items]);
  const uniqueCountries = useMemo(() => ['All countries', ...Array.from(new Set(items.map(i => i.country).filter(Boolean))).sort()], [items]);
  const [selectedReporter, setSelectedReporter] = useState<ReporterContact | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  return (
    <div className="px-6 py-4 max-w-6xl mx-auto space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Reporter Contact Directory</h1>
        <p className="text-sm text-slate-600">Secure list of reporter contact & location for follow-up. Founder/Admin only.</p>
      </header>

      {/* Controls Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, email, or phone"
          className="w-full sm:w-64 px-3 py-2 border rounded-md text-sm"
        />
        <select value={city ?? ''} onChange={(e) => setCity(e.target.value || undefined)} className="px-3 py-2 border rounded-md text-sm">
          {uniqueCities.map((c) => (
            <option key={c} value={c === 'All cities' ? '' : c}>{c}</option>
          ))}
        </select>
        <select value={stateVal ?? ''} onChange={(e) => setStateVal(e.target.value || undefined)} className="px-3 py-2 border rounded-md text-sm">
          {uniqueStates.map((s) => (
            <option key={s} value={s === 'All states' ? '' : s}>{s}</option>
          ))}
        </select>
        <select value={country ?? ''} onChange={(e) => setCountry(e.target.value || undefined)} className="px-3 py-2 border rounded-md text-sm">
          {uniqueCountries.map((c) => (
            <option key={c} value={c === 'All countries' ? '' : c}>{c}</option>
          ))}
        </select>
        <select
          value={`${sortBy}:${sortDir}`}
          onChange={(e) => {
            const [sb, sd] = e.target.value.split(':') as ['lastStoryAt' | 'totalStories', 'asc' | 'desc'];
            setSortBy(sb);
            setSortDir(sd);
          }}
          className="px-3 py-2 border rounded-md text-sm"
        >
          <option value="lastStoryAt:desc">Newest activity (default)</option>
          <option value="totalStories:desc">Most stories</option>
        </select>
      </div>

      {/* Table with data */}
      <DirectoryTable
        isLoading={isLoading}
        isError={isError}
        error={error as any}
        items={items}
        sortBy={sortBy}
        sortDir={sortDir}
        onSelect={(r) => { setSelectedReporter(r); setIsProfileOpen(true); }}
      />

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

function DirectoryTable({ isLoading, isError, error, items, sortBy, sortDir, onSelect }: { isLoading: boolean; isError: boolean; error: any; items: ReporterContact[]; sortBy: 'lastStoryAt' | 'totalStories'; sortDir: 'asc' | 'desc'; onSelect: (r: ReporterContact) => void }) {
  const navigate = useNavigate();

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
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Stories {sortBy==='totalStories' && <span className="inline-block align-middle ml-1">{sortDir==='desc'?'▼':'▲'}</span>}</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Last Story {sortBy==='lastStoryAt' && <span className="inline-block align-middle ml-1">{sortDir==='desc'?'▼':'▲'}</span>}</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {(!items || items.length === 0) ? (
            <tr>
              <td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-600">No reporters match your filters yet.</td>
            </tr>
          ) : (
            items.map((rc) => (
              <tr key={rc.id} className="cursor-pointer hover:bg-slate-50" onClick={() => onSelect(rc)}>
                <td className="px-4 py-3 text-sm flex items-center gap-1">{rc.name || '—'} {rc.notes ? <span title="Has private notes" className="text-xs">📝</span> : null}</td>
                <td className="px-4 py-3 text-sm">{rc.email || '—'}</td>
                <td className="px-4 py-3 text-sm">{rc.phone || '—'}</td>
                <td className="px-4 py-3 text-sm">{rc.city || '—'}</td>
                <td className="px-4 py-3 text-sm">{rc.state || '—'}</td>
                <td className="px-4 py-3 text-sm">{rc.country || '—'}</td>
                <td className="px-4 py-3 text-sm">{rc.totalStories}</td>
                <td className="px-4 py-3 text-sm">{rc.lastStoryAt ? new Date(rc.lastStoryAt).toLocaleString() : '—'}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const key = rc.id; // unique reporter key (id/email/phone)
                      const name = rc.name || rc.email || 'Unknown reporter';
                      const qs = new URLSearchParams();
                      qs.set('reporterKey', key);
                      if (name) qs.set('name', name);
                      navigate(`/community/reporter-stories?${qs.toString()}`, { state: { reporterKey: key, reporterName: name } });
                    }}
                    className="text-xs px-3 py-1 rounded-md border hover:bg-slate-50"
                  >
                    View Stories
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
 
