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
  return {
    lockdown: (payload: { reason: string; scope: 'site' | 'admin' | 'publishing'; pin: string }) => post('/api/founder/lockdown', payload),
    unlock: (pin: string) => post('/api/founder/unlock', { pin }),
    snapshot: (note?: string) => post('/api/founder/snapshot', { note }),
    rollback: (snapshotId: string, dryRun = true) => post('/api/founder/rollback', { snapshotId, dryRun }),
    listSnapshots: () => get('/api/founder/snapshots'),
    diffSnapshot: (id: string) => get(`/api/founder/snapshots/${id}/diff`),
    getEscalation: () => get('/api/alerts/settings'),
    saveEscalation: (data: any) => post('/api/alerts/settings', data),
    rotatePin: (oldPin: string, newPin: string) => post('/api/founder/pin/rotate', { oldPin, newPin }),
  };
}
