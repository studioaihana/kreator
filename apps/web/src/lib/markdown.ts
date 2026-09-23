/** Minimal markdown renderer (headings, lists, tables, code, emphasis, links). */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inline(text: string): string {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|\s)\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer noopener">$1</a>');
}

export function renderMarkdown(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];
  let inCode = false;
  let listType: 'ul' | 'ol' | null = null;
  let tableBuffer: string[] = [];

  const closeList = () => {
    if (listType) {
      html.push(`</${listType}>`);
      listType = null;
    }
  };

  const flushTable = () => {
    if (tableBuffer.length === 0) return;
    const rows = tableBuffer
      .map((row) => row.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim()))
      .filter((cells) => !cells.every((cell) => /^-{2,}$/.test(cell)));
    if (rows.length > 0) {
      const [header, ...body] = rows;
      html.push('<table><thead><tr>');
      header?.forEach((cell) => html.push(`<th>${inline(cell)}</th>`));
      html.push('</tr></thead><tbody>');
      body.forEach((cells) => {
        html.push('<tr>');
        cells.forEach((cell) => html.push(`<td>${inline(cell)}</td>`));
        html.push('</tr>');
      });
      html.push('</tbody></table>');
    }
    tableBuffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.startsWith('```')) {
      closeList();
      flushTable();
      if (inCode) {
        html.push('</code></pre>');
        inCode = false;
      } else {
        html.push('<pre><code>');
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      html.push(`${escapeHtml(rawLine)}\n`);
      continue;
    }
    if (line.trim().startsWith('|')) {
      closeList();
      tableBuffer.push(line);
      continue;
    }
    flushTable();

    if (!line.trim()) {
      closeList();
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      closeList();
      const level = heading[1]!.length;
      html.push(`<h${level}>${inline(heading[2] ?? '')}</h${level}>`);
      continue;
    }

    if (/^>\s?/.test(line)) {
      closeList();
      html.push(`<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`);
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      closeList();
      html.push('<hr/>');
      continue;
    }

    const bullet = line.match(/^\s*[-*+]\s+(.*)$/);
    if (bullet) {
      if (listType !== 'ul') {
        closeList();
        html.push('<ul>');
        listType = 'ul';
      }
      html.push(`<li>${inline(bullet[1] ?? '')}</li>`);
      continue;
    }

    const ordered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ordered) {
      if (listType !== 'ol') {
        closeList();
        html.push('<ol>');
        listType = 'ol';
      }
      html.push(`<li>${inline(ordered[1] ?? '')}</li>`);
      continue;
    }

    closeList();
    html.push(`<p>${inline(line)}</p>`);
  }

  closeList();
  flushTable();
  if (inCode) html.push('</code></pre>');
  return html.join('\n');
}
