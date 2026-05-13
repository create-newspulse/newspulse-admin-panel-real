import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import {
  DEFAULT_ADMIN_FEATURE_VISIBILITY,
  OWNER_CONTROLLED_FEATURES,
  isOwnerRole,
} from '@/lib/adminFeatureVisibility';
import { useAdminFeatureVisibility } from '@/hooks/useAdminFeatureVisibility';

export type SafeOwnerZonePhaseOneTab =
  | 'hub'
  | 'security'
  | 'emergency'
  | 'ai-safety'
  | 'backup'
  | 'compliance'
  | 'system-health'
  | 'audit-logs';

export function resolvePhaseOneTab(_slug?: string | null): SafeOwnerZonePhaseOneTab {
  return 'hub';
}

export default function SafeOwnerZonePhaseOne(_props: { tab?: SafeOwnerZonePhaseOneTab }) {
  const { isFounder, user } = useAuth();
  const { visibility, isLoading, isSaving, save, error } = useAdminFeatureVisibility();
  const [draft, setDraft] = useState(DEFAULT_ADMIN_FEATURE_VISIBILITY);
  const ownerRole = useMemo(() => isFounder || isOwnerRole(user?.role), [isFounder, user?.role]);
  const canSeeComplianceReports = ownerRole || visibility['compliance-reports'] !== false;

  useEffect(() => {
    setDraft(visibility);
  }, [visibility]);

  const dirty = OWNER_CONTROLLED_FEATURES.some((item) => draft[item.key] !== visibility[item.key]);
  const lockedItems = [
    { key: 'dashboard', label: 'Dashboard', note: 'Locked ON' },
    { key: 'soz', label: 'Safe Zone', note: 'Founder-only locked' },
    { key: 'dark', label: 'Dark', note: 'Locked ON' },
    { key: 'logout', label: 'Logout', note: 'Locked ON' },
  ];

  async function handleSave() {
    try {
      await save(draft);
      toast.success('Owner feature visibility updated');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save feature visibility');
    }
  }

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-10">
      <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-3xl">Safe Zone</h1>
          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
            Founder-only safety area. This section is reserved for future emergency, backup, audit, and protection controls.
          </p>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-100">
          Safe Zone is currently in preview mode. No action here changes the website.
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
          <span className="font-semibold text-slate-950 dark:text-white">Status:</span> Preview only
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-950/40">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Owner Feature Visibility</h2>
              <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                Control which admin navbar modules are visible to non-owner users. Founder visibility always remains unchanged.
              </p>
            </div>
            {isFounder ? (
              <button
                type="button"
                onClick={handleSave}
                disabled={!dirty || isSaving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? 'Saving...' : 'Save visibility'}
              </button>
            ) : null}
          </div>

          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100">
            Founder always sees every nav item. Non-owner users only see the modules enabled below.
          </div>

          {!isFounder ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              This section is founder-controlled. Locked modules remain unchanged.
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800/60 dark:bg-red-950/30 dark:text-red-100">
              Failed to load the saved visibility settings. Founder navigation still fails safe and remains fully visible.
            </div>
          ) : null}

          <div className="mt-5 grid gap-3">
            {OWNER_CONTROLLED_FEATURES.map((item) => (
              <label
                key={item.key}
                className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-700"
              >
                <div>
                  <div className="font-medium text-slate-900 dark:text-white">{item.label}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {draft[item.key] ? 'Visible to non-owner users' : 'Hidden from non-owner users'}
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={draft[item.key]}
                  disabled={!isFounder || isLoading || isSaving}
                  onClick={() => setDraft((current) => ({ ...current, [item.key]: !current[item.key] }))}
                  className={`inline-flex h-7 w-14 items-center rounded-full border transition ${draft[item.key] ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 bg-slate-300 dark:border-slate-600 dark:bg-slate-700'} disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  <span
                    className={`inline-block h-5 w-5 rounded-full bg-white transition ${draft[item.key] ? 'translate-x-8' : 'translate-x-1'}`}
                  />
                </button>
              </label>
            ))}
          </div>

          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-900">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Locked Modules</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {lockedItems.map((item) => (
                <div key={item.key} className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950">
                  <div className="font-medium text-slate-900 dark:text-white">{item.label}</div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.note}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {canSeeComplianceReports ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-950/40">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Compliance &amp; Legal Controls</h2>
                <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                  Founder and legal compliance controls that link directly to the existing compliance reporting workspace.
                </p>
              </div>
              <Link
                to="/admin/compliance-reports"
                className="inline-flex items-center justify-center rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
              >
                Open Compliance Reports
              </Link>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-900">
              <div className="text-base font-semibold text-slate-950 dark:text-white">Compliance Reports</div>
              <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                Manage monthly compliance reports, grievance officer details, and internal compliance records.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
