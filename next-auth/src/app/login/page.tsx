"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginRedirect() {
  const router = useRouter();
  useEffect(() => {
    // ✅ Fixed: unify login entrypoint at /login; this page redirects to existing /auth UI.
    router.replace("/auth");
  }, [router]);
  return null;
}
