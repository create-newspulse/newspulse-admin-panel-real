import React, { useState } from 'react';

const SectionBlock = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="bg-white dark:bg-slate-800 rounded-xl shadow p-5 mb-10 border border-slate-200 dark:border-slate-700">
    <h2 className="text-xl font-semibold mb-4 text-slate-800 dark:text-white">{title}</h2>
    {children}
  </section>
);

const InspirationHub: React.FC = () => {
  const [customEmbed, setCustomEmbed] = useState('');
  const [embedPreview, setEmbedPreview] = useState('');

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
          onClick={() => setEmbedPreview(customEmbed)}
        >
          ▶️ Preview Embed
        </button>

        {embedPreview && (
          <div className="mt-6 aspect-video w-full rounded overflow-hidden border border-blue-500 shadow">
            {/* Render embed safely: prefer iframe src, otherwise sanitize HTML before injection */}
            {(() => {
              // runtime safety: only render preview in browser secure contexts
              if (typeof window === 'undefined' || window.location.protocol === 'file:') {
                return <div className="text-sm text-red-600">Preview blocked in this context.</div>;
              }
              try {
                const { extractIframeSrc, isHostAllowed } = require('../../lib/embedUtils');
                const src = extractIframeSrc(embedPreview || '');
                if (src && isHostAllowed(src)) return <iframe title="embed" src={src} width="100%" height="100%" frameBorder={0} allowFullScreen />;
              } catch (e) {}
              const { sanitizeHtml } = require('../../lib/sanitize');
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