// src/components/ErrorDisplay.tsx

export default function ErrorDisplay({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div className="bg-red-100 text-red-700 border border-red-300 rounded p-2 mb-2">
      {error === 'Too many requests'
        ? '⛔ Too many requests. Please wait and try again.'
        : error}
    </div>
  );
}
