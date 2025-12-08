// 📁 File: src/pages/admin/EmbedManager.tsx
// ✅ Embed Manager with TED Youth Zone, Manual Embed, and Section Assignment

import React, { useState } from 'react';
import AdminShell from '../../components/adminv2/AdminShell';
import { extractIframeSrc, isHostAllowed } from '../../lib/embedUtils';

const SectionBlock = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-white dark:bg-slate-800 rounded-xl shadow p-5 mb-8 border border-slate-200 dark:border-slate-700">
    <h2 className="text-xl font-semibold mb-4 text-slate-800 dark:text-white">{title}</h2>
    {children}
  </div>
);

const EmbedManager: React.FC = () => {
  const [customEmbed, setCustomEmbed] = useState('');
  // embedSrc holds a safe iframe src URL extracted from user input
  const [embedSrc, setEmbedSrc] = useState('');
  const [embedError, setEmbedError] = useState('');

  // embed utils handle extraction and host allowlist (configurable via VITE_EMBED_ALLOWLIST)

  return (
    <AdminShell>
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-10">🧩 Embed Manager</h1>

      {/* 🎥 TED Youth Zone */}
      <SectionBlock title="🎓 Curated TED Youth Embeds">
        <ul className="list-disc list-inside text-sm text-blue-700">
          <li>
            <a
              href="https://www.youtube.com/embed/QtyT8G9b2Xo"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              📌 Why you will fail to have a great career — Larry Smith
            </a>
          </li>
          <li>
            <a
              href="https://www.youtube.com/embed/2zrtHt3bBmQ"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              📌 The power of believing you can improve — Carol Dweck
            </a>
          </li>
          <li>
            <a
              href="https://www.youtube.com/embed/16p9YRF0l-g"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              📌 What adults can learn from kids — Adora Svitak
            </a>
          </li>
          <li>
            <a
              href="https://www.youtube.com/embed/16p9YRF0l-g"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              📌 How to build your creative confidence — David Kelley
            </a>
          </li>
          <li>
            <a
              href="https://www.youtube.com/embed/_QdPW8JrYzQ"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              📌 This is what happens when you reply to spam email — James Veitch
            </a>
          </li>
        </ul>

        <p className="text-xs mt-2 text-gray-500 italic">
          📎 All TED content is embedded via official YouTube source. Copyright belongs to TED.
        </p>
      </SectionBlock>

      {/* ✍️ Manual Embed Entry */}
      <SectionBlock title="✍️ Paste Your Own Embed Code + Assign Section">
        <textarea
          rows={4}
          className="w-full p-3 rounded border border-gray-300 text-sm font-mono"
          placeholder="<iframe ...></iframe>"
          value={customEmbed}
          onChange={(e) => setCustomEmbed(e.target.value)}
        />

        <div className="mt-3">
          <label className="block mb-2 font-medium text-sm">🎯 Assign to Section:</label>
          <select className="w-full p-2 border border-gray-300 rounded text-sm">
            <option>🎓 TED Youth</option>
            <option>🚁 DroneTV</option>
            <option>✨ Daily Wonders</option>
            <option>📺 DD News Live</option>
            <option>🏛️ Sansad TV</option>
          </select>
        </div>

        <button
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500"
          onClick={() => {
            setEmbedError('');
            setEmbedSrc('');
            const src = extractIframeSrc(customEmbed);
            if (!src) {
              setEmbedError('Unable to extract a valid iframe src from the input. Paste a full iframe or embed URL.');
              return;
            }
            if (!isHostAllowed(src)) {
              setEmbedError('Embed host not allowed. Only YouTube, Vimeo, TED, AirVuz and trusted providers are permitted.');
              return;
            }
            setEmbedSrc(src);
          }}
        >
          ▶️ Preview Embed
        </button>

        {embedError && <p className="text-sm text-red-600 mt-3">{embedError}</p>}

        {embedSrc && (
          <div className="mt-6 aspect-video w-full rounded overflow-hidden border border-blue-500 shadow">
            <iframe
              title="Embed preview"
              src={embedSrc}
              width="100%"
              height="100%"
              frameBorder={0}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}
      </SectionBlock>

      <p className="text-xs text-center text-gray-400 mt-10 border-t pt-4">
        📜 All embeds are from YouTube, TED, AirVuz or other trusted public sources. No videos are hosted on News Pulse. This system follows legal, non-monetized embedding standards.
      </p>
    </div>
    </AdminShell>
  );
};

export default EmbedManager;
