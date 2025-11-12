import axios from 'axios';

async function main() {
  try {
    const res = await axios.post('http://localhost:5000/api/live-content/update', {
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
