export function countWords(text: string) {
  return (text.trim().match(/\b\w+\b/g) || []).length;
}

export function readingTimeSec(text: string, wpm = 180) {
  const words = countWords(text);
  return Math.max(1, Math.round((words / wpm) * 60));
}
