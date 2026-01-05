import React, { useEffect, useState } from 'react';
import { apiUrl } from '../lib/api';

// AIRA endpoints are public API routes (NOT admin):
// - proxy mode:  /admin-api/aira/*
// - direct mode: <backend>/api/aira/*
const AIRA_BASE = apiUrl('/api/aira').replace(/\/+$/, '');

export interface AiraItem {
  id: string;
  ts: number;
  lang: string;
  title: string;
  script: string;
  audioUrl: string | null;
}

const fmtTime = (ts: number) => new Date(ts).toLocaleString();

const speakWithBrowser = async (text: string, lang: string) => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    alert('SpeechSynthesis not supported.');
    return;
  }
  const utter = new SpeechSynthesisUtterance(text);
  // Best-effort voice selection
  utter.lang = /guj|Gujarati/i.test(lang) ? 'gu-IN' : /hi|Hindi/i.test(lang) ? 'hi-IN' : 'en-US';
  utter.rate = 1.0;
  utter.pitch = 1.0;
  speechSynthesis.cancel();
  speechSynthesis.speak(utter);
};

const AiraVoicePlayer: React.FC = () => {
  const [items, setItems] = useState<AiraItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [lang, setLang] = useState<'Gujarati'|'Hindi'|'English'>('Gujarati');
  const [focus, setFocus] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${AIRA_BASE}/bulletins`, { credentials: 'include' });
      const json = await res.json();
      if (json?.ok && Array.isArray(json.items)) setItems(json.items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const generate = async () => {
    setGenLoading(true);
    try {
      const r = await fetch(`${AIRA_BASE}/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ lang, durationSec: 45, focus }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.detail || 'Failed to generate');
      await load();
    } catch (e: any) {
      alert(e?.message || String(e));
    } finally {
      setGenLoading(false);
    }
  };

  const remove = async (id: string) => {
    if (!id) return;
    const ok = window.confirm('Delete this bulletin? This action cannot be undone.');
    if (!ok) return;
    setDeletingId(id);
    try {
      const r = await fetch(`${AIRA_BASE}/bulletins/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.detail || 'Delete failed');
      setItems(prev => prev.filter(x => x.id !== id));
    } catch (e: any) {
      alert(e?.message || String(e));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="rounded-xl border dark:border-slate-700 p-4 bg-white dark:bg-slate-900">
      <h3 className="text-xl font-bold mb-3">AIRA Voice Bulletins</h3>

      <div className="flex flex-wrap gap-2 items-center mb-3">
        <select className="border dark:border-slate-700 rounded-lg p-2 dark:bg-slate-800" value={lang} onChange={(e)=>setLang(e.target.value as any)}>
          <option value="Gujarati">Gujarati</option>
          <option value="Hindi">Hindi</option>
          <option value="English">English</option>
        </select>
        <input className="border dark:border-slate-700 rounded-lg p-2 dark:bg-slate-800 flex-1 min-w-[220px]" placeholder="Focus (optional) e.g., Youth Pulse" value={focus} onChange={(e)=>setFocus(e.target.value)} />
        <button disabled={genLoading} onClick={generate} className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          {genLoading ? 'Generating…' : 'Generate Now'}
        </button>
      </div>

      {loading ? <div>Loading…</div> : (
        items.length === 0 ? <div>No bulletins yet.</div> : (
          <div className="space-y-3">
            {items.map(it => (
              <div key={it.id} className="border dark:border-slate-700 rounded-lg p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold">{it.title}</div>
                  <div className="text-xs opacity-70">{fmtTime(it.ts)} · {it.lang}</div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  {it.audioUrl ? (
                    <audio controls src={it.audioUrl} className="w-full" />
                  ) : (
                    <button className="px-2 py-1 bg-slate-800 text-white rounded hover:bg-slate-700" onClick={()=>speakWithBrowser(it.script, it.lang)}>Play (browser TTS)</button>
                  )}
                  <button disabled={deletingId === it.id} className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50" onClick={()=>remove(it.id)}>
                    {deletingId === it.id ? 'Deleting…' : 'Delete'}
                  </button>
                  <details className="ml-auto">
                    <summary className="cursor-pointer text-sm">Show script</summary>
                    <pre className="mt-2 whitespace-pre-wrap text-sm bg-slate-50 dark:bg-slate-800 p-2 rounded border dark:border-slate-700 max-h-48 overflow-auto">{it.script}</pre>
                  </details>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
};

export default AiraVoicePlayer;
