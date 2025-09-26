import { useLocation, Link } from "react-router-dom";
import { FaChevronRight } from "react-icons/fa";

const Breadcrumbs = () => {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);

  const formatLabel = (segment: string) => {
    return decodeURIComponent(segment)
      .replaceAll("-", " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-sm">
      <ol className="flex flex-wrap items-center gap-1 text-gray-600 dark:text-gray-300">
        <li>
          <Link
            to="/"
            className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
          >
            🏠 Home
          </Link>
        </li>
        {segments.map((seg, i) => {
          const path = "/" + segments.slice(0, i + 1).join("/");
          const isLast = i === segments.length - 1;

          return (
            <li key={i} className="flex items-center gap-1">
              <FaChevronRight className="text-gray-400 text-xs" />
              {isLast ? (
                <span className="font-semibold text-gray-800 dark:text-white">
                  {formatLabel(seg)}
                </span>
              ) : (
                <Link
                  to={path}
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {formatLabel(seg)}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;
