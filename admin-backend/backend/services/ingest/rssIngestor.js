// backend/services/ingest/rssIngestor.js
// Minimal ingestion scaffold: fetch RSS/JSON feeds, normalize, dedupe.

const axios = require('axios');
const crypto = require('crypto');

function checksum(text) {
  return crypto.createHash('sha1').update(text || '').digest('hex');
}

/**
 * Normalize a feed item to a common shape used by our pipeline.
 */
function normalizeItem(sourceId, item) {
  const title = item.title || item.headline || '';
  const url = item.link || item.url || '';
  const contentText = item.contentSnippet || item.description || item.summary || '';
  const id = item.guid || item.id || url || title;
  return {
    sourceId,
    externalId: String(id),
    title,
    url,
    publishedAt: item.isoDate || item.pubDate || item.published || null,
    author: item.creator || item.author || '',
    lang: item.lang || 'auto',
    contentHtml: item['content:encoded'] || item.content || '',
    contentText,
    ingestMeta: {
      fetchedAt: new Date().toISOString(),
      checksum: checksum(`${title}\n${contentText}\n${url}`)
    }
  };
}

/**
 * Fetch from a simple JSON or RSS proxy endpoint (serverless rss-proxy is available in this repo).
 * Expects `{ items: [...] }` shape from the endpoint.
 */
async function fetchSource({ id, endpoint }) {
  const res = await axios.get(endpoint, { timeout: 15000 });
  const payload = res.data || {};
  const items = Array.isArray(payload.items) ? payload.items : [];
  return items.map((it) => normalizeItem(id, it));
}

/**
 * Fetch and combine multiple sources; returns array of normalized items.
 * Dedupes by checksum.
 */
async function fetchAndNormalizeSources(sources) {
  const all = [];
  for (const src of sources) {
    try {
      const items = await fetchSource(src);
      all.push(...items);
    } catch (err) {
      // Non-fatal: continue other sources
      // eslint-disable-next-line no-console
      console.warn(`[ingest] source ${src.id} failed:`, err.message);
    }
  }
  // dedupe
  const seen = new Set();
  const deduped = [];
  for (const it of all) {
    if (seen.has(it.ingestMeta.checksum)) continue;
    seen.add(it.ingestMeta.checksum);
    deduped.push(it);
  }
  return deduped;
}

module.exports = {
  fetchAndNormalizeSources,
};
