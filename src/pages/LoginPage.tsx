import { useState } from "react";
import api, { setAuthToken } from "../lib/api";

export default function LoginPage() {
  const [email, setEmail] = useState("admin@newspulse.ai");
  const [password, setPassword] = useState("Safe!2025@News");
  const [msg, setMsg] = useState("");

  async function login() {
    setMsg("");
    try {
      const { data } = await api.post("/admin/auth/login", { email, password });
      localStorage.setItem("np_token", data.token);
      setAuthToken(data.token);
      window.location.href = "/articles";
    } catch (e: any) {
      setMsg(e?.response?.data?.message || "Login failed");
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>Login</h2>
      <input value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="Email" />
      <br />
      <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Password" />
      <br />
      <button onClick={login}>Login</button>
      {msg && <p>{msg}</p>}
    </div>
  );
}
