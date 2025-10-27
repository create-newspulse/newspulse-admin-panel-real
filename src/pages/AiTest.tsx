import React, { useEffect, useState } from 'react';
import AiEngineToggle, { AiEngine } from '../components/AiEngineToggle';
import VoicePlayer from '../components/VoicePlayer';
import { API_BASE_PATH } from '../lib/api';

// Task type definition
type TaskType = 'summarize' | 'headline' | 'rewrite';

const LANGUAGES = ['English', 'Hindi', 'Gujarati'] as const;
type Language = typeof LANGUAGES[number];

const AITest: React.FC = () => {
  const [engine, setEngine] = useState<AiEngine>('auto');
  const [taskType, setTaskType] = useState<TaskType>('summarize');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState<Language>('English');
  const [selectedArticleId, setSelectedArticleId] = useState('');
  const [articles, setArticles] = useState<any[]>([]);
  const [articleError, setArticleError] = useState<string | null>(null);

  // Fetch articles on mount
  useEffect(() => {
    setArticleError(null);
    fetch(`${API_BASE_PATH}/news/all`, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error('API error: ' + res.status);
        const type = res.headers.get('content-type');
        if (!type?.includes('application/json')) throw new Error('Not JSON response');
        return res.json();
      })
      .then((data) => {
        setArticles(Array.isArray(data.articles) ? data.articles : []);
        if (Array.isArray(data.articles) && data.articles.length === 1) {
          setSelectedArticleId(data.articles[0]._id);
          setInput(data.articles[0].content || '');
        }
      })
      .catch((err) => {
        setArticles([]);
        setArticleError('❌ Failed to load articles: ' + (err?.message || err));
        setInput('');
      });
  }, []);

  // AI Explain Task
  const handleSubmit = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setOutput('');
    try {
      const res = await fetch(`${API_BASE_PATH}/ai/explain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content: input }),
      });

      const type = res.headers.get('content-type');
      if (!res.ok || !type?.includes('application/json')) {
        const text = await res.text();
        throw new Error('Invalid AI response:\n' + text);
      }

      const data = await res.json();
      const summary = data.summary?.trim() || '';
      const result = `🧠 ${engine.toUpperCase()} Output:\n${summary || 'No output returned.'}`;
      setOutput(result);

      // Optional: Save logs only if summary
      if (summary) {
        await fetch(`${API_BASE_PATH}/ai/logs/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ taskType, language, engine, result }),
        });
      }
    } catch (err: any) {
      setOutput('⚠️ AI Task failed. ' + (err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  // Save/copy helpers
  const handleCopy = () => {
    navigator.clipboard.writeText(output);
    alert('✅ Output copied to clipboard!');
  };

  const handleSave = () => {
    const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
    const filename = `NewsPulse-${taskType}-${Date.now()}.txt`;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  const handleSaveToArticle = async () => {
    const summaryText = output.replace(/^🧠.*?Output:\n/, '');
    try {
      const res = await fetch(`${API_BASE_PATH}/ai/logs/save-summary-to-article`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          articleId: selectedArticleId,
          summary: summaryText,
          engine,
          userId: 'founder',
        }),
      });
      const data = await res.json();
      alert(data.message || 'Summary saved!');
    } catch (err) {
      alert('❌ Failed to save summary to article.');
    }
  };

  // Language code for TTS
  const detectLangCode = () =>
    language === 'Hindi' ? 'hi' : language === 'Gujarati' ? 'gu' : 'en';

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-blue-700">🧠 News Pulse AI Engine</h1>

      <AiEngineToggle engine={engine} setEngine={setEngine} />

      <div>
        <label className="block font-medium mb-1">Language:</label>
        <select
          className="border p-2 w-full rounded"
          value={language}
          onChange={e => setLanguage(e.target.value as Language)}
        >
          {LANGUAGES.map(l => (
            <option value={l} key={l}>{l}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block font-medium mb-1">Task Type:</label>
        <select
          className="border p-2 w-full rounded"
          value={taskType}
          onChange={e => setTaskType(e.target.value as TaskType)}
        >
          <option value="summarize">Summarize</option>
          <option value="headline">Generate Headline</option>
          <option value="rewrite">Rewrite Text</option>
        </select>
      </div>

      <div>
        <label className="block font-medium mb-1">Select Article:</label>
        <select
          className="border p-2 w-full rounded"
          value={selectedArticleId}
          onChange={e => {
            setSelectedArticleId(e.target.value);
            const selected = articles.find(a => a._id === e.target.value);
            if (selected) setInput(selected.content || '');
          }}
        >
          <option value="">-- Select Article --</option>
          {articles.map(article => (
            <option key={article._id} value={article._id}>
              {article.title}
            </option>
          ))}
        </select>
      </div>

      {articleError && (
        <div className="text-red-500 text-sm">{articleError}</div>
      )}

      <textarea
        className="w-full border p-3 rounded min-h-[120px] focus:outline-blue-500"
        placeholder="Paste or select news content..."
        value={input}
        onChange={e => setInput(e.target.value)}
      />

      <button
        onClick={handleSubmit}
        disabled={loading || !input.trim()}
        className={`px-4 py-2 rounded text-white ${loading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}
      >
        {loading ? 'Processing...' : 'Run AI Task'}
      </button>

      {output && (
        <>
          <div className={`bg-gray-100 border p-4 rounded whitespace-pre-wrap text-sm text-gray-800 font-${language === 'Gujarati' ? 'gujarati' : language === 'Hindi' ? 'hindi' : 'sans'}`}>
            {output}
          </div>
          <div className="text-xs text-right text-gray-500 mt-1">
            Characters: {output.replace(/^🧠.*?Output:\n/, '').length}
          </div>
          <div className="flex gap-3 mt-3 flex-wrap items-center">
            <VoicePlayer text={output} language={detectLangCode()} />
            <button onClick={handleCopy} className="bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-1 rounded">📋 Copy</button>
            <button onClick={handleSave} className="bg-purple-600 hover:bg-purple-700 text-white text-sm px-3 py-1 rounded">📎 Save as TXT</button>
            {selectedArticleId && (
              <button onClick={handleSaveToArticle} className="bg-orange-600 hover:bg-orange-700 text-white text-sm px-3 py-1 rounded">📎 Save to Article</button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AITest;
