// Vercel Serverless: /api/news-ticker
// Returns a small list of topical headlines for the dashboard ticker.
// If NEWS_API_KEY is configured, it will fetch from NewsAPI; otherwise falls back to static examples.
export default async function handler(_req, res) {
    try {
        const key = process.env.NEWS_API_KEY;
        if (key) {
            const url = new URL('https://newsapi.org/v2/top-headlines');
            url.searchParams.set('apiKey', key);
            url.searchParams.set('country', 'in');
            url.searchParams.set('pageSize', '5');
            const r = await fetch(url.toString());
            if (!r.ok) {
                const txt = await r.text().catch(() => '');
                console.warn('news-ticker upstream error:', r.status, txt.slice(0, 160));
                // fall through to static topics
            }
            else {
                const json = await r.json().catch(() => null);
                const topics = Array.isArray(json?.articles)
                    ? json.articles.map((a) => a?.title).filter(Boolean).slice(0, 5)
                    : [];
                if (topics.length > 0)
                    return res.status(200).json({ topics });
            }
        }
        // Fallback topics
        const fallback = [
            'Market Watch: Key indices open flat',
            'Tech Update: AI tools boost newsroom productivity',
            'Weather Alert: Heavy rains expected in Mumbai',
            'Sports: India claim series win with thrilling finish',
            'Policy: New digital media guidelines announced',
        ];
        return res.status(200).json({ topics: fallback });
    }
    catch (err) {
        console.error('news-ticker error:', err);
        return res.status(200).json({ topics: [] });
    }
}
