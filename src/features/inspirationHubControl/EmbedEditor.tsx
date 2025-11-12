import React from 'react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  error?: string | null;
}

const EmbedEditor: React.FC<Props> = ({ value, onChange, error }) => {
  return (
    <div className="bg-white dark:bg-slate-800 border rounded-lg p-4">
      <label className="block text-sm font-semibold mb-2">Embed Code</label>
      <textarea
        rows={6}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full border rounded p-3 font-mono text-sm ${error ? 'border-red-500' : ''}`}
        placeholder="<iframe src='https://www.youtube.com/embed/...'></iframe> or paste a direct video URL"
      />
      <div className="mt-2 text-xs text-slate-500">
        Only trusted domains are allowed; content is sanitized on the server. Enter a standard YouTube/Vimeo/Twitter embed.
      </div>
      {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
    </div>
  );
};

export default EmbedEditor;
