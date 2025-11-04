import { jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import api from "../lib/api"; // ← relative import so it works without alias
export default function RequireAuth({ children }) {
    const [ok, setOk] = useState(null);
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
    if (ok === null)
        return _jsx("div", { children: "Checking auth\u2026" });
    return _jsx(_Fragment, { children: ok ? children : null });
}
