import axios from 'axios';

const EMBED = '<iframe width="560" height="315" src="https://www.youtube.com/embed/21X5lGlDOfg" title="YouTube video player" frameborder="0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>';

const apiBase = process.env.API_URL || process.env.SERVER_URL;

if (!apiBase) {
  console.error('[update-live] Missing API_URL (or SERVER_URL) env var');
  process.exit(1);
}

async function main() {
  try {
    const res = await axios.post(`${apiBase.replace(/\/+$/, '')}/api/live-content/update`, {
      mode: 'live',
      embedCode: EMBED,
    }, { headers: { 'Content-Type': 'application/json' } });
    console.log('[update-live] response', JSON.stringify(res.data));
  } catch (e) {
    console.error('[update-live] error', e?.response?.data || e?.message || e);
    process.exit(1);
  }
}

main();
