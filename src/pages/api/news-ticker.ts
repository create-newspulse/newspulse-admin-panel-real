import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const response = await axios.get("https://newsapi.org/v2/top-headlines", {
      params: {
        apiKey: process.env.NEWS_API_KEY,
        country: "in",
        pageSize: 5,
      },
    });

    const topics = response.data.articles.map((a: { title: string }) => a.title);
    res.status(200).json({ topics });
  } catch (error: any) {
    console.error("❌ News ticker fetch failed:", error.message);
    res.status(500).json({ topics: [], error: "News fetch error" });
  }
}
