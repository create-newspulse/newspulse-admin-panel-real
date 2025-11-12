const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const LT_ENDPOINT = process.env.LT_ENDPOINT || 'https://api.languagetool.org/v2/check';
const LT_API_KEY = process.env.LT_API_KEY || '';

exports.checkEnglish = async function(text) {
  try {
    const params = new URLSearchParams();
    params.set('text', text);
    params.set('language', 'en-US');
    if (LT_API_KEY) params.set('apikey', LT_API_KEY);

    const res = await fetch(LT_ENDPOINT, { method: 'POST', body: params });
    const data = await res.json();
    const issues = (data.matches || []).map(m => ({
      offset: m.offset,
      length: m.length,
      message: m.message,
      rule: m.rule?.id || 'LT',
    }));
    return { ok: issues.length === 0, issues };
  } catch (e) {
    return { ok: true, issues: [] }; // fail-open
  }
};
