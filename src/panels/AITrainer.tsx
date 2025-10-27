import { useState } from 'react';
import {
  FaSyncAlt, FaBrain, FaClock, FaChartBar, FaRocket, FaShieldAlt,
  FaCogs, FaMicroscope, FaBolt
} from 'react-icons/fa';
import { Link } from 'react-router-dom';
import { useAITrainingInfo } from '@context/AITrainingInfoContext';
import { apiFetch } from '@utils/apiFetch'; // <-- USE THIS

export default function AITrainer() {
  const { info: trainerInfo, loading, error } = useAITrainingInfo();
  const [feedback, setFeedback] = useState('');
  const [loadingAction, setLoadingAction] = useState(false);
  const [activating, setActivating] = useState(false);

  // --- Use apiFetch for backend actions ---
  const retrainNow = async () => {
    setLoadingAction(true);
    try {
      const res = await apiFetch('/api/system/ai-train', { method: 'POST' });
      alert(`✅ ${res.message || 'Retraining triggered.'}`);
      // Optionally trigger context refresh (e.g., refetch training info)
    } catch (err: any) {
      console.error('❌ Retrain failed:', err);
      alert('❌ Training failed: ' + (err.message || 'Unknown error'));
    } finally {
      setLoadingAction(false);
    }
  };

  const activateFullTrainer = async () => {
    setActivating(true);
    try {
      const res = await apiFetch('/api/system/ai-trainer/activate', { method: 'POST' });
      alert(`🧬 ${res.message || 'Full AI Trainer activated.'}`);
      // Optionally trigger context refresh
    } catch (err: any) {
      console.error('❌ Activation error:', err);
      alert('❌ Activation failed: ' + (err.message || 'Unknown error'));
    } finally {
      setActivating(false);
    }
  };

  const submitFeedback = async () => {
    if (!feedback.trim()) return;
    try {
      await apiFetch('/api/system/ai-feedback', {
        method: 'POST',
        body: JSON.stringify({ feedback }),
      });
      alert('📩 Feedback submitted to AI trainer.');
      setFeedback('');
    } catch (err: any) {
      console.error('❌ Feedback error:', err);
      alert('❌ Failed to send feedback: ' + (err.message || 'Unknown error'));
    }
  };

  return (
    <div className="ai-card glow-panel futuristic-glow border border-indigo-600 dark:border-indigo-400 p-6 rounded-xl text-white bg-gradient-to-br from-black via-gray-900 to-gray-800">
      <h2 className="text-xl font-bold flex items-center gap-2 text-blue-400 mb-2 animate-pulse">
        <FaBolt className="text-yellow-400" />
        AI Trainer Control Panel
      </h2>
      <p className="text-sm text-gray-300 mb-4">
        Tune your AI engine for smarter behavior, better decisions, and intelligent automation.
      </p>

      {error ? (
        <div className="text-red-400">❌ Failed to load AI training info.</div>
      ) : loading ? (
        <div className="text-gray-400">⏳ Loading trainer info...</div>
      ) : trainerInfo ? (
        <div className="space-y-2 text-sm text-gray-200">
          <p>
            <FaBrain className="inline mr-1 text-green-400" />
            <strong>Last Trained:</strong>{' '}
            {trainerInfo.lastTraining ? new Date(trainerInfo.lastTraining).toLocaleString() : '—'}
          </p>
          <p>
            <FaClock className="inline mr-1 text-yellow-300" />
            <strong>Next Training:</strong>{' '}
            {trainerInfo.nextTraining ? new Date(trainerInfo.nextTraining).toLocaleString() : '—'}
          </p>
          <p>
            <FaChartBar className="inline mr-1 text-blue-300" />
            <strong>Data Used:</strong> {trainerInfo.articlesAnalyzed} articles, {trainerInfo.keywords} keywords
          </p>
          <p>
            <FaRocket className="inline mr-1 text-purple-300" />
            <strong>Focus:</strong> {trainerInfo.patternFocus || 'Engagement Intelligence'}
          </p>
          <p>
            <FaShieldAlt className="inline mr-1 text-red-400" />
            <strong>Founder Lock:</strong>{' '}
            {trainerInfo.lockedByFounder ? '🛡️ Only you can retrain' : '❌ Not active'}
          </p>
          <p>
            <FaMicroscope className="inline mr-1 text-green-300" />
            <strong>
              <Link to="/admin/diagnostics" className="text-green-400 hover:underline">
                View AI Diagnostics
              </Link>
            </strong>
          </p>
        </div>
      ) : (
        <div className="text-gray-400">⏳ Loading trainer info...</div>
      )}

      <div className="flex gap-3 mt-6">
        <button
          onClick={retrainNow}
          disabled={loadingAction}
          className={`px-4 py-2 rounded-full flex items-center gap-2 text-white font-semibold shadow ${
            loadingAction ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-700 hover:bg-blue-800'
          }`}
        >
          <FaSyncAlt className={loadingAction ? 'animate-spin-slow' : ''} /> Retrain Now
        </button>

        <button
          onClick={activateFullTrainer}
          disabled={activating}
          className={`px-4 py-2 rounded-full flex items-center gap-2 text-white font-semibold shadow ${
            activating ? 'bg-purple-400 cursor-not-allowed' : 'bg-purple-700 hover:bg-purple-800'
          }`}
        >
          <FaCogs className={activating ? 'animate-spin-slow' : ''} /> Activate Full AI Trainer
        </button>
      </div>

      <div className="mt-6">
        <textarea
          rows={3}
          className="w-full p-3 border rounded-md bg-white dark:bg-slate-800 text-black dark:text-white text-sm"
          placeholder="💬 Suggest improvement or tell what AI should focus on..."
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
        />
        <button
          onClick={submitFeedback}
          className="mt-2 px-4 py-2 bg-green-600 text-white rounded-full hover:bg-green-700 font-medium shadow"
        >
          📤 Submit Feedback
        </button>
      </div>
    </div>
  );
}
