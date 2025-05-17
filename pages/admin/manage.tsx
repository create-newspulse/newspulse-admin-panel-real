import { useEffect, useState } from "react";
import AdminNavbar from "../../components/AdminNavbar";
import api from "../../lib/api";

export default function ManageNews() {
  const [news, setNews] = useState([]);

  useEffect(() => {
    api.get("/news").then((res) => setNews(res.data));
  }, []);

  return (
    <>
      <AdminNavbar />
      <div className="p-6">
        <h1 className="text-xl font-bold mb-4">Manage News</h1>
        <ul className="space-y-2">
          {news.map((item: any, index: number) => (
            <li key={index} className="border p-3 rounded">{item.title}</li>
          ))}
        </ul>
      </div>
    </>
  );
}
