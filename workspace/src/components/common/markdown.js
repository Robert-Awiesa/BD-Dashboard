// Minimal markdown -> HTML renderer for in-app memos.
//
// Deliberately dependency-free: the memo editor needs headings, bold/italic,
// lists, links, quotes and code — not a full CommonMark implementation — and
// pulling a parser + sanitiser into the bundle for that is not a good trade.
//
// SAFETY: every character of user input is HTML-escaped *first*, so the only
// tags that can reach the DOM are the ones this file emits. That is what makes
// the `dangerouslySetInnerHTML` at the call site safe.

const escapeHtml = (text) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// Only http(s) and mailto survive — blocks javascript: and data: payloads
// smuggled in through link syntax.
const safeUrl = (url) => {
  const trimmed = url.trim();
  return /^(https?:\/\/|mailto:|\/)/i.test(trimmed) ? trimmed : '#';
};

// Inline formatting, applied to already-escaped text.
const renderInline = (text) => {
  let out = text;

  // `code`
  out = out.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-slate-100 text-navy-800 text-[0.85em] font-mono">$1</code>');

  // [label](url)
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label, url) =>
    `<a href="${safeUrl(url)}" target="_blank" rel="noopener noreferrer" class="text-navy-700 underline underline-offset-2 hover:text-navy-900">${label}</a>`
  );

  // **bold** then *italic* / _italic_ (bold first so ** isn't eaten as two *)
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-navy-900">$1</strong>');
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  out = out.replace(/(^|\W)_([^_\n]+)_/g, '$1<em>$2</em>');

  return out;
};

const HEADING_CLASSES = {
  1: 'text-xl font-bold text-navy-900 mt-5 mb-2 first:mt-0',
  2: 'text-lg font-bold text-navy-900 mt-5 mb-2 first:mt-0',
  3: 'text-base font-semibold text-navy-900 mt-4 mb-1.5 first:mt-0',
};

export const renderMarkdown = (source) => {
  if (!source || !source.trim()) return '';

  const lines = escapeHtml(source).split(/\r?\n/);
  const html = [];
  let listType = null; // 'ul' | 'ol' | null
  let paragraph = [];

  const closeList = () => {
    if (listType) {
      html.push(`</${listType}>`);
      listType = null;
    }
  };

  const flushParagraph = () => {
    if (paragraph.length) {
      html.push(`<p class="text-sm text-slate-700 leading-relaxed mb-3">${renderInline(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  };

  const openList = (type) => {
    if (listType !== type) {
      closeList();
      const classes = type === 'ul'
        ? 'list-disc pl-5 space-y-1 mb-3 text-sm text-slate-700'
        : 'list-decimal pl-5 space-y-1 mb-3 text-sm text-slate-700';
      html.push(`<${type} class="${classes}">`);
      listType = type;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      closeList();
      continue;
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1].length;
      html.push(`<h${level} class="${HEADING_CLASSES[level]}">${renderInline(heading[2])}</h${level}>`);
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      flushParagraph();
      closeList();
      html.push('<hr class="my-4 border-slate-200" />');
      continue;
    }

    const quote = trimmed.match(/^&gt;\s?(.*)$/);
    if (quote) {
      flushParagraph();
      closeList();
      html.push(
        `<blockquote class="border-l-3 border-navy-200 pl-3 py-1 my-3 text-sm text-slate-600 italic">${renderInline(quote[1])}</blockquote>`
      );
      continue;
    }

    const bullet = trimmed.match(/^[-*+]\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      openList('ul');
      html.push(`<li>${renderInline(bullet[1])}</li>`);
      continue;
    }

    const numbered = trimmed.match(/^\d+[.)]\s+(.*)$/);
    if (numbered) {
      flushParagraph();
      openList('ol');
      html.push(`<li>${renderInline(numbered[1])}</li>`);
      continue;
    }

    closeList();
    paragraph.push(trimmed);
  }

  flushParagraph();
  closeList();

  return html.join('');
};

// Short preview line for repository cards — strips syntax rather than
// rendering it, so a card never shows raw ## or ** noise.
export const markdownExcerpt = (source, limit = 160) => {
  if (!source) return '';
  const plain = source
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+[.)]\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > limit ? plain.slice(0, limit).trimEnd() + '…' : plain;
};
