import React, { useEffect, useState } from 'react';
import { extractIframeSrc, isHostAllowed } from '../../lib/embedUtils';
import { sanitizeHtml } from '../../lib/sanitize';

function isLoopbackUrl(src: string): boolean {
  try {
    const u = new URL(src);
    const host = u.hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '[::1]';
  } catch {
    return false;
  }
}

async function probeLoopbackUrl(url: string, timeoutMs = 1500): Promise<boolean> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(url, { method: 'GET', mode: 'no-cors', signal: controller.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

const SectionBlock = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="bg-white dark:bg-slate-800 rounded-xl shadow p-5 mb-10 border border-slate-200 dark:border-slate-700">
    <h2 className="text-xl font-semibold mb-4 text-slate-800 dark:text-white">{title}</h2>
    {children}
  </section>
);

const InspirationHub: React.FC = () => {
  const [customEmbed, setCustomEmbed] = useState('');
  const [embedPreview, setEmbedPreview] = useState('');
  const [previewSrc, setPreviewSrc] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [loopbackReachable, setLoopbackReachable] = useState<boolean | null>(null);

  const isLoopback = !!previewSrc && isLoopbackUrl(previewSrc);
  const loopbackBlocked = isLoopback && !import.meta.env.DEV;
  const loopbackUnreachable = isLoopback && import.meta.env.DEV && loopbackReachable === false;

  useEffect(() => {
    let cancelled = false;
    setLoopbackReachable(null);
    if (!previewSrc) return;
    if (!isLoopbackUrl(previewSrc)) return;
    if (!import.meta.env.DEV) return;

    void (async () => {
      const ok = await probeLoopbackUrl(previewSrc);
      if (cancelled) return;
      setLoopbackReachable(ok);
    })();

    return () => {
      cancelled = true;
    };
  }, [previewSrc]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-10">
        🌄 Inspiration Hub
      </h1>

      {/* 🎥 Auto Embed – DroneTV */}
      <SectionBlock title="🚁 DroneTV – Scenic Nature Relaxation">
        <div className="aspect-video w-full rounded overflow-hidden border border-gray-300">
          <iframe
            src="https://www.youtube.com/embed/YVYNY6ez_uw"
            title="DroneTV"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
          ></iframe>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          ✅ Auto embed from YouTube. For peaceful and safe viewing.
        </p>
      </SectionBlock>

      {/* 🌠 Auto Embed – Daily Wonders */}
      <SectionBlock title="✨ Daily Wonders – Uplifting Visual Quotes">
        <div className="aspect-video w-full rounded overflow-hidden border border-gray-300">
         <iframe
  width="560"
  height="315"
  src="https://www.youtube.com/embed/qtYGQT-9Sc4"
  frameBorder="0"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
  allowFullScreen
  title="Daily Wonder"
></iframe>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          🎇 AI-powered visuals to brighten your day. Powered by safe YouTube embedding.
        </p>
      </SectionBlock>

      {/* ✍️ Manual Embed */}
      <SectionBlock title="✍️ Embed Your Own Video (Manual)">
        <textarea
          rows={4}
          className="w-full p-3 rounded border border-gray-300 text-sm font-mono"
          placeholder="<iframe ...></iframe>"
          value={customEmbed}
          onChange={(e) => setCustomEmbed(e.target.value)}
        />
        <button
          className="mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500"
          onClick={() => {
            setEmbedPreview(customEmbed);
            setPreviewError('');
            const src = extractIframeSrc(customEmbed || '');
            setPreviewSrc(src || '');
            if (!src) return;

            if (isLoopbackUrl(src) && !import.meta.env.DEV) {
              setPreviewError('Local/loopback embeds are disabled outside dev.');
              return;
            }
            if (!isHostAllowed(src)) {
              setPreviewError('Embed host not allowed.');
              return;
            }
          }}
        >
          ▶️ Preview Embed
        </button>

        {previewError ? (
          <div className="mt-3 text-sm text-red-600">{previewError}</div>
        ) : null}

        {embedPreview && (
          <div className="mt-6 aspect-video w-full rounded overflow-hidden border border-blue-500 shadow">
            {/* Render embed safely: prefer iframe src, otherwise sanitize HTML before injection */}
            {(() => {
              // runtime safety: only render preview in browser secure contexts
              if (typeof window === 'undefined' || window.location.protocol === 'file:') {
                return <div className="text-sm text-red-600">Preview blocked in this context.</div>;
              }
              if (previewSrc) {
                if (loopbackBlocked || loopbackUnreachable) {
                  return (
                    <div className="h-full w-full flex flex-col items-center justify-center gap-3 p-6 text-center">
                      <div className="text-sm font-semibold text-slate-800">Embed blocked</div>
                      <div className="text-xs text-slate-600 max-w-md">
                        {loopbackBlocked
                          ? 'Local/loopback embeds are disabled outside dev.'
                          : 'Local/loopback embed is not reachable right now.'}
                      </div>
                      <a href={previewSrc} target="_blank" rel="noopener noreferrer" className="text-xs px-3 py-2 rounded-md border hover:bg-slate-50">Open in new tab</a>
                    </div>
                  );
                }

                if (!isHostAllowed(previewSrc)) {
                  return (
                    <div className="h-full w-full flex flex-col items-center justify-center gap-3 p-6 text-center">
                      <div className="text-sm font-semibold text-slate-800">Embed blocked</div>
                      <div className="text-xs text-slate-600 max-w-md">This embed host is not allowed.</div>
                      <a href={previewSrc} target="_blank" rel="noopener noreferrer" className="text-xs px-3 py-2 rounded-md border hover:bg-slate-50">Open in new tab</a>
                    </div>
                  );
                }

                return (
                  <iframe
                    title="embed"
                    src={previewSrc}
                    width="100%"
                    height="100%"
                    frameBorder={0}
                    allowFullScreen
                    referrerPolicy="no-referrer"
                    onError={() => setPreviewError('Embed failed to load. Open in a new tab instead.')}
                  />
                );
              }

              return <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(embedPreview || '') }} />;
            })()}
          </div>
        )}
      </SectionBlock>

      {/* 📜 Legal Footer */}
      <p className="text-xs text-center text-gray-400 mt-10 border-t pt-4">
        📜 All videos are embedded via YouTube. We do not host, store, or monetize any external content. Embeds are used under public YouTube terms.
      </p>
    </div>
  );
};

export default InspirationHub;