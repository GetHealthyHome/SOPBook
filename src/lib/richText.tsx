import React, { useEffect, useRef } from 'react';

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
export function walkToMarkers(root: Node): string {
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
      case 'div':
        // contentEditable wraps each visual line in a div — one newline only,
        // otherwise editing a document would keep adding blank lines
        return `${text}\n`;
      case 'p':
      case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6':
        // Real paragraphs (as pasted from Word/Docs) keep a blank line
        return text ? `${text}\n\n` : '';
      case 'ul':
      case 'ol':
      case 'table':
        // Each item already ends with a newline; no extra gap
        return inner.endsWith('\n') ? inner : `${inner}\n`;
      case 'tr':
        return text ? `${text}\n` : '';
      case 'td':
      case 'th':
        return text ? `${text} ` : '';
      default:
        return inner;
    }
  };

  return plainToMarkers(walk(root));
}

/**
 * Convert clipboard HTML (Word, Google Docs, web pages) into markers.
 * The HTML is only ever *read* — parsed into a detached document and walked
 * for text, with scripts and styles dropped first. Nothing is injected.
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
  return walkToMarkers(doc.body);
}

/**
 * Build editor DOM from stored markers.
 *
 * Nodes are created with the DOM API and text is set via textContent, so no
 * HTML string is ever parsed or injected — the marker text is data, never
 * markup. That keeps the "never inject HTML" rule intact while still showing
 * real bold/italic/underline/lists inside the editor.
 */
function buildNodes(text: string): DocumentFragment {
  const frag = document.createDocumentFragment();

  const inlineNodes = (line: string): Node[] => {
    const out: Node[] = [];
    const re = new RegExp(INLINE_RE.source, 'g');
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      if (m.index > last) out.push(document.createTextNode(line.slice(last, m.index)));
      const token = m[0];
      let el: HTMLElement;
      if (token.startsWith('**')) { el = document.createElement('strong'); el.textContent = token.slice(2, -2); }
      else if (token.startsWith('__')) { el = document.createElement('u'); el.textContent = token.slice(2, -2); }
      else { el = document.createElement('em'); el.textContent = token.slice(1, -1); }
      out.push(el);
      last = m.index + token.length;
    }
    if (last < line.length) out.push(document.createTextNode(line.slice(last)));
    return out;
  };

  let list: HTMLElement | null = null;
  let listKind: 'ul' | 'ol' | null = null;

  for (const line of String(text ?? '').split('\n')) {
    const bullet = line.match(BULLET_LINE);
    const ordered = line.match(ORDERED_LINE);
    if (bullet || ordered) {
      const kind: 'ul' | 'ol' = bullet ? 'ul' : 'ol';
      if (listKind !== kind) {
        list = document.createElement(kind);
        frag.appendChild(list);
        listKind = kind;
      }
      const li = document.createElement('li');
      inlineNodes(bullet ? bullet[1] : ordered![2]).forEach(n => li.appendChild(n));
      list!.appendChild(li);
    } else {
      list = null;
      listKind = null;
      const div = document.createElement('div');
      const nodes = inlineNodes(line);
      if (!nodes.length) div.appendChild(document.createElement('br'));
      else nodes.forEach(n => div.appendChild(n));
      frag.appendChild(div);
    }
  }
  return frag;
}

/**
 * Rich text editor that shows formatting as you apply it — bold text looks
 * bold rather than showing asterisks. The content is still *stored* as plain
 * text with markers, so nothing downstream changes: the server sanitizer,
 * the database columns and the read-only renderer all stay as they were.
 */
export function RichTextarea({ value, onChange, rows, placeholder, className }: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // What we last reported upward. Repainting only when the incoming value
  // differs from this keeps the caret still while typing.
  const lastEmitted = useRef<string | null>(null);

  const paint = (text: string) => {
    const el = ref.current;
    if (!el) return;
    el.textContent = '';
    el.appendChild(buildNodes(text));
    el.dataset.empty = text.trim() ? 'false' : 'true';
  };

  useEffect(() => {
    if (value !== lastEmitted.current) paint(value);
  }, [value]);

  const emit = () => {
    const el = ref.current;
    if (!el) return;
    const markers = walkToMarkers(el);
    lastEmitted.current = markers;
    el.dataset.empty = markers.trim() ? 'false' : 'true';
    onChange(markers);
  };

  /** Apply a formatting command to the current selection. execCommand is
   *  deprecated but is the only cross-browser way to do this without pulling
   *  in an editor framework, and it degrades harmlessly if unavailable. */
  const exec = (command: string) => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    try {
      // Prefer <b>/<i>/<u> tags over inline styles so the walker sees them
      document.execCommand('styleWithCSS', false, 'false');
      document.execCommand(command);
    } catch {
      return;
    }
    emit();
  };

  /** Paste keeps its formatting: clipboard HTML becomes markers, then real
   *  nodes inserted at the caret. */
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const html = e.clipboardData.getData('text/html');
    const plain = e.clipboardData.getData('text/plain');
    const markers = html ? htmlToMarkers(html) : plainToMarkers(plain);
    if (!markers) return;

    e.preventDefault();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const frag = buildNodes(markers);
    const last = frag.lastChild;
    range.insertNode(frag);
    if (last) {
      // Drop the caret after what was pasted
      const after = document.createRange();
      after.setStartAfter(last);
      after.collapse(true);
      selection.removeAllRanges();
      selection.addRange(after);
    }
    emit();
  };

  const btn = 'h-6 min-w-[24px] px-1.5 rounded-md border border-gray-200 bg-white text-gray-600 text-xs leading-none hover:border-emerald-300 hover:text-emerald-800 transition-colors';
  // Buttons must not steal the selection from the editor
  const hold = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div>
      <div className="flex items-center gap-1 mb-1">
        <button type="button" tabIndex={-1} onMouseDown={hold} onClick={() => exec('bold')} className={`${btn} font-black`} title="Bold">B</button>
        <button type="button" tabIndex={-1} onMouseDown={hold} onClick={() => exec('italic')} className={`${btn} italic font-bold`} title="Italic">I</button>
        <button type="button" tabIndex={-1} onMouseDown={hold} onClick={() => exec('underline')} className={`${btn} underline font-bold`} title="Underline">U</button>
        <button type="button" tabIndex={-1} onMouseDown={hold} onClick={() => exec('insertUnorderedList')} className={`${btn} font-bold`} title="Bullet list">•≡</button>
        <button type="button" tabIndex={-1} onMouseDown={hold} onClick={() => exec('insertOrderedList')} className={`${btn} font-bold`} title="Numbered list">1≡</button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={placeholder}
        data-placeholder={placeholder}
        data-rich-editor="true"
        onInput={emit}
        onBlur={emit}
        onPaste={handlePaste}
        style={{ minHeight: `${Math.max(2, rows ?? 3) * 1.6}em` }}
        className={className}
      />
    </div>
  );
}
