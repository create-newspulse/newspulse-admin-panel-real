// ✅ AI Mood Tag Generator – DroneTV Video Analysis
export function generateMoodTags(title: string, description: string): string[] {
  const combined = `${title.toLowerCase()} ${description.toLowerCase()}`;
  const tags: string[] = [];

  if (combined.includes("aerial") || combined.includes("drone")) tags.push("Aerial");
  if (combined.includes("calm") || combined.includes("peace") || combined.includes("relax")) tags.push("Calm");
  if (combined.includes("forest") || combined.includes("mountain") || combined.includes("nature")) tags.push("Nature");
  if (combined.includes("sunset") || combined.includes("landscape") || combined.includes("scenic")) tags.push("Scenic");
  if (combined.includes("music") || combined.includes("ambient") || combined.includes("soothing")) tags.push("Ambient");

  return tags;
}
