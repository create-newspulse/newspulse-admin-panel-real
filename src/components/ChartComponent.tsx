import React, { useEffect, useState } from "react";
import { Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import axios from 'axios';

ChartJS.register(ArcElement, Tooltip, Legend);

const ChartComponent: React.FC<{ isDark?: boolean }> = ({ isDark = false }) => {
  const [chartData, setChartData] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    axios
      .get('/api/monitor-hub')
      .then((res) => {
        const { debug = 0, manualEntry = 0, technology = 0 } = res.data;
        setChartData([debug, manualEntry, technology]);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch chart data:', err);
        setError(true);
        setLoading(false);
      });
  }, []);

  const data = {
    labels: ['Debug', 'Manual Entry', 'Technology'],
    datasets: [
      {
        label: 'Entry Types',
        data: chartData,
        backgroundColor: ['#3B82F6', '#10B981', '#F59E0B'],
        borderColor: isDark ? '#1F2937' : '#FFFFFF',
        borderWidth: 2,
        hoverOffset: 10,
      },
    ],
  };

  const options: ChartOptions<'pie'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      tooltip: {
        enabled: true,
      },
      legend: {
        position: 'bottom',
        labels: {
          color: isDark ? '#E5E7EB' : '#1F2937',
          font: {
            size: 13,
          },
        },
      },
    },
  };

  return (
    <div className="w-full h-[300px] sm:h-[400px] p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md transition">
      {loading ? (
        <div className="text-sm text-gray-500 dark:text-gray-300 animate-pulse">Loading chart...</div>
      ) : error ? (
        <div className="text-sm text-red-500">Failed to load chart data</div>
      ) : (
        <Pie data={data} options={options} />
      )}
    </div>
  );
};

export default ChartComponent;
