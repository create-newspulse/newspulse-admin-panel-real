import { useEffect, useMemo, useState } from 'react';
import settingsApi from '@/lib/settingsApi';
import { getOwnerKeyRemainingMs, isOwnerKeyUnlocked, useOwnerKeyStore, type OwnerMode } from '@/lib/ownerKeyStore';

function formatMmSs(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function deriveModeFromSettings(settings: any): OwnerMode {
  const lockdown = settings?.security?.lockdown === true || settings?.lockdown === true;
  const readOnly = settings?.publishing?.readOnly === true || settings?.readOnly === true;
  if (lockdown) return 'LOCKDOWN';
  if (readOnly) return 'READONLY';
  return 'NORMAL';
}

export default function OwnerBar() {
  const mode = useOwnerKeyStore((s) => s.mode);
  const setMode = useOwnerKeyStore((s) => s.setMode);
  const unlockedUntilMs = useOwnerKeyStore((s) => s.unlockedUntilMs);

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    let mounted = true;
    const tick = async () => {
      try {
        const s = await settingsApi.getAdminSettings();
        if (!mounted) return;
        setMode(deriveModeFromSettings(s));
      } catch {
        // Silent: mode remains last-known.
      }
    };

    // Prime once, then refresh occasionally.
    tick();
    const t = window.setInterval(tick, 60_000);
    return () => {
      mounted = false;
      window.clearInterval(t);
    };
  }, [setMode]);

  const remainingMs = useMemo(() => getOwnerKeyRemainingMs(unlockedUntilMs, now), [unlockedUntilMs, now]);
  const unlocked = useMemo(() => isOwnerKeyUnlocked(unlockedUntilMs, now), [unlockedUntilMs, now]);

  return (
    <div className="border-b border-slate-200 bg-white/95 px-4 py-2 text-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 md:px-6">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">Mode:</span>
          <span className="font-semibold text-slate-900 dark:text-white">{mode}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">Owner:</span>
          <span className="font-semibold text-slate-900 dark:text-white">
            {unlocked ? `Unlocked (${formatMmSs(remainingMs)})` : 'Locked'}
          </span>
        </div>
      </div>
    </div>
  );
}
