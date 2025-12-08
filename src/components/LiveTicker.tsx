import { useEffect, useState } from "react";
import clsx from "clsx";

type LiveTickerProps = {
  apiUrl?: string;
  refreshInterval?: number;
  position?: "top" | "bottom";
};

export default function LiveTicker({
  apiUrl = "/api/news-ticker",
  refreshInterval = 30000,
  position = "top",
}: LiveTickerProps) {
  const [tickerText, setTickerText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    const fetchTicker = async () => {
      try {
        setLoading(true);
        const res = await fetch(apiUrl, { signal, credentials: 'include' });

        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status} ${res.statusText}. Body: ${txt.slice(0, 120)}`);
        }

        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('application/json')) {
          const txt = await res.text().catch(() => '');
          throw new Error(`Expected JSON, got "${ct}". Body: ${txt.slice(0, 120)}`);
        }

        const data = await res.json();

        if (Array.isArray(data?.topics) && data.topics.length > 0) {
          setTickerText("🔴 " + data.topics.join(" | "));
        } else {
          setTickerText(null);
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.warn("🛑 LiveTicker fetch error:", err.message);
          setTickerText(null);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchTicker();
    const interval = setInterval(fetchTicker, refreshInterval);

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [apiUrl, refreshInterval]);

  // If loading or no text, don't render ticker bar
  if (loading || !tickerText) return null;

  return (
    <div
      className={clsx(
        "ticker-bar",
        position === "top" ? "top-0" : "bottom-0"
      )}
      aria-live="polite"
      role="status"
    >
      <div className="absolute inset-0 flex items-center">
        <div className="animate-marquee text-sm font-semibold px-4 whitespace-nowrap">
          {tickerText}
        </div>
      </div>
    </div>
  );
}
