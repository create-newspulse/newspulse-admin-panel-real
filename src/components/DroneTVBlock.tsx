
interface DroneVideo {
  _id: string;
  title: string;
  embedCode: string;
  moodTags: string[]; // <-- New mood tag array
}

const moodTagColors: Record<string, string> = {
  "🧘 Calm": "bg-blue-100 text-blue-800",
  "🌲 Nature": "bg-green-100 text-green-800",
  "🏞️ Scenic": "bg-indigo-100 text-indigo-800",
  "🚁 Aerial": "bg-gray-100 text-gray-800",
  "🎵 Ambient": "bg-purple-100 text-purple-800",
};

const DroneTVBlock = ({ video }: { video: DroneVideo }) => {
  return (
    <div className="mb-8 border rounded-lg p-4 shadow-md bg-white dark:bg-slate-900">
      <div>
        {(() => {
          if (typeof window === 'undefined' || window.location.protocol === 'file:') {
            return <div className="text-sm text-red-600">Preview blocked</div>;
          }
          try {
            const { extractIframeSrc, isHostAllowed } = require('./../lib/embedUtils');
            const src = extractIframeSrc(video.embedCode || '');
            if (src) {
              const isLoopback = (() => {
                try {
                  const u = new URL(src);
                  const host = u.hostname.toLowerCase();
                  return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '[::1]';
                } catch { return false; }
              })();

              if (isLoopback && !import.meta.env.DEV) {
                return (
                  <div className="text-sm text-slate-700">
                    Embed blocked (local/loopback URL).{' '}
                    <a className="underline" href={src} target="_blank" rel="noopener noreferrer">Open in new tab</a>
                  </div>
                );
              }

              if (isHostAllowed(src)) {
                return (
                  <iframe
                    title={video.title || 'video'}
                    src={src}
                    width="100%"
                    height="320"
                    frameBorder={0}
                    allowFullScreen
                    referrerPolicy="no-referrer"
                  />
                );
              }

              return (
                <div className="text-sm text-slate-700">
                  Embed blocked (host not allowed).{' '}
                  <a className="underline" href={src} target="_blank" rel="noopener noreferrer">Open in new tab</a>
                </div>
              );
            }
          } catch (e) {}
          const { sanitizeHtml } = require('./../lib/sanitize');
          // eslint-disable-next-line react/no-danger
          return <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(video.embedCode || '') }} />;
        })()}
      </div>

      <div className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
        {video.title}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {video.moodTags.map((tag) => (
          <span
            key={tag}
            className={`px-3 py-1 text-sm rounded-full font-medium ${
              moodTagColors[tag] || "bg-gray-200 text-gray-700"
            }`}
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
};

export default DroneTVBlock;
