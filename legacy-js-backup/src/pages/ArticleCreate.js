import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import api from "../lib/api";
export default function ArticleCreate() {
    const [title, setTitle] = useState("");
    const [language, setLanguage] = useState("en");
    const [status, setStatus] = useState("draft");
    const [content, setContent] = useState("");
    const [msg, setMsg] = useState("");
    async function save() {
        setMsg("");
        try {
            const { data } = await api.post("/articles", {
                title, language, status, content,
                categories: [], voiceEnabled: false, voiceStyle: "female"
            });
            setMsg("Saved Γ£à ID: " + data.item._id);
        }
        catch (e) {
            setMsg(e?.response?.data?.message || "Save failed");
        }
    }
    return (_jsxs("div", { children: [_jsx("h2", { children: "Create Article" }), _jsx("input", { placeholder: "Title", value: title, onChange: e => setTitle(e.target.value) }), _jsxs("select", { value: language, onChange: e => setLanguage(e.target.value), children: [_jsx("option", { value: "en", children: "English" }), _jsx("option", { value: "hi", children: "Hindi" }), _jsx("option", { value: "gu", children: "Gujarati" })] }), _jsxs("select", { value: status, onChange: e => setStatus(e.target.value), children: [_jsx("option", { value: "draft", children: "Draft" }), _jsx("option", { value: "published", children: "Published" })] }), _jsx("textarea", { placeholder: "Content", value: content, onChange: e => setContent(e.target.value), rows: 8 }), _jsx("button", { onClick: save, children: "Save" }), msg && _jsx("p", { children: msg })] }));
}
