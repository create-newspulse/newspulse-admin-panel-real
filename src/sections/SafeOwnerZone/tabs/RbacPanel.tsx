export default function RbacPanel() {
  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">RBAC</h2>
          <span className="text-xs rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            Awaiting backend
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Manage roles and permissions for Founder/Admin/Editor/Staff.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800">
            Create role
          </button>
          <button type="button" disabled className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800">
            Save changes
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
            <div className="text-sm font-semibold">Roles</div>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">Founder, Admin, Editor, Staff</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
            <div className="text-sm font-semibold">Permissions</div>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Define allowed actions (publish, settings, security controls, etc.).
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
