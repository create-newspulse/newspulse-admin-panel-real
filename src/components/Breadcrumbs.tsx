import { useLocation, Link } from "react-router-dom";
import { FaChevronRight } from "react-icons/fa";

const Breadcrumbs = () => {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);

  // Friendly labels for specific segments (applies to any position)
  const SEGMENT_LABELS: Record<string, string> = {
    admin: "Admin",
    safeownerzone: "Safe Owner Zone",
    'ai-engine': 'AI Engine',
  };

  // Full-path overrides for clarity between similarly named areas
  // e.g., distinguish Admin Security vs Founder Security
  const PATH_LABELS: Record<string, string> = {
    "/admin/security": "Zero-Trust Security",
    "/safeownerzone/security": "Security & Lockdown",
  };

  const formatLabel = (segment: string, path: string) => {
    // Full path wins first
    if (PATH_LABELS[path]) return PATH_LABELS[path];
    // Semantic segment mapping next
    if (SEGMENT_LABELS[segment]) return SEGMENT_LABELS[segment];
    // Default prettifier
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
                  {formatLabel(seg, path)}
                </span>
              ) : (
                <Link
                  to={path}
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {formatLabel(seg, path)}
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
