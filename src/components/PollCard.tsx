import { useEffect, useState } from 'react';
import { adminJson } from '@/lib/http/adminFetch';

interface Poll {
  _id: string;
  question_en: string;
  question_hi: string;
  question_gu: string;
  options_en: string[];
  options_hi: string[];
  options_gu: string[];
  options?: { text: string; votes: number }[]; // optional from vote update
}

const PollCard = () => {
  const [poll, setPoll] = useState<Poll | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [voted, setVoted] = useState(false);
  const [lang, setLang] = useState<'en' | 'hi' | 'gu'>('en');

  useEffect(() => {
    const stored = localStorage.getItem('preferredLang');
    const detected = navigator.language.startsWith('hi')
      ? 'hi'
      : navigator.language.startsWith('gu')
      ? 'gu'
      : 'en';
    setLang((stored as any) || detected);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const data = await adminJson<any>('/polls/latest', { method: 'GET' });
        if (data?.success) setPoll(data.poll);
      } catch {
        // ignore
      }
    })();
  }, []);

  const getQuestion = () => {
    if (!poll) return '';
    return lang === 'hi'
      ? poll.question_hi
      : lang === 'gu'
      ? poll.question_gu
      : poll.question_en;
  };

  const getOptions = () => {
    if (!poll) return [];
    return lang === 'hi'
      ? poll.options_hi
      : lang === 'gu'
      ? poll.options_gu
      : poll.options_en;
  };

  const handleVote = async () => {
    if (!poll || selected === null) return;

    const data = await adminJson<any>('/polls/vote', {
      method: 'POST',
      json: { pollId: poll._id, optionIndex: selected },
    });
    if (data.success) {
      setPoll(data.poll); // returns updated votes
      setVoted(true);
    }
  };

  if (!poll) return null;

  return (
    <div className="bg-white shadow p-4 rounded-lg">
      <h3 className="font-semibold text-lg mb-2">📊 Poll of the Day</h3>
      <p className="mb-3 text-sm">{getQuestion()}</p>

      {getOptions().map((opt, idx) => (
        <button
          key={idx}
          onClick={() => setSelected(idx)}
          className={`block w-full text-left px-3 py-2 mb-1 border rounded ${
            selected === idx ? 'border-blue-600 bg-blue-50' : 'border-gray-300'
          }`}
        >
          {opt}
          {voted && poll.options && (
            <span className="ml-2 text-sm text-gray-500">
              ({poll.options[idx]?.votes ?? 0})
            </span>
          )}
        </button>
      ))}

      {!voted ? (
        <button
          className="mt-3 w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          onClick={handleVote}
          disabled={selected === null}
        >
          Vote
        </button>
      ) : (
        <p className="text-green-600 mt-2">✅ Voted!</p>
      )}
    </div>
  );
};

export default PollCard;
