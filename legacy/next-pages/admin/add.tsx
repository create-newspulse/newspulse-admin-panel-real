// @ts-nocheck
"use client";
import { useState } from "react";
import AdminNavbar from "../../components/AdminNavbar";
import api from "../../lib/api";

export default function AddNews() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post("/news", { title, content });
    alert("News added!");
    setTitle("");
    setContent("");
  };

  return (
    <>
      <AdminNavbar />
      <div className="p-6">
        <h1 className="text-xl font-bold mb-4">Add News</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input className="w-full p-2 border" placeholder="Title" value={title}
            onChange={(e) => setTitle(e.target.value)} required />
          <textarea className="w-full p-2 border" placeholder="Content" value={content}
            onChange={(e) => setContent(e.target.value)} required />
          <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">Submit</button>
        </form>
      </div>
    </>
  );
}
