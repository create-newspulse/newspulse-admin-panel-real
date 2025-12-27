import axios from 'axios';

const apiBase = process.env.API_URL || process.env.SERVER_URL;

if (!apiBase) {
  console.error('[update-inspiration] Missing API_URL (or SERVER_URL) env var');
  process.exit(1);
}

async function main() {
  try {
    const res = await axios.post(`${apiBase.replace(/\/+$/, '')}/api/live-content/update`, {
      mode: 'inspiration',
      embedCode: '',
    }, { headers: { 'Content-Type': 'application/json' } });
    console.log('[update-inspiration] response', JSON.stringify(res.data));
  } catch (e) {
    console.error('[update-inspiration] error', e?.response?.data || e?.message || e);
    process.exit(1);
  }
}

main();
