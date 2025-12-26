import { useNavigate } from 'react-router-dom';

export default function AiLogsPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">🧠 AI Logs</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Pre-Launch / Under Setup — AI activity logs will appear here once AI features are enabled.
          </p>
        </div>
      </header>

      <section className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6">
        <div className="text-sm text-slate-700 dark:text-slate-200">
          This page will show a searchable history of AI actions (summaries, rewrites, moderation checks, etc.) for audit and debugging.
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => navigate('/admin/dashboard')}
            className="px-4 py-2 rounded bg-slate-900 text-white hover:bg-slate-800 transition"
          >
            Go to Dashboard
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/settings')}
            className="px-4 py-2 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            Open Settings
          </button>
        </div>
      </section>
    </div>
  );
}
