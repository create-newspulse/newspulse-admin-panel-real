import React from 'react';
import type { InspirationMode } from './types';

interface Props {
  value: InspirationMode;
  onChange: (v: InspirationMode) => void;
}

const ModePicker: React.FC<Props> = ({ value, onChange }) => {
  return (
    <div className="bg-white dark:bg-slate-800 border rounded-lg p-4">
      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            checked={value === 'inspiration'}
            onChange={() => onChange('inspiration')}
          />
          <span>🌟 Inspiration Hub</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            checked={value === 'livetv'}
            onChange={() => onChange('livetv')}
          />
          <span>📺 Live TV</span>
        </label>
      </div>
    </div>
  );
};

export default ModePicker;
