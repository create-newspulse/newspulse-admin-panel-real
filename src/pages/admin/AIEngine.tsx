import { useEffect, useState } from 'react';
import { api as apiLib } from '../../lib/api';

const API_ORIGIN = (import.meta.env.VITE_API_URL?.toString() || 'https://newspulse-backend-real.onrender.com').replace(/\/+$/, '');
const API_BASE = `${API_ORIGIN}/api`;

// Simple options
const LANGUAGES = ['English', 'Hindi', 'Gujarati'];
const TASKS = ['Summarize', 'Rewrite', 'Creative Narrative', '5W1H Story', 'SEO Article'];

type ProviderKey = 'openai' | 'gemini';

export default function AIEngine(): JSX.Element {
  const [provider, setProvider] = useState<ProviderKey>('openai');
  const [model, setModel] = useState<string>('');
  const [serverModel, setServerModel] = useState<string>('');
  const [language, setLanguage] = useState<string>('English');
  const [task, setTask] = useState<string>('Summarize');
  const [founderCommand, setFounderCommand] = useState<string>('');
  const [sourceText, setSourceText] = useState<string>('');
  const [sourceUrl, setSourceUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [result, setResult] = useState<any>(null);

  const run = async () => {
    setError('');
    setResult(null);
    if (!sourceText.trim() && !sourceUrl.trim()) {
      setError('Please paste content or provide a source URL.');
      return;
    }
    setLoading(true);
    try {
  const resp = await apiLib.aiEngineRun({ provider, model, language, taskType: task, founderCommand, sourceText, url: sourceUrl });
      setResult(resp.result);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to run AI Engine');
    } finally {
      setLoading(false);
    }
  };

  const prettyModel = (m?: string) => {
    const v = (m || '').toLowerCase();
    if (v === 'gpt-5' || v === 'gpt5') return 'GPT‑5 Plus';
    if (v === 'gpt-5-auto') return 'GPT‑5 Auto';
    if (!v) return 'GPT‑5 Plus';
    return (m || 'gpt-5')
      .replace(/^gpt-/, 'GPT-')
      .replace(/-/g, ' ')
      .replace(/G P T/, 'GPT');
  };

  const ProviderButton = ({ label, keyName, hintModel }: { label: string; keyName: ProviderKey; hintModel?: string }) => (
    <button
      onClick={() => { setProvider(keyName); setModel(hintModel || ''); }}
      className={`px-3 py-2 rounded border ${provider === keyName ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200'} hover:border-blue-400`}
    >
      {label}
    </button>
  );

  // Fetch current backend OpenAI model for display/hint
  useEffect(() => {
    fetch(`${API_BASE}/system/ai-health`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => {
        const m = (data && (data.model || data.selectedModel)) || '';
        if (typeof m === 'string' && m) setServerModel(m);
      })
      .catch(() => {/* silent fallback */});
  }, []);

  return (
    <div className="max-w-5xl mx-auto p-4">
      <h1 className="text-3xl font-bold mb-2">🧠 News Pulse AI Engine</h1>
      <p className="text-slate-600 dark:text-slate-300 mb-6">Paste any news content or URL and generate a fresh, publication-ready article. Original narrative with 5W1H framing and SEO extras.</p>

      {/* Task selection is handled via the Task Type dropdown below; tab presets removed for simplicity. */}

      {/* Provider */}
      <div className="mb-4" aria-label="AI Engine Provider">
        <div className="text-sm font-medium mb-1">AI Engine:</div>
        <div className="flex flex-wrap gap-2">
          <ProviderButton
            label={`OpenAI (${prettyModel(serverModel)})`}
            keyName="openai"
            hintModel={serverModel || 'gpt-5'}
          />
          <ProviderButton label="Gemini 1.5 Pro" keyName="gemini" hintModel="gemini-1.5-pro" />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium mb-1">Language</label>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full border rounded px-3 py-2">
            {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Task Type</label>
          {/* When tabs are used, sync the task selection */}
          <select value={task} onChange={(e) => setTask(e.target.value)} className="w-full border rounded px-3 py-2">
            {TASKS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Tool-specific helpers */}
      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium mb-1">Founder Command (override)</label>
          <input value={founderCommand} onChange={(e) => setFounderCommand(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="e.g., Emphasize accountability and add strong headline variants" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Source URL (optional)</label>
          <input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="https://example.com/article" />
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Paste or type source content</label>
        <textarea value={sourceText} onChange={(e) => setSourceText(e.target.value)} rows={8} className="w-full border rounded px-3 py-2" placeholder="Paste the news text or facts here..." />
      </div>

      {error && <div className="text-red-600 mb-3">❌ {error}</div>}

      <button disabled={loading} onClick={() => {
        // Use the currently selected Task Type directly
        run();
      }} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded disabled:opacity-60">
        {loading ? 'Running…' : 'Run AI Task'}
      </button>

      {/* Results */}
      {result && (
        <div className="mt-6 space-y-4">
          <div className="bg-white dark:bg-slate-800 p-4 rounded shadow">
            <div className="text-sm text-slate-500 mb-1">Title</div>
            <div className="text-xl font-bold">{result.title}</div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-4 rounded shadow">
            <div className="text-sm text-slate-500 mb-1">Summary</div>
            <p>{result.summary}</p>
          </div>

          {result.fiveWh && (
            <div className="bg-white dark:bg-slate-800 p-4 rounded shadow grid md:grid-cols-3 gap-3">
              <div><div className="text-xs text-slate-500">Who</div><div className="font-medium">{result.fiveWh.who}</div></div>
              <div><div className="text-xs text-slate-500">What</div><div className="font-medium">{result.fiveWh.what}</div></div>
              <div><div className="text-xs text-slate-500">Where</div><div className="font-medium">{result.fiveWh.where}</div></div>
              <div><div className="text-xs text-slate-500">When</div><div className="font-medium">{result.fiveWh.when}</div></div>
              <div><div className="text-xs text-slate-500">Why</div><div className="font-medium">{result.fiveWh.why}</div></div>
              <div><div className="text-xs text-slate-500">How</div><div className="font-medium">{result.fiveWh.how}</div></div>
            </div>
          )}

          {Array.isArray(result.outline) && result.outline.length > 0 && (
            <div className="bg-white dark:bg-slate-800 p-4 rounded shadow">
              <div className="text-sm text-slate-500 mb-1">Outline</div>
              <ul className="list-disc ml-6 space-y-1">
                {result.outline.map((o: string, i: number) => <li key={i}>{o}</li>)}
              </ul>
            </div>
          )}

          {result.article && (
            <div className="bg-white dark:bg-slate-800 p-4 rounded shadow">
              <div className="text-sm text-slate-500 mb-1">Article</div>
              <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap">{result.article}</div>
            </div>
          )}

          {result.seo && (
            <div className="bg-white dark:bg-slate-800 p-4 rounded shadow">
              <div className="text-sm text-slate-500 mb-1">SEO</div>
              <div className="font-medium">{result.seo.title}</div>
              <div className="text-sm text-slate-600">{result.seo.description}</div>
              <div className="mt-1 text-xs">Tags: {(result.seo.tags || []).join(', ')}</div>
            </div>
          )}

          {result.disclaimer && (
            <div className="text-xs text-slate-500">{result.disclaimer}</div>
          )}
        </div>
      )}
    </div>
  );
}
