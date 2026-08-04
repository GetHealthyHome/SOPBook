import React, { useRef } from 'react';

/**
 * Lightweight rich-text support: content is stored as plain text with
 * markdown-style markers and rendered as React elements — never as HTML —
 * so there is no injection surface and the server-side sanitization
 * (which strips angle brackets) is unaffected.
 *
 * Supported: **bold**, *italic*, __underline__, and "- " bullet lines.
 */

const INLINE_RE = /(\*\*.+?\*\*|__.+?__|\*[^*\n]+?\*)/g;

function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const re = new RegExp(INLINE_RE.source, 'g');
  let last = 0;
  let i = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const idx = match.index;
    if (idx > last) nodes.push(text.slice(last, idx));
    const token = match[0];
    // Explicit classes so formatting never depends on browser/reset defaults
    if (token.startsWith('**')) {
      nodes.push(<strong key={`${keyBase}-${i}`} className="font-bold">{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('__')) {
      nodes.push(<u key={`${keyBase}-${i}`} className="underline">{token.slice(2, -2)}</u>);
    } else {
      nodes.push(<em key={`${keyBase}-${i}`} className="italic">{token.slice(1, -1)}</em>);
    }
    last = idx + token.length;
    i++;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** "- item" or "• item" */
export const BULLET_LINE = /^\s*[-•]\s+(.*)$/;
/** "1. item" or "1) item" */
export const ORDERED_LINE = /^\s*(\d{1,3})[.)]\s+(.*)$/;

export function RichText({ text, className }: { text: string; className?: string }) {
  const lines = String(text ?? '').split('\n');
  const blocks: React.ReactNode[] = [];
  let items: React.ReactNode[] = [];
  let kind: 'ul' | 'ol' | null = null;
  let start = 1;

  // Consecutive list lines of the same kind become one list; anything else
  // (or a switch between bullets and numbers) closes the current one.
  const flushList = (key: string) => {
    if (!items.length) return;
    blocks.push(
      kind === 'ol'
        ? <ol key={key} start={start} className="list-decimal pl-5 space-y-0.5">{items}</ol>
        : <ul key={key} className="list-disc pl-5 space-y-0.5">{items}</ul>
    );
    items = [];
    kind = null;
  };

  lines.forEach((line, i) => {
    const bullet = line.match(BULLET_LINE);
    const ordered = line.match(ORDERED_LINE);

    if (bullet) {
      if (kind === 'ol') flushList(`list-${i}`);
      kind = 'ul';
      items.push(<li key={`li-${i}`}>{renderInline(bullet[1], `li-${i}`)}</li>);
    } else if (ordered) {
      if (kind === 'ul') flushList(`list-${i}`);
      // Honour the first number so a list can pick up where another left off
      if (kind !== 'ol') start = Math.max(1, parseInt(ordered[1], 10) || 1);
      kind = 'ol';
      items.push(<li key={`li-${i}`}>{renderInline(ordered[2], `li-${i}`)}</li>);
    } else {
      flushList(`list-${i}`);
      blocks.push(
        <span key={`ln-${i}`} className="block min-h-[1.25em]">
          {renderInline(line, `ln-${i}`)}
        </span>
      );
    }
  });
  flushList('list-end');

  return <div className={className}>{blocks}</div>;
}

// Bullet glyphs that Word, Docs and PDFs put at the start of list lines
const BULLET_GLYPHS = /^[\s]*[•·▪◦‣∙*–—]\s+/;

/** Normalize pasted plain text: tidy line endings and turn whatever bullet
 *  glyph the source used into the "- " marker this editor understands. */
export function plainToMarkers(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/ /g, ' ') // non-breaking spaces come across from Word
    .split('\n')
    .map(line => (BULLET_GLYPHS.test(line) ? line.replace(BULLET_GLYPHS, '- ') : line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n') // collapse runaway blank lines to one gap
    .trim();
}

/**
 * Convert clipboard HTML (Word, Google Docs, web pages) into the same
 * markdown-ish markers the editor stores, so pasted text keeps its bold,
 * italics, underline, bullets, line breaks and paragraph spacing.
 *
 * The HTML is only ever *read* — parsed into a detached document and walked
 * for text. Nothing is injected, and the result is plain text that still
 * passes through the server-side sanitizer like anything typed by hand.
 */
export function htmlToMarkers(html: string): string {
  if (typeof DOMParser === 'undefined') return '';
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(html, 'text/html');
  } catch {
    return '';
  }
  doc.querySelectorAll('script, style, head').forEach(el => el.remove());

  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      // Collapse the incidental newlines/indentation in source markup
      return (node.textContent ?? '').replace(/\s+/g, ' ');
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (tag === 'br') return '\n';

    const inner = Array.from(el.childNodes).map(walk).join('');
    const text = inner.trim();

    switch (tag) {
      case 'b':
      case 'strong':
        return text ? `**${text}**` : '';
      case 'i':
      case 'em':
        return text ? `*${text}*` : '';
      case 'u':
        return text ? `__${text}__` : '';
      case 'li': {
        if (!text) return '';
        // Numbered in the source stays numbered here
        const parent = el.parentElement;
        if (parent && parent.tagName.toLowerCase() === 'ol') {
          const idx = Array.prototype.indexOf.call(parent.children, el) + 1;
          return `${idx}. ${text}\n`;
        }
        return `- ${text}\n`;
      }
      case 'p':
      case 'div':
      case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6':
        // Paragraphs keep a blank line between them
        return text ? `${text}\n\n` : '';
      case 'ul':
      case 'ol':
      case 'table':
        return inner.endsWith('\n') ? `${inner}\n` : `${inner}\n\n`;
      case 'tr':
        return text ? `${text}\n` : '';
      case 'td':
      case 'th':
        return text ? `${text} ` : '';
      default:
        return inner;
    }
  };

  return plainToMarkers(walk(doc.body));
}

/**
 * A textarea with a small formatting toolbar. Buttons wrap the current
 * selection with the matching markers (or toggle "- " prefixes for
 * bullets), keeping the cursor on the text that was formatted.
 */
export function RichTextarea({ value, onChange, rows, placeholder, className }: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const wrapSelection = (marker: string) => {
    const ta = ref.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const selected = value.slice(s, e) || 'text';
    const next = value.slice(0, s) + marker + selected + marker + value.slice(e);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(s + marker.length, s + marker.length + selected.length);
    });
  };

  /** Strip whatever list marker a line already carries, so the two list
   *  buttons convert between each other instead of stacking markers. */
  const stripMarker = (l: string) =>
    l.replace(/^(\s*)-\s+/, '$1').replace(/^(\s*)\d{1,3}[.)]\s+/, '$1');

  /** Shared plumbing for both list buttons: work on the lines the selection
   *  touches, then leave the caret at the end of what changed. */
  const applyToSelectedLines = (transform: (lines: string[]) => string[]) => {
    const ta = ref.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const lineStart = value.lastIndexOf('\n', s - 1) + 1;
    const lineEndIdx = value.indexOf('\n', e);
    const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
    const updatedSegment = transform(value.slice(lineStart, lineEnd).split('\n')).join('\n');
    const next = value.slice(0, lineStart) + updatedSegment + value.slice(lineEnd);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      const caret = lineStart + updatedSegment.length;
      ta.setSelectionRange(caret, caret);
    });
  };

  const toggleNumbers = () => applyToSelectedLines(segLines => {
    // "All numbered" only counts lines that have text; an empty selection
    // (a blank line) should ADD numbering so a list can be started.
    const nonEmpty = segLines.filter(l => l.trim());
    const allNumbered = nonEmpty.length > 0 && nonEmpty.every(l => ORDERED_LINE.test(l));
    if (allNumbered) return segLines.map(stripMarker);
    let n = 0;
    return segLines.map(l => `${++n}. ${stripMarker(l)}`);
  });

  const toggleBullets = () => {
    const ta = ref.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const lineStart = value.lastIndexOf('\n', s - 1) + 1;
    const lineEndIdx = value.indexOf('\n', e);
    const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
    const segment = value.slice(lineStart, lineEnd);
    const segLines = segment.split('\n');
    // "All bulleted" only counts lines that have text; an empty selection
    // (a blank line) should ADD a bullet so a list can be started.
    const nonEmpty = segLines.filter(l => l.trim());
    const allBulleted = nonEmpty.length > 0 && nonEmpty.every(l => /^\s*-\s+/.test(l));
    const updatedSegment = segLines
      .map(l => {
        if (allBulleted) return l.replace(/^(\s*)-\s+/, '$1');   // remove bullets
        if (/^\s*-\s+/.test(l)) return l;                        // already bulleted
        return `- ${stripMarker(l)}`;                             // add (converts a numbered line)
      })
      .join('\n');
    const next = value.slice(0, lineStart) + updatedSegment + value.slice(lineEnd);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      // Put the cursor at the end of the updated segment so the user can type
      const caret = lineStart + updatedSegment.length;
      ta.setSelectionRange(caret, caret);
    });
  };

  /**
   * Keep formatting when pasting from Word, Google Docs or a web page:
   * convert the clipboard's HTML into this editor's markers rather than
   * letting the browser drop everything to flat text.
   */
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const ta = ref.current;
    if (!ta) return;
    const html = e.clipboardData.getData('text/html');
    const plain = e.clipboardData.getData('text/plain');
    const converted = html ? htmlToMarkers(html) : plainToMarkers(plain);
    // Nothing useful to convert — let the browser paste normally
    if (!converted || converted === plain) return;

    e.preventDefault();
    const s = ta.selectionStart;
    const eSel = ta.selectionEnd;
    const next = value.slice(0, s) + converted + value.slice(eSel);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      const caret = s + converted.length;
      ta.setSelectionRange(caret, caret);
    });
  };

  const btn = 'h-6 min-w-[24px] px-1.5 rounded-md border border-gray-200 bg-white text-gray-600 text-xs leading-none hover:border-emerald-300 hover:text-emerald-800 transition-colors';

  return (
    <div>
      <div className="flex items-center gap-1 mb-1">
        <button type="button" tabIndex={-1} onClick={() => wrapSelection('**')} className={`${btn} font-black`} title="Bold">B</button>
        <button type="button" tabIndex={-1} onClick={() => wrapSelection('*')} className={`${btn} italic font-bold`} title="Italic">I</button>
        <button type="button" tabIndex={-1} onClick={() => wrapSelection('__')} className={`${btn} underline font-bold`} title="Underline">U</button>
        <button type="button" tabIndex={-1} onClick={toggleBullets} className={`${btn} font-bold`} title="Bullet list">•≡</button>
        <button type="button" tabIndex={-1} onClick={toggleNumbers} className={`${btn} font-bold`} title="Numbered list">1≡</button>
      </div>
      <textarea
        ref={ref}
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        onPaste={handlePaste}
        className={className}
      />
    </div>
  );
}
