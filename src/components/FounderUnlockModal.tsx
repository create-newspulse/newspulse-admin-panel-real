import React, { useEffect, useState } from 'react';

type FounderUnlockModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (code: string) => void;
};

const FounderUnlockModal: React.FC<FounderUnlockModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [code, setCode] = useState('');

  // ⌨️ Close on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter' && code.trim()) onSubmit(code);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [code, onClose, onSubmit]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-60 flex items-center justify-center">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6 w-full max-w-md space-y-4">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">🔐 Founder Reactivation</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Enter your Founder Reactivation Code to unlock system access.
        </p>
        <input
          type="password"
          className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-black dark:text-white"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Enter secret code"
          autoFocus
        />
        <div className="flex justify-end gap-2 pt-2">
          <button
            className="px-4 py-2 bg-gray-400 hover:bg-gray-500 text-white rounded-md"
            onClick={() => {
              setCode('');
              onClose();
            }}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md disabled:opacity-50"
            onClick={() => {
              if (code.trim()) {
                onSubmit(code.trim());
                setCode('');
              }
            }}
            disabled={!code.trim()}
          >
            Unlock
          </button>
        </div>
      </div>
    </div>
  );
};

export default FounderUnlockModal;
