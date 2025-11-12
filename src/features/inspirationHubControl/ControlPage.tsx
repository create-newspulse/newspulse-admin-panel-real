import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import apiClient from '@/lib/api';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { extractIframeSrc, isHostAllowed } from '@/lib/embedUtils';
import ModePicker from './ModePicker';
import EmbedEditor from './EmbedEditor';
import PreviewBox from './PreviewBox';
import PublishBar from './PublishBar';
import type { InspirationHubPayload, InspirationMode } from './types';

// Map backend <-> UI modes
const toUiMode = (v: string | undefined | null): InspirationMode => (v === 'live' ? 'livetv' : 'inspiration');
const toBackendMode = (v: InspirationMode) => (v === 'livetv' ? 'live' : 'inspiration');

const ControlPage: React.FC = () => {
  const [mode, setMode] = useState<InspirationMode>('inspiration');
  const [embedHtml, setEmbedHtml] = useState('');
  const [sanitized, setSanitized] = useState('');
  const [updatedAt, setUpdatedAt] = useState<string | undefined>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load current
  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get('/live-content');
        const data: any = (res as any)?.data ?? res;
        setMode(toUiMode(data?.mode));
        // Prefer server-sanitized for preview, and keep raw text area with either embedHtml or embedCode
        setSanitized(data?.embedHtmlSanitized || data?.embedCode || '');
        setEmbedHtml(data?.embedHtml || data?.embedCode || '');
        setUpdatedAt(data?.updatedAt || undefined);
      } catch (e) {
        toast.error('Failed to load Inspiration Hub state');
        // keep defaults
      }
    })();
  }, []);

  // Client-side domain validation helper
  const validateEmbed = (html: string): string | null => {
    if (!html?.trim()) return null; // empty is allowed
    try {
      const src = extractIframeSrc(html.trim());
      if (!src) return 'Embed must include a valid src or URL';
      if (!isHostAllowed(src)) return 'This domain is not in the allowed list';
      return null;
    } catch (e) {
      return 'Invalid embed code or URL';
    }
  };

  const onPublish = async () => {
    const err = validateEmbed(embedHtml);
    setError(err);
    if (err) {
      toast.error(err);
      return;
    }

    setSaving(true);
    const payload: InspirationHubPayload = { mode, embedHtml };
    try {
      const res = await apiClient.post('/live-content/update', {
        mode: toBackendMode(payload.mode),
        embedCode: payload.embedHtml, // backend legacy field name
      });
      const data: any = (res as any)?.data ?? res;
      setUpdatedAt(data?.updatedAt || new Date().toISOString());
      // Optimistic preview update: prefer server-sanitized if returned
      setSanitized(data?.embedHtmlSanitized || data?.embedCode || embedHtml);
      toast.success('Saved & published');
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Save failed';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const headerNote = useMemo(() => (
    mode === 'livetv'
      ? 'Live TV mode is active — the public page will render the embed below.'
      : 'Inspiration Hub mode is active — the public page will show curated inspiration content.'
  ), [mode]);

  return (
    <AuthenticatedLayout requiredRoles={["admin", "founder"]}>
      <div className="max-w-3xl mx-auto py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">🎛️ Inspiration Hub Control</h1>
          <p className="text-sm text-slate-500">{headerNote}</p>
        </div>

        <ModePicker value={mode} onChange={setMode} />

        <EmbedEditor value={embedHtml} onChange={(v) => { setEmbedHtml(v); if (error) setError(null); }} error={error} />

        <PreviewBox sanitizedHtml={sanitized} mode={mode} />

        <PublishBar saving={saving} updatedAt={updatedAt} onPublish={onPublish} />
      </div>
    </AuthenticatedLayout>
  );
};

export default ControlPage;
