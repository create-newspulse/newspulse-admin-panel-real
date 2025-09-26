
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
      <div dangerouslySetInnerHTML={{ __html: video.embedCode }} />

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
