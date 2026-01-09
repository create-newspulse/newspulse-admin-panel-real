// 📁 src/pages/SafeOwner/LegalComplianceNote.tsx
import React from 'react';

const LegalComplianceNote: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold mb-6 text-red-700">⚖️ Legal Compliance Notice</h1>

      <p className="mb-4 text-gray-800 dark:text-gray-200">
        The following live content integrations on News Pulse strictly follow all applicable laws and platform policies:
      </p>

      <div className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg p-5">
        <h2 className="text-lg font-semibold mb-2 text-blue-700">1. YouTube Terms of Service</h2>
        <ul className="list-disc pl-6 text-sm text-gray-700 dark:text-gray-300">
          <li>✔️ We embed live YouTube videos directly using official embed links.</li>
          <li>✔️ We do not alter, overlay, or monetize the stream in any way.</li>
          <li>✔️ We fully retain all YouTube logos, branding, and link back to the official channel.</li>
        </ul>

        <h2 className="text-lg font-semibold mt-6 mb-2 text-blue-700">2. Indian Copyright Act Compliance</h2>
        <ul className="list-disc pl-6 text-sm text-gray-700 dark:text-gray-300">
          <li>✔️ We do not download, store, or reproduce any copyrighted broadcasts.</li>
          <li>✔️ Usage is purely for educational and civic informational purposes under fair use.</li>
          <li>✔️ All content is attributed with source and public interest intent.</li>
        </ul>

        <h2 className="text-lg font-semibold mt-6 mb-2 text-blue-700">3. Source Attribution</h2>
        <ul className="list-disc pl-6 text-sm text-gray-700 dark:text-gray-300">
          <li>📡 Source: <a href="https://www.youtube.com/@sansadtv" target="_blank" className="text-blue-600 underline" rel="noreferrer">Sansad TV Official YouTube</a></li>
          <li>🎯 Content displayed is for civic awareness and public broadcast relay only.</li>
        </ul>
      </div>

      <p className="mt-6 text-xs text-gray-500 dark:text-gray-400 italic">
        Last Updated: {new Date().toLocaleDateString()} — Verified by Admin Panel.
      </p>
    </div>
  );
};

export default LegalComplianceNote;
