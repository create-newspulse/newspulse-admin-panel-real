import React, { useEffect, useState } from 'react';

interface ScheduleDialogProps {
  isOpen: boolean;
  initialDateTime?: string | null;
  onCancel: () => void;
  onConfirm: (value: string) => void; // value is the datetime-local string (YYYY-MM-DDTHH:mm)
}

// Format a Date into YYYY-MM-DDTHH:mm (local time)
function formatLocal(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${y}-${m}-${d}T${h}:${min}`;
}

export const ScheduleDialog: React.FC<ScheduleDialogProps> = ({ isOpen, initialDateTime, onCancel, onConfirm }) => {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (initialDateTime) {
        // Expecting an ISO string; convert to local datetime-local format
        const d = new Date(initialDateTime);
        if (!Number.isNaN(d.getTime())) {
          setValue(formatLocal(d));
          return;
        }
      }
      // Default: now + 1h
      setValue(formatLocal(new Date(Date.now() + 60 * 60 * 1000)));
    } else {
      setValue('');
    }
  }, [isOpen, initialDateTime]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-md bg-white shadow-lg border border-slate-200 p-4">
        <h2 className="text-lg font-semibold mb-3">Schedule article</h2>
        <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor="schedule-datetime">
          Date &amp; Time (IST)
        </label>
        <input
          id="schedule-datetime"
          type="datetime-local"
          className="w-full border rounded px-2 py-1 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1 text-sm rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!value}
            onClick={() => value && onConfirm(value)}
            className="px-3 py-1 text-sm rounded bg-blue-600 text-white disabled:opacity-50 hover:bg-blue-700"
          >
            Schedule
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScheduleDialog;