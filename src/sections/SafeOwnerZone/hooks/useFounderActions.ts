import { useCallback, useMemo } from 'react';
import { api, apiUrl } from '@/lib/http';
import { getAuthToken } from '@/lib/adminApi';

export function useFounderActions() {
  const post = useCallback((url: string, body: any) => api(url, { method: 'POST', json: body }), []);
  const get = useCallback((url: string) => api(url), []);
  const SECURITY_ENABLED = import.meta.env.VITE_SECURITY_SYSTEM_ENABLED !== 'false';

  const safeGetEscalation = useCallback(async () => {
    const path = '/api/alerts/settings';
    if (!SECURITY_ENABLED) return { levels: [], _stub: true };
    // Probe via HEAD first to avoid full GET if clearly absent.
    try {
      const token = getAuthToken();
      const head = await fetch(apiUrl(path), {
        method: 'HEAD',
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!head.ok && head.status === 404) {
        console.warn('[useFounderActions] HEAD 404 escalation; stub');
        return { levels: [], _stub: true };
      }
    } catch {
      // Network failure -> return stub to keep UI functional
      console.warn('[useFounderActions] HEAD failed for escalation; stub fallback');
      return { levels: [], _stub: true };
    }
    try {
      return await get(path);
    } catch (err: any) {
      if (/404|not found/i.test(err?.message || '')) {
        console.warn('[useFounderActions] GET 404 escalation; stub');
        return { levels: [], _stub: true };
      }
      throw err;
    }
  }, [SECURITY_ENABLED, get]);

  const safeSaveEscalation = useCallback(async (data: any) => {
    const path = '/api/alerts/settings';
    if (!SECURITY_ENABLED) {
      console.warn('[useFounderActions] escalation save skipped (security disabled)');
      return { ok: true, levels: data.levels || [], _stub: true };
    }
    // Probe before POST to suppress inevitable 404 POST.
    try {
      const token = getAuthToken();
      const head = await fetch(apiUrl(path), {
        method: 'HEAD',
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!head.ok && head.status === 404) {
        console.warn('[useFounderActions] save HEAD 404; stub persist');
        return { ok: true, levels: data.levels || [], _stub: true };
      }
    } catch {
      console.warn('[useFounderActions] save HEAD failed; stub persist');
      return { ok: true, levels: data.levels || [], _stub: true };
    }
    try {
      return await post(path, data);
    } catch (err: any) {
      if (/404|not found/i.test(err?.message || '')) {
        console.warn('[useFounderActions] POST 404 escalation; stub persist');
        return { ok: true, levels: data.levels || [], _stub: true };
      }
      throw err;
    }
  }, [SECURITY_ENABLED, post]);

  return useMemo(
    () => ({
      lockdown: (payload: { reason: string; scope: 'site' | 'admin' | 'publishing'; pin?: string }) => post('/api/founder/lockdown', payload),
      unlock: (pin: string) => post('/api/founder/unlock', { pin }),
      snapshot: (note?: string) => post('/api/founder/snapshot', { note }),
      rollback: (snapshotId: string, dryRun = true) => post('/api/founder/rollback', { snapshotId, dryRun }),
      listSnapshots: () => get('/api/founder/snapshots'),
      diffSnapshot: (id: string) => get(`/api/founder/snapshots/${id}/diff`),
      getEscalation: () => safeGetEscalation(),
      saveEscalation: (data: any) => safeSaveEscalation(data),
      rotatePin: (oldPin: string, newPin: string) => post('/api/founder/pin/rotate', { oldPin, newPin }),
    }),
    [get, post, safeGetEscalation, safeSaveEscalation],
  );
}
