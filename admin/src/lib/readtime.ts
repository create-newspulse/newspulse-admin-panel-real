import { stripHtmlToText } from './richText';

export function countWords(text: string) {
  const plain = stripHtmlToText(text || '');
  return (plain.match(/\b\w+\b/g) || []).length;
}

export function readingTimeSec(text: string, wpm = 180) {
  const words = countWords(text);
  return Math.max(1, Math.round((words / wpm) * 60));
}
