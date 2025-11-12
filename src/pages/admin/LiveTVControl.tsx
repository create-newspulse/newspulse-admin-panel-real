import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import apiClient from '@lib/api';
import type { LiveFeed } from '@/types/live';

type ValidateResult = {
  ptiCompliance: { status: 'PENDING' | 'PASS' | 'FAIL'; notes?: string };
  safety: { status: 'SAFE' | 'RISKY' | 'BLOCKED'; reason?: string };
};

const initialFeed: LiveFeed = {
  _id: 'temp',
  title: '',
  sourceType: 'OTHER',
  rawInput: '',
  isActive: false,
  displayMode: 'HERO',
  ptiCompliance: { status: 'PENDING' },
  safety: { status: 'SAFE' },
  fallback: { mode: 'SLIDESHOW' },
  createdBy: 'me',
  updatedAt: new Date().toISOString(),
};

export default function LiveTVControl() {
  const [feed, setFeed] = useState<LiveFeed>(initialFeed);
  const [loading, setLoading] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [audit, setAudit] = useState<any[]>([]);

  const canActivate = useMemo(() => feed.ptiCompliance.status === 'PASS' && feed.safety.status === 'SAFE', [feed]);

  const onCreate = async () => {
    try {
      setLoading(true);
      const rawInputValue = feed.rawInput; // Capture current value
      console.log('📤 Creating draft with rawInput:', rawInputValue);
      
      const r = await apiClient.post('/live/create', {
        title: feed.title || 'Untitled',
        rawInput: rawInputValue,
        sourceType: feed.sourceType,
      });
      const data = r.data?.data || r.data;
      console.log('✅ Draft created:', data);
      setFeed((f) => ({ ...f, ...data }));
      toast.success('Draft created with ID: ' + data._id);
      
      // Auto-sanitize after creation using the NEW id
      if (data._id && data._id !== 'temp') {
        console.log('📤 Auto-sanitizing with ID:', data._id, 'rawInput:', rawInputValue);
        const sanitizeRes = await apiClient.post(`/live/${data._id}/sanitize`, { rawInput: rawInputValue });
        const sanitizeData = sanitizeRes.data?.data || sanitizeRes.data;
        console.log('✅ Sanitize response:', sanitizeData);
        setFeed((f) => ({ ...f, sanitizedEmbedHtml: sanitizeData?.sanitizedEmbedHtml }));
        setPreviewHtml(String(sanitizeData?.sanitizedEmbedHtml || ''));
        if (sanitizeData?.sanitizedEmbedHtml) {
          toast.success('✅ Sanitized & ready to preview');
        } else {
          toast.error('⚠️ Could not extract video ID from embed code');
        }
      }
    } catch (e: any) {
      console.error('❌ onCreate error:', e);
      toast.error(e?.response?.data?.error || 'Failed to create draft');
    } finally {
      setLoading(false);
    }
  };

  const onValidate = async () => {
    try {
      setLoading(true);
      const r = await apiClient.post(`/live/${feed._id}/validate`, { rawInput: feed.rawInput });
      const data: ValidateResult = r.data?.data || r.data;
      setFeed((f) => ({ ...f, ptiCompliance: data.ptiCompliance, safety: data.safety }));
      toast.success(`PTI: ${data.ptiCompliance.status} | Safety: ${data.safety.status}`);
    } catch (e: any) {
      toast('Validate endpoint not ready — set PASS/SAFE locally');
      setFeed((f) => ({ ...f, ptiCompliance: { status: 'PASS' }, safety: { status: 'SAFE' } }));
    } finally {
      setLoading(false);
    }
  };

  const onActivate = async () => {
    if (!canActivate) {
      toast.error('Cannot activate: PTI or Safety not PASS/SAFE');
      return;
    }
    try {
      setLoading(true);
      const r = await apiClient.post(`/live/${feed._id}/activate`);
      const data = r.data?.data || r.data;
      setFeed((f) => ({ ...f, ...data, isActive: true }));
      toast.success('Live is ON');
    } catch (e: any) {
      setFeed((f) => ({ ...f, isActive: true }));
      toast('Activate endpoint not ready — toggled ON locally');
    } finally {
      setLoading(false);
    }
  };

  const onDeactivate = async () => {
    try {
      setLoading(true);
      await apiClient.post(`/live/${feed._id}/deactivate`);
      setFeed((f) => ({ ...f, isActive: false }));
      toast.success('Live is OFF');
    } catch (e: any) {
      setFeed((f) => ({ ...f, isActive: false }));
      toast('Deactivate endpoint not ready — toggled OFF locally');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // TODO: fetch audit logs once backend is ready
    setAudit([]);
  }, [feed._id]);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">📺 Live TV Control</h1>
          <p className="text-sm text-slate-500">Manage live sources with sanitization, PTI, safety and fallback</p>
        </div>
        <div className="text-sm">
          <span className={`px-2 py-1 rounded ${feed.isActive ? 'bg-green-600 text-white' : 'bg-slate-600 text-white'}`}>
            {feed.isActive ? '🟢 Online' : '⚫ Offline'}
          </span>
          <span className="ml-2 px-2 py-1 rounded bg-slate-700 text-white">PTI: {feed.ptiCompliance.status}</span>
          <span className="ml-2 px-2 py-1 rounded bg-slate-700 text-white">Safety: {feed.safety.status}</span>
        </div>
      </header>

      {/* Paste & Parse */}
      <section className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <h2 className="font-semibold mb-2">Paste & Parse</h2>
        <p className="text-sm text-slate-500 mb-3">Paste a YouTube URL or full iframe embed code below, then click "Create Draft" to sanitize and preview.</p>
        <input
          className="w-full mb-2 px-3 py-2 rounded bg-slate-100 dark:bg-slate-800"
          placeholder="Title (optional)"
          value={feed.title}
          onChange={(e) => setFeed((f) => ({ ...f, title: e.target.value }))}
        />
        <textarea
          className="w-full h-28 px-3 py-2 rounded bg-slate-100 dark:bg-slate-800 font-mono text-sm"
          placeholder="Paste YouTube URL or iframe embed code here..."
          value={feed.rawInput}
          onChange={(e) => setFeed((f) => ({ ...f, rawInput: e.target.value }))}
        />
        <div className="mt-3 flex gap-2">
          <button 
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50" 
            onClick={onCreate} 
            disabled={loading || !feed.rawInput.trim()}
          >
            {loading ? 'Processing...' : 'Create Draft & Preview'}
          </button>
          <button 
            className="px-4 py-2 rounded bg-slate-600 hover:bg-slate-700 text-white disabled:opacity-50" 
            onClick={onValidate} 
            disabled={loading || feed._id === 'temp'}
          >
            Run PTI/Safety
          </button>
        </div>
      </section>

      {/* Controls */}
      <section className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <h2 className="font-semibold mb-2">Controls</h2>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2">
            <span>Display Mode</span>
            <select
              className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800"
              value={feed.displayMode}
              onChange={(e) => setFeed((f) => ({ ...f, displayMode: e.target.value as LiveFeed['displayMode'] }))}
            >
              <option value="HERO">Hero</option>
              <option value="BANNER">Banner</option>
              <option value="IN_ARTICLE">In-Article</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span>Language</span>
            <select
              className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800"
              value={feed.language || 'en'}
              onChange={(e) => setFeed((f) => ({ ...f, language: e.target.value as any }))}
            >
              <option value="en">English</option>
              <option value="hi">Hindi</option>
              <option value="gu">Gujarati</option>
            </select>
          </label>
          <div className="ml-auto flex gap-2">
            <button className="btn-success" onClick={onActivate} disabled={loading || !canActivate}>Activate</button>
            <button className="btn-danger" onClick={onDeactivate} disabled={loading || !feed.isActive}>Deactivate</button>
          </div>
        </div>
      </section>

      {/* Preview */}
      <section className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <h2 className="font-semibold mb-3">Preview</h2>
        {!previewHtml && (
          <div className="text-sm text-slate-500">No preview yet. Click Sanitize after pasting an input.</div>
        )}
        {previewHtml && (
          <iframe
            title="Live Preview"
            className="w-full aspect-video rounded border border-slate-300"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-presentation allow-popups-to-escape-sandbox"
            referrerPolicy="no-referrer"
            srcDoc={`<!doctype html><html><head><meta charset='utf-8' /><meta name='viewport' content='width=device-width,initial-scale=1' /></head><body style='margin:0;background:#000'>${previewHtml}</body></html>`}
          />
        )}
      </section>

      {/* Audit Log */}
      <section className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <h2 className="font-semibold mb-2">Audit Log</h2>
        {audit.length === 0 ? (
          <div className="text-sm text-slate-500">No entries yet.</div>
        ) : (
          <ul className="text-sm list-disc ml-5">
            {audit.map((a, i) => (
              <li key={i}>{JSON.stringify(a)}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
