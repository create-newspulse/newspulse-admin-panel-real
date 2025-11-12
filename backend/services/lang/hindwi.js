// Hindi language adapter (stub)
// In production, call HINDWI_ENDPOINT for grammar/spell analysis.
const HINDWI_ENDPOINT = process.env.HINDWI_ENDPOINT || '';

exports.checkHindi = async function(text) {
  // Stub: return empty issues; extend with real API call later.
  return { ok: true, issues: [] };
};
