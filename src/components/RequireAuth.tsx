import { useEffect, useState, PropsWithChildren } from "react";
import { Navigate, useLocation } from 'react-router-dom';
import api from "../lib/api"; // ← relative import so it works without alias

export default function RequireAuth({ children }: PropsWithChildren) {
  const [ok, setOk] = useState<boolean | null>(null);
  const location = useLocation();

  // Per spec: only protect /admin/* routes.
  const p = location.pathname || '';
  const isAdminArea = p.startsWith('/admin');

  useEffect(() => {
    if (!isAdminArea) {
      setOk(null);
      return;
    }
    const token = localStorage.getItem("admin_token");
    if (!token) {
      setOk(false);
      return;
    }

    // ping a route; if it fails, redirect
    api
      .get("/articles?limit=1")
      .then(() => setOk(true))
      .catch(() => {
        setOk(false);
      });
  }, [isAdminArea]);

  if (!isAdminArea) return <>{children}</>;

  if (ok === null) return <div>Checking auth…</div>;
  if (!ok) return <Navigate to="/login" replace state={{ from: location }} />;
  return <>{children}</>;
}
