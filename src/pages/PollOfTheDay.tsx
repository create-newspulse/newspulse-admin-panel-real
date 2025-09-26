import { useEffect, useState } from 'react';
import { useLockdownCheck } from '@hooks/useLockdownCheck';
import axios from 'axios';

interface Poll {
  _id: string;
  question_en: string;
  question_hi: string;
  question_gu: string;
  options_en: string[];
  options_hi: string[];
  options_gu: string[];
  options?: { text: string; votes: number }[];
}

const PollOfTheDay = () => {
  const [poll, setPoll] = useState<Poll | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [voted, setVoted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<'en' | 'hi' | 'gu'>('en');
  const [settings, setSettings] = useState({ lockdown: false });

  // 🔒 Load lockdown settings
  useEffect(() => {
    axios
      .get('/api/settings/load')
      .then((res) => setSettings(res.data))
      .catch(() => setSettings({ lockdown: false }));
  }, []);

  useLockdownCheck(settings);

  // 🌐 Detect browser language
  useEffect(() => {
    const browserLang = navigator.language;
    if (browserLang.startsWith('hi')) setLang('hi');
    else if (browserLang.startsWith('gu')) setLang('gu');
  }, []);

  // 📥 Load latest poll
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/polls/latest`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setPoll(data.poll);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load poll', err);
        setLoading(false);
      });
  }, []);

  const getQuestion = () => {
    if (!poll) return '';
    if (lang === 'hi') return poll.question_hi;
    if (lang === 'gu') return poll.question_gu;
    return poll.question_en;
  };

  const getOptions = () => {
    if (!poll) return [];
    if (lang === 'hi') return poll.options_hi;
    if (lang === 'gu') return poll.options_gu;
    return poll.options_en;
  };

  const handleVote = async () => {
    if (poll && selected !== null) {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/polls/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pollId: poll._id, optionIndex: selected }),
        });
        const data = await res.json();
        if (data.success) {
          setPoll(data.poll);
          setVoted(true);
        }
      } catch (err) {
        console.error('Vote failed', err);
      }
    }
  };

  // 🔒 Lockdown message
  if (settings.lockdown) {
    return (
      <div className="p-6 text-center text-red-600 dark:text-red-400">
        🔒 Voting is temporarily disabled during lockdown mode.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto bg-white shadow rounded-xl">
      <h1 className="text-2xl font-bold mb-4">📊 Poll of the Day</h1>

      {/* 🌐 Language Selector */}
      <div className="mb-4">
        <label htmlFor="lang" className="mr-2 font-semibold">Language:</label>
        <select
          id="lang"
          value={lang}
          onChange={(e) => setLang(e.target.value as 'en' | 'hi' | 'gu')}
          className="border px-2 py-1 rounded"
        >
          <option value="en">🇬🇧 English</option>
          <option value="hi">🇮🇳 हिंदी</option>
          <option value="gu">🇮🇳 ગુજરાતી</option>
        </select>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : poll ? (
        <>
          <h2 className="text-lg font-semibold mb-3">{getQuestion()}</h2>
          <ul className="space-y-2">
            {getOptions().map((opt, idx) => (
              <li
                key={idx}
                onClick={() => setSelected(idx)}
                className={`cursor-pointer px-4 py-2 rounded-md border ${
                  selected === idx ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                }`}
              >
                {opt}
                {voted && poll.options && poll.options[idx] && (
                  <span className="ml-2 text-sm text-gray-600">
                    – {poll.options[idx].votes} vote{poll.options[idx].votes !== 1 ? 's' : ''}
                  </span>
                )}
              </li>
            ))}
          </ul>

          {!voted && (
            <button
              onClick={handleVote}
              className="mt-4 px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              disabled={selected === null}
            >
              Vote
            </button>
          )}

          {voted && (
            <p className="mt-4 text-green-600">✅ Thank you for voting!</p>
          )}
        </>
      ) : (
        <p>No active poll available.</p>
      )}
    </div>
  );
};

export default PollOfTheDay;
