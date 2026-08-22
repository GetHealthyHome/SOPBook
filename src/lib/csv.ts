/**
 * CSV parsing and generation for bulk import.
 *
 * Hand-written rather than pulled in as a dependency, because the job is small
 * and the failure mode of getting it wrong is silent: a naive `split(',')`
 * mangles any row containing a comma inside quotes, which for this app means
 * every safety module whose body has a sentence in it.
 *
 * Follows RFC 4180 closely enough for what spreadsheets actually produce:
 * quoted fields, doubled quotes as an escape, embedded commas and newlines,
 * CRLF or LF line endings, and Excel's UTF-8 byte order mark.
 */

/** Parse a CSV document into rows of raw string cells. */
export function parseCsv(input: string): string[][] {
  // Excel writes a BOM on UTF-8 files. Left in place it becomes part of the
  // first header name, and every lookup for that column silently misses.
  const text = input.replace(/^﻿/, '');

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  const endField = () => { row.push(field); field = ''; };
  const endRow = () => { endField(); rows.push(row); row = []; };

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }  // escaped quote
        inQuotes = false; i++; continue;
      }
      field += ch; i++; continue;
    }

    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === ',') { endField(); i++; continue; }
    if (ch === '\r') { i++; continue; }   // handled by the \n that follows
    if (ch === '\n') { endRow(); i++; continue; }
    field += ch; i++;
  }

  // A file not ending in a newline still has a final record.
  if (field !== '' || row.length) endRow();

  // Drop rows that are entirely empty — a trailing blank line, or the gap
  // somebody left between groups while editing in a spreadsheet.
  return rows.filter(r => r.some(cell => cell.trim() !== ''));
}

/**
 * Parse into objects keyed by header name.
 *
 * Headers are matched case-insensitively and ignoring spaces and underscores,
 * so `Module Title`, `module_title` and `moduletitle` are the same column.
 * People edit these in Excel; being strict about capitalisation would reject
 * files that are obviously correct.
 */
export function parseCsvRows(input: string): { headers: string[]; rows: Record<string, string>[] } {
  const raw = parseCsv(input);
  if (!raw.length) return { headers: [], rows: [] };

  const headers = raw[0].map(h => h.trim());
  const keys = headers.map(normaliseHeader);
  const rows = raw.slice(1).map(cells => {
    const obj: Record<string, string> = {};
    keys.forEach((key, idx) => { if (key) obj[key] = (cells[idx] ?? '').trim(); });
    return obj;
  });
  return { headers, rows };
}

export const normaliseHeader = (h: string) => h.toLowerCase().replace(/[\s_-]+/g, '');

/** Quote a single cell only when it needs it. */
function quote(value: string): string {
  const v = value ?? '';
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/**
 * Build a CSV document.
 *
 * Emits a BOM and CRLF line endings so Excel opens it with the right encoding
 * and does not run every row together — without the BOM, an em dash or a
 * degree sign in an example row arrives as mojibake.
 */
export function toCsv(headers: string[], rows: string[][]): string {
  const lines = [headers.map(quote).join(','), ...rows.map(r => r.map(quote).join(','))];
  return '﻿' + lines.join('\r\n') + '\r\n';
}
