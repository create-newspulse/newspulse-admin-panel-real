import { useEffect } from "react";
import { useRouter } from "next/router";
import AdminNavbar from "../../components/AdminNavbar";

export default function Dashboard() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    if (!token) {
      router.push("/admin");
    }
  }, []);

  return (
    <>
      <AdminNavbar />
      <div className="p-6">
        <h1 className="text-3xl font-bold">Welcome to News Pulse Admin Panel</h1>
        <p className="text-gray-600 mt-2">Use the menu to manage content.</p>
      </div>
    </>
  );
}
