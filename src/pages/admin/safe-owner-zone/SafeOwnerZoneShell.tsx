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
              Founder-only emergency, recovery, audit and protection area.
            </p>
          </div>
        </div>

        <Outlet />
      </div>
    </section>
  );
}
