import { useEffect } from "react";

export default function AdminLogin() {
  useEffect(() => {
    window.location.replace('/auth');
  }, []);

  return (
    <div className="min-h-screen flex justify-center items-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-2xl font-semibold mb-2">Redirecting to secure sign-in…</h1>
        <p className="text-gray-600">If you are not redirected, <a className="text-blue-600 underline" href="/auth">click here</a>.</p>
      </div>
    </div>
  );
}
