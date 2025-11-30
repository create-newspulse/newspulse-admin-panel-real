import React from 'react';

export type CommunityStoryStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'published'
  | 'rejected'
  | 'withdrawn'
  | 'removed';

export function mapStoryStatus(raw: string | undefined | null): CommunityStoryStatus {
  const s = String(raw || '').toLowerCase();
  if (!s) return 'draft';
  if (s === 'draft') return 'draft';
  if (s === 'approved') return 'approved';
  if (s === 'published' || s === 'live') return 'published';
  if (s === 'rejected' || s === 'declined') return 'rejected';
  if (s === 'withdrawn' || s === 'withdraw') return 'withdrawn';
  if (s === 'removed' || s === 'taken_down' || s === 'takedown') return 'removed';
  if (s === 'deleted' || s === 'archived') return 'removed';
  if (s === 'pending' || s === 'pending_review' || s === 'under_review' || s === 'submitted') return 'submitted';
  return s.includes('pending') || s.includes('review') ? 'submitted' : 'draft';
}

export default function StoryStatusPill({ status }: { status: CommunityStoryStatus }) {
  const label = {
    draft: 'Draft',
    submitted: 'Submitted',
    approved: 'Approved',
    published: 'Published on News Pulse',
    rejected: 'Rejected',
    withdrawn: 'Withdrawn',
    removed: 'Removed by News Pulse',
  }[status];

  const classes = {
    draft: 'bg-slate-100 text-slate-700',
    submitted: 'bg-blue-100 text-blue-700',
    approved: 'bg-emerald-100 text-emerald-700',
    published: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-700',
    withdrawn: 'bg-amber-100 text-amber-700',
    removed: 'bg-rose-100 text-rose-700',
  }[status];

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${classes}`}>
      {label}
    </span>
  );
}
