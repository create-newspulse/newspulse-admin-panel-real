import { Link } from 'react-router-dom';

const NotFound = () => {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-8">
      <h1 className="text-3xl font-bold mb-2">Page not found</h1>
      <p className="text-slate-600 dark:text-slate-300 mb-6">
        The page you’re looking for doesn’t exist or was moved.
      </p>
      <Link to="/admin/dashboard" className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">
        Go to Dashboard
      </Link>
    </div>
  );
};

export default NotFound;
