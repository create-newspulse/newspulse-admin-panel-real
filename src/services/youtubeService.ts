// frontend/src/services/youtubeService.ts

const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY || import.meta.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
const MYGOV_CHANNEL_ID = 'UC6VhWcceZURzJKoNqC3ebWQ'; // ✅ MyGovIndia verified

export async function fetchMyGovVideos() {
  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?key=${YOUTUBE_API_KEY}&channelId=${MYGOV_CHANNEL_ID}&part=snippet,id&order=date&maxResults=6`
    );

    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error('❌ YouTube Fetch Error:', error);
    return [];
  }
}
