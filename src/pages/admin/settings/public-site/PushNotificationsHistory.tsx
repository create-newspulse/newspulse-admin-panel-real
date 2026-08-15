import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  filterPushHistory,
  formatPushAcceptedTiming,
  formatPushClickTiming,
  formatPushDeliveryProof,
  formatPushResponseTiming,
  loadPushHistory,
  PUSH_HISTORY_PAGE_SIZE,
  type PushHistoryFilterDate,
  type PushHistoryFilterStatus,
  type PushHistoryFilterType,
  type PushHistoryRecord,
} from '@/lib/pushHistory';

function formatCount(value: number | null): string {
  return value === null ? 'Unknown' : value.toLocaleString();
}

function typeChipClass(type: string): string {
  return type.toLowerCase() === 'breaking'
    ? 'border-red-200 bg-red-50 text-red-700'
    : 'border-blue-200 bg-blue-50 text-blue-700';
}

function statusChipClass(status: string): string {
  if (status === 'Clicked') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'Received') return 'border-sky-200 bg-sky-50 text-sky-700';
  if (status === 'FCM Accepted') return 'border-indigo-200 bg-indigo-50 text-indigo-700';
  if (status === 'Partial') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (status === 'Failed') return 'border-rose-200 bg-rose-50 text-rose-700';
  return 'border-slate-200 bg-slate-100 text-slate-700';
}

function renderDeliveryTimeline(first: string | null, last: string | null): string | null {
  if (!first && !last) return null;
  if (first && last) return `First ${first} | Last ${last}`;
  if (first) return `First ${first}`;
  return `Last ${last}`;
}

export default function PushNotificationsHistory() {
  const [records, setRecords] = useState<PushHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<PushHistoryFilterDate>('all');
  const [typeFilter, setTypeFilter] = useState<PushHistoryFilterType>('all');
  const [statusFilter, setStatusFilter] = useState<PushHistoryFilterStatus>('all');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const nextRecords = await loadPushHistory();
      if (!mounted) return;
      setRecords(nextRecords);
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setPage(1);
    setExpandedId(null);
  }, [dateFilter, typeFilter, statusFilter]);

  const filteredRecords = useMemo(
    () => filterPushHistory(records, { date: dateFilter, type: typeFilter, status: statusFilter }),
    [dateFilter, records, statusFilter, typeFilter],
  );

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PUSH_HISTORY_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleRecords = filteredRecords.slice((currentPage - 1) * PUSH_HISTORY_PAGE_SIZE, currentPage * PUSH_HISTORY_PAGE_SIZE);
  const summaryCards = useMemo(() => [
    { label: 'Total pushes', value: records.length },
    { label: 'Sent', value: records.filter((record) => record.status === 'FCM Accepted').length },
    { label: 'Received', value: records.filter((record) => record.status === 'Received').length },
    { label: 'Clicked', value: records.filter((record) => record.status === 'Clicked').length },
    { label: 'Failed', value: records.filter((record) => record.status === 'Failed').length },
    { label: 'No recipients', value: records.filter((record) => record.status === 'No recipients').length },
  ], [records]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-lg font-semibold text-slate-950">Push History</div>
            <div className="mt-1 text-sm text-slate-600">All retained push notification delivery records.</div>
          </div>
          <Link
            to="/admin/settings/public-site/push-notifications"
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Back to Push Notifications
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-1 text-sm font-semibold text-slate-700">
            <span>Date</span>
            <select
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value as PushHistoryFilterDate)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900"
            >
              <option value="today">Today</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="all">All retained records</option>
            </select>
          </label>
          <label className="space-y-1 text-sm font-semibold text-slate-700">
            <span>Type</span>
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as PushHistoryFilterType)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900"
            >
              <option value="all">All</option>
              <option value="breaking">Breaking</option>
              <option value="article">Article</option>
            </select>
          </label>
          <label className="space-y-1 text-sm font-semibold text-slate-700">
            <span>Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as PushHistoryFilterStatus)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900"
            >
              <option value="all">All</option>
              <option value="fcm-accepted">FCM Accepted</option>
              <option value="received">Received</option>
              <option value="clicked">Clicked</option>
              <option value="failed">Failed</option>
              <option value="no-recipients">No recipients</option>
              <option value="partial">Partial</option>
            </select>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6" aria-label="Push history summary">
          {summaryCards.map((card) => (
            <div key={card.label} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</div>
              <div className="mt-1 text-xl font-semibold tabular-nums text-slate-950">{card.value.toLocaleString()}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">Loading push history...</div>
        ) : visibleRecords.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">No push history records found.</div>
        ) : (
          <div data-testid="full-push-history-scroll" className="overflow-x-auto rounded-xl border border-slate-200">
            <table aria-label="Full push history" className="min-w-[1080px] table-fixed divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="w-52 whitespace-nowrap px-4 py-3 text-left">Sent At</th>
                  <th className="w-28 whitespace-nowrap px-4 py-3 text-left">Type</th>
                  <th className="w-[26rem] px-4 py-3 text-left">Title</th>
                  <th className="w-24 whitespace-nowrap px-4 py-3 text-right">Targeted</th>
                  <th className="w-28 whitespace-nowrap px-4 py-3 text-right">FCM Accepted</th>
                  <th className="w-32 whitespace-nowrap px-4 py-3 text-right">Browser Received</th>
                  <th className="w-20 whitespace-nowrap px-4 py-3 text-right">Clicked</th>
                  <th className="w-36 px-4 py-3 text-left">Final Status</th>
                  <th className="w-28 px-4 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {visibleRecords.map((item) => {
                  const isExpanded = expandedId === item.id;
                  const receivedTimeline = renderDeliveryTimeline(item.firstReceivedAt, item.lastReceivedAt);
                  const clickedTimeline = renderDeliveryTimeline(item.firstClickedAt, item.lastClickedAt);
                  return (
                    <Fragment key={item.id}>
                      <tr>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">{item.sentAt}</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${typeChipClass(item.type)}`}>{item.type}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          <div title={item.title} className="line-clamp-2 min-w-0 max-w-[24rem] break-words leading-5">{item.title}</div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-700">{formatCount(item.targeted)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-700">{formatCount(item.success)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-700">{formatCount(item.browserReceived)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-700">{formatCount(item.clicked)}</td>
                        <td className="px-4 py-3 text-slate-700">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${statusChipClass(item.status)}`}>{item.status}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            aria-expanded={isExpanded}
                            onClick={() => setExpandedId(isExpanded ? null : item.id)}
                          >
                            {isExpanded ? 'Hide details' : 'View details'}
                          </button>
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr>
                          <td colSpan={9} className="bg-slate-50 px-4 py-4 text-sm text-slate-700">
                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                              <div>
                                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Full title</div>
                                <div className="mt-1 break-words text-slate-900">{item.title}</div>
                              </div>
                              <div>
                                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Failure code</div>
                                <div className="mt-1 break-words text-slate-900">{item.failureCode || '-'}</div>
                              </div>
                              <div>
                                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Accepted timing</div>
                                <div className="mt-1 text-slate-900">{formatPushAcceptedTiming(item) || '-'}</div>
                              </div>
                              <div>
                                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Browser received</div>
                                <div className="mt-1 break-words text-slate-900">{receivedTimeline || '-'}</div>
                              </div>
                              <div>
                                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Click timing</div>
                                <div className="mt-1 break-words text-slate-900">{formatPushClickTiming(item) || clickedTimeline || '-'}</div>
                              </div>
                              <div>
                                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Extra notes</div>
                                <div className="mt-1 break-words text-slate-900">{formatPushDeliveryProof(item)}</div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <div>
            Showing {visibleRecords.length === 0 ? 0 : (currentPage - 1) * PUSH_HISTORY_PAGE_SIZE + 1}
            {visibleRecords.length > 0 ? `-${(currentPage - 1) * PUSH_HISTORY_PAGE_SIZE + visibleRecords.length}` : ''} of {filteredRecords.length}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}