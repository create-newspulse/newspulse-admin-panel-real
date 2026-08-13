import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  filterPushHistory,
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

export default function PushNotificationsHistory() {
  const [records, setRecords] = useState<PushHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<PushHistoryFilterDate>('all');
  const [typeFilter, setTypeFilter] = useState<PushHistoryFilterType>('all');
  const [statusFilter, setStatusFilter] = useState<PushHistoryFilterStatus>('all');
  const [page, setPage] = useState(1);

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
  }, [dateFilter, typeFilter, statusFilter]);

  const filteredRecords = useMemo(
    () => filterPushHistory(records, { date: dateFilter, type: typeFilter, status: statusFilter }),
    [dateFilter, records, statusFilter, typeFilter],
  );

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PUSH_HISTORY_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleRecords = filteredRecords.slice((currentPage - 1) * PUSH_HISTORY_PAGE_SIZE, currentPage * PUSH_HISTORY_PAGE_SIZE);

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
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
              <option value="no-recipients">No recipients</option>
            </select>
          </label>
        </div>

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">Loading push history...</div>
        ) : visibleRecords.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">No push history records found.</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Title</th>
                  <th className="px-4 py-3 text-left">Sent At</th>
                  <th className="px-4 py-3 text-right">Targeted</th>
                  <th className="px-4 py-3 text-right">Success</th>
                  <th className="px-4 py-3 text-right">Failed</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Failure Code</th>
                  <th className="px-4 py-3 text-left">Failure Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {visibleRecords.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{item.type}</td>
                    <td className="px-4 py-3 text-slate-700">{item.title}</td>
                    <td className="px-4 py-3 text-slate-700">{item.sentAt}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{formatCount(item.targeted)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{formatCount(item.success)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{formatCount(item.failed)}</td>
                    <td className="px-4 py-3 text-slate-700">{item.status}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <span className="block max-w-56 break-words">{item.status === 'Failed' && item.failureCode ? item.failureCode : '-'}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <span className="block max-w-xs break-words">{item.status === 'Failed' && item.failureMessage ? item.failureMessage : '-'}</span>
                    </td>
                  </tr>
                ))}
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