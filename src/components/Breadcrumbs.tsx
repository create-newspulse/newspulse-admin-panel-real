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
    // News management aliases → single label
    articles: 'Manage News',
    news: 'Manage News',
    'manage-news': 'Manage News',
    community: 'Community',
    reporter: 'Community Reporter Queue',
  };

  // Full-path overrides for clarity between similarly named areas
  // e.g., distinguish Admin Security vs Founder Security
  const PATH_LABELS: Record<string, string> = {
    "/admin/security": "Zero-Trust Security",
    "/safeownerzone/security": "Security & Lockdown",
    "/community/reporter": "Community Reporter Queue",
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
        {(() => {
          // Build renderable entries allowing us to skip dynamic IDs for known routes
          const entries: { key: string; path: string; label: string; isLast: boolean }[] = [];
          const cleaned: Array<{ seg: string; idx: number }> = [];

          // Hide 'admin' when it's a mere prefix
          segments.forEach((seg, i) => {
            if (seg === 'admin' && segments.length > 1) return;
            cleaned.push({ seg, idx: i });
          });

          // Special-case: /admin/articles/:id/edit → hide :id and label 'Edit Article'
          // Note: original indices still in `segments`
          const isArticleEdit = segments.length >= 4
            && segments[0] === 'admin'
            && segments[1] === 'articles'
            && segments[3] === 'edit';

          for (let viewIndex = 0; viewIndex < cleaned.length; viewIndex++) {
            const { seg, idx } = cleaned[viewIndex];

            // Skip the dynamic id between articles and edit
            if (isArticleEdit && idx === 2) continue;

            const path = "/" + segments.slice(0, idx + 1).join("/");
            const isLast = (function () {
              // If we skipped the id, the visual last might shift
              if (isArticleEdit) {
                // Last visible segment is at original idx 3 ('edit')
                return idx === 3;
              }
              return idx === segments.length - 1;
            })();

            let label = (isArticleEdit && seg === 'edit')
              ? 'Edit Article'
              : formatLabel(seg, path);

            // Special-case: Community Reporter detail → show reporter name instead of raw id
            const isCommunityDetail = segments[0] === 'admin' && segments[1] === 'community-reporter' && idx === 2;
            if (isCommunityDetail) {
              const looksLikeId = /^[a-f0-9]{24}$/i.test(seg) || /^\d{10,}$/i.test(seg);
              if (looksLikeId) {
                const st: any = (location as any).state || {};
                let preferred = st?.reporterName || '';
                if (!preferred) {
                  try { preferred = sessionStorage.getItem(`cr:${seg}:name`) || ''; } catch {}
                }
                label = preferred || 'Submission';
              }
            }

            entries.push({ key: `${idx}:${seg}`, path, label, isLast });
          }

          return entries.map((e) => (
            <li key={e.key} className="flex items-center gap-1">
              <FaChevronRight className="text-gray-400 text-xs" />
              {e.isLast ? (
                <span className="font-semibold text-gray-800 dark:text-white">{e.label}</span>
              ) : (
                <Link to={e.path} className="text-blue-600 dark:text-blue-400 hover:underline">{e.label}</Link>
              )}
            </li>
          ));
        })()}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;
