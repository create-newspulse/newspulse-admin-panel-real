import { useEffect } from "react";

export default function LoginPage() {
  useEffect(() => {
    window.location.replace('/auth');
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h2>Redirecting to secure sign-in…</h2>
      <p>If you are not redirected, <a href="/auth">click here</a>.</p>
    </div>
  );
}
