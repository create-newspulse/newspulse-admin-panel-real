import { Link } from 'react-router-dom';

const BROADCAST_CENTER_PATH = '/admin/broadcast-center';

export default function TickersSettings() {
  // Breaking/Live Updates ticker configuration (enabled, speed/duration, max items,
  // pause-on-hover) is now owned exclusively by Broadcast Center. This page intentionally
  // no longer reads/patches `draft.tickers.*` so it cannot act as a second editor and cannot
  // inject destructive defaults into the stored PublicSiteSettings ticker object when other
  // Settings Center sections are saved or published. Homepage `.order` fields for these
  // modules remain owned by Homepage Modules Settings and are unaffected by this page.
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-lg font-semibold">Breaking & Live Updates</div>
        <div className="mt-1 text-sm text-slate-600">
          Breaking and Live Updates ticker configuration is managed in Broadcast Center.
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="text-sm text-slate-600">
          Use Broadcast Center to manage ticker visibility, timing and editorial updates.
        </div>
        <Link
          to={BROADCAST_CENTER_PATH}
          className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Manage in Broadcast Center
        </Link>
      </div>
    </div>
  );
}
