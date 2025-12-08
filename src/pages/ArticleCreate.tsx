import { useState } from "react";
import api from "../lib/api";

export default function ArticleCreate() {
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState<"en"|"hi"|"gu">("en");
  const [status, setStatus] = useState<"draft"|"published">("draft");
  const [content, setContent] = useState("");
  const [msg, setMsg] = useState("");

  async function save() {
    setMsg("");
    try {
      const { data } = await api.post("/articles", {
        title, language, status, content,
        categories: [], voiceEnabled: false, voiceStyle: "female"
      });
      setMsg("Saved ✅ ID: " + data.item._id);
    } catch (e: any) {
      setMsg(e?.response?.data?.message || "Save failed");
    }
  }

  return (
    <div>
      <h2>Create Article</h2>
      <input placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} />
      <select value={language} onChange={e=>setLanguage(e.target.value as any)}>
        <option value="en">English</option>
        <option value="hi">Hindi</option>
        <option value="gu">Gujarati</option>
      </select>
      <select value={status} onChange={e=>setStatus(e.target.value as any)}>
        <option value="draft">Draft</option>
        <option value="published">Published</option>
      </select>
      <textarea placeholder="Content" value={content} onChange={e=>setContent(e.target.value)} rows={8}/>
      <button onClick={save}>Save</button>
      {msg && <p>{msg}</p>}
    </div>
  );
}
