import { useEffect, useState } from 'react';
import { api as apiLib } from '../../lib/api';
import { apiUrl } from '@/lib/apiBase';

// Simple options
const LANGUAGES = ['English', 'Hindi', 'Gujarati'];
const TASKS = ['Summarize', 'Rewrite', 'Creative Narrative', '5W1H Story', 'SEO Article'];

type ProviderKey = 'openai' | 'gemini';

type OpenAiModelMode = 'auto' | 'pinned';
type GeminiModelMode = 'latest' | 'pinned';

type AiModelsStatus = {
  openaiResolved?: string;
  geminiResolved?: string;
  raw?: any;
};

function pickResolvedModel(data: any, provider: ProviderKey): string {
  try {
    const root = data || {};
    const byProvider = root?.[provider] || root?.providers?.[provider] || root?.status?.[provider] || null;
    const resolved =
      byProvider?.resolvedModel ??
      byProvider?.resolved ??
      byProvider?.model ??
      byProvider?.selectedModel ??
      root?.resolved?.[provider] ??
      root?.models?.resolved?.[provider] ??
      '';
    return typeof resolved === 'string' ? resolved : resolved ? String(resolved) : '';
  } catch {
    return '';
  }
}

function labelMode(provider: ProviderKey, mode: string): string {
  if (provider === 'openai') return mode === 'pinned' ? 'Pinned' : 'Auto (Latest)';
  return mode === 'pinned' ? 'Pinned' : 'Latest';
}

export default function AIEngine(): JSX.Element {
  const [provider, setProvider] = useState<ProviderKey>('openai');

  const [openaiMode, setOpenaiMode] = useState<OpenAiModelMode>('auto');
  const [openaiPinnedModel, setOpenaiPinnedModel] = useState<string>('');

  const [geminiMode, setGeminiMode] = useState<GeminiModelMode>('latest');
  const [geminiPinnedModel, setGeminiPinnedModel] = useState<string>('');

  const [modelsStatus, setModelsStatus] = useState<AiModelsStatus>({});
  const [modelsStatusLoading, setModelsStatusLoading] = useState(false);
  const [language, setLanguage] = useState<string>('English');
  const [task, setTask] = useState<string>('Summarize');
  const [founderCommand, setFounderCommand] = useState<string>('');
  const [sourceText, setSourceText] = useState<string>('');
  const [sourceUrl, setSourceUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [result, setResult] = useState<any>(null);

  const getProviderSelection = (p: ProviderKey) => {
    if (p === 'openai') {
      return {
        mode: openaiMode,
        pinnedModel: openaiPinnedModel,
      };
    }
    return {
      mode: geminiMode,
      pinnedModel: geminiPinnedModel,
    };
  };

  const buildRunPayload = () => {
    const sel = getProviderSelection(provider);
    const pinned = (sel.pinnedModel || '').trim();
    const modelToSend = sel.mode === 'pinned' ? pinned : '';

    return {
      provider,
      // Back-compat: backend previously accepted `model`; keep sending it (empty means auto/latest).
      model: modelToSend,
      // New: explicit model mode + pinned model (backend may ignore if not implemented yet).
      modelMode: sel.mode,
      pinnedModel: pinned,
      language,
      taskType: task,
      founderCommand,
      sourceText,
      url: sourceUrl,
    };
  };

  const fetchModelsStatus = async () => {
    setModelsStatusLoading(true);
    try {
      const r = await fetch(apiUrl('/ai/models/status'), { credentials: 'include' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setModelsStatus({
        openaiResolved: pickResolvedModel(data, 'openai'),
        geminiResolved: pickResolvedModel(data, 'gemini'),
        raw: data,
      });
    } catch {
      // keep UI non-blocking
      setModelsStatus((prev) => ({ ...prev }));
    } finally {
      setModelsStatusLoading(false);
    }
  };

  const refreshModels = async () => {
    setModelsStatusLoading(true);
    try {
      const r = await fetch(apiUrl('/ai/models/refresh'), {
        method: 'POST',
        credentials: 'include',
        headers: { accept: 'application/json' },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    } finally {
      await fetchModelsStatus();
    }
  };

  const run = async () => {
    setError('');
    setResult(null);
    if (!sourceText.trim() && !sourceUrl.trim()) {
      setError('Please paste content or provide a source URL.');
      return;
    }
    setLoading(true);
    try {
      const payload = buildRunPayload();
      const resp = await (apiLib as any).aiEngineRun?.(payload)
    .catch(async () => {
      // Fallback POST if helper missing
      try {
        const endpoint = apiUrl('/ai/engine/run');
        const fr = await fetch(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!fr.ok) throw new Error(`HTTP ${fr.status}`);
        return fr.json();
      } catch (e) {
        throw e;
      }
    });
      setResult(resp.result);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to run AI Engine');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchModelsStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-5xl mx-auto p-4">
      <h1 className="text-3xl font-bold mb-2">🧠 News Pulse AI Engine</h1>
      <p className="text-slate-600 dark:text-slate-300 mb-6">Paste any news content or URL and generate a fresh, publication-ready article. Original narrative with 5W1H framing and SEO extras.</p>

      {/* Task selection is handled via the Task Type dropdown below; tab presets removed for simplicity. */}

      {/* Provider */}
      <div className="mb-4" aria-label="AI Engine Provider">
        <div className="text-sm font-medium mb-1">AI Engine:</div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <div className={`rounded border p-3 ${provider === 'openai' ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-900/10' : 'border-slate-200 dark:border-slate-700'}`}>
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setProvider('openai')}
                className={`text-left font-semibold ${provider === 'openai' ? 'text-blue-700 dark:text-blue-200' : 'text-slate-800 dark:text-slate-200'}`}
              >
                OpenAI
              </button>
              <select
                value={openaiMode}
                onChange={(e) => setOpenaiMode(e.target.value as OpenAiModelMode)}
                className="border rounded px-2 py-1 text-sm bg-white dark:bg-slate-800"
                aria-label="OpenAI model mode"
              >
                <option value="auto">Auto</option>
                <option value="pinned">Pinned</option>
              </select>
            </div>

            <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
              Mode: {labelMode('openai', openaiMode)}
            </div>
            <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
              Resolved: {modelsStatusLoading ? '...' : (modelsStatus.openaiResolved || '-')}
            </div>

            {openaiMode === 'pinned' ? (
              <div className="mt-2">
                <input
                  value={openaiPinnedModel}
                  onChange={(e) => setOpenaiPinnedModel(e.target.value)}
                  className="w-full border rounded px-2 py-1 text-sm bg-white dark:bg-slate-800"
                  placeholder="Pinned model (e.g., gpt-5.2)"
                />
              </div>
            ) : null}
          </div>

          <div className={`rounded border p-3 ${provider === 'gemini' ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-900/10' : 'border-slate-200 dark:border-slate-700'}`}>
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setProvider('gemini')}
                className={`text-left font-semibold ${provider === 'gemini' ? 'text-blue-700 dark:text-blue-200' : 'text-slate-800 dark:text-slate-200'}`}
              >
                Gemini
              </button>
              <select
                value={geminiMode}
                onChange={(e) => setGeminiMode(e.target.value as GeminiModelMode)}
                className="border rounded px-2 py-1 text-sm bg-white dark:bg-slate-800"
                aria-label="Gemini model mode"
              >
                <option value="latest">Latest</option>
                <option value="pinned">Pinned</option>
              </select>
            </div>

            <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
              Mode: {labelMode('gemini', geminiMode)}
            </div>
            <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
              Resolved: {modelsStatusLoading ? '...' : (modelsStatus.geminiResolved || '-')}
            </div>

            {geminiMode === 'pinned' ? (
              <div className="mt-2">
                <input
                  value={geminiPinnedModel}
                  onChange={(e) => setGeminiPinnedModel(e.target.value)}
                  className="w-full border rounded px-2 py-1 text-sm bg-white dark:bg-slate-800"
                  placeholder="Pinned model (e.g., gemini-pro-latest)"
                />
              </div>
            ) : null}
          </div>

          <div className="flex items-start">
            <button
              type="button"
              disabled={modelsStatusLoading}
              onClick={() => void refreshModels()}
              className="rounded border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {modelsStatusLoading ? 'Refreshing...' : 'Refresh models'}
            </button>
          </div>
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
