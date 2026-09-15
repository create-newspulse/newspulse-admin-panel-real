import { useEffect, useState } from 'react';

import { api } from '@/lib/api';

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

type FinanceSummary = {
  totalRevenue: number;
  paidAmount: number;
  outstandingAmount: number;
  revenueRecords: number;
};

type FinanceSummaryState =
  | { status: 'loading'; summary: null; error: null }
  | { status: 'connected'; summary: FinanceSummary; error: null }
  | { status: 'error'; summary: null; error: string };

function toFinanceNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function mapFinanceSummary(payload: any): FinanceSummary {
  return {
    totalRevenue: toFinanceNumber(payload?.totalRevenue ?? payload?.total),
    paidAmount: toFinanceNumber(payload?.paidAmount),
    outstandingAmount: toFinanceNumber(payload?.outstandingAmount),
    revenueRecords: toFinanceNumber(payload?.revenueRecords ?? payload?.recordCount),
  };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

export default function FinanceDesk() {
  const [summaryState, setSummaryState] = useState<FinanceSummaryState>({ status: 'loading', summary: null, error: null });

  useEffect(() => {
    let cancelled = false;

    api.revenue()
      .then((payload: any) => {
        if (cancelled) return;
        if (payload?.error) {
          setSummaryState({ status: 'error', summary: null, error: 'Finance summary is unavailable.' });
          return;
        }
        setSummaryState({ status: 'connected', summary: mapFinanceSummary(payload), error: null });
      })
      .catch(() => {
        if (!cancelled) setSummaryState({ status: 'error', summary: null, error: 'Finance summary is unavailable.' });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const summaryCards = [
    { label: 'Total Revenue', value: summaryState.summary ? formatCurrency(summaryState.summary.totalRevenue) : null },
    { label: 'Paid Amount', value: summaryState.summary ? formatCurrency(summaryState.summary.paidAmount) : null },
    { label: 'Outstanding Amount', value: summaryState.summary ? formatCurrency(summaryState.summary.outstandingAmount) : null },
    { label: 'Revenue Records', value: summaryState.summary ? summaryState.summary.revenueRecords.toLocaleString('en-IN') : null },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Admin Finance</div>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">Finance Desk</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Financial operations workspace for invoice tracking, receipts, expense records, revenue entries, sponsor payment status, reconciliation, and monthly finance reports to the Founder.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="Finance summary metrics">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-slate-950">Finance Summary</h2>
          <div className={summaryState.status === 'error' ? 'text-xs font-semibold text-rose-700' : 'text-xs font-semibold text-emerald-700'}>
            {summaryState.status === 'loading' ? 'Loading real Finance source' : summaryState.status === 'error' ? summaryState.error : 'Connected real Finance source'}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <article key={card.label} aria-label={`${card.label} summary`} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</div>
              <div className="mt-2 text-xl font-semibold text-slate-950">
                {summaryState.status === 'loading' ? 'Loading...' : summaryState.status === 'error' ? 'Unavailable' : card.value}
              </div>
            </article>
          ))}
        </div>
      </section>

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