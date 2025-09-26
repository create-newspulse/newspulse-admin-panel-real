import { useEffect, useState } from "react";
import api from "../lib/api";

export default function ArticlesList() {
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => { load(); }, []);
  async function load() {
    const { data } = await api.get("/articles", { params: { q } });
    setItems(data.items);
  }

  return (
    <div>
      <h2>Articles</h2>
      <input placeholder="Search" value={q} onChange={(e)=>setQ(e.target.value)} />
      <button onClick={load}>Search</button>
      <ul>
        {items.map(a => <li key={a._id}>{a.title} — {a.status} — {a.language}</li>)}
      </ul>
    </div>
  );
}
