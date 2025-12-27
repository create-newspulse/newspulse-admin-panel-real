import { io } from 'socket.io-client';
import axios from 'axios';

const url = process.env.SOCKET_URL;
const timeoutMs = Number(process.env.TIMEOUT_MS || 10000);

if (!url) {
  console.error('[socket-test] Missing SOCKET_URL env var');
  process.exit(1);
}

console.log('[socket-test] connecting to', url);

const socket = io(url, {
  transports: ['websocket', 'polling'],
  withCredentials: true,
});

let timer = setTimeout(() => {
  console.error('[socket-test] timeout waiting for live-content-updated');
  try { socket.close(); } catch {}
  process.exit(1);
}, timeoutMs);

socket.on('connect', async () => {
  console.log('[socket-test] connected', socket.id);
  // Trigger an update to ensure an event is emitted while we're listening
  try {
    const payload = {
      mode: 'live',
      embedCode: '<iframe width="560" height="315" src="https://www.youtube.com/embed/21X5lGlDOfg" title="YouTube video player" frameborder="0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>'
    };
    const res = await axios.post(`${url}/api/live-content/update`, payload, { headers: { 'Content-Type': 'application/json' } });
    console.log('[socket-test] POST /api/live-content/update ->', res.data?.ok ? 'ok' : 'resp');
    // Refresh timeout after POST
    clearTimeout(timer);
    timer = setTimeout(() => {
      console.error('[socket-test] timeout after POST without receiving event');
      try { socket.close(); } catch {}
      process.exit(1);
    }, timeoutMs);
  } catch (e) {
    console.error('[socket-test] POST failed', e?.response?.data || e?.message || e);
  }
});

socket.on('connect_error', (err) => {
  console.error('[socket-test] connect_error', err?.message || err);
});

socket.on('live-content-updated', (payload) => {
  clearTimeout(timer);
  console.log('[socket-test] EVENT live-content-updated', JSON.stringify(payload));
  try { socket.close(); } catch {}
  process.exit(0);
});

// Also log current connection state after a short delay
setTimeout(() => {
  console.log('[socket-test] status', socket.connected ? 'connected' : 'not-connected');
}, 500);
