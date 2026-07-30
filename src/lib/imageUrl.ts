/**
 * Normalizes image URLs pasted from a browser's address bar.
 *
 * Copying an image from Google/Bing image search usually yields a link to
 * the *results page*, not the image file — e.g.
 *   https://www.google.com/imgres?q=...&imgurl=https%3A%2F%2Fsite%2Fphoto.jpg
 * Those render as nothing at all. When such a wrapper carries the real
 * image address as a parameter, unwrap it; otherwise return the input
 * unchanged so ordinary URLs pass straight through.
 */

// Query parameters different search engines use to carry the real image URL
const EMBEDDED_PARAMS = ['imgurl', 'mediaurl', 'media', 'url', 'imgrefurl'];

export function normalizeImageUrl(raw: string): string {
  const value = (raw ?? '').trim();
  if (!value) return '';

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return value; // not an absolute URL (e.g. a same-origin path) — leave as-is
  }

  for (const param of EMBEDDED_PARAMS) {
    const embedded = parsed.searchParams.get(param);
    if (!embedded) continue;
    try {
      const inner = new URL(embedded); // already decoded by searchParams
      if (inner.protocol === 'https:' || inner.protocol === 'http:') {
        return inner.toString();
      }
    } catch {
      // parameter wasn't a URL — keep looking
    }
  }

  return value;
}
