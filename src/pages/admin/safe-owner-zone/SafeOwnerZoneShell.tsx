import { Outlet } from 'react-router-dom';

export type OwnerZoneStatus = 'UNLOCKED';

export type OwnerZoneShellContext = {
  status: OwnerZoneStatus;
  founderStatus: string;
  websiteStatus: string;
  ownerKeyStatus: string;
  lastSnapshotLabel: string;
  lastAuditLabel: string;
};

export default function SafeOwnerZoneShell() {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-10">
      <div className="space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-8">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-3xl">Safe Zone</h1>
            <p className="text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
              Founder-only safety area. This section is reserved for future emergency, backup, audit, and protection controls.
            </p>
          </div>

          <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-100">
            Safe Zone is currently in preview mode. No action here changes the website.
          </div>

          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <span className="font-semibold text-slate-950 dark:text-white">Status:</span> Preview only
          </div>
        </div>

        <Outlet />
      </div>
    </section>
  );
}
