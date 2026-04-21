import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { fetchCommunitySubmissions } from '@/api/adminCommunityReporterApi';
import { normalizeError } from '@/lib/error';
import {
  CONTRIBUTOR_DIRECTORY_STORAGE_KEY,
  buildYouthContributorDirectory,
  normalizeYouthPulseSubmission,
  type YouthPulseContributorDirectoryEntry,
  type YouthPulseContributorMeta,
  type YouthPulseSubmission,
} from '@/lib/youthPulseCommunity';

function readContributorMeta(): Record<string, YouthPulseContributorMeta> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(CONTRIBUTOR_DIRECTORY_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export default function YouthPulseContributorDirectory() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submissions, setSubmissions] = useState<YouthPulseSubmission[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'watchlist' | 'paused'>('all');
  const [meta, setMeta] = useState<Record<string, YouthPulseContributorMeta>>(() => readContributorMeta());
  const [selectedId, setSelectedId] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(CONTRIBUTOR_DIRECTORY_STORAGE_KEY, JSON.stringify(meta));
    } catch {
      // Ignore storage issues.
    }
  }, [meta]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        let records = await fetchCommunitySubmissions({ status: 'all', page: 1, limit: 300 });
        if (!Array.isArray(records) || records.length === 0) {
          records = await fetchCommunitySubmissions({ page: 1, limit: 300 });
        }
        const normalized = records
          .map((item) => normalizeYouthPulseSubmission(item as Record<string, any>))
          .filter((item): item is YouthPulseSubmission => Boolean(item));
        if (cancelled) return;
        setSubmissions(normalized);
      } catch (err: any) {
        if (cancelled) return;
        const normalized = normalizeError(err, 'Failed to load the Youth Pulse contributor directory.');
        setError(normalized.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const contributors = useMemo(() => buildYouthContributorDirectory(submissions, meta), [meta, submissions]);

  const filteredContributors = useMemo(() => {
    const search = searchQuery.trim().toLowerCase();
    return contributors.filter((contributor) => {
      if (statusFilter !== 'all' && contributor.status !== statusFilter) return false;
      if (!search) return true;
      const haystack = [
        contributor.fullName,
        contributor.email,
        contributor.mobile,
        contributor.college,
        contributor.city,
        contributor.state,
        contributor.internalNotes,
      ].join(' ').toLowerCase();
      return haystack.includes(search);
    });
  }, [contributors, searchQuery, statusFilter]);

  const selectedContributor = filteredContributors.find((item) => item.id === selectedId)
    || contributors.find((item) => item.id === selectedId)
    || filteredContributors[0]
    || null;

  useEffect(() => {
    if (!selectedContributor) {
      setSelectedId('');
      return;
    }
    setSelectedId((current) => current || selectedContributor.id);
  }, [selectedContributor]);

  function updateContributorMeta(id: string, update: YouthPulseContributorMeta) {
    setMeta((current) => ({
      ...current,
      [id]: {
        ...current[id],
        ...update,
      },
    }));
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Community Hub</div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Youth Pulse Contact Directory</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Dedicated contributor directory for Youth Pulse Community submissions. This stays separate from Reporter Contact Directory and keeps Youth contributor notes and status in a distinct admin view.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <Link to="/community" className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50">
            Back to Community Hub
          </Link>
          <Link to="/community/reporter" className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50">
            Open Community Reporter Queue
          </Link>
          <Link to="/community/reporter-contacts" className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50">
            Open Reporter Contact Directory
          </Link>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search contributors by name, email, phone, college, city, state or notes"
              className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm xl:max-w-md"
            />
            <div className="flex flex-wrap gap-2">
              {(['all', 'active', 'watchlist', 'paused'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-full border px-3 py-1.5 text-sm ${statusFilter === status ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
                >
                  {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
          ) : null}

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3">Full Name</th>
                  <th className="px-3 py-3">Email</th>
                  <th className="px-3 py-3">Mobile</th>
                  <th className="px-3 py-3">College</th>
                  <th className="px-3 py-3">City</th>
                  <th className="px-3 py-3">State</th>
                  <th className="px-3 py-3">Submissions</th>
                  <th className="px-3 py-3">Approved</th>
                  <th className="px-3 py-3">Published</th>
                  <th className="px-3 py-3">Last Submission</th>
                  <th className="px-3 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={11} className="px-3 py-8 text-center text-slate-500">Loading Youth Pulse contributors…</td>
                  </tr>
                ) : filteredContributors.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-3 py-8 text-center text-slate-500">No contributors matched the current filters.</td>
                  </tr>
                ) : (
                  filteredContributors.map((contributor) => (
                    <tr
                      key={contributor.id}
                      onClick={() => setSelectedId(contributor.id)}
                      className={`cursor-pointer border-b border-slate-100 transition hover:bg-slate-50 ${selectedContributor?.id === contributor.id ? 'bg-slate-50' : 'bg-white'}`}
                    >
                      <td className="px-3 py-3 align-top font-medium text-slate-900">{contributor.fullName}</td>
                      <td className="px-3 py-3 align-top">{contributor.email}</td>
                      <td className="px-3 py-3 align-top">{contributor.mobile}</td>
                      <td className="px-3 py-3 align-top">{contributor.college}</td>
                      <td className="px-3 py-3 align-top">{contributor.city}</td>
                      <td className="px-3 py-3 align-top">{contributor.state}</td>
                      <td className="px-3 py-3 align-top">{contributor.submissionsCount}</td>
                      <td className="px-3 py-3 align-top">{contributor.approvedCount}</td>
                      <td className="px-3 py-3 align-top">{contributor.publishedCount}</td>
                      <td className="px-3 py-3 align-top whitespace-nowrap">{contributor.lastSubmissionLabel}</td>
                      <td className="px-3 py-3 align-top">
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                          {contributor.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Contributor Notes</h2>
            {!selectedContributor ? (
              <div className="mt-4 text-sm text-slate-500">Select a contributor to review directory details.</div>
            ) : (
              <div className="mt-4 space-y-4">
                <DirectoryField label="Full Name" value={selectedContributor.fullName} />
                <DirectoryField label="Email" value={selectedContributor.email} />
                <DirectoryField label="Mobile" value={selectedContributor.mobile} />
                <DirectoryField label="College" value={selectedContributor.college} />
                <DirectoryField label="City / State" value={`${selectedContributor.city}, ${selectedContributor.state}`} />
                <DirectoryField label="Submission Counts" value={`${selectedContributor.submissionsCount} total · ${selectedContributor.approvedCount} approved · ${selectedContributor.publishedCount} published`} />
                <DirectoryField label="Last Submission" value={selectedContributor.lastSubmissionLabel} />

                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Status</label>
                  <select
                    value={selectedContributor.status}
                    onChange={(event) => updateContributorMeta(selectedContributor.id, { status: event.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="active">Active</option>
                    <option value="watchlist">Watchlist</option>
                    <option value="paused">Paused</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Internal Notes</label>
                  <textarea
                    value={selectedContributor.internalNotes}
                    onChange={(event) => updateContributorMeta(selectedContributor.id, { internalNotes: event.target.value })}
                    rows={8}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Keep founder-safe internal notes about communication, follow-up, or contributor quality here"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-950 p-5 text-slate-100 shadow-sm">
            <h2 className="text-lg font-semibold">Directory Guardrails</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">Separate from Reporter Contact Directory so Youth Pulse contributor handling stays distinct.</div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">Counts are derived from Youth Pulse community submissions and linked draft/article states.</div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">Status and internal notes are stored only for this Youth Pulse contributor view.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DirectoryField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm text-slate-700">{value}</div>
    </div>
  );
}