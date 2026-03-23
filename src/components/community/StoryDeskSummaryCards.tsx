import type { ReactNode } from 'react';

export type StoryDeskSummary = {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  withdrawn: number;
  published: number;
  thisMonth: number;
  lastSubmissionLabel: string;
};

function Card({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

export default function StoryDeskSummaryCards({ summary }: { summary: StoryDeskSummary }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
      <Card label="Total Stories" value={summary.total} />
      <Card label="Approved" value={summary.approved} />
      <Card label="Pending" value={summary.pending} />
      <Card label="Rejected" value={summary.rejected} />
      <Card label="Withdrawn" value={summary.withdrawn} />
      <Card label="Published" value={summary.published} />
      <Card label="This Month" value={summary.thisMonth} />
      <Card label="Last Submission" value={summary.lastSubmissionLabel} />
    </div>
  );
}
