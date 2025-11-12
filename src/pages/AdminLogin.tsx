// ✅ Fixed: removed automatic redirect to /auth to stop loop. Use /login as canonical.
export default function AdminLogin() {
  return (
    <div className="min-h-screen flex justify-center items-center bg-gray-50">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-semibold mb-2">Admin Sign In</h1>
        <p className="text-gray-600 text-sm">Use the standard login flow. Advanced MFA page is still at <code>/auth</code>.</p>
        <div className="space-y-2">
          <a href="/login" className="inline-block bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded">Go to Login</a>
          <a href="/auth" className="block text-blue-600 underline text-sm">Advanced Auth & MFA</a>
        </div>
      </div>
    </div>
  );
}
