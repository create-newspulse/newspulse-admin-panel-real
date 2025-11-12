export function ptiCheckBasic({ title, content }: { title?: string; content?: string }) {
  const banned = ['fake', 'rumor', 'clickbait'];
  const reasons: string[] = [];
  const text = `${title || ''} ${content || ''}`.toLowerCase();

  for (const word of banned) {
    if (text.includes(word)) reasons.push(`Contains banned term: ${word}`);
  }

  if (content && !/source|via|reported by|pti/gi.test(content)) {
    reasons.push('No explicit source reference detected');
  }

  const status = reasons.length === 0 ? 'compliant' : 'needs_review';
  return { status, reasons } as { status: 'compliant' | 'needs_review'; reasons: string[] };
}
