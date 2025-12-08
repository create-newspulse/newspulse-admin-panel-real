import React from 'react';

interface Props {
  saving: boolean;
  updatedAt?: string;
  onPublish: () => void;
}

const PublishBar: React.FC<Props> = ({ saving, updatedAt, onPublish }) => {
  return (
    <div className="flex items-center justify-between gap-3">
      <button
        onClick={onPublish}
        disabled={saving}
        className="px-4 py-2 rounded bg-indigo-600 text-white disabled:opacity-60"
      >
        {saving ? 'Saving…' : 'Save & Go Live'}
      </button>
      <div className="text-xs text-slate-500">
        Last updated: {updatedAt ? new Date(updatedAt).toLocaleString() : '—'}
      </div>
    </div>
  );
};

export default PublishBar;
