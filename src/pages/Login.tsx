// 📁 src/pages/Login.tsx
// Redirect to the new magic-link auth page
import React, { useEffect } from 'react';

const Login: React.FC = () => {
  useEffect(() => {
    window.location.replace('/auth');
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="text-center">
        <h2 className="text-2xl font-semibold mb-2">Redirecting to secure sign-in…</h2>
        <p className="text-gray-600">If nothing happens, <a className="text-indigo-600 underline" href="/auth">click here</a>.</p>
      </div>
    </div>
  );
};

export default Login;
