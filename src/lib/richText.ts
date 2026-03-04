function escapeHtml(input: string): string {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function stripHtmlToText(input: string): string {
  return String(input || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatInlineWithMarkSyntax(input: string): string {
  const src = String(input || '');
  const re = /==([\s\S]+?)==/g;
  let last = 0;
  let out = '';

  for (;;) {
    const m = re.exec(src);
    if (!m) break;

    out += escapeHtml(src.slice(last, m.index));
    out += `<mark>${escapeHtml(m[1] ?? '')}</mark>`;
    last = m.index + m[0].length;
  }

  out += escapeHtml(src.slice(last));
  return out;
}

function isBlankLine(line: string): boolean {
  return !String(line || '').trim();
}

function isBulletLine(line: string): boolean {
  return /^\s*[-•]\s+/.test(String(line || ''));
}

function isOneLinerBoldLine(line: string): boolean {
  return /^\s*##\s+/.test(String(line || ''));
}

function stripBulletPrefix(line: string): string {
  return String(line || '').replace(/^\s*[-•]\s+/, '').trim();
}

function stripOneLinerPrefix(line: string): string {
  return String(line || '').replace(/^\s*##\s+/, '').trim();
}

export function autoFormatPlainTextToHtml(input: string): string {
  const raw = String(input || '').replace(/\r\n?/g, '\n');
  const lines = raw.split('\n');

  let i = 0;
  const out: string[] = [];

  const pushParagraph = (paraLines: string[]) => {
    const joined = paraLines
      .map((l) => String(l ?? '').trim())
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    const inner = formatInlineWithMarkSyntax(joined);
    if (!inner.trim()) return;
    out.push(`<p>${inner}</p>`);
  };

  while (i < lines.length) {
    while (i < lines.length && isBlankLine(lines[i])) i += 1;
    if (i >= lines.length) break;

    const line = lines[i] ?? '';

    if (isOneLinerBoldLine(line)) {
      const text = stripOneLinerPrefix(line);
      const inner = formatInlineWithMarkSyntax(text);
      out.push(`<p><strong>${inner}</strong></p>`);
      i += 1;
      continue;
    }

    if (isBulletLine(line)) {
      const items: string[] = [];
      while (i < lines.length && isBulletLine(lines[i] ?? '')) {
        const itemText = stripBulletPrefix(lines[i] ?? '');
        items.push(`<li>${formatInlineWithMarkSyntax(itemText)}</li>`);
        i += 1;
      }
      if (items.length) out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    const paraLines: string[] = [];
    while (i < lines.length) {
      const l = lines[i] ?? '';
      if (isBlankLine(l) || isBulletLine(l) || isOneLinerBoldLine(l)) break;
      paraLines.push(l);
      i += 1;
    }
    pushParagraph(paraLines);
  }

  return out.length ? out.join('') : '<p></p>';
}
