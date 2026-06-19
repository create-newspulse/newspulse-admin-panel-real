const financeItems = [
  'Invoices and receipt records',
  'Revenue and expense entries',
  'Sponsor payment status',
  'Monthly finance reports for Founder review',
  'Reconciliation summary exports',
];

const restrictedItems = [
  'Bank detail changes',
  'Payment gateway settings',
  'Withdrawal approvals',
  'Finance record deletion',
  'Final finance report approval',
];

export default function FinanceDesk() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Admin Finance</div>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">Finance Desk</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Financial operations workspace for invoice tracking, receipts, expense records, revenue entries, sponsor payment status, reconciliation, and monthly finance reports to the Founder.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <h2 className="text-base font-semibold text-emerald-950">Finance & Accounts Manager Scope</h2>
          <div className="mt-4 space-y-2 text-sm text-emerald-900">
            {financeItems.map((item) => (
              <div key={item} className="rounded-lg border border-emerald-200 bg-white px-3 py-2">{item}</div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
          <h2 className="text-base font-semibold text-rose-950">Founder-only Finance Controls</h2>
          <div className="mt-4 space-y-2 text-sm text-rose-900">
            {restrictedItems.map((item) => (
              <div key={item} className="rounded-lg border border-rose-200 bg-white px-3 py-2">{item}</div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}