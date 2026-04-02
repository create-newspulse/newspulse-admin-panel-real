import React, { useMemo, useState } from 'react';
import api from '@/utils/api';

export type AiToolsPanelLanguage = 'Gujarati' | 'Hindi' | 'English';

export interface AiToolResult {
  tool: string;
  label: string;
  body: any;
  output: string;
  createdAt: string;
}

interface AiToolsPanelProps {
  text?: string;
  defaultText?: string;
  onTextChange?: (value: string) => void;
  titleText?: string;
  language?: AiToolsPanelLanguage;
  onLanguageChange?: (value: AiToolsPanelLanguage) => void;
  heading?: string;
  contextLabel?: string;
  disabled?: boolean;
  hideTextInput?: boolean;
  emptyStateText?: string;
  showTopband?: boolean;
  onToolResult?: (result: AiToolResult) => void;
}

const TOOL_LABELS: Record<string, string> = {
  summarize: 'Summarize',
  translate: 'Translate',
  'fact-check': 'Fact Check',
  headline: 'Rank Headline',
  'seo-meta': 'SEO Meta',
  'voice-script': 'Voice Script',
  'inverted-pyramid': 'Inverted Pyramid',
  '5w1h': '5W1H',
  topband: 'Topband One-Liners',
};

const AiToolsPanel: React.FC<AiToolsPanelProps> = ({
  text,
  defaultText = '',
  onTextChange,
  titleText,
  language,
  onLanguageChange,
  heading = 'AI Tools',
  contextLabel,
  disabled = false,
  hideTextInput = false,
  emptyStateText = 'Select or enter content to run AI tools.',
  showTopband = true,
  onToolResult,
}) => {
  const [internalText, setInternalText] = useState(defaultText);
  const [internalLang, setInternalLang] = useState<AiToolsPanelLanguage>('Gujarati');
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<string>('');
  const [lastReq, setLastReq] = useState<{ path: string; body: any } | null>(null);

  const currentText = text ?? internalText;
  const currentLang = language ?? internalLang;
  const toolsDisabled = disabled || !currentText.trim();

  const contextMessage = useMemo(() => {
    if (contextLabel) return contextLabel;
    if (toolsDisabled) return emptyStateText;
    return '';
  }, [contextLabel, emptyStateText, toolsDisabled]);

  function setTextValue(value: string) {
    if (onTextChange) {
      onTextChange(value);
      return;
    }
    setInternalText(value);
  }

  function setLanguageValue(value: AiToolsPanelLanguage) {
    if (onLanguageChange) {
      onLanguageChange(value);
      return;
    }
    setInternalLang(value);
  }

  function getResultString(json: any): string {
    if (json?.ok && (json.result || json.raw)) {
      return typeof json.result === 'string' ? json.result : JSON.stringify(json.result, null, 2);
    }
    if (json?.content) {
      return json.content;
    }
    return JSON.stringify(json, null, 2);
  }

  async function callTool(path: string, body: any) {
    setLoading(path);
    setResult('');
    setLastReq({ path, body });
    try {
      const res = await api.post(`/api/ai/tools/${path}`, body, { validateStatus: () => true });
      if (res.status === 401) {
        setResult('AI auth not configured on backend (401). Please check API credentials.');
        return;
      }
      if (res.status === 429) {
        const limitedBy = res.headers['x-rate-limited-by'] || '';
        const hint = limitedBy === 'queue' ? 'AI is busy right now. Wait a few seconds, then retry.' : 'Too many requests or upstream quota hit. Please retry shortly.';
        const detail = res.data?.message || res.data?.detail || '';
        setResult(`AI rate limited (429).\n${hint}${detail ? `\nDetails: ${detail}` : ''}`.trim());
        return;
      }
      if (res.status >= 400) {
        const msg = res.data?.message || res.data?.error || `HTTP ${res.status}`;
        setResult(`Error: ${msg}`);
        return;
      }
      const json = res.data;
      const output = getResultString(json);
      setResult(output);
      onToolResult?.({
        tool: path,
        label: TOOL_LABELS[path] || path,
        body,
        output,
        createdAt: new Date().toISOString(),
      });
    } catch (e: any) {
      const msg = e?.message || String(e);
      if (/timeout|network|fetch|ECONNREFUSED|ENOTFOUND/i.test(msg)) {
        setResult('Error: Failed to reach backend API. Please check your network or backend availability.');
      } else {
        setResult(`Error: ${msg}`);
      }
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="rounded-xl border dark:border-slate-700 p-4 bg-white dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="text-xl font-bold">{heading}</h3>
        {contextMessage ? <span className="text-xs text-slate-500 dark:text-slate-400">{contextMessage}</span> : null}
      </div>
      {!hideTextInput && (
        <textarea
          className="w-full border dark:border-slate-700 rounded-lg p-3 mb-3 dark:bg-slate-800"
          rows={6}
          placeholder="Paste article text or headline here..."
          value={currentText}
          onChange={(e) => setTextValue(e.target.value)}
        />
      )}

      <div className="flex flex-wrap gap-2 items-center mb-3">
        <select
          className="border dark:border-slate-700 rounded-lg p-2 dark:bg-slate-800"
          value={currentLang}
          onChange={(e) => setLanguageValue(e.target.value as AiToolsPanelLanguage)}
        >
          <option value="Gujarati">Gujarati</option>
          <option value="Hindi">Hindi</option>
          <option value="English">English</option>
        </select>

        <button
          disabled={!!loading || toolsDisabled}
          onClick={() => callTool('summarize', { text: currentText, bullets: 2 })}
          className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading === 'summarize' ? 'Summarizing…' : 'Summarize'}
        </button>

        <button
          disabled={!!loading || toolsDisabled}
          onClick={() => callTool('translate', { text: currentText, targetLang: currentLang })}
          className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          {loading === 'translate' ? 'Translating…' : `Translate → ${currentLang}`}
        </button>

        <button
          disabled={!!loading || toolsDisabled}
          onClick={() => callTool('fact-check', { text: currentText })}
          className="px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
        >
          {loading === 'fact-check' ? 'Checking…' : 'Fact Check'}
        </button>

        <button
          disabled={!!loading || toolsDisabled}
          onClick={() => callTool('headline', { title: titleText || currentText })}
          className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
        >
          {loading === 'headline' ? 'Ranking…' : 'Rank Headline'}
        </button>

        <button
          disabled={!!loading || toolsDisabled}
          onClick={() => callTool('seo-meta', { text: currentText })}
          className="px-3 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50"
        >
          {loading === 'seo-meta' ? 'Optimizing…' : 'SEO Meta'}
        </button>

        <button
          disabled={!!loading || toolsDisabled}
          onClick={() => callTool('voice-script', { text: currentText, durationSec: 25 })}
          className="px-3 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50"
        >
          {loading === 'voice-script' ? 'Writing…' : 'Voice Script'}
        </button>

        <button
          disabled={!!loading || toolsDisabled}
          onClick={() => callTool('inverted-pyramid', { text: currentText, targetLang: currentLang })}
          className="px-3 py-2 bg-amber-700 text-white rounded-lg hover:bg-amber-800 disabled:opacity-50"
        >
          {loading === 'inverted-pyramid' ? 'Structuring…' : 'Inverted Pyramid'}
        </button>

        <button
          disabled={!!loading || toolsDisabled}
          onClick={() => callTool('5w1h', { text: currentText, targetLang: currentLang })}
          className="px-3 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
        >
          {loading === '5w1h' ? 'Extracting…' : '5W1H'}
        </button>

        {showTopband && (
          <button
            disabled={!!loading || toolsDisabled}
            onClick={() => callTool('topband', { text: currentText, targetLang: currentLang })}
            className="px-3 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 disabled:opacity-50"
          >
            {loading === 'topband' ? 'Generating…' : 'Topband One‑Liners'}
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 mb-2">
        {result && lastReq && !loading && (
          <button
            onClick={() => callTool(lastReq.path, lastReq.body)}
            className="px-2 py-1 text-xs bg-slate-200 dark:bg-slate-700 rounded hover:bg-slate-300 dark:hover:bg-slate-600"
          >
            Retry
          </button>
        )}
      </div>
      <pre className="whitespace-pre-wrap text-sm bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border dark:border-slate-700 overflow-auto max-h-72">{result}</pre>
    </div>
  );
};

export default AiToolsPanel;
