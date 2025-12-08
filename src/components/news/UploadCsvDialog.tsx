import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { usePublishFlag } from '@/context/PublishFlagContext';
import { useAuth } from '@/context/AuthContext';
import { sanitizeBulkRows } from '@/lib/bulkUploadGuard';
import { debug } from '@/lib/debug';
import { BulkUploadResult } from '@/types/api';

interface Props { onDone: ()=>void; }
export const UploadCsvDialog: React.FC<Props> = ({ onDone }) => {
  const qc = useQueryClient();
  const { publishEnabled } = usePublishFlag();
  const { user } = useAuth();
  const isFounder = (user?.role || '').toLowerCase() === 'founder';

  const mutate = useMutation<BulkUploadResult, Error, File>({ mutationFn: async (file: File) => {
    const fd = new FormData(); fd.append('file', file);
    const res = await api.post('/articles/bulk-upload', fd);
    if (!publishEnabled || !isFounder) {
      debug('[UploadCsvDialog] bulk upload performed while publish disabled or user not founder', { publishEnabled, isFounder });
    }
    return res.data as BulkUploadResult;
  }, onSuccess: () => qc.invalidateQueries({ queryKey: ['articles'] }) });
  const [file, setFile] = React.useState<File | null>(null);
  const [preflightMsg, setPreflightMsg] = React.useState<string | null>(null);
  const [validating, setValidating] = React.useState(false);
  return (
    <div className="p-4 border rounded bg-white space-y-3">
      <h2 className="font-semibold">CSV Upload</h2>
      <input type="file" accept=".csv" onChange={e=> { setFile(e.target.files?.[0] || null); setPreflightMsg(null); }} />
      <button
        disabled={!file || validating}
        onClick={()=> {
          if (!file) return;
            setValidating(true);
            const reader = new FileReader();
            reader.onload = () => {
              try {
                const text = String(reader.result || '');
                const lines = text.split(/\r?\n/).filter(l=> l.trim().length>0);
                if (lines.length < 2) {
                  setPreflightMsg('CSV appears empty');
                  setValidating(false);
                  return;
                }
                const header = lines[0].split(',');
                const statusIdx = header.findIndex(h => h.toLowerCase() === 'status');
                const scheduledIdx = header.findIndex(h => h.toLowerCase() === 'scheduledat');
                const dataRows = lines.slice(1);
                const parsed = dataRows.map(r => {
                  const cols = r.split(',');
                  return { status: statusIdx>=0 ? cols[statusIdx] : undefined, scheduledAt: scheduledIdx>=0 ? cols[scheduledIdx] : undefined };
                });
                const { changed } = sanitizeBulkRows(parsed, { publishEnabled, isFounder });
                if (changed > 0) {
                  setPreflightMsg(`Sanitized ${changed} publish/schedule statuses to draft (flag off or insufficient role). Proceeding.`);
                } else {
                  setPreflightMsg('Preflight OK');
                }
                mutate.mutate(file);
              } catch (err:any) {
                debug('[UploadCsvDialog] preflight error', err);
                setPreflightMsg('Preflight failed: ' + (err.message || 'unknown'));
              } finally {
                setValidating(false);
              }
            };
            reader.onerror = () => { setPreflightMsg('Unable to read file'); setValidating(false); };
            reader.readAsText(file);
        }}
        className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50"
      >{validating ? 'Validating…' : 'Upload'}</button>
      {preflightMsg && <div className="text-[11px] text-slate-600">{preflightMsg}</div>}
      {!publishEnabled && (
        <div className="text-[11px] text-amber-700">
          Publishing OFF: publish/scheduled statuses auto-downgraded to draft.
        </div>
      )}
      {mutate.data && (
        <div className="text-xs bg-slate-50 p-2 rounded border">
          created: {mutate.data.created}, updated: {mutate.data.updated}, skipped: {mutate.data.skipped}
          {((mutate.data?.errors?.length ?? 0) > 0) && (
            <pre className="mt-2 text-red-600 whitespace-pre-wrap">{JSON.stringify(mutate.data?.errors,null,2)}</pre>
          )}
        </div>
      )}
      <button onClick={onDone} className="px-3 py-1 bg-slate-600 text-white rounded">Close</button>
      <a href="data:text/csv;charset=utf-8,title,summary,content,category,tags,imageUrl,sourceName,sourceUrl,language,status,scheduledAt\nSample Title,Short summary,<p>HTML body</p>,Breaking,tag1;tag2,,Reuters,https://example.com,en,draft," download="articles-template.csv" className="text-blue-700 underline text-xs">Download Template</a>
    </div>
  );
};
