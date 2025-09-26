import React, { useState } from 'react';
import { useTranslate } from '../hooks/useTranslate';

const AISummarizer: React.FC = () => {
  const t = useTranslate();

  const [input, setInput] = useState('');
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSummarize = async () => {
    if (!input.trim()) return;

    setLoading(true);
    setError('');
    setSummary('');

    try {
      const res = await fetch('https://newspulse-backend.onrender.com/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: input }),
      });

      const data = await res.json();

      if (data.success && data.summary) {
        setSummary(data.summary);
      } else {
        setError(t('aiSummaryFailed'));
      }
    } catch (err) {
      setError(t('serverError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto text-gray-800 dark:text-white">
      <h1 className="text-2xl font-bold mb-4">🧠 {t('aiSummarize')}</h1>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={6}
        placeholder={t('newsContent')}
        className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded dark:bg-gray-800 mb-4"
      />

      <button
        onClick={handleSummarize}
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? t('loading') : t('aiSummarize')}
      </button>

      {summary && (
        <div className="mt-6 p-4 bg-green-100 dark:bg-green-900 text-sm rounded">
          <strong>{t('aiSummary')}:</strong>
          <p className="mt-2 whitespace-pre-wrap">{summary}</p>
        </div>
      )}

      {error && <p className="mt-4 text-red-500">{error}</p>}
    </div>
  );
};

export default AISummarizer;
