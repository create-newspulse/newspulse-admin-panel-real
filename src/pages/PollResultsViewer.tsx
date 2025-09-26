// 📁 src/pages/PollResultsViewer.tsx
import { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import toast from 'react-hot-toast';
import 'chart.js/auto';

const PollResultsViewer = () => {
  const [poll, setPoll] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPoll = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/polls/latest`);
        const data = await res.json();
        if (data.success && data.poll) {
          setPoll(data.poll);
        } else {
          toast.error('❌ No active poll found');
        }
      } catch (err) {
        toast.error('⚠️ Error loading poll');
      } finally {
        setLoading(false);
      }
    };

    fetchPoll();
  }, []);

  if (loading) return <p className="text-center">⏳ Loading...</p>;
  if (!poll) return <p className="text-center">🚫 No poll data</p>;

  const chartData = {
    labels: poll.options.map((o: any) => o.text),
    datasets: [
      {
        label: 'Votes',
        data: poll.options.map((o: any) => o.votes),
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
      },
    ],
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">📊 Poll Results</h2>
      <p className="mb-6 text-lg font-medium">{poll.question}</p>
      <Bar data={chartData} options={{ responsive: true, plugins: { legend: { display: false } } }} />
    </div>
  );
};

export default PollResultsViewer;
