import { useEffect, useState } from 'react';
import { founderApi } from '@/lib/founderApi';

export default function AiLogsViewer() {
  const [rows, setRows] = useState<any[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [prevStack, setPrevStack] = useState<string[]>([]);

  async function load(cursor?: string) {
    const r: any = await founderApi.getAiLogs(cursor);
    setRows(r.logs || []);
    setNextCursor(r.nextCursor ?? null);
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="rounded-2xl p-4 bg-executive-card text-white border border-white/5">
      <h3 className="text-lg font-semibold">AI Logs</h3>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-slate-400">
            <tr><th className="py-2">Time</th><th>Action</th><th>Subject</th><th>Result</th></tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map(r=> (
              <tr key={r.id} className="hover:bg-white/5">
                <td className="py-2">{new Date(r.time).toLocaleString()}</td>
                <td>{r.action}</td>
                <td>{r.subject}</td>
                <td>{r.result}</td>
              </tr>
            ))}
            {rows.length===0 && (<tr><td className="py-4 text-slate-400" colSpan={4}>No logs</td></tr>)}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between text-sm">
        <button
          className="px-3 py-1 rounded bg-slate-700 disabled:opacity-50"
          onClick={() => { const prev = prevStack[prevStack.length-1]; const rest = prevStack.slice(0,-1); setPrevStack(rest); load(prev); }}
          disabled={prevStack.length===0}
        >Prev</button>
        <button
          className="px-3 py-1 rounded bg-slate-700 disabled:opacity-50"
          onClick={() => { if (nextCursor) { setPrevStack([...prevStack, nextCursor]); load(nextCursor); } }}
          disabled={!nextCursor}
        >Next</button>
      </div>
    </div>
  );
}
