import React from "react";

interface DailyWonderProps {
  quote: string;
  videoEmbedUrl: string;
  source: string;
  creator: string;
}

const DailyWonderBlock: React.FC<DailyWonderProps> = ({
  quote,
  videoEmbedUrl,
  source,
  creator,
}) => {
  // (Optional) Basic YouTube embed URL check
  const isYouTubeEmbed = /^https:\/\/www\.youtube\.com\/embed\//.test(videoEmbedUrl);

  const handleVoicePlay = () => {
    // Trigger voice reading logic here
    console.log("🔊 Play voice for Daily Wonder");
  };

  return (
    <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-xl shadow-xl overflow-hidden mb-10 transition-all duration-300">
      <div className="p-6 space-y-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
          🌄 Daily Wonder
        </h2>

        <p className="italic text-lg text-blue-700 dark:text-blue-300 leading-relaxed">
          “{quote}”
        </p>

        <div className="aspect-video w-full rounded-lg overflow-hidden shadow-md border border-gray-200 dark:border-gray-700">
          {isYouTubeEmbed ? (
            <iframe
              src={videoEmbedUrl}
              title="Daily Wonder Video"
              aria-label="Daily Wonder YouTube Video"
              className="w-full h-full"
              allow="autoplay; encrypted-media"
              allowFullScreen
              loading="lazy"
            ></iframe>
          ) : (
            <div className="text-red-500 text-center p-4">Invalid video link</div>
          )}
        </div>

        <button
          onClick={handleVoicePlay}
          aria-label="Listen to this wonder"
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md font-medium shadow-sm transition"
        >
          🔈 Listen to This Wonder
        </button>

        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          📹 Source:{" "}
          <a
            href={source}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-blue-600 dark:hover:text-blue-300"
          >
            {creator}
          </a>
        </p>
      </div>
    </div>
  );
};

export default DailyWonderBlock;
