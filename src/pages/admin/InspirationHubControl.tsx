import React, { useEffect, useMemo, useState } from 'react';
import apiClient, { API_BASE_PATH } from '@lib/api';
import { io, Socket } from 'socket.io-client';
import { extractIframeSrc, isHostAllowed } from '@lib/embedUtils';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';

type Mode = 'inspiration' | 'live';

const InspirationHubControl: React.FC = () => {
  const [mode, setMode] = useState<Mode>('inspiration');
  const [embedCode, setEmbedCode] = useState<string>('');
  const [updatedAt, setUpdatedAt] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await apiClient.get('/live-content');
        const data = (r as any)?.data ?? r;
        setMode((data?.mode || 'inspiration') as Mode);
        setEmbedCode(data?.embedCode || '');
        setUpdatedAt(data?.updatedAt || '');
        console.log('🔌 live-content loaded:', data);
      } catch (e) {
        console.error('❌ load live-content failed', e);
      }
    })();
  }, []);

  // Socket for real-time changes (use REST origin)
  useEffect(() => {
    let s: Socket | null = null;
    try {
      const base = API_BASE_PATH.replace(/\/$/, '');
      s = io(base, { path: '/socket.io', transports: ['websocket'] });
      s.on('connect', () => console.log('🧩 socket connected for live-content'));
      s.on('live-content-updated', (p: any) => {
        console.log('📡 live-content-updated', p);
        setMode(p?.mode || 'inspiration');
        setEmbedCode(p?.embedCode || '');
        setUpdatedAt(p?.updatedAt || new Date().toISOString());
      });
    } catch (e) {
      console.warn('⚠️ socket init failed', e);
    }
    return () => { try { s?.close(); } catch {} };
  }, []);

  const onSave = async () => {
    setSaving(true);
    try {
      const r = await apiClient.post('/live-content/update', { mode, embedCode });
      const data = (r as any)?.data ?? r;
      setUpdatedAt(data?.updatedAt || new Date().toISOString());
      console.log('💾 saved live-content', data);
      alert('✅ Saved');
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Save failed';
      alert('❌ ' + msg);
    } finally { setSaving(false); }
  };

  const preview = useMemo(() => {
    try {
      const src = extractIframeSrc(embedCode || '');
      if (src && isHostAllowed(src)) {
        return <iframe title="preview" src={src} className="w-full h-full" allow="autoplay; fullscreen" />;
      }
    } catch {}
    return <div className="text-sm text-slate-500 p-4">Enter a YouTube/Vimeo/Twitter embed or URL to preview.</div>;
  }, [embedCode]);

  return (
    <AuthenticatedLayout requiredRoles={["admin","founder"]}>
      <div className="max-w-3xl mx-auto py-8">
        <h1 className="text-2xl font-bold mb-4">🎛️ Inspiration Hub Control</h1>

        <div className="bg-white dark:bg-slate-800 border rounded-lg p-4 mb-6">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input type="radio" checked={mode==='inspiration'} onChange={()=>setMode('inspiration')} />
              Inspiration Hub
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={mode==='live'} onChange={()=>setMode('live')} />
              Live TV
            </label>
          </div>
          <p className="text-xs text-slate-500 mt-2">Last updated: {updatedAt ? new Date(updatedAt).toLocaleString() : '—'}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 border rounded-lg p-4 mb-6">
          <label className="block text-sm font-semibold mb-2">Embed Code or URL</label>
          <textarea
            rows={4}
            value={embedCode}
            onChange={(e)=>setEmbedCode(e.target.value)}
            className="w-full border rounded p-2 font-mono text-sm"
            placeholder="<iframe src='https://www.youtube.com/embed/...'></iframe> OR https://youtu.be/..."
          />
          <div className="mt-3 text-xs text-slate-500">Allowed hosts: YouTube, Vimeo, Twitter/X</div>
        </div>

        <div className="bg-white dark:bg-slate-800 border rounded-lg p-2 mb-6">
          <div className="relative aspect-video w-full overflow-hidden rounded">
            {mode==='live' ? (
              <>
                <div className="absolute right-2 top-2 z-10 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded">LIVE 🔴</div>
                {preview}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-500">Inspiration Hub will auto-play (live is OFF)</div>
            )}
          </div>
        </div>

        <button onClick={onSave} disabled={saving} className="px-4 py-2 rounded bg-indigo-600 text-white disabled:opacity-60">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </AuthenticatedLayout>
  );
};

export default InspirationHubControl;
