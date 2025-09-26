import React, { useState } from 'react';

const SectionBlock = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-white dark:bg-slate-800 rounded-xl shadow p-5 mb-8 border border-slate-200 dark:border-slate-700">
    <h2 className="text-xl font-semibold mb-4 text-slate-800 dark:text-white">{title}</h2>
    {children}
  </div>
);

const InspirationHub: React.FC = () => {
  const [customEmbed, setCustomEmbed] = useState('');
  const [embedPreview, setEmbedPreview] = useState('');

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-10">🌄 Inspiration Hub</h1>

      {/* ✅ Auto Embed Section */}
      <SectionBlock title="🚁 DroneTV – Scenic Nature Relaxation (Auto Embed)">
        <div className="aspect-video w-full rounded overflow-hidden border border-gray-300 shadow">
          <iframe
            src="https://www.youtube.com/embed/YVYNY6ez_uw"
            title="DroneTV"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
          ></iframe>
        </div>
        <p className="text-sm text-gray-500 mt-2 text-center">
          ✅ Auto embed from YouTube. For peaceful and safe viewing.
        </p>
      </SectionBlock>

      {/* ✍️ Manual Embed Section */}
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
            <div dangerouslySetInnerHTML={{ __html: embedPreview }} />
          </div>
        )}
      </SectionBlock>

      {/* 📜 Legal Disclaimer */}
      <p className="text-xs text-center text-gray-400 mt-10 border-t pt-4">
        📜 All videos are embedded from YouTube. We do not store, modify, or monetize any external content.
      </p>
    </div>
  );
};

export default InspirationHub;
