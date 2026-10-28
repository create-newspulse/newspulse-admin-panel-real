import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApiClient as api } from '@/lib/adminApiClient';
import { usePublishFlag } from '@/context/PublishFlagContext';
import { useAuth } from '@/context/AuthContext';
import { BulkCsvValidationError, sanitizeBulkCsv } from '@/lib/bulkUploadGuard';
import { articleFollowUpWarning, normalizeArticleError } from '@/lib/articleLifecycle';
import { debug } from '@/lib/debug';
import type { BulkUploadResult } from '@/types/api';

interface Props { onDone: ()=>void; }
export const UploadCsvDialog: React.FC<Props> = ({ onDone }) => {
  const qc = useQueryClient();
  const { publishEnabled } = usePublishFlag();
  const { user, isAuthenticated, isReady, isLoading, isRestoring } = useAuth();
  const sessionReady = Boolean(isAuthenticated && isReady && !isLoading && !isRestoring && user?.role);
  const isFounder = sessionReady && (user?.role || '').toLowerCase() === 'founder';
  const access = React.useRef({ publishEnabled, isFounder, sessionReady });
  access.current = { publishEnabled, isFounder, sessionReady };
  const [file, setFile] = React.useState<File | null>(null);
  const [preflightMsg, setPreflightMsg] = React.useState<string | null>(null);
  const [followUpWarning, setFollowUpWarning] = React.useState<string | null>(null);
  const [validating, setValidating] = React.useState(false);
  const inFlight = React.useRef(false);
  const readerRef = React.useRef<FileReader | null>(null);
  const mounted = React.useRef(false);

  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      readerRef.current?.abort();
    };
  }, []);

  const mutate = useMutation<BulkUploadResult, unknown, File>({
    retry: false,
    mutationFn: async sourceFile => {
      const reader = new FileReader();
      readerRef.current = reader;
      const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
        reader.onload = () => {
          if (reader.result === null || typeof reader.result === 'string') {
            reject(new BulkCsvValidationError('Unable to read the CSV file. No upload was sent.'));
          } else {
            resolve(reader.result);
          }
        };
        reader.onerror = () => reject(new BulkCsvValidationError('Unable to read the CSV file. No upload was sent.'));
        reader.onabort = () => reject(new BulkCsvValidationError('CSV validation was cancelled. No upload was sent.'));
        reader.readAsArrayBuffer(sourceFile);
      });
      readerRef.current = null;
      if (!mounted.current || !access.current.sessionReady) {
        throw new BulkCsvValidationError('Your session is not ready. Sign in again before uploading.');
      }
      let text: string;
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      } catch {
        throw new BulkCsvValidationError('CSV must be valid UTF-8 text. No upload was sent.');
      }
      const { csv, changed, rowCount } = sanitizeBulkCsv(text, access.current);
      let sanitizedFile: File;
      try {
        sanitizedFile = new File([csv], sourceFile.name, { type: 'text/csv', lastModified: sourceFile.lastModified });
      } catch {
        throw new BulkCsvValidationError('Unable to prepare the sanitized CSV file. No upload was sent.');
      }
      const fd = new FormData();
      fd.append('file', sanitizedFile);
      setPreflightMsg(`Prepared ${rowCount} rows; sanitized publication/scheduling fields in ${changed} rows.`);
      setValidating(false);
      debug('[UploadCsvDialog] sanitized CSV prepared', { rowCount, changed });
      const res = await api.post<BulkUploadResult>('articles/bulk-upload', fd);
      return res.data;
    },
    onSuccess: async result => {
      setFollowUpWarning(articleFollowUpWarning(result));
      try {
        await qc.invalidateQueries({ queryKey: ['articles'] }, { throwOnError: true });
      } catch {
        setFollowUpWarning(previous => previous
          ? `${previous} The article list also could not be refreshed.`
          : 'CSV upload completed, but the article list could not be refreshed. Refresh the list; do not repeat the upload.');
      }
    },
    onSettled: () => {
      readerRef.current = null;
      inFlight.current = false;
      setValidating(false);
    },
  });
  const busy = validating || mutate.isPending;
  return (
    <div className="p-4 border rounded bg-white space-y-3">
      <h2 className="font-semibold">CSV Upload</h2>
      <input type="file" accept=".csv" aria-label="CSV file" disabled={busy} onChange={e => {
        if (inFlight.current) return;
        setFile(e.target.files?.[0] || null);
        setPreflightMsg(null);
        setFollowUpWarning(null);
        mutate.reset();
      }} />
      <button
        disabled={!file || !sessionReady || busy || mutate.isSuccess}
        onClick={() => {
          if (!file || !sessionReady || inFlight.current || mutate.isSuccess) return;
          inFlight.current = true;
          setValidating(true);
          setPreflightMsg(null);
          setFollowUpWarning(null);
          mutate.mutate(file);
        }}
        className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50"
      >{validating ? 'Validating…' : mutate.isPending ? 'Uploading…' : 'Upload'}</button>
      {preflightMsg && <div role="status" className="text-[11px] text-slate-600">{preflightMsg}</div>}
      {mutate.isError && (
        <div role="alert" className="text-xs text-red-600">
          {mutate.error instanceof BulkCsvValidationError
            ? `Preflight failed: ${mutate.error.message}`
            : normalizeArticleError(mutate.error, 'CSV upload failed').message}
        </div>
      )}
      {followUpWarning && <div role="alert" className="text-xs text-amber-700">{followUpWarning}</div>}
      {(!publishEnabled || !isFounder) && (
        <div className="text-[11px] text-amber-700">
          {publishEnabled ? 'CSV publishing and scheduling require Founder.' : 'Publishing OFF:'}
          {' '}Publish/scheduled statuses are downgraded to draft and publication/scheduling timestamps are cleared.
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
      <button onClick={onDone} disabled={busy} className="px-3 py-1 bg-slate-600 text-white rounded disabled:opacity-50">Close</button>
      <a href="data:text/csv;charset=utf-8,title,summary,content,category,tags,imageUrl,sourceName,sourceUrl,language,status,scheduledAt\nSample Title,Short summary,<p>HTML body</p>,Breaking,tag1;tag2,,Reuters,https://example.com,en,draft," download="articles-template.csv" className="text-blue-700 underline text-xs">Download Template</a>
    </div>
  );
};
