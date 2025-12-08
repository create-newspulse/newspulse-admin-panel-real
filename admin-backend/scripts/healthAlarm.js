/*
  Simple health alarm script for Render Cron or any scheduler.
  - Pings BACKEND_URL + /api/system/health
  - On failure or non-200, posts a message to SLACK_WEBHOOK_URL (if set)
*/

const BACKEND_URL = (process.env.BACKEND_URL || '').replace(/\/$/, '');
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || '';

if (!BACKEND_URL) {
  console.error('BACKEND_URL is not set');
  process.exitCode = 1;
}

const postSlack = async (text) => {
  if (!SLACK_WEBHOOK_URL) return; // silently skip if not configured
  try {
    const resp = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!resp.ok) {
      console.error('Slack webhook failed:', resp.status, await resp.text().catch(() => ''));
    }
  } catch (e) {
    console.error('Slack webhook error:', e);
  }
};

(async () => {
  const ts = new Date().toISOString();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(`${BACKEND_URL}/api/system/health`, {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      const msg = `\u26a0\ufe0f Health check FAILED: ${r.status} at ${ts} for ${BACKEND_URL}\n${txt.slice(0, 300)}`;
      console.error(msg);
      await postSlack(msg);
      process.exitCode = 2;
      return;
    }

    const ct = r.headers.get('content-type') || '';
    const body = ct.includes('application/json') ? await r.json() : await r.text();
    console.log(`\u2705 Health OK at ${ts}`, typeof body === 'string' ? body.slice(0, 120) : body);
  } catch (e) {
    const msg = `\u26d4 Health check ERROR at ${ts} for ${BACKEND_URL}: ${String(e)}`;
    console.error(msg);
    await postSlack(msg);
    process.exitCode = 3;
  }
})();
