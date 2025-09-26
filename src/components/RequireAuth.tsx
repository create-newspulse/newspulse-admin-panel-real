import { useEffect, useState, PropsWithChildren } from "react";
import api from "../lib/api"; // ← relative import so it works without alias

export default function RequireAuth({ children }: PropsWithChildren) {
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("np_token");
    if (!token) {
      // redirect then stop the effect (returning void)
      window.location.href = "/login";
      return;
    }

    // ping a route; if it fails, redirect
    api
      .get("/articles?limit=1")
      .then(() => setOk(true))
      .catch(() => {
        window.location.href = "/login";
      });
  }, []);

  if (ok === null) return <div>Checking auth…</div>;
  return <>{ok ? children : null}</>;
}
