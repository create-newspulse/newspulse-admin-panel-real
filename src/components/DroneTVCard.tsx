
interface DroneVideo {
  _id: string;
  title: string;
  description: string;
  embedCode: string;
  moodTags: string[];
  source?: string;
  credit?: string;
}

// ✅ Color map for tags
const moodTagColors: Record<string, string> = {
  '🧘 Calm': 'bg-blue-100 text-blue-800',
  '🌲 Nature': 'bg-green-100 text-green-800',
  '🏞️ Scenic': 'bg-indigo-100 text-indigo-800',
  '🚁 Aerial': 'bg-gray-100 text-gray-800',
  '🎵 Ambient': 'bg-purple-100 text-purple-800',
};

interface Props {
  video: DroneVideo;
}

export default function DroneTVCard({ video }: Props) {
  return (
    <div className="bg-white shadow rounded p-4 mb-4">
      <h2 className="text-lg font-bold mb-2">{video.title}</h2>

      {/* Embedded video */}
      <div className="my-3">
        {(() => {
          if (typeof window === 'undefined' || window.location.protocol === 'file:') {
            return <div className="text-sm text-red-600">Preview blocked</div>;
          }
          try {
            const { extractIframeSrc, isHostAllowed } = require('../lib/embedUtils');
            const src = extractIframeSrc(video.embedCode || '');
            if (src && isHostAllowed(src)) return <iframe title={video.title || 'video'} src={src} width="100%" height="280" frameBorder={0} allowFullScreen />;
          } catch (e) {}
          const { sanitizeHtml } = require('../lib/sanitize');
          // eslint-disable-next-line react/no-danger
          return <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(video.embedCode || '') }} />;
        })()}
      </div>

      {/* Description */}
      <p className="text-gray-700 text-sm mb-2">{video.description}</p>

      {/* Mood Tags with colors */}
      <div className="flex flex-wrap gap-2 mb-2">
        {video.moodTags.map((tag: string, i: number) => (
          <span
            key={i}
            className={`text-xs font-medium px-2 py-1 rounded-full ${moodTagColors[tag] || 'bg-gray-100 text-gray-600'}`}
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Source & Credit */}
      <div className="text-sm text-gray-500 mt-1">
        <span>📌 Source: {video.source || 'Unknown'}</span><br />
        <span>🎥 Credit: {video.credit || 'Admin Upload'}</span>
      </div>
    </div>
  );
}
