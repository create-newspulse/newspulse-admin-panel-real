// 📁 components/PushPreviewBox.tsx
import { useEffect, useState } from 'react';
import { getPushPreview } from '../utils/pushPreview';

interface Props {
  headline: string;
  category: string;
}

export default function PushPreviewBox({ headline, category }: Props) {
  const [preview, setPreview] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!headline || !category) {
      setPreview('');
      return;
    }

    setError(false); // Reset error state

    getPushPreview(headline, category)
      .then((data) => {
        setPreview(data);
      })
      .catch(() => {
        setError(true);
        setPreview('⚠️ Failed to fetch preview.');
      });
  }, [headline, category]);

  return (
    <div className="mt-3 bg-blue-50 dark:bg-gray-800 border border-blue-200 dark:border-gray-600 rounded p-4">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">🔔 Push Notification Preview:</p>
      <p className="text-lg font-bold text-gray-900 dark:text-white">
        {preview || '🔍 Waiting for headline...'}
      </p>
      {error && (
        <p className="text-red-500 text-xs mt-2">Backend not responding or invalid preview.</p>
      )}
    </div>
  );
}
