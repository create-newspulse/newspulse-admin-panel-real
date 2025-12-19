export function useFounderActions() {
  async function parseResponse(r: Response) {
    const ctype = r.headers.get('content-type') || '';
    const isJson = ctype.includes('application/json');
    if (!r.ok) {
      // Try to read body for better diagnostics
      const body = isJson ? await r.json().catch(() => undefined) : await r.text().catch(() => '');
      const snippet = typeof body === 'string' ? body.slice(0, 200) : JSON.stringify(body);
      throw new Error(`HTTP ${r.status} ${r.statusText}${snippet ? ` — ${snippet}` : ''}`);
    }
    return isJson ? r.json() : r.text();
  }

  const post = (url: string, body: any) =>
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body)
    }).then(parseResponse);

  const get = (url: string) => fetch(url, { credentials: 'include' }).then(parseResponse);
  const SECURITY_ENABLED = import.meta.env.VITE_SECURITY_SYSTEM_ENABLED !== 'false';

  async function safeGetEscalation() {
    const path = '/api/alerts/settings';
    if (!SECURITY_ENABLED) return { levels: [], _stub: true };
    // Probe via HEAD first to avoid full GET if clearly absent.
    try {
      const head = await fetch(path, { method: 'HEAD', credentials: 'include' });
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
  }

  async function safeSaveEscalation(data: any) {
    const path = '/api/alerts/settings';
    if (!SECURITY_ENABLED) {
      console.warn('[useFounderActions] escalation save skipped (security disabled)');
      return { ok: true, levels: data.levels || [], _stub: true };
    }
    // Probe before POST to suppress inevitable 404 POST.
    try {
      const head = await fetch(path, { method: 'HEAD', credentials: 'include' });
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
  }

  return {
    lockdown: (payload: { reason: string; scope: 'site' | 'admin' | 'publishing'; pin?: string }) => post('/api/founder/lockdown', payload),
    unlock: (pin: string) => post('/api/founder/unlock', { pin }),
    snapshot: (note?: string) => post('/api/founder/snapshot', { note }),
    rollback: (snapshotId: string, dryRun = true) => post('/api/founder/rollback', { snapshotId, dryRun }),
    listSnapshots: () => get('/api/founder/snapshots'),
    diffSnapshot: (id: string) => get(`/api/founder/snapshots/${id}/diff`),
    getEscalation: () => safeGetEscalation(),
    saveEscalation: (data: any) => safeSaveEscalation(data),
    rotatePin: (oldPin: string, newPin: string) => post('/api/founder/pin/rotate', { oldPin, newPin }),
  };
}
