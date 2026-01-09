import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import settingsApi from '@/lib/settingsApi';
import { hasLikelyAdminSession } from '@/lib/api';
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
  const { pathname } = useLocation();
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
        if (!hasLikelyAdminSession()) return;
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

  const isSafeOwnerZoneRoute = useMemo(() => {
    const p = (pathname || '').toLowerCase();
    return p.startsWith('/admin/safe-owner-zone') || p.startsWith('/safe-owner-zone') || p.startsWith('/safeownerzone');
  }, [pathname]);

  if (mode === 'NORMAL') return null;

  const bannerClass =
    mode === 'LOCKDOWN'
      ? 'sticky top-0 z-50 w-full bg-red-600 text-white'
      : 'sticky top-0 z-50 w-full bg-amber-500 text-black';

  return (
    <>
      {mode === 'LOCKDOWN' && !isSafeOwnerZoneRoute ? <div className="np-lockdown-overlay" aria-hidden="true" /> : null}
      <div className={bannerClass} role="status" aria-live="polite">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2 md:px-6">
          <div className="font-semibold">
            {mode === 'LOCKDOWN' ? (
              <>
                🔒 LOCKDOWN ACTIVE — Actions are disabled.{' '}
                <Link className="underline" to="/admin/safe-owner-zone">
                  Go to Safe Owner Zone.
                </Link>
              </>
            ) : (
              <>
                🟡 READ-ONLY MODE — Write actions are disabled.{' '}
                <Link className="underline" to="/admin/safe-owner-zone">
                  Review in Safe Owner Zone.
                </Link>
              </>
            )}
          </div>
          <div className="text-sm opacity-90">Owner: {unlocked ? `Unlocked (${formatMmSs(remainingMs)})` : 'Locked'}</div>
        </div>
      </div>
    </>
  );
}
