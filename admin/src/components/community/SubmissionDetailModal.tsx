import React, { useState } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { getCommunitySubmission, updateCommunitySubmissionStatus, CommunitySubmission } from '../../lib/api/communitySubmissions';

interface Props {
  id: string | null;
  onClose: () => void;
  onStatusChange: (id: string, nextStatus: string, rejectReason?: string) => void;
}

export default function SubmissionDetailModal({ id, onClose, onStatusChange }: Props){
  const qc = useQueryClient();
  const [showRejectPrompt, setShowRejectPrompt] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['community-submission', id],
    queryFn: () => getCommunitySubmission(id!),
    enabled: !!id
  });
  const item: CommunitySubmission | undefined = data?.data || data; // adjust for possible API envelope

  if(!id) return null;

  async function approve(){
    if(!id) return;
    await updateCommunitySubmissionStatus(id, { status: 'APPROVED' });
    qc.invalidateQueries({ queryKey: ['community-submissions'] });
    onStatusChange(id, 'APPROVED');
    onClose();
  }
  async function rejectSubmit(e: React.FormEvent){
    e.preventDefault();
    if(!id) return;
    await updateCommunitySubmissionStatus(id, { status: 'REJECTED', rejectReason });
    qc.invalidateQueries({ queryKey: ['community-submissions'] });
    onStatusChange(id, 'REJECTED', rejectReason);
    setShowRejectPrompt(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded shadow-lg w-full max-w-xl max-h-[80vh] flex flex-col">
        <div className="px-4 py-3 border-b flex justify-between items-center">
          <h2 className="font-semibold">Community Submission Details</h2>
          <button onClick={onClose} className="text-sm text-slate-600 hover:underline">Close</button>
        </div>
        <div className="p-4 overflow-y-auto text-sm flex-1">
          {isLoading && <div>Loading...</div>}
          {!isLoading && item && (
            <div className="space-y-2">
              <div><span className="font-medium">Headline:</span> {item.headline}</div>
              <div><span className="font-medium">Name:</span> {item.name} {item.email && <span className="text-slate-500">({item.email})</span>}</div>
              <div><span className="font-medium">Location:</span> {item.location || '—'}</div>
              <div><span className="font-medium">Category:</span> {item.category || '—'}</div>
              <div><span className="font-medium">Status:</span> {item.status}</div>
              {item.rejectReason && <div><span className="font-medium">Reject Reason:</span> {item.rejectReason}</div>}
              <div>
                <span className="font-medium">Story:</span>
                <div className="mt-1 p-2 border rounded bg-slate-50 whitespace-pre-wrap max-h-48 overflow-y-auto text-xs">
                  {item.body || '—'}
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="p-4 border-t flex items-center justify-end gap-2">
          {!showRejectPrompt && (
            <>
              <button onClick={()=> setShowRejectPrompt(true)} className="btn-secondary">Reject</button>
              <button disabled={isLoading} onClick={approve} className="btn">Approve</button>
            </>
          )}
          {showRejectPrompt && (
            <form onSubmit={rejectSubmit} className="flex items-center gap-2 w-full">
              <input
                autoFocus
                type="text"
                placeholder="Reject reason"
                value={rejectReason}
                onChange={e=> setRejectReason(e.target.value)}
                className="flex-1 border rounded px-2 py-1 text-sm"
                required
              />
              <button type="button" onClick={()=> setShowRejectPrompt(false)} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn">Confirm</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
