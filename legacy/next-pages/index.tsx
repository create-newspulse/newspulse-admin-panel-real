// @ts-nocheck
// pages/index.tsx
import Link from "next/link";

export default function Home() {
  return (
    <div style={{ textAlign: "center", marginTop: "100px" }}>
      <h1>📰 Welcome to News Pulse Admin Panel</h1>
      <p>
        <Link href="/admin">
          <span style={{ color: "#0070f3", textDecoration: "underline" }}>
            Go to Admin Panel
          </span>
        </Link>
      </p>
    </div>
  );
}
