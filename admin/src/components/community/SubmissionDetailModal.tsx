import React, { useState, useEffect } from 'react';
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
  const [aiHeadline, setAiHeadline] = useState('');
  const [aiBody, setAiBody] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['community-submission', id],
    queryFn: () => getCommunitySubmission(id!),
    enabled: !!id
  });
  const item: CommunitySubmission | undefined = data?.data || data; // adjust for possible API envelope

  // Initialize AI editable fields when item loads / id changes
  useEffect(()=> {
    if(item){
      setAiHeadline(item.aiHeadline || '');
      setAiBody(item.aiBody || '');
    }
  }, [item, id]);

  if(!id) return null;

  async function approve(){
    if(!id) return;
    await updateCommunitySubmissionStatus(id, { status: 'APPROVED', aiHeadline: aiHeadline || item?.aiHeadline, aiBody: aiBody || item?.aiBody });
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
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold mb-2">Original Story</h3>
                  <div className="mb-2">
                    <span className="font-medium text-xs uppercase tracking-wide text-slate-600">Headline</span>
                    <div className="mt-1 p-2 border rounded bg-slate-50 text-xs min-h-[38px] whitespace-pre-wrap">{item.headline || '—'}</div>
                  </div>
                  <div>
                    <span className="font-medium text-xs uppercase tracking-wide text-slate-600">Body</span>
                    <div className="mt-1 p-2 border rounded bg-slate-50 text-xs max-h-60 overflow-y-auto whitespace-pre-wrap">{item.body || '—'}</div>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">AI-Suggested Version</h3>
                  <div className="mb-2">
                    <label className="font-medium text-xs uppercase tracking-wide text-slate-600" htmlFor="aiHeadline">AI Headline</label>
                    <textarea
                      id="aiHeadline"
                      className="mt-1 w-full border rounded px-2 py-1 text-xs min-h-[60px]"
                      placeholder="AI suggested headline"
                      value={aiHeadline}
                      onChange={e=> setAiHeadline(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="font-medium text-xs uppercase tracking-wide text-slate-600" htmlFor="aiBody">AI Body</label>
                    <textarea
                      id="aiBody"
                      className="mt-1 w-full border rounded px-2 py-1 text-xs min-h-[140px]"
                      placeholder="AI suggested body"
                      value={aiBody}
                      onChange={e=> setAiBody(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <div><span className="font-medium">Name:</span> {item.userName} {item.email && <span className="text-slate-500">({item.email})</span>}</div>
                <div><span className="font-medium">Location:</span> {item.location || '—'}</div>
                <div><span className="font-medium">Category:</span> {item.category || '—'}</div>
                <div><span className="font-medium">Status:</span> {item.status}</div>
                {item.rejectReason && <div><span className="font-medium">Reject Reason:</span> {item.rejectReason}</div>}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">Risk:</span>
                  {typeof item.riskScore === 'number' ? (
                    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${item.riskScore <= 25 ? 'bg-green-100 text-green-700 border-green-200' : item.riskScore <= 60 ? 'bg-yellow-100 text-yellow-700 border-yellow-200' : 'bg-red-100 text-red-700 border-red-200'}`}>{item.riskScore}</span>
                  ) : '—'}
                </div>
                <div>
                  <span className="font-medium">Flags:</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {item.flags && item.flags.length > 0 ? (
                      item.flags.map(f => (
                        <span key={f} className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-xs font-medium">{f}</span>
                      ))
                    ) : (
                      <span className="text-slate-500 text-xs">No risk flags</span>
                    )}
                  </div>
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
