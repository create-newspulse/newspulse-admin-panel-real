import { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useLockdownCheck } from '@hooks/useLockdownCheck';

const PollEditor = () => {
  const [question, setQuestion] = useState({ en: '', hi: '', gu: '' });
  const [options, setOptions] = useState({ en: ['', ''], hi: ['', ''], gu: ['', ''] });
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [settings, setSettings] = useState({ lockdown: false });

  useEffect(() => {
    axios
      .get('/api/settings/load')
      .then((res) => setSettings(res.data))
      .catch(() => setSettings({ lockdown: false }));
  }, []);

  useLockdownCheck(settings);

  const handleOptionChange = (lang: 'en' | 'hi' | 'gu', value: string, index: number): void => {
    const updated = [...options[lang]];
    updated[index] = value;
    setOptions({ ...options, [lang]: updated });
  };

  const handleQuestionChange = (lang: 'en' | 'hi' | 'gu', value: string): void => {
    setQuestion({ ...question, [lang]: value });
  };

  const addOption = (): void => {
    if (options.en.length >= 6) {
      toast.error('Maximum 6 options allowed');
      return;
    }
    setOptions({
      en: [...options.en, ''],
      hi: [...options.hi, ''],
      gu: [...options.gu, ''],
    });
  };

  const removeOption = (index: number): void => {
    if (options.en.length <= 2) {
      toast.error('Minimum 2 options required');
      return;
    }
    setOptions({
      en: options.en.filter((_, i) => i !== index),
      hi: options.hi.filter((_, i) => i !== index),
      gu: options.gu.filter((_, i) => i !== index),
    });
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/ai/poll-question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.question && data.options) {
        setQuestion(data.question);
        setOptions(data.options);
        toast.success('✨ AI generated a poll!');
      } else {
        toast.error('Failed to generate');
      }
    } catch (err) {
      toast.error('AI server error');
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmit = async (): Promise<void> => {
    if (!question.en.trim()) {
      toast.error('English question is required');
      return;
    }
    if (options.en.some((opt) => !opt.trim())) {
      toast.error('All English options must be filled');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/polls/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, options }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('✅ Poll created');
        setQuestion({ en: '', hi: '', gu: '' });
        setOptions({ en: ['', ''], hi: ['', ''], gu: ['', ''] });
      } else {
        toast.error(data.message || 'Failed to create poll');
      }
    } catch (err) {
      toast.error('Server error');
    } finally {
      setLoading(false);
    }
  };

  if (settings.lockdown) {
    return (
      <div className="p-6 text-center text-red-600 dark:text-red-400">
        🔒 Poll creation is disabled during lockdown mode.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">🗳️ Create New Poll</h2>

      <div className="mb-4">
        <input
          className="w-full border px-4 py-2 mb-2 rounded"
          placeholder="Question (English)"
          value={question.en}
          onChange={(e) => handleQuestionChange('en', e.target.value)}
        />
        <input
          className="w-full border px-4 py-2 mb-2 rounded"
          placeholder="प्रश्न (Hindi)"
          value={question.hi}
          onChange={(e) => handleQuestionChange('hi', e.target.value)}
        />
        <input
          className="w-full border px-4 py-2 mb-2 rounded"
          placeholder="પ્રશ્ન (Gujarati)"
          value={question.gu}
          onChange={(e) => handleQuestionChange('gu', e.target.value)}
        />
      </div>

      {options.en.map((_, idx) => (
        <div key={idx} className="flex gap-2 mb-2">
          <div className="flex-1">
            <input
              className="w-full border px-3 py-1 mb-1 rounded"
              placeholder={`Option ${idx + 1} (English)`}
              value={options.en[idx]}
              onChange={(e) => handleOptionChange('en', e.target.value, idx)}
            />
            <input
              className="w-full border px-3 py-1 mb-1 rounded"
              placeholder={`विकल्प ${idx + 1} (Hindi)`}
              value={options.hi[idx]}
              onChange={(e) => handleOptionChange('hi', e.target.value, idx)}
            />
            <input
              className="w-full border px-3 py-1 rounded"
              placeholder={`વિકલ્પ ${idx + 1} (Gujarati)`}
              value={options.gu[idx]}
              onChange={(e) => handleOptionChange('gu', e.target.value, idx)}
            />
          </div>
          {options.en.length > 2 && (
            <button
              onClick={() => removeOption(idx)}
              className="text-red-500 font-bold"
            >
              ✖
            </button>
          )}
        </div>
      ))}

      <div className="flex gap-3 flex-wrap mb-4">
        <button
          onClick={addOption}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded"
        >
          ➕ Add Option
        </button>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded"
        >
          💡 {generating ? 'Generating...' : 'Auto Generate Poll'}
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded"
        >
          🚀 Publish Poll
        </button>
      </div>
    </div>
  );
};

export default PollEditor;
