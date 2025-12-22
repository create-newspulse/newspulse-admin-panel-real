export default function SessionsPanel() {
  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">Active Sessions</h2>
          <span className="text-xs rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            Awaiting backend
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          View active logins/devices, revoke sessions, and logout all sessions.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800">
            Logout all sessions
          </button>
          <button type="button" disabled className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800">
            Revoke selected
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 dark:text-slate-300">
                <th className="py-2 pr-4">Device</th>
                <th className="py-2 pr-4">IP</th>
                <th className="py-2 pr-4">Last Active</th>
                <th className="py-2 pr-4">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={4} className="py-6 text-slate-500 dark:text-slate-300">
                  No session data yet.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
