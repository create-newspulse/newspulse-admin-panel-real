// 📁 src/pages/PollResultsChart.tsx
import { useEffect, useState } from 'react';
import { Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

interface Poll {
  _id: string;
  question: string;
  options: { text: string; votes: number }[];
}

const PollResultsChart = () => {
  const [poll, setPoll] = useState<Poll | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/polls/latest`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setPoll(data.poll);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load poll results', err);
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="p-6">Loading chart...</p>;
  if (!poll) return <p className="p-6">No poll data available</p>;

  const chartData = {
    labels: poll.options.map((o) => o.text),
    datasets: [
      {
        label: 'Votes',
        data: poll.options.map((o) => o.votes),
        backgroundColor: [
          '#3b82f6',
          '#10b981',
          '#f59e0b',
          '#ef4444',
          '#8b5cf6',
          '#14b8a6',
        ],
        borderWidth: 1,
      },
    ],
  };

  return (
    <div className="max-w-xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">📊 Live Poll Results</h2>
      <p className="text-lg font-medium mb-4">{poll.question}</p>
      <Pie data={chartData} />
    </div>
  );
};

export default PollResultsChart;
