import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { SubmitStoryResult } from '@/lib/api/communityReporterApi';

function humanizeReporterType(t: SubmitStoryResult['reporterType']): string {
  return t === 'journalist' ? 'Professional Journalist' : 'Community Reporter';
}

function humanizeStatus(s: SubmitStoryResult['status']): string {
  switch (s) {
    case 'under_review': return 'Under Review';
    case 'draft': return 'Draft';
    case 'approved': return 'Approved';
    case 'rejected': return 'Rejected';
    case 'withdrawn': return 'Withdrawn';
    default: return String(s);
  }
}

export const SubmissionSuccessCard: React.FC<{
  result: SubmitStoryResult;
  onNewStory: () => void;
}> = ({ result, onNewStory }) => {
  const navigate = useNavigate();

  return (
    <div className="max-w-2xl mx-auto mt-8">
      <div className="bg-white rounded-xl border border-emerald-200 shadow-sm p-8 text-center">
        <div className="mx-auto mb-4 flex items-center justify-center h-14 w-14 rounded-full bg-emerald-100 text-emerald-600">
          {/* Big green check icon */}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8">
            <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-2.29a.75.75 0 0 1 1.08 1.04l-5.25 5.5a.75.75 0 0 1-1.08 0l-2.25-2.36a.75.75 0 1 1 1.08-1.04l1.71 1.79 4.71-4.93Z" clipRule="evenodd" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-2">Story submitted successfully</h1>
        <p className="text-sm text-slate-600 mb-6">Thank you for sharing your story with News Pulse. Our editorial team will review it shortly.</p>

        <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800">{humanizeReporterType(result.reporterType)}</span>
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800">Ref: {result.referenceId}</span>
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800">Status: {humanizeStatus(result.status)}</span>
        </div>

        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            className="inline-flex items-center px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => navigate('/community/portal')}
          >
            View My Community Stories
          </button>
          <button
            type="button"
            className="inline-flex items-center px-4 py-2 rounded-md border border-slate-300 text-slate-800 hover:bg-slate-50"
            onClick={onNewStory}
          >
            Submit another story
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubmissionSuccessCard;
