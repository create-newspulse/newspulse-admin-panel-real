import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import api from "../lib/api";
export default function ArticlesList() {
    const [items, setItems] = useState([]);
    const [q, setQ] = useState("");
    useEffect(() => { load(); }, []);
    async function load() {
        const { data } = await api.get("/articles", { params: { q } });
        setItems(data.items);
    }
    return (_jsxs("div", { children: [_jsx("h2", { children: "Articles" }), _jsx("input", { placeholder: "Search", value: q, onChange: (e) => setQ(e.target.value) }), _jsx("button", { onClick: load, children: "Search" }), _jsx("ul", { children: items.map(a => _jsxs("li", { children: [a.title, " \u2014 ", a.status, " \u2014 ", a.language] }, a._id)) })] }));
}
