// api/ai/process.cjs
// POST { title, text } -> { summary, tags, titleCandidates }

const { generateSummaryAndTags } = require('../_lib/ai/summarize.cjs');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const body = req.body || {};
    const title = String(body.title || '').trim();
    const text = String(body.text || '').trim();

    if (!title || !text) {
      res.status(400).json({ error: 'Missing required fields: title, text' });
      return;
    }

    const out = await generateSummaryAndTags({ title, text });
    res.status(200).json({ success: true, ...out });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api/ai/process] error:', err);
    res.status(500).json({ success: false, error: err.message || 'Internal Error' });
  }
};
