import React, { useEffect, useState } from "react";
import axios from "axios";

interface Quote {
  text: string;
  author: string;
}

const fallbackQuote: Quote = {
  text: "Stay hungry, stay foolish.",
  author: "Steve Jobs",
};

const DailyQuoteBlock: React.FC = () => {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchQuote = async () => {
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/daily-quote`);
        if (res.data.success) {
          setQuote(res.data.data);
        } else {
          setQuote(fallbackQuote);
        }
      } catch (error) {
        console.error("❌ Failed to load quote:", error);
        setQuote(fallbackQuote);
      } finally {
        setLoading(false);
      }
    };

    fetchQuote();
  }, []);

  if (loading) {
    return (
      <div className="p-4 rounded-xl bg-yellow-100 dark:bg-yellow-900 animate-pulse shadow mb-6 h-[120px]">
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading quote...</p>
      </div>
    );
  }

  if (!quote) return null;

  return (
    <div className="bg-yellow-100 dark:bg-yellow-900 text-black dark:text-white p-5 rounded-xl shadow-md mb-6 transition duration-300">
      <blockquote className="italic text-lg leading-relaxed">
        “{quote.text}”
      </blockquote>
      <p className="text-sm mt-2 text-right font-medium">— {quote.author}</p>
    </div>
  );
};

export default DailyQuoteBlock;
