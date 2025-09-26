import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function AiTrainerCard() {
  const router = useRouter();
  const [trainingInfo, setTrainingInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchTrainingInfo = async () => {
      try {
        const res = await fetch('/api/system/ai-training-info');
        const json = await res.json();

        if (res.ok && json.success && json.data) {
          setTrainingInfo(json.data); // ✅ Correct assignment
        } else {
          console.error('⚠️ Training Info API Error:', json);
          setError(json.message || '❌ Failed to load training info.');
        }
      } catch (err) {
        console.error('❌ AI Training Info Fetch Error:', err);
        setError('❌ Failed to load AI training info.');
      } finally {
        setLoading(false);
      }
    };

    fetchTrainingInfo();
  }, []);

  const handleViewDiagnostics = (e: React.MouseEvent) => {
    e.preventDefault();
    router.push('/admin/diagnostics');
  };

  const handleActivateTrainer = async () => {
    try {
      const res = await fetch('/api/system/activate-ai-trainer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: 'manual' })
      });

      const data = await res.json();

      if (res.ok) {
        alert('✅ Full AI Trainer activated!');
        console.log('🧠 Activation Response:', data);
      } else {
        alert('❌ Activation failed: ' + data.message);
      }
    } catch (err) {
      alert('❌ Failed to activate trainer. Check backend logs.');
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-xl border border-slate-200">
      <h2 className="text-xl font-bold text-blue-700 dark:text-blue-300 mb-2">🧬 AI Trainer</h2>

      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
        Train your AI engine for smarter automation, engagement optimization, and performance learning.
      </p>

      {error ? (
        <p className="text-red-600 text-sm mb-2">{error}</p>
      ) : loading ? (
        <p className="text-sm text-gray-500">Loading training data...</p>
      ) : trainingInfo ? (
        <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-1">
          <li>🕓 <strong>Last Trained:</strong> {trainingInfo.lastTraining ? new Date(trainingInfo.lastTraining).toLocaleString() : 'N/A'}</li>
          <li>⏳ <strong>Next Training:</strong> {trainingInfo.nextTraining ? new Date(trainingInfo.nextTraining).toLocaleString() : 'N/A'}</li>
          <li>📊 <strong>Data Used:</strong> {trainingInfo.articlesAnalyzed} articles, {trainingInfo.keywords} keywords</li>
          <li>🎯 <strong>Focus:</strong> {trainingInfo.patternFocus}</li>
          <li>🛡️ <strong>Founder Lock:</strong> {trainingInfo.lockedByFounder ? '✅ Active' : '❌ Not active'}</li>
        </ul>
      ) : (
        <p className="text-sm text-gray-500">No training info available.</p>
      )}

      <div className="mt-4 flex flex-col gap-2">
        <a
          href="#"
          onClick={handleViewDiagnostics}
          className="text-green-600 underline text-sm hover:text-green-800"
        >
          🧠 View AI Diagnostics
        </a>

        <button
          onClick={handleActivateTrainer}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded text-sm"
        >
          🔧 Activate Full AI Trainer
        </button>
      </div>

      <div className="mt-4">
        <textarea
          placeholder="Suggest improvement or tell what AI should focus on..."
          className="w-full border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white p-2 rounded mt-2"
          rows={3}
        />
      </div>
    </div>
  );
}
