const NotFound = () => (
  <div className="min-h-screen flex flex-col items-center justify-center text-center">
    <h1 className="text-4xl font-bold text-red-600 mb-2">404 – Page Not Found</h1>
    <p className="text-gray-600">This page doesn't exist.</p>
    <a href="/" className="mt-4 text-blue-600 underline">← Go back</a>
  </div>
);
export default NotFound;
