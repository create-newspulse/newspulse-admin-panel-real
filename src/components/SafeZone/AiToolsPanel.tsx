import React, { useState } from 'react';
import { API_BASE_PATH } from '../../lib/api';

const AiToolsPanel: React.FC = () => {
  const [text, setText] = useState('');
  const [lang, setLang] = useState<'Gujarati'|'Hindi'|'English'>('Gujarati');
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<string>('');

  async function callTool(path: string, body: any) {
    setLoading(path);
    setResult('');
    try {
      const res = await fetch(`${API_BASE_PATH}/ai/tools/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const ct = res.headers.get('content-type') || '';
      if (!res.ok || !/application\/json/i.test(ct)) {
        const txt = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}. Body: ${txt.slice(0, 200)}`);
      }
      const json = await res.json();
      if (json?.ok && (json.result || json.raw)) {
        setResult(typeof json.result === 'string' ? json.result : JSON.stringify(json.result, null, 2));
      } else if (json?.content) {
        setResult(json.content);
      } else {
        setResult(JSON.stringify(json, null, 2));
      }
    } catch (e: any) {
      setResult(`Error: ${e?.message || String(e)}`);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="rounded-xl border dark:border-slate-700 p-4 bg-white dark:bg-slate-900">
      <h3 className="text-xl font-bold mb-3">AI Tools</h3>
      <textarea
        className="w-full border dark:border-slate-700 rounded-lg p-3 mb-3 dark:bg-slate-800"
        rows={6}
        placeholder="Paste article text or headline here..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <div className="flex flex-wrap gap-2 items-center mb-3">
        <select
          className="border dark:border-slate-700 rounded-lg p-2 dark:bg-slate-800"
          value={lang}
          onChange={(e) => setLang(e.target.value as any)}
        >
          <option value="Gujarati">Gujarati</option>
          <option value="Hindi">Hindi</option>
          <option value="English">English</option>
        </select>

        <button
          disabled={!!loading}
          onClick={() => callTool('summarize', { text, bullets: 2 })}
          className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading === 'summarize' ? 'Summarizing…' : 'Summarize'}
        </button>

        <button
          disabled={!!loading}
          onClick={() => callTool('translate', { text, targetLang: lang })}
          className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          {loading === 'translate' ? 'Translating…' : `Translate → ${lang}`}
        </button>

        <button
          disabled={!!loading}
          onClick={() => callTool('fact-check', { text })}
          className="px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
        >
          {loading === 'fact-check' ? 'Checking…' : 'Fact Check'}
        </button>

        <button
          disabled={!!loading}
          onClick={() => callTool('headline', { title: text })}
          className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
        >
          {loading === 'headline' ? 'Ranking…' : 'Rank Headline'}
        </button>

        <button
          disabled={!!loading}
          onClick={() => callTool('seo-meta', { text })}
          className="px-3 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50"
        >
          {loading === 'seo-meta' ? 'Optimizing…' : 'SEO Meta'}
        </button>

        <button
          disabled={!!loading}
          onClick={() => callTool('voice-script', { text, durationSec: 25 })}
          className="px-3 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50"
        >
          {loading === 'voice-script' ? 'Writing…' : 'Voice Script'}
        </button>
      </div>

      <pre className="whitespace-pre-wrap text-sm bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border dark:border-slate-700 overflow-auto max-h-72">{result}</pre>
    </div>
  );
};

export default AiToolsPanel;
