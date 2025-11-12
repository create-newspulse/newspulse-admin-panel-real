import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

interface Props { onDone: ()=>void; }
export const UploadCsvDialog: React.FC<Props> = ({ onDone }) => {
  const qc = useQueryClient();
  const mutate = useMutation({ mutationFn: async (file: File) => {
    const fd = new FormData(); fd.append('file', file); const res = await api.post('/articles/bulk-upload', fd); return res.data; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['articles'] })
  });
  const [file, setFile] = React.useState<File | null>(null);
  return (
    <div className="p-4 border rounded bg-white space-y-3">
      <h2 className="font-semibold">CSV Upload</h2>
      <input type="file" accept=".csv" onChange={e=> setFile(e.target.files?.[0] || null)} />
      <button disabled={!file} onClick={()=> file && mutate.mutate(file)} className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50">Upload</button>
      {mutate.data && (
        <div className="text-xs bg-slate-50 p-2 rounded border">
          created: {mutate.data.created}, updated: {mutate.data.updated}, skipped: {mutate.data.skipped}
          {mutate.data.errors?.length>0 && <pre className="mt-2 text-red-600 whitespace-pre-wrap">{JSON.stringify(mutate.data.errors,null,2)}</pre>}
        </div>
      )}
      <button onClick={onDone} className="px-3 py-1 bg-slate-600 text-white rounded">Close</button>
      <a href="data:text/csv;charset=utf-8,title,summary,content,category,tags,imageUrl,sourceName,sourceUrl,language,status,scheduledAt\nSample Title,Short summary,<p>HTML body</p>,Breaking,tag1;tag2,,Reuters,https://example.com,en,draft," download="articles-template.csv" className="text-blue-700 underline text-xs">Download Template</a>
    </div>
  );
};
