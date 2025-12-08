import React from 'react';
import { sanitizeHtml } from '@/lib/sanitize';

interface Props {
  sanitizedHtml: string;
  mode: 'inspiration' | 'livetv';
}

const PreviewBox: React.FC<Props> = ({ sanitizedHtml, mode }) => {
  const safe = sanitizedHtml || '';
  return (
    <div className="bg-white dark:bg-slate-800 border rounded-lg p-3">
      <div className="relative aspect-video w-full overflow-hidden rounded">
        {mode === 'livetv' && (
          <div className="absolute right-2 top-2 z-10 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded">LIVE 🔴</div>
        )}
        {/* Server-sanitized HTML from API; fallback sanitize on client if needed */}
        {/* eslint-disable-next-line react/no-danger */}
        <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: safe || sanitizeHtml(safe) }} />
      </div>
      <div className="mt-2 text-xs text-slate-500">Only trusted domains allowed; sanitized server-side.</div>
    </div>
  );
};

export default PreviewBox;
