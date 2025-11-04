import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import axios from "axios";
const fallbackQuote = {
    text: "Stay hungry, stay foolish.",
    author: "Steve Jobs",
};
const DailyQuoteBlock = () => {
    const [quote, setQuote] = useState(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const fetchQuote = async () => {
            try {
                const res = await axios.get(`${import.meta.env.VITE_API_URL}/daily-quote`);
                if (res.data.success) {
                    setQuote(res.data.data);
                }
                else {
                    setQuote(fallbackQuote);
                }
            }
            catch (error) {
                console.error("❌ Failed to load quote:", error);
                setQuote(fallbackQuote);
            }
            finally {
                setLoading(false);
            }
        };
        fetchQuote();
    }, []);
    if (loading) {
        return (_jsx("div", { className: "p-4 rounded-xl bg-yellow-100 dark:bg-yellow-900 animate-pulse shadow mb-6 h-[120px]", children: _jsx("p", { className: "text-sm text-gray-500 dark:text-gray-400", children: "Loading quote..." }) }));
    }
    if (!quote)
        return null;
    return (_jsxs("div", { className: "bg-yellow-100 dark:bg-yellow-900 text-black dark:text-white p-5 rounded-xl shadow-md mb-6 transition duration-300", children: [_jsxs("blockquote", { className: "italic text-lg leading-relaxed", children: ["\u201C", quote.text, "\u201D"] }), _jsxs("p", { className: "text-sm mt-2 text-right font-medium", children: ["\u2014 ", quote.author] })] }));
};
export default DailyQuoteBlock;
